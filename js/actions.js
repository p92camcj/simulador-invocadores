// actions.js
import { prepararEjemploPersona, guardarEjemploPersona } from './aprendizaje-navegador.js';
import { nextTurn, finalizarPartida } from './game.js';
import { render, picker } from './render.js';
import { applyAbility, eleccionesUltimaHabilidad } from './abilities.js';
import { describirObjetivoHabilidad, construirEstadoVisibleParaBot } from './bot.js';
import { mostrarCarta, tieneGemaAsterisco, contarGemasUnitarias } from './utils.js';
import { estado } from './motor/estado.js';
import {
  jugarCarta, terminarTurno, pasarTurno, validarFaseB, opcionesFaseB, completarActivacion,
} from './motor/acciones.js';
import {
  anunciarCartaJugada, envolverHabilidad, anunciarInvocacion, cuandoTermineEspectaculo,
  hayEspectaculoEnCurso
} from './espectaculo.js';
import { vistaMesaActiva, preguntarMesa } from './mesa3d.js';
import {
  registrarEnHistorial, claveDeDestino, claveDeOrigenHabilidad, fotoPortales, portalesCambiados,
  pilaDeClave, textoJugada, textoHabilidad, textoInvocacion, trazosHabilidad,
} from './historial.js';

/**
 * Etiqueta entre paréntesis de lo que hay en el top de un Portal, con el
 * mismo criterio de visibilidad que usa render.js: 'Vacío' si no tiene
 * cartas, el nombre si la carta superior es pública, 'Carta Oculta' si no.
 */
function topLabel(stack) {
  if (!stack.length) return 'Vacío';
  const top = stack.at(-1);
  return top.vis?.public ? mostrarCarta(top) : 'Carta Oculta';
}

/**
 * Fase A: la jugadora activa baja la carta `cartaIdx` de su mano a
 * `destKey` ('p:<idx>' | 'n:<idx>' | 'a:<pi>:<pj>'). Las reglas están en el
 * motor (jugarCarta); aquí solo se presenta el resultado. La usan los tres
 * métodos humanos (clic, arrastrar, panel) y el autómata. Devuelve true si
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
  // En la Mesa 3D, hoja con dos botones en vez del confirm() del navegador.
  if (vistaMesaActiva()) {
    preguntarMesa(`${player.name}: ¿cómo pagas el acceso al Portal central?`, [
      { val: 'asterisco', lbl: '✦ Revelar mi Gema de asterisco (gratis)' },
      { val: 'unidad', lbl: '💎 Pagar 1 Gema de valor 1' },
    ], val => responder(val === 'asterisco'));
    return;
  }
  responder(confirm(`${player.name}: tienes una Gema de asterisco. ¿Revelarla para activar la habilidad gratis? (Cancelar para pagar 1 Gema de valor 1)`));
}

/**
 * Fin del turno: el motor repone manos y resuelve la invocación
 * (terminarTurno); aquí se presentan los eventos. Cuando acaban las escenas
 * se pasa el turno (pasarTurno + nextTurn). Es el clic de #btnEndTurn y
 * también lo llama el autómata.
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
    const { nivel, nombre, need, recompensas } = invocacion;
    registrarEnHistorial(estado.partida, { tipo: 'invocacion', texto: textoInvocacion(invocacion) });
    const escenificada = anunciarInvocacion({ nivel, nombre, need, recompensas });
    if (!escenificada) alert(`Invocación ${nivel} (${nombre}) completa`);
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

/**
 * Inicializa los controladores de acciones (selección de cartas, jugar, activar
 * habilidad, fin de turno). Lee siempre `estado.partida`.
 */
export function initActions() {
  // Siempre se lee la partida actual (estado.partida), nunca arrays
  // capturados al empezar: así cargarPartida() no deja referencias viejas.
  const P = () => estado.partida;
  // Clic en una carta de la propia mano: la selecciona; un segundo clic
  // sobre la misma carta la deselecciona (toggle). No hace nada si ya se
  // jugó carta este turno.
  window.selectHandCard = idx => {
    if (window.played) return;
    const pl = P().players[window.turn];
    if (!pl.hand[idx]) return;
    window.selectedCardIdx = (window.selectedCardIdx === idx) ? null : idx;
    render(P().players, P().neutrals, window.levelIdx);
  };

  // Clic en un Portal (propio, central o de otra jugadora): si hay una
  // carta seleccionada la juega ahí; sin selección activa, no hace nada.
  window.tryPlayOnPortal = destKey => {
    ejecutarJugada(window.selectedCardIdx, destKey);
  };

  // Drag & drop nativo como alternativa al clic — ambos métodos coexisten.
  window.handleCardDragStart = (event, idx) => {
    if (window.played) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', String(idx));
    event.dataTransfer.effectAllowed = 'move';
  };
  window.handlePortalDragOver = event => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  };
  window.handlePortalDrop = (event, destKey) => {
    event.preventDefault();
    const idxStr = event.dataTransfer.getData('text/plain');
    if (idxStr === '') return;
    window.selectedCardIdx = parseInt(idxStr, 10);
    ejecutarJugada(window.selectedCardIdx, destKey);
  };

  // Tercer método (coexiste con clic y drag&drop): panel con dos <select>
  // + botón "Jugar", igual que antes de introducir el clic directo. Al
  // abrirlo, si ya había una carta elegida por clic (window.selectedCardIdx),
  // el <select> de carta la preselecciona — comparten el mismo estado, no
  // hay dos selecciones independientes que puedan desincronizarse.
  function abrirPanelJugarCarta() {
    if (window.played) {
      alert('Ya jugaste');
      return;
    }
    const pl = P().players[window.turn];
    const selCard = document.querySelector('#selCard');
    selCard.innerHTML = '';
    pl.hand.forEach((c, idx) => {
      const visible = c.vis?.owner || pl.hasClariActivo;
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = visible ? mostrarCarta(c) : '?';
      if (idx === (window.selectedCardIdx ?? 0)) opt.selected = true;
      selCard.appendChild(opt);
    });

    const selDest = document.querySelector('#selDest');
    selDest.innerHTML = '';
    pl.portals.forEach((stack, j) => {
      const opt = document.createElement('option');
      opt.value = `p:${j}`;
      opt.textContent = `Tu portal ${j + 1} (${topLabel(stack)})`;
      selDest.appendChild(opt);
    });
    P().neutrals.forEach((stack, j) => {
      const opt = document.createElement('option');
      opt.value = `n:${j}`;
      opt.textContent = `Neutral ${j + 1} (${topLabel(stack)})`;
      selDest.appendChild(opt);
    });
    P().players.forEach((p, pi) => {
      if (pi !== window.turn) {
        p.portals.forEach((stack, pj) => {
          const opt = document.createElement('option');
          opt.value = `a:${pi}:${pj}`;
          opt.textContent = `${p.name} P${pj + 1} (${topLabel(stack)})`;
          selDest.appendChild(opt);
        });
      }
    });

    document.querySelector('#ctrlPlay').classList.remove('hidden');
  }

  document.querySelector('#btnCtrlPlay').onclick = abrirPanelJugarCarta;

  document.querySelector('#btnPlay').onclick = () => {
    const selCard = document.querySelector('#selCard');
    const cardIdx = parseInt(selCard.value, 10);
    if (isNaN(cardIdx) || !P().players[window.turn].hand[cardIdx]) {
      alert('Debes seleccionar una carta válida antes de jugar.');
      return;
    }
    const destKey = document.querySelector('#selDest').value;
    document.querySelector('#ctrlPlay').classList.add('hidden');
    window.selectedCardIdx = cardIdx;
    ejecutarJugada(window.selectedCardIdx, destKey);
  };

  document.querySelector('#ctrlPlayCancel').onclick = () => {
    document.querySelector('#ctrlPlay').classList.add('hidden');
    window.selectedCardIdx = null;
    render(P().players, P().neutrals, window.levelIdx);
  };

  // Cancelar la selección de carta actual (visible solo mientras hay una
  // carta elegida, ver render.js) — también cierra el panel de <select>
  // por si se había abierto, para no dejar ambos métodos en estados
  // distintos.
  document.querySelector('#btnPlayCancel').onclick = () => {
    window.selectedCardIdx = null;
    document.querySelector('#ctrlPlay')?.classList.add('hidden');
    render(P().players, P().neutrals, window.levelIdx);
  };

  // Clic directo en el grid sobre el Portal objetivo de una habilidad en
  // curso (Ocultista/Cronista/Estratega/1er picker de Cronomante) — coexiste
  // con el modal picker() de siempre, mismo criterio que jugar carta.
  // window.pickerObjetivoPortal lo fija pickerPortal() (render.js) mientras
  // ese picker esté abierto; los Portales NO válidos (opcion.disabled) no
  // responden al clic.
  window.selectPortalObjetivo = key => {
    const objetivo = window.pickerObjetivoPortal;
    if (!objetivo) return;
    const opcion = objetivo.opciones.find(o => o.val === key);
    if (!opcion || opcion.disabled) return;
    window.pickerObjetivoPortal = null;
    document.querySelector('#picker')?.classList.add('hidden');
    objetivo.cb(key);
  };

  // Activar habilidad (Fase B, opcional, una vez por turno): la habilidad del
  // personaje visible en uno de tus propios portales (gratis) o la de un
  // personaje visible en un portal central (pagando, ver utils.js).
  document.querySelector('#btnAbility').onclick = () => {
    if (window.juegoTerminado) return;
    const invalida = validarFaseB(estado.partida)[0];
    if (invalida) {
      alert(invalida.motivo);
      return;
    }

    const lvl = window.LEVELS[window.levelIdx];
    const need = lvl ? window.INVOCATION_SETS[window.invocationSet][lvl].need : [];

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
  };

  // Botón terminar turno (también lo usa el autómata, ver ejecutarFinDeTurno).
  document.querySelector('#btnEndTurn').onclick = ejecutarFinDeTurno;

}
