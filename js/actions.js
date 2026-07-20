// actions.js
import { nextTurn, finalizarPartida } from './game.js';
import { render, picker } from './render.js';
import { applyAbility, ocultarOtrasCentinelas } from './abilities.js';
import {
  draw, generarVis,
  opcionesActivarHabilidad, pagarActivacionPortalCentral,
  construirPoolGemas
} from './utils.js';

/**
 * Inicializa los controladores de acciones (selección de cartas, jugar, activar
 * habilidad, fin de turno).
 * @param {Array} players - Array de jugadores.
 * @param {Array} neutrals - Array de portales neutrales.
 */
export function initActions(players, neutrals) {
  // Jugar carta (Fase A) sobre `destKey` (mismo formato que antes poblaba
  // el `<select>` de destino: 'p:<idx>' | 'n:<idx>' | 'a:<pi>:<pj>'), usando
  // la carta actualmente seleccionada (window.selectedCardIdx). No activa
  // ninguna habilidad automáticamente — eso es Fase B, ver btnAbility.
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
    stack.push({ name: card.name, vis: generarVis('portal', {}) });
    // Efecto pasivo/automático de Centinela (REGLAMENTO.md: "solo puede
    // haber una Centinela visible en mesa"), no requiere Fase B.
    if (card.name === 'Centinela') {
      ocultarOtrasCentinelas(stack, players, neutrals);
    }

    window.played = true;
    window.selectedCardIdx = null;

    render(players, neutrals, window.levelIdx);
    if (!pl.hasClariActivo) {
      pl.haTenidoClarividente = false;
    }
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

  // Cancelar la selección de carta actual (visible solo mientras hay una
  // carta elegida, ver render.js).
  document.querySelector('#btnPlayCancel').onclick = () => {
    window.selectedCardIdx = null;
    render(players, neutrals, window.levelIdx);
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

      const lvl = window.LEVELS[window.levelIdx];
      const need = lvl ? window.INVOCATION_SETS[window.invocationSet][lvl].need : [];
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
    players.forEach(p => {
      if (p.hand.length < 2) {
        if (!p.hand.some(h => h.vis?.owner)) draw(p, true);
        if (p.hand.filter(h => !h.vis?.owner).length < 1) draw(p, false);
      }
    });

    // Comprobación invocación
    const lvl = window.LEVELS[window.levelIdx];
    if (lvl) {
      const invocacion = window.INVOCATION_SETS[window.invocationSet][lvl];
      const need = invocacion.need;
      const map = new Map();
      const add = (idx, s) => {
        if (s.length && s.at(-1).vis?.public) {
          const nombre = s.at(-1).name;
          if (need.includes(nombre)) {
            if (!map.has(nombre)) map.set(nombre, []);
            map.get(nombre).push(idx);
          }
        }
      };

      players.forEach((player, playerIdx) => {
        player.portals.forEach(stack => add(playerIdx, stack));
      });
      neutrals.forEach(st => add(null, st));
      const allPortals = [
        ...players.flatMap(p => p.portals),
        ...neutrals
      ];
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
        // de si el Pícaro era o no requisito de esta invocación.
        players.forEach(p => p.portals.forEach(st => {
          if (st.length && st.at(-1).name === 'Pícaro' && st.at(-1).vis?.public) {
            p.gems.push({ valor: 1, nivel: 'unitaria' });
            if (st.at(-1).vis) {
              st.at(-1).vis.public = false;
            }
          }
        }));
        // Maestro: bonus pasivo de 3 Gemas unitarias si es requisito de la
        // invocación (en cualquier nivel, no solo 'A') y no hay ningún Pícaro
        // visible en ninguna parte de la mesa (no solo fuera del combo actual).
        const hayPicaroVisible = allPortals.some(
          st => st.length && st.at(-1).name === 'Pícaro' && st.at(-1).vis?.public
        );
        if (need.includes('Maestro') && map.get('Maestro')?.length === 1 && map.get('Maestro')[0] !== null && !hayPicaroVisible) {
          const beneficiario = players[map.get('Maestro')[0]];
          beneficiario.gems.push({ valor: 1, nivel: 'unitaria' }, { valor: 1, nivel: 'unitaria' }, { valor: 1, nivel: 'unitaria' });
        }
        alert(`Invocación ${lvl} (${invocacion.nombre}) completa`);

        // La visibilidad de #zoneNeutral se decide en cada render() según
        // neutrals.length (ver render.js), no hace falta tocarla aquí.
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

  // Vista de depuración (Tarea C, solo para pruebas del dueño del
  // proyecto): alterna entre la vista compartida normal y la vista con
  // todo visible. render() decide qué zona mostrar según
  // window.debugViewActive.
  const btnDebugView = document.querySelector('#btnDebugView');
  if (btnDebugView) {
    btnDebugView.onclick = () => {
      window.debugViewActive = !window.debugViewActive;
      render(players, neutrals, window.levelIdx);
    };
  }

}
