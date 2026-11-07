// render.js
//
// Punto único de repintado de la partida y de las preguntas a la jugadora.
// Desde 1.32.3 la única vista es la Mesa 3D (js/mesa3d.js): render() le
// pide que se pinte y picker() abre su hoja inferior de opciones. Aquí
// queda además la elección de la Clarividente, que se dispara al repintar.
import { actualizarClarividente } from './utils.js';
import { aplicarEleccionClarividente } from './motor/habilidades.js';
import { renderMesa3D, pickerMesa, hayPickerMesaAbierto } from './mesa3d.js';

/**
 * Resuelve, para una jugadora que acaba de perder la visibilidad de su
 * Clarividente, cuál de sus dos cartas de mano prefiere seguir viendo
 * (REGLAMENTO.md, "Clarividente": "el jugador debe voltear una carta a su
 * elección" — corte inmediato, sin periodo de gracia, ver nota de
 * interpretación). Jugadora humana: picker() con etiquetas neutras (no
 * revela el nombre del personaje, para no filtrar información en la
 * pantalla compartida). Autómata: heurística mínima — se queda con la
 * carta que sea el personaje requerido por la invocación activa si aplica,
 * si no, al azar (documentado también en bot.js como punto de extensión
 * futuro si se quisiera algo más elaborado).
 */
function resolverEleccionClarividente(player) {
  const [c0, c1] = player.hand;
  if (!c0 || !c1) {
    // Estado inesperado (debería haber siempre exactamente 2 cartas en
    // mano fuera de mitad de turno): no hay elección real posible, se
    // limpia el marcador de transición sin más.
    player._clariEligiendo = false;
    player._clariVisiblePrev = false;
    return;
  }

  const aplicarEleccion = idxElegida => {
    // La regla (qué carta ve cada quien) está en el motor.
    aplicarEleccionClarividente(player, idxElegida);
    player._clariEligiendo = false;
    player._clariVisiblePrev = false;
    render(window.players, window.neutrals, window.levelIdx);
  };

  if (player.tipo === 'auto') {
    const lvl = window.LEVELS?.[window.levelIdx];
    const need = lvl ? window.INVOCATION_SETS?.[window.invocationSet]?.[lvl]?.need : null;
    const esRequerida = c => !!need && need.includes(c.aspecto || c.name);
    let idxElegida;
    if (need && esRequerida(c0) && !esRequerida(c1)) idxElegida = 0;
    else if (need && esRequerida(c1) && !esRequerida(c0)) idxElegida = 1;
    else idxElegida = Math.random() < 0.5 ? 0 : 1;
    aplicarEleccion(idxElegida);
    return;
  }

  const elegir = () => picker(
    `${player.name}: la Clarividente ha dejado de estar visible. ¿Qué carta prefieres seguir viendo?`,
    [
      { val: '0', lbl: 'Mi carta de la izquierda' },
      { val: '1', lbl: 'Mi carta de la derecha' },
    ],
    val => aplicarEleccion(parseInt(val, 10)),
    // No hay forma válida de "no elegir": cancelar simplemente reabre el
    // mismo picker, porque el reglamento exige que la jugadora SÍ elija.
    elegir,
  );
  elegir();
}

/**
 * Detecta, para cada jugadora, la transición "tenía Clarividente visible →
 * ya no la tiene" (comparando `hasClariActivo` recién calculado contra
 * `player._clariVisiblePrev`, guardado en la llamada anterior) y dispara de
 * inmediato `resolverEleccionClarividente()` — nunca se espera al turno
 * propio de la jugadora ni al de nadie más. Si ya hay un picker en curso
 * (de otra habilidad, o de otra Clarividente resolviéndose) se pospone sin
 * más: como `_clariVisiblePrev` no se actualiza para esa jugadora mientras
 * está pendiente, se reintenta automáticamente en la siguiente llamada a
 * `render()` (que ocurre constantemente tras cualquier acción del juego).
 */
function gestionarTransicionesClarividente(players) {
  actualizarClarividente(players);
  const pickerEnCurso = !!window.pickerObjetivoPortal || hayPickerMesaAbierto();
  players.forEach(player => {
    if (player._clariVisiblePrev === true && !player.hasClariActivo && !player._clariEligiendo) {
      if (pickerEnCurso) return;
      player._clariEligiendo = true;
      resolverEleccionClarividente(player);
      return;
    }
    if (!player._clariEligiendo) {
      player._clariVisiblePrev = player.hasClariActivo;
    }
  });
}

/**
 * Pide a la jugadora que elija una opción entre varias (hoja inferior de la
 * Mesa 3D, `pickerMesa()`).
 *
 * Cada opción tiene `val` (valor devuelto), `lbl` (texto visible) y
 * opcionalmente `disabled: true` (se muestra pero no se puede elegir).
 *
 * @param {string} title - Pregunta
 * @param {Array<{val: string, lbl: string, disabled?: boolean}>} options - Opciones
 * @param {Function} cb - Recibe el valor elegido
 * @param {Function} [onCancel] - Se llama al cancelar, en vez de `cb`
 */
export function picker(title, options, cb, onCancel) {
  pickerMesa(title, options, cb, onCancel);
}

/**
 * Como picker(), pero además habilita tocar directamente los Portales
 * válidos de la mesa como alternativa a la hoja de opciones (ver
 * `elegirPortalObjetivo()` en actions.js y `tocarPortal()` en mesa3d.js).
 * `opciones` debe tener el formato de `portalesConEstado()` (utils.js):
 * val = "playerIdx:portalIdx" o "n:idx", con `disabled` ya calculado por la
 * regla real de la habilidad (incluida la protección de Centinela). El
 * toque en la mesa y la opción de la hoja convergen en la MISMA `cb`, así que
 * no hay validación duplicada.
 */
export function pickerPortal(title, opciones, cb, onCancel) {
  window.pickerObjetivoPortal = { opciones, cb };
  render(window.players, window.neutrals, window.levelIdx);
  picker(title, opciones, val => {
    window.pickerObjetivoPortal = null;
    cb(val);
  }, () => {
    window.pickerObjetivoPortal = null;
    render(window.players, window.neutrals, window.levelIdx);
    onCancel?.();
  });
}

/**
 * Repinta la partida. Antes actualiza la Clarividente de cada jugadora y, si
 * alguna acaba de perderla, dispara su elección de qué carta seguir viendo
 * (sin periodo de gracia, ver gestionarTransicionesClarividente()). Esa
 * elección sí cambia carta.vis de verdad, como pide REGLAMENTO.md ("el
 * jugador debe voltear una carta a su elección").
 *
 * Los parámetros se mantienen por compatibilidad con quien la llama; la
 * mesa lee siempre `estado.partida`.
 */
export function render(players, neutrals, levelIdx) {
  gestionarTransicionesClarividente(players);
  renderMesa3D();
}
