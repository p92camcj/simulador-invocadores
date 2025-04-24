// actions.js
import { nextTurn } from './game.js';
import { render } from './render.js';
import { applyAbility } from './abilities.js';
import { draw, generarVis, mostrarCarta, gestionarMetamorfos } from './utils.js';

/**
 * Inicializa los controladores de acciones (selección de cartas, jugar, fin de turno).
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

  // Jugar carta
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

    const ownerIdx = tp === 'a' ? +a : window.turn;
    const ask = tp === 'a';
    const personajesConHabilidad = ['Ocultista', 'Cronista', 'Cronomante', 'Estratega', 'Aprendiz', 'Metamorfo'];
    const tieneHabilidad = personajesConHabilidad.includes(card.name);
    if (!tieneHabilidad || !ask || confirm(`${players[ownerIdx].name}: ¿activar habilidad de ${card.name}?`)) {
      applyAbility(card.name, ownerIdx, stack, players, neutrals, levelIdx);
    }


    render(players, neutrals, window.levelIdx);
    if (!pl.hasClariActivo) {
      pl.haTenidoClarividente = false;
    }

  };

  // Botón terminar turno
  document.querySelector('#btnEndTurn').onclick = async () => {
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
      const need = window.COMBOS[lvl];
      const transformacionesMetamorfos = await gestionarMetamorfos(players, neutrals, lvl, need);
      const map = new Map();
      const add = (idx, s, i, j) => {
        if (s.length && s.at(-1).vis?.public) {
          const key = `${i}:${j}`;
          const carta = s.at(-1);
          const nombre = transformacionesMetamorfos.get(key) || carta.name;
          if (need.includes(nombre)) {
            if (!map.has(nombre)) map.set(nombre, []);
            map.get(nombre).push(idx);
          }
        }
      };
      
      players.forEach((player, playerIdx) => {
        player.portals.forEach((stack, portalIdx) => {
          add(playerIdx, stack, playerIdx, portalIdx);
        });
      });
      neutrals.forEach((st, j) => add(null, st, null, j));
      const allPortals = [
        ...players.flatMap(p => p.portals),
        ...neutrals
      ];
        const puedeInvocar = allPortals.every(p => p.length && p.at(-1).vis?.public);
        if (puedeInvocar && need.every(k => map.get(k))) {
        need.forEach(k => {
          const arr = map.get(k);
          if (arr.length === 1 && arr[0] !== null) players[arr[0]].gems += window.REWARD[lvl];
        });
        // Habilidad Pícaro
        players.forEach(p => p.portals.forEach(st => {
          if (st.length && st.at(-1).name === 'Pícaro' && st.at(-1).vis?.public) {
            p.gems++;
            if (st.at(-1).vis) {
              st.at(-1).vis.public = false;
            }
            
          }
        }));
        // Maestro extra
        if (lvl === 'A' && map.get('Maestro') && map.get('Maestro').length === 1 && !map.has('Pícaro')) {
          players[map.get('Maestro')[0]].gems += 3;
        }
        alert('Invocación ' + lvl + ' completa');

        neutrals.push([]);
        document.querySelector('#zoneNeutral').classList.remove('hidden');
        window.levelIdx++;
        finalizarPartida('Se ha completado la invocación A. Fin de la partida.');
        return;
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
