// actions.js
import { nextTurn, finalizarPartida } from './game.js';
import { render, picker } from './render.js';
import { applyAbility, ocultarOtrasCentinelas } from './abilities.js';
import {
  generarVis, mostrarCarta,
  opcionesActivarHabilidad, pagarActivacionPortalCentral,
  construirPoolGemas, todosLosPortales, reponerManoSiFalta
} from './utils.js';

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
    if (window.juegoTerminado) return;
    if (window.played) return;
    if (window.selectedCardIdx === null || window.selectedCardIdx === undefined) return;

    const pl = players[window.turn];
    const cardIdx = window.selectedCardIdx;
    if (!pl.hand[cardIdx]) return;
    const card = pl.hand.splice(cardIdx, 1)[0];

    const [tp, a, b] = destKey.split(':');
    const stack = tp === 'p'
      ? pl.portals[+a]
      : tp === 'n'
        ? neutrals[+a]
        : players[+a].portals[+b];
    // Se propaga `.aspecto` (ítem 14 de DEUDA_TECNICA.md) por si esta carta
    // ya era un Metamorfo transformado que había vuelto a la mano (p. ej.
    // vía Cronista) — de lo contrario se perdería la apariencia al
    // reconstruir el objeto para el nuevo Portal.
    stack.push({ name: card.name, aspecto: card.aspecto, vis: generarVis('portal', {}) });
    // Efecto pasivo/automático de Centinela (REGLAMENTO.md: "solo puede
    // haber una Centinela visible en mesa"), no requiere Fase B.
    if (card.name === 'Centinela') {
      ocultarOtrasCentinelas(stack, players, neutrals);
    }

    window.played = true;
    window.selectedCardIdx = null;

    // render() ya dispara, si aplica, la elección inmediata de Clarividente
    // (gestionarTransicionesClarividente en render.js) para CUALQUIER
    // jugadora afectada por esta jugada, no solo `pl` — sin periodo de
    // gracia que limpiar aquí.
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
    if (!window.played) {
      alert('Primero debes jugar una carta.');
      return;
    }
    if (window.habilidadUsadaEsteTurno) {
      alert('Ya has activado una habilidad este turno.');
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

    const opciones = opcionesActivarHabilidad(window.turn, players, neutrals);
    if (!opciones.length) {
      alert('No tienes ninguna habilidad activable ahora mismo.');
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
      const onComplete = () => {
        if (tipo === 'central') {
          pagarActivacionPortalCentral(players[window.turn]);
        }
        window.habilidadUsadaEsteTurno = true;
        render(players, neutrals, window.levelIdx);
      };

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
    if (!window.played) {
      alert('Juega una carta');
      return;
    }
    // Robo de cartas si <2
    players.forEach(reponerManoSiFalta);

    // Comprobación invocación
    const lvl = window.LEVELS[window.levelIdx];
    if (lvl) {
      const invocacion = window.INVOCATION_SETS[window.invocationSet][lvl];
      const need = invocacion.need;
      const map = new Map();
      const add = (idx, s) => {
        if (s.length && s.at(-1).vis?.public) {
          // Apariencia, no identidad (ítem 14 de DEUDA_TECNICA.md): un
          // Metamorfo transformado cuenta como el personaje imitado a
          // efectos de cumplir la combinación de la invocación y repartir
          // sus Gemas (REGLAMENTO.md, "Metamorfo").
          const nombre = s.at(-1).aspecto || s.at(-1).name;
          if (need.includes(nombre)) {
            if (!map.has(nombre)) map.set(nombre, []);
            map.get(nombre).push(idx);
          }
        }
      };

      const todosPortales = todosLosPortales(players, neutrals);
      todosPortales.forEach(({ stack, playerIdx }) => add(playerIdx, stack));
      const allPortals = todosPortales.map(t => t.stack);
      const puedeInvocar = allPortals.every(p => p.length && p.at(-1).vis?.public);
      if (puedeInvocar && need.every(k => map.get(k))) {
        const pool = construirPoolGemas(invocacion.gemas);
        need.forEach(k => {
          const arr = map.get(k);
          if (arr.length === 1 && arr[0] !== null) {
            const gema = pool.shift();
            if (gema) players[arr[0]].gems.push({ valor: gema.valor, nivel: lvl, esAsterisco: gema.esAsterisco });
          }
        });
        // Habilidad Pícaro: siempre Gema unitaria (valor 1), independientemente
        // de si el Pícaro era o no requisito de esta invocación. Solo Portales
        // de jugadora (nunca centrales/neutrales) — mismo criterio que antes.
        todosPortales.filter(t => t.playerIdx !== null).forEach(({ playerIdx, stack: st }) => {
          if (st.length && st.at(-1).name === 'Pícaro' && st.at(-1).vis?.public) {
            players[playerIdx].gems.push({ valor: 1, nivel: 'unitaria' });
            if (st.at(-1).vis) {
              st.at(-1).vis.public = false;
            }
          }
        });
        // Maestro: bonus pasivo de 3 Gemas unitarias si es requisito de la
        // invocación (en cualquier nivel, no solo 'A') y no hay ningún Pícaro
        // visible en ninguna parte de la mesa (no solo fuera del combo actual).
        const hayPicaroVisible = allPortals.some(
          st => st.length && st.at(-1).name === 'Pícaro' && st.at(-1).vis?.public
        );
        // Identidad real, no apariencia (ítem 14 de DEUDA_TECNICA.md): un
        // Metamorfo transformado en Maestro cuenta para completar el combo
        // de la invocación (map, arriba, usa .aspecto para eso) pero NO
        // otorga este bonus pasivo, que es propio del Maestro real — por
        // eso aquí no se reutiliza `map` (indexado por apariencia), se
        // recorren los Portales buscando `.name === 'Maestro'` directamente.
        let maestroOwnerIdx = null;
        let maestrosRealesVisibles = 0;
        todosPortales.forEach(({ stack: st, playerIdx }) => {
          if (st.length && st.at(-1).vis?.public && st.at(-1).name === 'Maestro') {
            maestrosRealesVisibles++;
            if (playerIdx !== null) maestroOwnerIdx = playerIdx;
          }
        });
        if (need.includes('Maestro') && maestrosRealesVisibles === 1 && maestroOwnerIdx !== null && !hayPicaroVisible) {
          players[maestroOwnerIdx].gems.push({ valor: 1, nivel: 'unitaria' }, { valor: 1, nivel: 'unitaria' }, { valor: 1, nivel: 'unitaria' });
        }
        alert(`Invocación ${lvl} (${invocacion.nombre}) completa`);

        neutrals.push([]);
        window.levelIdx++;
        const esUltimaInvocacion = window.levelIdx >= window.LEVELS.length;
        if (esUltimaInvocacion) {
          finalizarPartida(`Se ha completado la invocación ${lvl}. Fin de la partida.`);
          return;
        }
      }
    }

    window.turn = (window.turn + 1) % players.length;
    nextTurn();
    window.played = false;
  };

}
