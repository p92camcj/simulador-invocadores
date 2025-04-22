// render.js
import { mostrarCarta, actualizarVisibilidad  } from './utils.js';
import { LEVELS, COMBOS, actualizarClarividente } from './utils.js';

/**
 * Muestra un selector emergente para elegir una opción entre varias.
 * 
 * Cada opción puede tener:
 * - val: valor devuelto al seleccionar
 * - lbl: texto visible
 * - disabled (opcional): si está presente y es true, la opción se mostrará como no seleccionable
 *
 * Ejemplo de uso:
 * picker("Selecciona portal", [
 *   { val: "0:0", lbl: "Jugador A P1" },
 *   { val: "n:0", lbl: "🚫 Neutral 1", disabled: true }
 * ], valor => { ... });
 * 
 * @param {string} title - Título del picker
 * @param {Array<{val: string, lbl: string, disabled?: boolean}>} options - Lista de opciones
 * @param {Function} cb - Función callback que recibe el valor seleccionado
 */
export function picker(title, options, cb) {
  const pickerEl = document.querySelector('#picker');
  const titleEl = document.querySelector('#pickerTitle');
  const selectEl = document.querySelector('#pickerSelect');
  const okBtn = document.querySelector('#pickerOk');
  const cancelBtn = document.querySelector('#pickerCancel');

  titleEl.textContent = title;
  selectEl.innerHTML = '';
  options.forEach(o => {
    const opt = document.createElement('option');
    opt.value = o.val;
    opt.textContent = o.disabled ? `🚫 ${o.lbl}` : o.lbl;
    if (o.disabled) opt.disabled = true;
    selectEl.appendChild(opt);
  });
  pickerEl.classList.remove('hidden');

  const hide = () => pickerEl.classList.add('hidden');
  okBtn.onclick = () => {
    const v = selectEl.value;
    hide();
    cb(v);
  };
  cancelBtn.onclick = () => hide();
}

/**
 * Renderiza toda la interfaz del juego:
 * - Zona activa
 * - Zona de otros jugadores
 * - Portales neutrales
 * - Estado de invocación
 * @param {Array} players - Array de jugadores.
 * @param {Array} neutrals - Array de portales neutrales.
 * @param {number} levelIdx - Índice de la invocación actual.
 */
export function render(players, neutrals, levelIdx) {
  actualizarClarividente(players);
  actualizarVisibilidad(players);
  const zoneActive = document.querySelector('#zoneActive');
  const zoneOthers = document.querySelector('#zoneOthers');
  const neutralArea = document.querySelector('#neutralArea');
  const lblTurn = document.querySelector('#lblTurn');
  const lblInv = document.querySelector('#lblInv');
  const invStatus = document.querySelector('#invStatus');

  const pl = players[window.turn];
  const activeColor = ['player-red', 'player-blue', 'player-yellow', 'player-purple'][turn % 4];
  zoneActive.innerHTML = `<div class="section ${activeColor}">`;
  zoneActive.innerHTML += `<h3>${pl.name} (G ${pl.gems})</h3>`;
  pl.portals.forEach((stack, i) => {
    const top = stack.length === 0 ? 'Vacío' : (stack.at(-1).vis?.public ? mostrarCarta(stack.at(-1)) : 'Carta Oculta');
    zoneActive.innerHTML += `<div class="card">Portal ${i+1}: ${top} (${stack.length})</div>`;
  });
  zoneActive.innerHTML += '<h4>Mano</h4>';
  pl.hand.forEach((c, idx) => {
    const visible = c.vis?.owner || pl.hasClariActivo || pl.haTenidoClarividente;
    zoneActive.innerHTML += `
      <div class="card" onclick="selectCard(${idx})">
        ${visible ? mostrarCarta(c) : 'Carta Oculta'}
      </div>`;
  });
  zoneActive.innerHTML += `</div>`;

  zoneOthers.innerHTML = '';
  players.forEach((p, i) => {
    if (i === turn) return;
    const colorClass = ['player-red', 'player-blue', 'player-yellow', 'player-purple'][i % 4];
    zoneOthers.innerHTML += `<div class="section ${colorClass}">`;
    zoneOthers.innerHTML += `<h4>${p.name} (G ${p.gems})</h4>`;
    p.portals.forEach((stack, j) => {
      const top = stack.length === 0 ? 'Vacío' : (stack.at(-1).vis?.public ? mostrarCarta(stack.at(-1)) : 'Carta Oculta');
      zoneOthers.innerHTML += `<div class="card">Portal ${j+1}: ${top} (${stack.length})</div>`;
    });
    zoneOthers.innerHTML += '<h5>Cartas ocultas</h5>';
    p.hand.forEach(h => {
      zoneOthers.innerHTML += `<div class="card">${h.vis?.others ? mostrarCarta(h) : "?"}</div>`;
    });
    zoneOthers.innerHTML += `</div>`;
  });

  neutralArea.innerHTML = '';
  neutrals.forEach((stack, i) => {
    const top = stack.length === 0 ? 'Vacío' : (stack.at(-1).vis?.public ? mostrarCarta(stack.at(-1)) : 'Carta Oculta');
    neutralArea.innerHTML += `<div class="card">Neutral ${i+1}: ${top} (${stack.length})</div>`;
  });

  const lvl = LEVELS[levelIdx] || '-';
  lblInv.textContent = lvl;
  if (lvl === '-') {
    invStatus.innerHTML = '';
    return;
  }
  const need = COMBOS[lvl];
  const cnt = {};
  need.forEach(n => cnt[n] = 0);
  players.forEach(p => p.portals.forEach(stack => {
    if (stack.length && stack.at(-1).vis?.public) cnt[stack.at(-1).name]++;
  }));
  neutrals.forEach(stack => {
    if (stack.length && stack.at(-1).vis?.public) cnt[stack.at(-1).name]++;
  });
  invStatus.innerHTML = need.map(n => {
    const cls = cnt[n] === 0 ? 'missing' : cnt[n] === 1 ? 'present' : 'duplicate';
    return `<span class="${cls}">${mostrarCarta({ name: n })}</span>`;
  }).join(' , ');
}
