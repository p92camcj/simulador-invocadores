// render.js
import { mostrarCarta, sumaGemas, contarGemasPorNivel, cardImages, CARTA_OCULTA_IMG } from './utils.js';
import { LEVELS, INVOCATION_SETS, actualizarClarividente } from './utils.js';

/**
 * Devuelve el <img> de una carta. Si `visible` es false, siempre usa el
 * reverso genérico (CARTA_OCULTA_IMG) y un alt sin el nombre real — no hay
 * que filtrar en el DOM qué personaje es una carta oculta para quien mira.
 */
function cartaImgHtml(name, visible) {
  const src = visible ? (cardImages[name] || CARTA_OCULTA_IMG) : CARTA_OCULTA_IMG;
  const alt = visible ? name : 'Carta oculta';
  return `<img src="${src}" alt="${alt}" class="card-img">`;
}

/**
 * Desglose completo (valor real de cada Gema) para la jugadora activa —
 * es la única que puede verlo, ver REGLAMENTO.md sobre secreto de Gemas.
 */
function desgloseGemasPropio(gems) {
  if (!gems.length) return 'sin Gemas';
  const grupos = new Map();
  gems.forEach(g => {
    const key = `${g.nivel}:${g.valor}`;
    grupos.set(key, (grupos.get(key) || 0) + 1);
  });
  return [...grupos.entries()]
    .map(([key, n]) => {
      const [nivel, valor] = key.split(':');
      return `${nivel}×${n} (v.${valor} c/u)`;
    })
    .join(', ');
}

/**
 * Recuento por nivel sin valores reales — para el resto de jugadoras, que
 * no deben poder ver los puntos exactos de las demás (fuga de información,
 * ver REGLAMENTO.md sobre secreto de Gemas).
 */
function desgloseGemasAjeno(gems) {
  const cnt = contarGemasPorNivel(gems);
  const entries = Object.entries(cnt);
  if (!entries.length) return 'sin Gemas';
  return entries.map(([nivel, n]) => `${nivel}×${n}`).join(', ');
}

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
 * @param {Function} [onCancel] - Callback opcional invocado al cancelar, en vez de `cb`
 */
export function picker(title, options, cb, onCancel) {
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
  cancelBtn.onclick = () => {
    hide();
    onCancel?.();
  };
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
  // Solo actualiza los flags hasClariActivo/haTenidoClarividente del
  // jugador; NUNCA muta carta.vis (ver js/utils.js) — el efecto de
  // Clarividente se decide en el momento de mostrar cada carta (más abajo,
  // `pl.hasClariActivo || pl.haTenidoClarividente`), no persistiéndolo en
  // el dato real. Así el estado subyacente (una carta visible + una
  // oculta) nunca se corrompe, y sigue intacto si después el Aprendiz
  // intercambia esta mano con la de otra jugadora.
  actualizarClarividente(players);
  const zoneActive = document.querySelector('#zoneActive');
  const zoneOthers = document.querySelector('#zoneOthers');
  const zoneNeutral = document.querySelector('#zoneNeutral');
  const neutralArea = document.querySelector('#neutralArea');
  const lblTurn = document.querySelector('#lblTurn');
  const lblInv = document.querySelector('#lblInv');
  const invStatus = document.querySelector('#invStatus');

  // Los Portales centrales pueden variar durante la partida (aparecen
  // nuevos al completar invocaciones), así que la visibilidad de esta zona
  // se decide en cada render(), no solo al preparar la partida.
  zoneNeutral.classList.toggle('hidden', neutrals.length === 0);

  const pl = players[window.turn];
  const activeColor = ['player-red', 'player-blue', 'player-yellow', 'player-purple'][window.turn % 4];
  zoneActive.innerHTML = `<div class="section ${activeColor}">`;
  zoneActive.innerHTML += `<h3>${pl.name} (G ${sumaGemas(pl.gems)} total — ${desgloseGemasPropio(pl.gems)})</h3>`;
  pl.portals.forEach((stack, i) => {
    const topCard = stack.at(-1);
    const body = stack.length === 0
      ? '<div class="card-empty">Vacío</div>'
      : cartaImgHtml(topCard.name, topCard.vis?.public === true);
    zoneActive.innerHTML += `<div class="card"><div class="card-label">Portal ${i+1} (${stack.length})</div>${body}</div>`;
  });
  zoneActive.innerHTML += '<h4>Mano</h4>';
  pl.hand.forEach((c, idx) => {
    const visible = c.vis?.owner || pl.hasClariActivo || pl.haTenidoClarividente;
    zoneActive.innerHTML += `
      <div class="card" onclick="selectCard(${idx})">
        ${cartaImgHtml(c.name, visible)}
      </div>`;
  });
  zoneActive.innerHTML += `</div>`;

  zoneOthers.innerHTML = '';
  players.forEach((p, i) => {
    if (i === window.turn) return;
    const colorClass = ['player-red', 'player-blue', 'player-yellow', 'player-purple'][i % 4];
    zoneOthers.innerHTML += `<div class="section ${colorClass}">`;
    zoneOthers.innerHTML += `<h4>${p.name} (${desgloseGemasAjeno(p.gems)})</h4>`;
    p.portals.forEach((stack, j) => {
      const topCard = stack.at(-1);
      const body = stack.length === 0
        ? '<div class="card-empty">Vacío</div>'
        : cartaImgHtml(topCard.name, topCard.vis?.public === true);
      zoneOthers.innerHTML += `<div class="card"><div class="card-label">Portal ${j+1} (${stack.length})</div>${body}</div>`;
    });
    zoneOthers.innerHTML += '<h5>Cartas ocultas</h5>';
    // Decisión de mesa (ver docs/reglamento/REGLAMENTO.md, nota sobre
    // Clarividente): mientras esta jugadora tenga la Clarividente
    // visible/en periodo de gracia, su mano COMPLETA queda oculta para el
    // resto — se sobrescribe la visibilidad normal, no se combina con OR.
    const manoOcultaPorClarividente = p.hasClariActivo || p.haTenidoClarividente;
    p.hand.forEach(h => {
      const visible = manoOcultaPorClarividente ? false : h.vis?.others === true;
      zoneOthers.innerHTML += `<div class="card">${cartaImgHtml(h.name, visible)}</div>`;
    });
    zoneOthers.innerHTML += `</div>`;
  });

  neutralArea.innerHTML = '';
  neutrals.forEach((stack, i) => {
    const topCard = stack.at(-1);
    const body = stack.length === 0
      ? '<div class="card-empty">Vacío</div>'
      : cartaImgHtml(topCard.name, topCard.vis?.public === true);
    neutralArea.innerHTML += `<div class="card"><div class="card-label">Neutral ${i+1} (${stack.length})</div>${body}</div>`;
  });

  const lvl = LEVELS[levelIdx] || '-';
  lblInv.textContent = lvl;
  if (lvl === '-') {
    invStatus.innerHTML = '';
    return;
  }
  const invocacion = INVOCATION_SETS[window.invocationSet][lvl];
  const need = invocacion.need;
  lblInv.textContent = `${lvl} — ${invocacion.nombre}`;
  const cnt = {};
  need.forEach(n => cnt[n] = 0);
  players.forEach(p => p.portals.forEach(stack => {
    if (stack.length && stack.at(-1).vis?.public && cnt[stack.at(-1).name] !== undefined) cnt[stack.at(-1).name]++;
  }));
  neutrals.forEach(stack => {
    if (stack.length && stack.at(-1).vis?.public && cnt[stack.at(-1).name] !== undefined) cnt[stack.at(-1).name]++;
  });
  invStatus.innerHTML = need.map(n => {
    const cls = cnt[n] === 0 ? 'missing' : cnt[n] === 1 ? 'present' : 'duplicate';
    return `<span class="${cls}">${mostrarCarta({ name: n })}</span>`;
  }).join(' , ');
}
