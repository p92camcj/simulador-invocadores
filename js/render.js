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
 * Atributos comunes de un Portal jugable: clic para jugar la carta
 * seleccionada (no hace nada si no hay ninguna, ver `window.tryPlayOnPortal`
 * en `actions.js`) y drag&drop nativo como alternativa que coexiste con el
 * clic. `destKey` usa el mismo formato que antes poblaba `#selDest`:
 * `p:<idx>` (portal propio), `n:<idx>` (central) o `a:<pi>:<pj>` (portal de
 * otra jugadora).
 */
function portalPlayAttrs(destKey) {
  return `onclick="window.tryPlayOnPortal('${destKey}')" `
    + `ondragover="window.handlePortalDragOver(event)" `
    + `ondrop="window.handlePortalDrop(event, '${destKey}')"`;
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
 * Construye el HTML de un Portal (propio, central o de otra jugadora) en
 * modo "jugar carta": clicable/soltable con `portalPlayAttrs`, y con la
 * clase `.target-portal` mientras haya una carta de mano seleccionada
 * (`window.selectedCardIdx`) — el clic no hace nada si no hay selección.
 */
function portalCardJugarHtml(stack, label, destKey) {
  const topCard = stack.at(-1);
  const body = stack.length === 0
    ? '<div class="card-empty">Vacío</div>'
    : cartaImgHtml(topCard.name, topCard.vis?.public === true);
  const haySeleccion = window.selectedCardIdx !== null && window.selectedCardIdx !== undefined;
  const targetClass = haySeleccion ? ' target-portal' : '';
  return `<div class="card${targetClass}" ${portalPlayAttrs(destKey)}><div class="card-label">${label} (${stack.length})</div>${body}</div>`;
}

/**
 * Tablero único e interactivo: una columna por jugadora (orden fijo por
 * índice, no se reordena según el turno) más una columna final de
 * Portales centrales si los hay. Sustituye a las antiguas zonas separadas
 * zoneActive/zoneOthers/neutralArea — visibilidad real en todo momento
 * (nada de "vista de depuración" con todo visible):
 * - Portales: visibles según `vis?.public` de la carta superior, igual
 *   para cualquier columna (no depende de quién es la activa).
 * - Mano de la jugadora ACTIVA (`window.turn`): según
 *   `c.vis?.owner || pl.hasClariActivo || pl.haTenidoClarividente`.
 * - Mano de cualquier OTRA jugadora: según `h.vis?.others`, salvo que esa
 *   jugadora tenga `hasClariActivo || haTenidoClarividente`, en cuyo caso
 *   se oculta la mano COMPLETA al resto (decisión de mesa, ver
 *   docs/reglamento/REGLAMENTO.md, nota de Clarividente).
 * La columna de la jugadora activa se resalta (`.turno-activo`); el resto
 * se atenúa (`.turno-inactivo`), sin perder su color de identidad fijo.
 */
function renderBoardGrid(players, neutrals) {
  const grid = document.querySelector('#boardGrid');
  if (!grid) return;

  const totalCols = players.length + (neutrals.length ? 1 : 0);
  grid.style.gridTemplateColumns = `repeat(${totalCols}, 1fr)`;

  let html = '';
  players.forEach((p, i) => {
    const esActiva = i === window.turn;
    const colorClass = ['player-red', 'player-blue', 'player-yellow', 'player-purple'][i % 4];
    const turnoClass = esActiva ? 'turno-activo' : 'turno-inactivo';
    html += `<div class="board-col section ${colorClass} ${turnoClass}">`;

    const gemasTxt = esActiva
      ? `G ${sumaGemas(p.gems)} total — ${desgloseGemasPropio(p.gems)}`
      : desgloseGemasAjeno(p.gems);
    html += `<h4>${p.name} (${gemasTxt})</h4>`;

    html += '<div class="board-portals">';
    p.portals.forEach((stack, j) => {
      const destKey = esActiva ? `p:${j}` : `a:${i}:${j}`;
      html += portalCardJugarHtml(stack, `Portal ${j + 1}`, destKey);
    });
    html += '</div>';

    html += '<h5>Mano</h5><div class="board-hand">';
    if (esActiva) {
      p.hand.forEach((c, idx) => {
        const visible = c.vis?.owner || p.hasClariActivo || p.haTenidoClarividente;
        const selectedClass = idx === window.selectedCardIdx ? ' selected' : '';
        html += `
          <div class="card${selectedClass}" draggable="true"
            onclick="window.selectHandCard(${idx})"
            ondragstart="window.handleCardDragStart(event, ${idx})">
            ${cartaImgHtml(c.name, visible)}
          </div>`;
      });
    } else {
      // Decisión de mesa (ver docs/reglamento/REGLAMENTO.md, nota sobre
      // Clarividente): mientras esta jugadora tenga la Clarividente
      // visible/en periodo de gracia, su mano COMPLETA queda oculta para
      // el resto — se sobrescribe la visibilidad normal, no se combina
      // con OR.
      const manoOcultaPorClarividente = p.hasClariActivo || p.haTenidoClarividente;
      p.hand.forEach(h => {
        const visible = manoOcultaPorClarividente ? false : h.vis?.others === true;
        html += `<div class="card">${cartaImgHtml(h.name, visible)}</div>`;
      });
    }
    html += '</div>';

    html += '</div>'; // .board-col
  });

  if (neutrals.length) {
    html += '<div class="board-col section"><h4>Neutrales</h4><div class="board-portals">';
    neutrals.forEach((stack, i) => {
      html += portalCardJugarHtml(stack, `Neutral ${i + 1}`, `n:${i}`);
    });
    html += '</div></div>';
  }

  grid.innerHTML = html;
}

/**
 * Renderiza toda la interfaz del juego: el tablero único (`renderBoardGrid`)
 * y el estado de la invocación activa.
 * @param {Array} players - Array de jugadores.
 * @param {Array} neutrals - Array de portales neutrales.
 * @param {number} levelIdx - Índice de la invocación actual.
 */
export function render(players, neutrals, levelIdx) {
  // Solo actualiza los flags hasClariActivo/haTenidoClarividente del
  // jugador; NUNCA muta carta.vis (ver js/utils.js) — el efecto de
  // Clarividente se decide en el momento de mostrar cada carta (más abajo),
  // no persistiéndolo en el dato real. Así el estado subyacente (una carta
  // visible + una oculta) nunca se corrompe, y sigue intacto si después el
  // Aprendiz intercambia esta mano con la de otra jugadora.
  actualizarClarividente(players);

  // Botón de cancelar selección: visible solo mientras hay una carta de la
  // mano elegida para jugar.
  document.querySelector('#btnPlayCancel')?.classList.toggle(
    'hidden',
    window.selectedCardIdx === null || window.selectedCardIdx === undefined
  );

  renderBoardGrid(players, neutrals);

  const lblInv = document.querySelector('#lblInv');
  const invStatus = document.querySelector('#invStatus');
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
