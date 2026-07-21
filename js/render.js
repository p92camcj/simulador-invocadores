// render.js
import { mostrarCarta, sumaGemas, cardImages, CARTA_OCULTA_IMG } from './utils.js';
import { LEVELS, INVOCATION_SETS, actualizarClarividente } from './utils.js';

/**
 * Resuelve, para una jugadora que acaba de perder la visibilidad de su
 * Clarividente, cuál de sus dos cartas de mano prefiere seguir viendo
 * (REGLAMENTO.md, "Clarividente": "el jugador debe voltear una carta a su
 * elección" — corte inmediato, sin periodo de gracia, ver nota de
 * interpretación). Jugadora humana: picker() con etiquetas neutras (no
 * revela el nombre del personaje, para no filtrar información en la
 * pantalla compartida). Autómata: heurística mínima — se queda con la
 * carta que sea el personaje requerido por la invocación activa si aplica,
 * si no, al azar (documentado también en bot.js como punto de extensión
 * futuro si se quisiera algo más elaborado).
 */
function resolverEleccionClarividente(player) {
  const [c0, c1] = player.hand;
  if (!c0 || !c1) {
    // Estado inesperado (debería haber siempre exactamente 2 cartas en
    // mano fuera de mitad de turno): no hay elección real posible, se
    // limpia el marcador de transición sin más.
    player._clariEligiendo = false;
    player._clariVisiblePrev = false;
    return;
  }

  const aplicarEleccion = idxElegida => {
    const elegida = idxElegida === 0 ? c0 : c1;
    const otra = idxElegida === 0 ? c1 : c0;
    elegida.vis = { owner: true, others: false, public: false };
    otra.vis = { owner: false, others: true, public: false };
    player._clariEligiendo = false;
    player._clariVisiblePrev = false;
    render(window.players, window.neutrals, window.levelIdx);
  };

  if (player.tipo === 'auto') {
    const lvl = window.LEVELS?.[window.levelIdx];
    const need = lvl ? window.INVOCATION_SETS?.[window.invocationSet]?.[lvl]?.need : null;
    const esRequerida = c => !!need && need.includes(c.aspecto || c.name);
    let idxElegida;
    if (need && esRequerida(c0) && !esRequerida(c1)) idxElegida = 0;
    else if (need && esRequerida(c1) && !esRequerida(c0)) idxElegida = 1;
    else idxElegida = Math.random() < 0.5 ? 0 : 1;
    aplicarEleccion(idxElegida);
    return;
  }

  const elegir = () => picker(
    `${player.name}: la Clarividente ha dejado de estar visible. ¿Qué carta prefieres seguir viendo?`,
    [
      { val: '0', lbl: 'Mi carta de la izquierda' },
      { val: '1', lbl: 'Mi carta de la derecha' },
    ],
    val => aplicarEleccion(parseInt(val, 10)),
    // No hay forma válida de "no elegir": cancelar simplemente reabre el
    // mismo picker, porque el reglamento exige que la jugadora SÍ elija.
    elegir,
  );
  elegir();
}

/**
 * Detecta, para cada jugadora, la transición "tenía Clarividente visible →
 * ya no la tiene" (comparando `hasClariActivo` recién calculado contra
 * `player._clariVisiblePrev`, guardado en la llamada anterior) y dispara de
 * inmediato `resolverEleccionClarividente()` — nunca se espera al turno
 * propio de la jugadora ni al de nadie más. Si ya hay un picker en curso
 * (de otra habilidad, o de otra Clarividente resolviéndose) se pospone sin
 * más: como `_clariVisiblePrev` no se actualiza para esa jugadora mientras
 * está pendiente, se reintenta automáticamente en la siguiente llamada a
 * `render()` (que ocurre constantemente tras cualquier acción del juego).
 */
function gestionarTransicionesClarividente(players) {
  actualizarClarividente(players);
  const pickerEnCurso = !!window.pickerObjetivoPortal ||
    document.querySelector('#picker')?.classList.contains('hidden') === false;
  players.forEach(player => {
    if (player._clariVisiblePrev === true && !player.hasClariActivo && !player._clariEligiendo) {
      if (pickerEnCurso) return;
      player._clariEligiendo = true;
      resolverEleccionClarividente(player);
      return;
    }
    if (!player._clariEligiendo) {
      player._clariVisiblePrev = player.hasClariActivo;
    }
  });
}

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

// Tarea 5: círculos de color en vez de texto plano por nivel/color de
// invocación (mapeo de colores según las reglas del juego, ver
// REGLAMENTO.md — azul: Gemas unitarias de valor 1; amarillo: primera
// invocación completada (nivel C); rojo: siguiente invocación (nivel B);
// morado: última invocación (nivel A)). Orden fijo, de menor a mayor
// valor, para que la misma posición signifique siempre lo mismo de un
// vistazo a otro. TODO si el futuro Modo Experto conecta
// `INVOCATION_ASTERISCO` (`utils.js`) a algún flujo real: haría falta un
// quinto nivel/color aquí — no implementado ahora porque hoy no hay
// ninguna Gema real de nivel 'experto' en juego (ver CLAUDE.md).
const NIVEL_ORDEN_GEMAS = ['unitaria', 'C', 'B', 'A'];
const NIVEL_CLASE_GEMA = { unitaria: 'gem-dot--unitaria', C: 'gem-dot--c', B: 'gem-dot--b', A: 'gem-dot--a' };

/**
 * Círculos de color con el recuento de Gemas por nivel. Para la jugadora
 * activa (`mostrarValorReal: true`) añade entre paréntesis la suma de los
 * valores reales de ese grupo — el resto de jugadoras solo ven el
 * recuento por nivel, nunca valores reales (fuga de información, ver
 * REGLAMENTO.md sobre secreto de Gemas) — igual que ya hacía
 * `desgloseGemasPropio()`/`desgloseGemasAjeno()`, ahora unificadas en esta
 * única función.
 */
function gemDotsHtml(gems, { mostrarValorReal }) {
  if (!gems.length) return 'sin Gemas';
  const porNivel = new Map();
  gems.forEach(g => {
    const entry = porNivel.get(g.nivel) || { count: 0, suma: 0 };
    entry.count++;
    entry.suma += g.valor || 0;
    porNivel.set(g.nivel, entry);
  });
  return NIVEL_ORDEN_GEMAS
    .filter(nivel => porNivel.has(nivel))
    .map(nivel => {
      const { count, suma } = porNivel.get(nivel);
      const valorTxt = mostrarValorReal ? ` (${suma})` : '';
      return `<span class="gem-dot ${NIVEL_CLASE_GEMA[nivel]}" title="Gemas de nivel ${nivel}"></span>×${count}${valorTxt}`;
    })
    .join(' ');
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
 * Como picker(), pero además habilita clicar directamente los Portales
 * válidos del tablero como alternativa al modal — mismo criterio que jugar
 * carta: ambos métodos de selección coexisten, ninguno sustituye al otro.
 * `opciones` debe tener el formato de `portalesConEstado()` (utils.js):
 * val = "playerIdx:portalIdx" o "n:idx", con `disabled` ya calculado por la
 * regla real de la habilidad (incluida la protección de Centinela). El
 * clic en el tablero y el OK del modal convergen en la MISMA `cb`, así que
 * no hay validación duplicada.
 */
export function pickerPortal(title, opciones, cb, onCancel) {
  window.pickerObjetivoPortal = { opciones, cb };
  render(window.players, window.neutrals, window.levelIdx);
  picker(title, opciones, val => {
    window.pickerObjetivoPortal = null;
    cb(val);
  }, () => {
    window.pickerObjetivoPortal = null;
    render(window.players, window.neutrals, window.levelIdx);
    onCancel?.();
  });
}

/**
 * Construye el HTML de un Portal (propio, central o de otra jugadora).
 * `keyObjetivo` es su clave en formato `portalesConEstado()`
 * ("playerIdx:portalIdx" o "n:idx"). Dos modos, mutuamente excluyentes
 * (una activación de habilidad solo puede empezar con Fase A ya resuelta,
 * así que nunca coincide con una carta de mano todavía seleccionada):
 * - Con `window.pickerObjetivoPortal` activo (Tarea D: selección de
 *   objetivo de habilidad en curso): si este Portal es una opción válida,
 *   clicable vía `window.selectPortalObjetivo`, resaltado con
 *   `.target-portal`; si no es válida (`disabled`), NO responde al clic,
 *   se atenúa (`.target-portal-disabled`) y su etiqueta se marca con 🚫 —
 *   mismo criterio visual que usa `picker()` en el `<select>`.
 * - Si no, modo normal "jugar carta": clicable/soltable con
 *   `portalPlayAttrs(destKeyJugar)`, resaltado con `.target-portal`
 *   mientras haya una carta de mano seleccionada (el clic no hace nada
 *   sin selección).
 */
function portalCardHtml(stack, label, destKeyJugar, keyObjetivo) {
  const topCard = stack.at(-1);
  // aspecto || name (ítem 14 de DEUDA_TECNICA.md): la imagen sigue la
  // apariencia (disfraz del Metamorfo), nunca la identidad real.
  const body = stack.length === 0
    ? '<div class="card-empty">Vacío</div>'
    : cartaImgHtml(topCard.aspecto || topCard.name, topCard.vis?.public === true);

  const objetivo = window.pickerObjetivoPortal;
  if (objetivo) {
    const opcion = objetivo.opciones.find(o => o.val === keyObjetivo);
    if (!opcion || opcion.disabled) {
      return `<div class="card target-portal-disabled"><div class="card-label">🚫 ${label} (${stack.length})</div>${body}</div>`;
    }
    return `<div class="card target-portal" onclick="window.selectPortalObjetivo('${keyObjetivo}')"><div class="card-label">${label} (${stack.length})</div>${body}</div>`;
  }

  const haySeleccion = window.selectedCardIdx !== null && window.selectedCardIdx !== undefined;
  const targetClass = haySeleccion ? ' target-portal' : '';
  return `<div class="card${targetClass}" ${portalPlayAttrs(destKeyJugar)}><div class="card-label">${label} (${stack.length})</div>${body}</div>`;
}

/**
 * Fila de Portales centrales/neutrales: a lo ancho de todo el contenedor,
 * POR ENCIMA del grid de columnas de jugadoras (Tarea 2, revisión) — nunca
 * mezclada entre las columnas de jugadoras, para que no pase desapercibida
 * como zona compartida. Oculta por completo cuando no hay Portales
 * centrales en esta partida (4-5 jugadoras pueden dar 1 o 0, ver
 * `js/setup.js`), en vez de dejar un hueco vacío.
 */
function renderBoardNeutrals(neutrals) {
  const el = document.querySelector('#boardNeutrals');
  if (!el) return;

  if (!neutrals.length) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }

  el.classList.remove('hidden');
  let html = '<h4>Portales centrales</h4><div class="board-portals">';
  neutrals.forEach((stack, i) => {
    html += portalCardHtml(stack, `Neutral ${i + 1}`, `n:${i}`, `n:${i}`);
  });
  html += '</div>';
  el.innerHTML = html;
}

/**
 * Tablero único e interactivo: una columna por jugadora (orden fijo por
 * índice, no se reordena según el turno). Los Portales centrales se
 * pintan aparte, en `renderBoardNeutrals()` (fila propia por encima de
 * este grid, ver Tarea 2) — este grid ya no incluye una columna para
 * ellos. Sustituye a las antiguas zonas separadas zoneActive/zoneOthers/
 * neutralArea — visibilidad real en todo momento (nada de "vista de
 * depuración" con todo visible):
 * - Portales: visibles según `vis?.public` de la carta superior, igual
 *   para cualquier columna (no depende de quién es la activa).
 * - Mano de la jugadora ACTIVA (`window.turn`), SOLO si es humana
 *   (`p.tipo !== 'auto'`, `esHumanaActiva` más abajo): según
 *   `c.vis?.owner || pl.hasClariActivo`.
 * - Mano de cualquier OTRA jugadora, Y de una autómata en su propio turno
 *   (una autómata nunca tiene "su propia pantalla" que la vea — ver
 *   `js/bot.js`): según `h.vis?.others`, salvo que esa jugadora tenga
 *   `hasClariActivo`, en cuyo caso se oculta la mano COMPLETA al resto
 *   (decisión de mesa, ver docs/reglamento/REGLAMENTO.md, nota de
 *   Clarividente). Ya no hay periodo de gracia: en cuanto deja de estar
 *   activa, la elección inmediata de la jugadora
 *   (`gestionarTransicionesClarividente`, más abajo) ya ha dejado
 *   `card.vis` en el estado correcto para volver a la visibilidad normal.
 * La columna de la jugadora activa se resalta (`.turno-activo`); el resto
 * se atenúa (`.turno-inactivo`), sin perder su color de identidad fijo.
 */
function renderBoardGrid(players, neutrals) {
  renderBoardNeutrals(neutrals);

  const grid = document.querySelector('#boardGrid');
  if (!grid) return;

  // minmax(240px, 1fr): cada columna crece para llenar el ancho disponible
  // cuando cabe (pantallas anchas, sin scroll horizontal); el scroll
  // horizontal de `.board-grid` (style.css) solo entra en juego cuando ni
  // siquiera el mínimo de 240px por columna cabe (pantallas estrechas o
  // muchas jugadoras a la vez) — mismo criterio para cualquier ancho, sin
  // rama de código separada para escritorio/móvil.
  grid.style.gridTemplateColumns = `repeat(${players.length}, minmax(240px, 1fr))`;

  let html = '';
  players.forEach((p, i) => {
    const esActiva = i === window.turn;
    // Una autómata nunca tiene "su propia pantalla" — la única audiencia es
    // la persona humana mirando esta pantalla compartida, así que su carta
    // "visible" (solo-dueña) y su desglose exacto de Gemas NUNCA deben
    // mostrarse, ni siquiera durante su propio turno (a diferencia de una
    // jugadora humana activa, para quien mostrarlo es la simplificación ya
    // asumida de este simulador de una sola pantalla — ver CLAUDE.md,
    // "Future direction"). `esHumanaActiva` sustituye a `esActiva` solo en
    // esos dos sitios; el resto (resaltado de columna, destino de Portal
    // para jugar) sigue dependiendo del turno real.
    const esHumanaActiva = esActiva && p.tipo !== 'auto';
    const colorClass = ['player-red', 'player-blue', 'player-yellow', 'player-purple'][i % 4];
    const turnoClass = esActiva ? 'turno-activo' : 'turno-inactivo';
    html += `<div class="board-col section ${colorClass} ${turnoClass}">`;

    const gemasTxt = esHumanaActiva
      ? `G ${sumaGemas(p.gems)} total — ${gemDotsHtml(p.gems, { mostrarValorReal: true })}`
      : gemDotsHtml(p.gems, { mostrarValorReal: false });
    html += `<h4>${p.name}${p.tipo === 'auto' ? ' 🤖' : ''} <span class="gem-breakdown">(${gemasTxt})</span></h4>`;

    html += '<div class="board-portals">';
    p.portals.forEach((stack, j) => {
      const destKeyJugar = esActiva ? `p:${j}` : `a:${i}:${j}`;
      html += portalCardHtml(stack, `Portal ${j + 1}`, destKeyJugar, `${i}:${j}`);
    });
    html += '</div>';

    html += '<h5>Mano</h5><div class="board-hand">';
    if (esHumanaActiva) {
      p.hand.forEach((c, idx) => {
        const visible = c.vis?.owner || p.hasClariActivo;
        const selectedClass = idx === window.selectedCardIdx ? ' selected' : '';
        html += `
          <div class="card${selectedClass}" draggable="true"
            onclick="window.selectHandCard(${idx})"
            ondragstart="window.handleCardDragStart(event, ${idx})">
            ${cartaImgHtml(c.aspecto || c.name, visible)}
          </div>`;
      });
    } else {
      // Misma rama para cualquier jugadora no activa Y para una autómata en
      // su propio turno (ver `esHumanaActiva` arriba): nunca ve su propia
      // carta "visible", solo la "oculta" (pública para el resto por
      // reglamento). De paso, ninguna carta con onclick/draggable — nada de
      // controles de selección para una autómata (tampoco tiene sentido que
      // el resto de jugadoras seleccione cartas ajenas).
      //
      // Decisión de mesa (ver docs/reglamento/REGLAMENTO.md, nota sobre
      // Clarividente): mientras esta jugadora tenga la Clarividente
      // visible, su mano COMPLETA queda oculta para el resto — se
      // sobrescribe la visibilidad normal, no se combina con OR. Sin
      // periodo de gracia: en cuanto deja de estar activa, esta jugadora
      // vuelve de inmediato a la visibilidad normal (ver
      // gestionarTransicionesClarividente más arriba).
      const manoOcultaPorClarividente = p.hasClariActivo;
      p.hand.forEach(h => {
        const visible = manoOcultaPorClarividente ? false : h.vis?.others === true;
        html += `<div class="card">${cartaImgHtml(h.aspecto || h.name, visible)}</div>`;
      });
    }
    html += '</div>';

    html += '</div>'; // .board-col
  });

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
  // Actualiza hasClariActivo (nunca muta carta.vis directamente aquí, ver
  // js/utils.js: el efecto "ver ambas cartas" se decide al mostrar cada
  // carta, más abajo) y, si para alguna jugadora acaba de pasar de true a
  // false, dispara de inmediato su elección de qué carta seguir viendo
  // (picker humano o heurística de bot) — sin periodo de gracia, ver
  // gestionarTransicionesClarividente() más arriba. Esa elección sí muta
  // carta.vis de las dos cartas de mano afectadas, de forma real y
  // persistente (no una regla de visualización), exactamente como pide
  // REGLAMENTO.md ("el jugador debe voltear una carta a su elección").
  gestionarTransicionesClarividente(players);

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
  // aspecto || name (ítem 14 de DEUDA_TECNICA.md): este recuento debe
  // reflejar exactamente lo mismo que la comprobación real de invocación en
  // actions.js, que también cuenta por apariencia — si no, este indicador
  // podría mostrar "falta" un personaje que un Metamorfo transformado ya
  // está cumpliendo de verdad.
  players.forEach(p => p.portals.forEach(stack => {
    if (stack.length && stack.at(-1).vis?.public) {
      const nombre = stack.at(-1).aspecto || stack.at(-1).name;
      if (cnt[nombre] !== undefined) cnt[nombre]++;
    }
  }));
  neutrals.forEach(stack => {
    if (stack.length && stack.at(-1).vis?.public) {
      const nombre = stack.at(-1).aspecto || stack.at(-1).name;
      if (cnt[nombre] !== undefined) cnt[nombre]++;
    }
  });
  invStatus.innerHTML = need.map(n => {
    const cls = cnt[n] === 0 ? 'missing' : cnt[n] === 1 ? 'present' : 'duplicate';
    return `<span class="${cls}">${mostrarCarta({ name: n })}</span>`;
  }).join(' , ');
}
