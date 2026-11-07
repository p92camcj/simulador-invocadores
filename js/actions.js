// actions.js
import { prepararEjemploPersona, guardarEjemploPersona } from './aprendizaje-navegador.js';
import { nextTurn, finalizarPartida } from './game.js';
import { render, picker } from './render.js';
import { applyAbility, eleccionesUltimaHabilidad } from './abilities.js';
import { describirObjetivoHabilidad, construirEstadoVisibleParaBot } from './bot.js';
import { tieneGemaAsterisco, contarGemasUnitarias } from './utils.js';
import { estado } from './motor/estado.js';
import {
  jugarCarta, terminarTurno, pasarTurno, validarFaseB, opcionesFaseB, completarActivacion, invocacionActiva,
} from './motor/acciones.js';
import {
  anunciarCartaJugada, envolverHabilidad, anunciarInvocacion, cuandoTermineEspectaculo,
  hayEspectaculoEnCurso
} from './espectaculo.js';
import { preguntarMesa } from './mesa3d.js';
import {
  registrarEnHistorial, claveDeDestino, claveDeOrigenHabilidad, fotoPortales, portalesCambiados,
  pilaDeClave, textoJugada, textoHabilidad, textoInvocacion, trazosHabilidad,
} from './historial.js';

/**
 * Fase A: la jugadora activa baja la carta `cartaIdx` de su mano a
 * `destKey` ('p:<idx>' | 'n:<idx>' | 'a:<pi>:<pj>'). Las reglas están en el
 * motor (jugarCarta); aquí solo se presenta el resultado. La usan los tres
 * métodos humanos (tocar y arrastrar en la mesa) y el autómata. Devuelve true si
 * la jugada fue válida; si no, no avisa y no cambia nada.
 */
export function ejecutarJugada(cartaIdx, destKey) {
  if (cartaIdx === null || cartaIdx === undefined) return false;
  // Aprendizaje de las autómatas: lo que sabía la persona y lo que eligió.
  const ejemplo = prepararEjemploPersona(estado.partida, cartaIdx, destKey);
  const jugadora = estado.partida.turn;
  const conocida = estado.partida.players[jugadora]?.hand[cartaIdx]?.vis?.owner === true;
  const eventos = jugarCarta(estado.partida, { cartaIdx, destino: destKey });
  const jugada = eventos.find(e => e.tipo === 'cartaJugada');
  if (!jugada) return false;
  guardarEjemploPersona(ejemplo);
  // Historial de jugadas (y narración en pantalla si es una autómata).
  const clave = claveDeDestino(destKey, jugadora);
  const carta = pilaDeClave(estado.partida, clave)?.at(-1);
  if (carta) {
    registrarEnHistorial(estado.partida, {
      tipo: 'jugada', jugadora, portales: [clave],
      trazos: [{ desde: `mano:${jugadora}`, hacia: clave, motivo: 'jugada' }],
      texto: textoJugada(estado.partida, { jugadora, carta, conocida, clave }),
    });
  }
  window.selectedCardIdx = null;
  // Modo espectáculo (solo presentación, ver js/espectaculo.js).
  anunciarCartaJugada(jugada.jugadora, jugada.destino);
  // render() también dispara, si aplica, la elección inmediata de
  // Clarividente para cualquier jugadora afectada.
  render(estado.partida.players, estado.partida.neutrals, estado.partida.levelIdx);
  return true;
}

/**
 * Envuelve el `onComplete` de una activación de habilidad (Fase B) para
 * anotarla en el historial con los Portales que cambiaron. Se crea ANTES de
 * aplicar la habilidad (foto de la mesa de antes) y anota cuando la
 * habilidad tiene efecto de verdad, antes de cobrar y repintar (así el
 * repintado ya resalta los Portales). `detalle()` (opcional) da la frase de
 * lo elegido y `elegidos()` los valores elegidos en los picker(). La usan la Fase B humana y la del autómata (bot.js).
 */
export function conHistorialHabilidad(personaje, jugadora, origen, { detalle, elegidos } = {}, onComplete) {
  const antes = fotoPortales(estado.partida);
  const claveOrigen = origen ? claveDeOrigenHabilidad(origen, jugadora) : null;
  return (...args) => {
    try {
      const partida = estado.partida;
      const cambiados = portalesCambiados(antes, fotoPortales(partida));
      registrarEnHistorial(partida, {
        tipo: 'habilidad', jugadora, personaje,
        portales: [...new Set([claveOrigen, ...cambiados].filter(Boolean))],
        texto: textoHabilidad(partida, {
          jugadora, personaje, origen: claveOrigen, detalle: detalle?.() || '', cambiados,
        }),
        trazos: trazosHabilidad(partida, {
          personaje, jugadora, origen: claveOrigen, cambiados, elegidos: elegidos?.() || [],
        }),
      });
    } catch (e) {
      console.warn('Historial de habilidad no disponible:', e);
    }
    return onComplete(...args);
  };
}

/**
 * Pago del acceso a un Portal central: si la jugadora tiene a la vez Gemas
 * de 1 y una Gema de asterisco, se le pregunta cuál usar. Es una decisión de
 * la interfaz humana; el autómata pasa siempre false.
 */
function preguntarUsoAsterisco(player, responder) {
  if (!tieneGemaAsterisco(player) || contarGemasUnitarias(player) === 0) {
    responder(false);
    return;
  }
  preguntarMesa(`${player.name}: ¿cómo pagas el acceso al Portal central?`, [
    { val: 'asterisco', lbl: '✦ Revelar mi Gema de asterisco (gratis)' },
    { val: 'unidad', lbl: '💎 Pagar 1 Gema de valor 1' },
  ], val => responder(val === 'asterisco'));
}

/**
 * Fin del turno: el motor repone manos y resuelve la invocación
 * (terminarTurno); aquí se presentan los eventos. Cuando acaban las escenas
 * se pasa el turno (pasarTurno + nextTurn). Es el botón "Terminar turno" de
 * la mesa y también lo llama el autómata.
 */
export function ejecutarFinDeTurno() {
  if (estado.partida.juegoTerminado) return;
  if (window.avanceTurnoPendiente) return;
  const eventos = terminarTurno(estado.partida);
  const invalida = eventos.find(e => e.tipo === 'accionInvalida');
  if (invalida) {
    alert(invalida.motivo);
    return;
  }
  const invocacion = eventos.find(e => e.tipo === 'invocacionCompletada');
  if (invocacion) {
    // En modo espectáculo la escena sustituye al aviso de texto.
    registrarEnHistorial(estado.partida, { tipo: 'invocacion', texto: textoInvocacion(invocacion) });
    const escenificada = anunciarInvocacion(invocacion);
    if (!escenificada) alert(textoInvocacion(invocacion));
  }
  const fin = eventos.find(e => e.tipo === 'partidaTerminada');
  if (fin) {
    // Se deja terminar la escena antes del marcador final (confirm() bloqueante).
    cuandoTermineEspectaculo().then(() => finalizarPartida(fin.motivo));
    return;
  }
  // El turno se pasa después de las escenas, para no enseñar antes de
  // tiempo la mano de la siguiente jugadora. Si no tiene cartas, nextTurn()
  // termina la partida.
  const avanzarTurno = () => {
    pasarTurno(estado.partida);
    nextTurn();
  };
  if (hayEspectaculoEnCurso()) {
    window.avanceTurnoPendiente = true;
    cuandoTermineEspectaculo().then(() => {
      window.avanceTurnoPendiente = false;
      avanzarTurno();
    });
  } else {
    avanzarTurno();
  }
}

// ---------- Acciones de la interfaz (las usa la Mesa 3D, js/mesa3d.js) ----------
// Siempre leen la partida actual (estado.partida), nunca arrays capturados
// al empezar: así cargarPartida() no deja referencias viejas.
const P = () => estado.partida;
const repintar = () => render(P().players, P().neutrals, window.levelIdx);

/**
 * Toque en una carta de la propia mano: la selecciona; otro toque sobre la
 * misma la deselecciona. No hace nada si ya se jugó carta este turno.
 */
export function seleccionarCartaMano(idx) {
  if (window.played) return;
  const pl = P().players[window.turn];
  if (!pl?.hand[idx]) return;
  window.selectedCardIdx = (window.selectedCardIdx === idx) ? null : idx;
  repintar();
}

/** Toque en un Portal: juega ahí la carta seleccionada (si hay una). */
export function jugarEnPortal(destKey) {
  ejecutarJugada(window.selectedCardIdx, destKey);
}

/** Deshace la selección de carta de la mano. */
export function cancelarSeleccion() {
  window.selectedCardIdx = null;
  repintar();
}

/**
 * Toque en el Portal objetivo de una habilidad en curso (Ocultista,
 * Cronista, Estratega, 1er paso del Cronomante). window.pickerObjetivoPortal
 * lo fija pickerPortal() (render.js) mientras ese picker esté abierto; los
 * Portales no válidos (opcion.disabled) no responden.
 */
export function elegirPortalObjetivo(key) {
  const objetivo = window.pickerObjetivoPortal;
  if (!objetivo) return;
  const opcion = objetivo.opciones.find(o => o.val === key);
  if (!opcion || opcion.disabled) return;
  window.pickerObjetivoPortal = null;
  objetivo.cb(key);
}

/**
 * Activar habilidad (Fase B, opcional, una vez por turno): la del personaje
 * visible en uno de tus propios Portales (gratis) o en un Portal central
 * (pagando, ver utils.js).
 */
export function activarHabilidad() {
  if (window.juegoTerminado) return;
  const invalida = validarFaseB(estado.partida)[0];
  if (invalida) {
    alert(invalida.motivo);
    return;
  }

  const need = invocacionActiva(estado.partida)?.need || [];

  // Si hay una investigación de Cronomante pendiente este turno (se
  // canceló el segundo picker sin querer), no se puede elegir otra
  // habilidad distinta desde el picker de nivel superior: se salta
  // directo a completarla, con el mismo Portal ya fijado
  // (window.cronomantePortalInvestigado, ver abilities.js).
  if (window.cronomantePortalInvestigado) {
    applyAbility('Cronomante', window.turn, null, P().players, P().neutrals, window.levelIdx, need, window.cronomanteOnComplete);
    return;
  }

  const { opciones, eventos } = opcionesFaseB(estado.partida);
  if (!opciones) {
    alert(eventos[0].motivo);
    return;
  }

  picker('¿Qué habilidad quieres activar?', opciones, key => {
    const [tipo, idxStr] = key.split(':');
    const idx = parseInt(idxStr);
    const stack = tipo === 'own' ? P().players[window.turn].portals[idx] : P().neutrals[idx];
    const name = stack.at(-1).name;
    const jugadora = window.turn;
    const detalleHumano = () => describirObjetivoHabilidad(name, eleccionesUltimaHabilidad(),
      construirEstadoVisibleParaBot(P().players, P().neutrals, jugadora));

    // Se invoca solo cuando la habilidad se ha aplicado de verdad (nunca si
    // el jugador cancela un picker() intermedio a medias): primero cobra el
    // coste de Portal central si aplica, luego marca la habilidad como
    // usada, luego refresca la UI. El coste propio del Metamorfo (si lo
    // hay) ya se cobra dentro de su propio case en abilities.js, antes de
    // llegar aquí.
    // envolverHabilidad() solo añade la escena del modo espectáculo
    // cuando la habilidad se aplica de verdad (js/espectaculo.js).
    const onComplete = envolverHabilidad(name, window.turn, stack, conHistorialHabilidad(name, window.turn, key, { detalle: detalleHumano, elegidos: eleccionesUltimaHabilidad }, () => {
      const cobrar = usarAsterisco => {
        completarActivacion(estado.partida, { origen: key, personaje: name, usarAsterisco });
        render(P().players, P().neutrals, window.levelIdx);
      };
      if (tipo === 'central') preguntarUsoAsterisco(P().players[window.turn], cobrar);
      else cobrar(false);
    }));

    // Guardado aparte para que, si la jugadora cancela el segundo picker
    // de Cronomante y vuelve a pulsar "Activar habilidad" más tarde, se
    // pueda completar la MISMA activación (con el mismo coste pendiente
    // de cobrar) sin reabrir este picker de nivel superior.
    if (name === 'Cronomante') {
      window.cronomanteOnComplete = onComplete;
    }

    applyAbility(name, window.turn, stack, P().players, P().neutrals, window.levelIdx, need, onComplete);
  });
}
