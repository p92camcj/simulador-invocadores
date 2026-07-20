// actions.js
import { nextTurn, finalizarPartida } from './game.js';
import { render, picker } from './render.js';
import { applyAbility } from './abilities.js';
import {
  draw, generarVis, mostrarCarta,
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
  // Selección de carta y portal
  window.selectCard = i => {
    if (window.played) {
      alert('Ya jugaste');
      return;
    }
    const pl = players[window.turn];
    const selCard = document.querySelector('#selCard');
    selCard.innerHTML = '';
    pl.hand.forEach((c, idx) => {
      const visible = c.vis?.owner || pl.hasClariActivo || pl.haTenidoClarividente;
      const opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = visible ? mostrarCarta(c) : '?';
      if (idx === i) opt.selected = true;
      selCard.appendChild(opt);
    });

    const selDest = document.querySelector('#selDest');
    selDest.innerHTML = '';
    pl.portals.forEach((_, j) => {
      const opt = document.createElement('option');
      opt.value = `p:${j}`;
      opt.textContent = `Tu portal ${j+1}`;
      selDest.appendChild(opt);
    });
    neutrals.forEach((_, j) => {
      const opt = document.createElement('option');
      opt.value = `n:${j}`;
      opt.textContent = `Neutral ${j+1}`;
      selDest.appendChild(opt);
    });
    players.forEach((p, pi) => {
      if (pi !== window.turn) {
        p.portals.forEach((_, pj) => {
          const opt = document.createElement('option');
          opt.value = `a:${pi}:${pj}`;
          opt.textContent = `${p.name} P${pj+1}`;
          selDest.appendChild(opt);
        });
      }
    });

    document.querySelector('#ctrlPlay').classList.remove('hidden');

  };

  // Cancelar juego de carta
  document.querySelector('#btnPlayCancel').onclick = () => {
    document.querySelector('#ctrlPlay').classList.add('hidden');
  };

  // Jugar carta (Fase A). Ya no activa ninguna habilidad automáticamente:
  // la activación de habilidad es una acción aparte, ver btnAbility más abajo.
  document.querySelector('#btnPlay').onclick = () => {
    if (window.juegoTerminado) return;
    if (window.played) return;
    const pl = players[window.turn];
    const selCard = document.querySelector('#selCard');
    const cardIdx = parseInt(selCard.value);
    if (isNaN(cardIdx) || !pl.hand[cardIdx]) {
      alert('Debes seleccionar una carta válida antes de jugar.');
      return;
    }
    const card = pl.hand.splice(cardIdx, 1)[0];

    const selDest = document.querySelector('#selDest').value;
    const [tp, a, b] = selDest.split(':');
    const stack = tp === 'p'
      ? pl.portals[+a]
      : tp === 'n'
        ? neutrals[+a]
        : players[+a].portals[+b];
    stack.push({ name: card.name, vis: generarVis('portal', {}) });

    window.played = true;
    document.querySelector('#ctrlPlay').classList.add('hidden');

    render(players, neutrals, window.levelIdx);
    if (!pl.hasClariActivo) {
      pl.haTenidoClarividente = false;
    }
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

  // Hace que el botón "Jugar una carta" en la parte
  // superor de la cabecera, funcione y abra la ventana para jugar carta
  const btnCtrlPlay = document.getElementById("btnCtrlPlay");
  if (btnCtrlPlay) {
    btnCtrlPlay.addEventListener("click", () => {
      window.selectCard(0);
    });
  }


}
