// actions.js
import { nextTurn, finalizarPartida } from './game.js';
import { render, picker } from './render.js';
import { applyAbility } from './abilities.js';
import { mostrarCarta } from './utils.js';
import { estado } from './motor/estado.js';
import {
  jugarCarta, terminarTurno, pasarTurno, validarFaseB, opcionesFaseB, completarActivacion,
} from './motor/acciones.js';
import {
  anunciarCartaJugada, envolverHabilidad, anunciarInvocacion, cuandoTermineEspectaculo,
  hayEspectaculoEnCurso
} from './espectaculo.js';

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
 * Inicializa los controladores de acciones (selección de cartas, jugar, activar
 * habilidad, fin de turno).
 * @param {Array} players - Array de jugadores.
 * @param {Array} neutrals - Array de portales neutrales.
 */
export function initActions(players, neutrals) {
  // Jugar carta (Fase A) sobre `destKey` (mismo formato que antes poblaba
  // el `<select>` de destino: 'p:<idx>' | 'n:<idx>' | 'a:<pi>:<pj>'), usando
  // la carta actualmente seleccionada (window.selectedCardIdx). Comparten
  // esta MISMA función y este MISMO estado los tres métodos de juego
  // (selector con <select>, clic directo, drag&drop) — ninguno duplica
  // validación ni puede dejar a los otros dos en un estado inconsistente.
  // No activa ninguna habilidad automáticamente — eso es Fase B, ver
  // btnAbility.
  function jugarCartaSeleccionadaEn(destKey) {
    if (window.selectedCardIdx === null || window.selectedCardIdx === undefined) return;
    // Las reglas (validar, apilar, Centinela) están en el motor. Si la
    // jugada no es válida no se avisa, igual que antes: la selección se
    // queda como estaba.
    const eventos = jugarCarta(estado.partida, { cartaIdx: window.selectedCardIdx, destino: destKey });
    const jugada = eventos.find(e => e.tipo === 'cartaJugada');
    if (!jugada) return;

    window.selectedCardIdx = null;
    // Modo espectáculo (solo presentación, ver js/espectaculo.js).
    anunciarCartaJugada(jugada.jugadora, jugada.destino);

    // render() ya dispara, si aplica, la elección inmediata de Clarividente
    // (gestionarTransicionesClarividente en render.js) para CUALQUIER
    // jugadora afectada por esta jugada.
    render(players, neutrals, window.levelIdx);
  }

  // Clic en una carta de la propia mano: la selecciona; un segundo clic
  // sobre la misma carta la deselecciona (toggle). No hace nada si ya se
  // jugó carta este turno.
  window.selectHandCard = idx => {
    if (window.played) return;
    const pl = players[window.turn];
    if (!pl.hand[idx]) return;
    window.selectedCardIdx = (window.selectedCardIdx === idx) ? null : idx;
    render(players, neutrals, window.levelIdx);
  };

  // Clic en un Portal (propio, central o de otra jugadora): si hay una
  // carta seleccionada la juega ahí; sin selección activa, no hace nada.
  window.tryPlayOnPortal = destKey => {
    jugarCartaSeleccionadaEn(destKey);
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
    jugarCartaSeleccionadaEn(destKey);
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
    const pl = players[window.turn];
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
    neutrals.forEach((stack, j) => {
      const opt = document.createElement('option');
      opt.value = `n:${j}`;
      opt.textContent = `Neutral ${j + 1} (${topLabel(stack)})`;
      selDest.appendChild(opt);
    });
    players.forEach((p, pi) => {
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
    if (isNaN(cardIdx) || !players[window.turn].hand[cardIdx]) {
      alert('Debes seleccionar una carta válida antes de jugar.');
      return;
    }
    const destKey = document.querySelector('#selDest').value;
    document.querySelector('#ctrlPlay').classList.add('hidden');
    window.selectedCardIdx = cardIdx;
    jugarCartaSeleccionadaEn(destKey);
  };

  document.querySelector('#ctrlPlayCancel').onclick = () => {
    document.querySelector('#ctrlPlay').classList.add('hidden');
    window.selectedCardIdx = null;
    render(players, neutrals, window.levelIdx);
  };

  // Cancelar la selección de carta actual (visible solo mientras hay una
  // carta elegida, ver render.js) — también cierra el panel de <select>
  // por si se había abierto, para no dejar ambos métodos en estados
  // distintos.
  document.querySelector('#btnPlayCancel').onclick = () => {
    window.selectedCardIdx = null;
    document.querySelector('#ctrlPlay')?.classList.add('hidden');
    render(players, neutrals, window.levelIdx);
  };

  // Clic directo en el grid sobre el Portal objetivo de una habilidad en
  // curso (Ocultista/Cronista/Estratega/1er picker de Cronomante) — coexiste
  // con el modal picker() de siempre, mismo criterio que jugar carta.
  // window.pickerObjetivoPortal lo fija pickerPortal() (render.js) mientras
  // ese picker esté abierto; los Portales NO válidos (opcion.disabled) no
  // responden al clic.
  window.selectPortalObjetivo = key => {
    const estado = window.pickerObjetivoPortal;
    if (!estado) return;
    const opcion = estado.opciones.find(o => o.val === key);
    if (!opcion || opcion.disabled) return;
    window.pickerObjetivoPortal = null;
    document.querySelector('#picker')?.classList.add('hidden');
    estado.cb(key);
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
      applyAbility('Cronomante', window.turn, null, players, neutrals, window.levelIdx, need, window.cronomanteOnComplete);
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
      const stack = tipo === 'own' ? players[window.turn].portals[idx] : neutrals[idx];
      const name = stack.at(-1).name;

      // Se invoca solo cuando la habilidad se ha aplicado de verdad (nunca si
      // el jugador cancela un picker() intermedio a medias): primero cobra el
      // coste de Portal central si aplica, luego marca la habilidad como
      // usada, luego refresca la UI. El coste propio del Metamorfo (si lo
      // hay) ya se cobra dentro de su propio case en abilities.js, antes de
      // llegar aquí.
      // envolverHabilidad() solo añade la escena del modo espectáculo
      // cuando la habilidad se aplica de verdad (js/espectaculo.js).
      const onComplete = envolverHabilidad(name, window.turn, stack, () => {
        completarActivacion(estado.partida, { origen: key, personaje: name });
        render(players, neutrals, window.levelIdx);
      });

      // Guardado aparte para que, si la jugadora cancela el segundo picker
      // de Cronomante y vuelve a pulsar "Activar habilidad" más tarde, se
      // pueda completar la MISMA activación (con el mismo coste pendiente
      // de cobrar) sin reabrir este picker de nivel superior.
      if (name === 'Cronomante') {
        window.cronomanteOnComplete = onComplete;
      }

      applyAbility(name, window.turn, stack, players, neutrals, window.levelIdx, need, onComplete);
    });
  };

  // Botón terminar turno
  document.querySelector('#btnEndTurn').onclick = () => {
    if (window.juegoTerminado) return;
    if (window.avanceTurnoPendiente) return;
    // Reponer manos y comprobar la invocación: reglas en el motor.
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
      const escenificada = anunciarInvocacion({ nivel, nombre, need, recompensas });
      if (!escenificada) alert(`Invocación ${nivel} (${nombre}) completa`);
    }
    const fin = eventos.find(e => e.tipo === 'partidaTerminada');
    if (fin) {
      // Se deja terminar la escena antes del marcador final (que usa un
      // confirm() bloqueante).
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
    // Si hay escenas del modo espectáculo en pantalla, el turno siguiente
    // (y su aviso "Turno de ...") espera a que terminen o se salten.
    if (hayEspectaculoEnCurso()) {
      window.avanceTurnoPendiente = true;
      cuandoTermineEspectaculo().then(() => {
        window.avanceTurnoPendiente = false;
        avanzarTurno();
      });
    } else {
      avanzarTurno();
    }
  };

}
