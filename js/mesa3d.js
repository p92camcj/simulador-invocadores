// js/mesa3d.js
//
// Vista "Mesa 3D": una interfaz alternativa a la clásica, pensada para
// jugar con el dedo en un móvil. Mesa en perspectiva con cartas 3D (CSS 3D,
// sin librerías), tu mano abajo en abanico, los rivales arriba y los
// Portales centrales en medio.
//
// No contiene reglas. Lee lo que se enseña de `construirVistaMesa()`
// (js/vista-mesa.js, puro) y actúa con las mismas funciones que la vista
// clásica: window.selectHandCard, window.tryPlayOnPortal,
// window.selectPortalObjetivo y los botones #btnAbility, #btnEndTurn y
// #btnPlayCancel (actions.js). Así las dos vistas no pueden divergir.
//
// Se engancha en tres sitios:
// - render() (render.js) llama a renderMesa3D() en cada pintado.
// - picker() (render.js) delega en pickerMesa() mientras la vista esté
//   activa: hoja inferior con botones grandes en vez de un <select>.
// - nextTurn() (game.js) llama a anunciarTurnoMesa() en vez de alert().
// Además, mientras la vista esté activa, alert() se muestra como aviso
// flotante que no bloquea la partida.

import { cardImages, CARTA_OCULTA_IMG, escapeHtml, iconos } from './utils.js';
import { rutaFigura, rutaCriatura, espectaculoActivo, fijarEspectaculo } from './espectaculo.js';
import { estado } from './motor/estado.js';
import { render } from './render.js';
import { opcionesFaseB } from './motor/acciones.js';
import {
  construirVistaMesa, elegirAsientoPropio, claveJugar, claveObjetivo, firmaPortal,
  cambioPortal, pistaTurno, contarHumanas,
} from './vista-mesa.js';

const CLAVE_VISTA = 'invocadores.vista';
const COLORES_JUGADORA = ['#ff6b6b', '#4dabf7', '#ffd43b', '#b197fc', '#69db7c'];
const DURACION_ANIM = 750;

// ---------- Preferencia de vista ----------

function vistaPorDefecto() {
  try {
    const guardada = localStorage.getItem(CLAVE_VISTA);
    if (guardada === 'mesa' || guardada === 'clasica') return guardada;
  } catch { /* sin almacenamiento */ }
  // En pantallas táctiles se empieza en la mesa.
  return window.matchMedia?.('(pointer: coarse)').matches ? 'mesa' : 'clasica';
}

let vista = 'clasica';

export function vistaMesaActiva() {
  return vista === 'mesa';
}

/** Cambia de vista ('mesa' | 'clasica'), la recuerda y repinta. */
export function fijarVista(nueva) {
  vista = nueva === 'mesa' ? 'mesa' : 'clasica';
  try { localStorage.setItem(CLAVE_VISTA, vista); } catch { /* nada */ }
  document.body.classList.toggle('vista-mesa', vista === 'mesa');
  const sel = document.querySelector('#selVista');
  if (sel) sel.value = vista;
  if (vista !== 'mesa') {
    cerrarHoja();
    document.body.classList.remove('mesa-en-partida');
  }
  ultimoHtml = '';
  if (estado.partida.players.length && document.querySelector('#setup')?.classList.contains('hidden')) {
    render(estado.partida.players, estado.partida.neutrals, estado.partida.levelIdx);
  }
}

/** Retardo antes de que juegue una autómata: algo más lento en la mesa. */
export function retardoAutomata() {
  return vistaMesaActiva() ? 1300 : 500;
}

/** Al volver al menú: la mesa desaparece. */
export function salirDeMesa() {
  document.body.classList.remove('mesa-en-partida');
  cerrarHoja();
  document.querySelector('.m-telon')?.remove();
  const raiz = document.querySelector('#mesa3d');
  if (raiz) raiz.innerHTML = '';
  ultimoHtml = '';
  firmas.clear();
  ultimaHumana = null;
}

// ---------- Estado propio de la vista (no es partida) ----------

let ultimoHtml = '';
let ultimaHumana = null;
const firmas = new Map();      // clave → firma pública del Portal / carta
const animHasta = new Map();   // clave → { clase, hasta }
let vuelo = null;              // { dest, rect, src } carta volando a un Portal
let arrastre = null;
let ignorarClickHasta = 0;
let hojaActual = null;         // { tipo: 'picker' | 'info', ... }
let activables = new Map();    // clave de Portal → { origen, lbl } (Fase B)

// ---------- Inicialización ----------

export function initMesa3D() {
  vista = vistaPorDefecto();
  document.body.classList.toggle('vista-mesa', vista === 'mesa');

  const sel = document.querySelector('#selVista');
  if (sel) {
    sel.value = vista;
    sel.addEventListener('change', e => fijarVista(e.target.value));
  }
  document.querySelector('#btnVista')?.addEventListener('click', () => fijarVista('mesa'));

  // alert() → aviso flotante mientras se juega en la mesa.
  const alertOriginal = window.alert.bind(window);
  window.alert = msg => {
    if (vistaMesaActiva() && document.body.classList.contains('mesa-en-partida')) mostrarAviso(String(msg));
    else alertOriginal(msg);
  };

  const raiz = asegurarRaiz();
  raiz.addEventListener('click', alClicar);
  raiz.addEventListener('pointerdown', alEmpezarArrastre);
  window.addEventListener('pointermove', alMoverArrastre, { passive: false });
  window.addEventListener('pointerup', alSoltarArrastre);
  window.addEventListener('pointercancel', cancelarArrastre);
}

function asegurarRaiz() {
  let raiz = document.querySelector('#mesa3d');
  if (!raiz) {
    raiz = document.createElement('div');
    raiz.id = 'mesa3d';
    document.body.appendChild(raiz);
  }
  return raiz;
}

// ---------- Piezas de HTML ----------

const imgCarta = nombre => cardImages[nombre] || CARTA_OCULTA_IMG;

/** Carta 3D con cara y dorso. Una carta oculta nunca lleva su nombre. */
function carta3d(cv, { clase = '', anim = '' } = {}) {
  const visible = !!cv?.visible;
  const frente = visible ? imgCarta(cv.nombre) : CARTA_OCULTA_IMG;
  const alt = visible ? escapeHtml(cv.nombre) : 'Carta oculta';
  return `<span class="c3d ${visible ? '' : 'dorso'} ${clase} ${anim}">`
    + `<span class="c3d-cuerpo">`
    + `<img class="c3d-cara" src="${frente}" alt="${alt}" draggable="false">`
    + `<img class="c3d-trasera" src="${CARTA_OCULTA_IMG}" alt="" draggable="false">`
    + `</span></span>`;
}

function claseAnim(clave, cambio) {
  const ahora = Date.now();
  if (cambio) animHasta.set(clave, { clase: `anim-${cambio}`, hasta: ahora + DURACION_ANIM });
  const a = animHasta.get(clave);
  if (a && a.hasta > ahora) return a.clase;
  animHasta.delete(clave);
  return '';
}

/** Gemas: total exacto si es tuya y tu turno; si no, solo por nivel. */
function gemasHtml(g) {
  const niveles = [['unitaria', 'u'], ['C', 'c'], ['B', 'b'], ['A', 'a']];
  const puntos = niveles
    .filter(([n]) => g.porNivel[n] > 0)
    .map(([n, c]) => `<span class="m-gema m-gema--${c}" title="Gemas de nivel ${n}"></span><b>${g.porNivel[n]}</b>`)
    .join('');
  const total = g.total !== null ? `<span class="m-gemas-total">💎 ${g.total}</span>` : '';
  const rev = g.reveladas.length ? `<span class="m-gemas-rev">${g.reveladas.map(v => `${v}*`).join(' ')}</span>` : '';
  return `<span class="m-gemas">${total}${puntos || '<i>sin Gemas</i>'}${rev}</span>`;
}

/**
 * Un Portal. `dest` (para jugar) y `obj` (para habilidades) usan los
 * formatos de actions.js. `clave` identifica el Portal entre pintados.
 */
function portalHtml(pv, { dest, obj, clave, etiqueta, tam, aria = etiqueta }) {
  const firma = firmaPortal(pv);
  const cambio = cambioPortal(firmas.get(clave), firma);
  firmas.set(clave, firma);

  const esperandoVuelo = vuelo && vuelo.dest === dest && vuelo.clave === clave;
  const anim = esperandoVuelo ? '' : claseAnim(clave, cambio);

  const objetivo = window.pickerObjetivoPortal;
  const haySel = window.selectedCardIdx !== null && window.selectedCardIdx !== undefined;
  let estadoCls = '';
  if (objetivo) {
    const op = objetivo.opciones.find(o => o.val === obj);
    estadoCls = !op || op.disabled ? 'bloqueado' : 'objetivo';
  } else if (haySel) {
    estadoCls = 'destino';
  } else if (activables.has(clave)) {
    estadoCls = 'activable';
  }

  const capas = Math.min(Math.max(pv.altura - 1, 0), 6);
  const cuerpo = pv.top
    ? carta3d(pv.top, { anim })
    : `<span class="m-portal-vacio"><img src="assets/portal.jpg" alt="" draggable="false"></span>`;
  const nombreTop = pv.top?.visible ? pv.top.nombre : (pv.top ? 'Carta oculta' : 'Vacío');

  return `<button type="button" class="m-portal m-portal--${tam} ${estadoCls} ${esperandoVuelo ? 'esperando-vuelo' : ''}"`
    + ` data-dest="${dest}" data-obj="${obj}" data-clave="${clave}"`
    + ` aria-label="${escapeHtml(aria)}: ${escapeHtml(nombreTop)}, ${pv.altura} carta${pv.altura === 1 ? '' : 's'}">`
    + `<span class="m-runa"></span>`
    + `<span class="m-pila capas-${capas}">${cuerpo}</span>`
    + (pv.altura > 0 ? `<span class="m-altura">${pv.altura}</span>` : '')
    + `<span class="m-etiqueta">${escapeHtml(etiqueta)}</span>`
    + `</button>`;
}

function nombreAsiento(a) {
  return `${a.automata ? '🤖 ' : ''}${escapeHtml(a.nombre)}`;
}

function rivalHtml(a, turno, unico) {
  const color = COLORES_JUGADORA[a.idx % COLORES_JUGADORA.length];
  const portales = a.portales.map((pv, j) => portalHtml(pv, {
    dest: claveJugar(turno, a.idx, j),
    obj: claveObjetivo(a.idx, j),
    clave: `${a.idx}:${j}`,
    etiqueta: a.portales.length > 1 ? `Portal ${j + 1}` : 'Portal',
    aria: a.portales.length > 1 ? `Portal ${j + 1} de ${a.nombre}` : `Portal de ${a.nombre}`,
    tam: 's',
  })).join('');
  const mano = a.mano.map((cv, k) => {
    const clave = `mano:${a.idx}:${k}`;
    const firma = cv ? (cv.visible ? cv.nombre : '?') : '-';
    const cambio = firmas.has(clave) && firmas.get(clave) !== firma ? 'entra' : null;
    firmas.set(clave, firma);
    return `<span class="m-mano-mini-carta" data-ver-mano="${a.idx}:${k}">${carta3d(cv, { anim: claseAnim(clave, cambio) })}</span>`;
  }).join('');
  return `<section class="m-rival ${a.activa ? 'activa' : ''} ${unico ? 'unico' : ''}" style="--color:${color}">`
    + `<header class="m-rival-cab"><span class="m-nombre">${nombreAsiento(a)}${a.activa ? ' <span class="m-turno-punto"></span>' : ''}</span>${gemasHtml(a.gemas)}</header>`
    + `<div class="m-rival-cuerpo"><div class="m-portales">${portales}</div>`
    + `<div class="m-mano-mini" aria-label="Mano de ${escapeHtml(a.nombre)}">${mano}</div></div>`
    + (a.clarividente ? `<span class="m-sello" title="Clarividente visible: su mano queda oculta">👁️</span>` : '')
    + `</section>`;
}

function invocacionHtml(inv) {
  if (!inv) return '<div class="m-invocacion"><strong>Sin invocación activa</strong></div>';
  const criatura = rutaCriatura(inv.nombre);
  return `<button type="button" class="m-invocacion nivel-${inv.nivel}" data-accion="invocacion">`
    + (criatura ? `<img class="m-criatura" src="${criatura}" alt="" draggable="false">` : `<span class="m-criatura m-criatura--sin">✦</span>`)
    + `<span class="m-inv-txt"><small>Invocación ${inv.nivel}</small><strong>${escapeHtml(inv.nombre)}</strong></span>`
    + `</button>`;
}

function requeridosHtml(inv) {
  if (!inv) return '';
  return `<div class="m-requeridos">` + inv.requeridos.map(r => {
    const fig = rutaFigura(r.nombre);
    const txt = r.estado === 'falta' ? 'falta' : r.estado === 'esta' ? 'en mesa' : 'repetido';
    return `<span class="m-req m-req--${r.estado}" title="${escapeHtml(r.nombre)}: ${txt}">`
      + (fig ? `<img src="${fig}" alt="" draggable="false">` : `<span class="m-req-ico">${iconos[r.nombre] || '?'}</span>`)
      + `<span class="m-req-nombre">${escapeHtml(r.nombre)}</span></span>`;
  }).join('') + `</div>`;
}

function manoPropiaHtml(a, puedeJugar) {
  const sel = window.selectedCardIdx;
  const n = a.mano.length;
  return a.mano.map((cv, k) => {
    const clave = `mano:${a.idx}:${k}`;
    const firma = cv ? (cv.visible ? cv.nombre : '?') : '-';
    const cambio = firmas.has(clave) && firmas.get(clave) !== firma ? 'reparte' : null;
    firmas.set(clave, firma);
    const giro = n > 1 ? (k - (n - 1) / 2) * 9 : 0;
    const seleccionada = puedeJugar && sel === k;
    return `<button type="button" class="m-carta-mano ${seleccionada ? 'seleccionada' : ''} ${puedeJugar ? 'jugable' : ''}"`
      + ` style="--giro:${giro}deg" data-mano="${k}"`
      + ` aria-label="${cv?.visible ? escapeHtml(cv.nombre) : 'Carta oculta para ti'}${seleccionada ? ' (seleccionada)' : ''}">`
      + carta3d(cv, { anim: claseAnim(clave, cambio) })
      + `</button>`;
  }).join('');
}

// ---------- Pintado ----------

/**
 * Pinta la mesa. La llama render() (render.js) en cada pintado; no hace
 * nada si la vista activa es la clásica.
 */
export function renderMesa3D() {
  if (!vistaMesaActiva()) return;
  const partida = estado.partida;
  if (!partida.players.length) return;
  if (!document.querySelector('#setup')?.classList.contains('hidden')) return;
  document.body.classList.add('mesa-en-partida');
  const raiz = asegurarRaiz();
  const ahora = Date.now();
  animHasta.forEach((a, k) => { if (a.hasta <= ahora) animHasta.delete(k); });

  const turno = partida.turn;
  if (partida.players[turno] && partida.players[turno].tipo !== 'auto') ultimaHumana = turno;
  const asiento = elegirAsientoPropio(partida.players, turno, ultimaHumana);
  const v = construirVistaMesa(partida, { asientoPropio: asiento });

  const miTurno = v.propio.activa && !v.propio.automata && !v.terminada;
  const puedeJugar = miTurno && !v.jugada;
  const haySel = window.selectedCardIdx !== null && window.selectedCardIdx !== undefined;
  const eligiendoObjetivo = !!window.pickerObjetivoPortal;

  // Fase B: Portales cuya habilidad se puede activar ahora (brillan y, al
  // tocarlos, ofrecen activarla). Mismas opciones que el botón Habilidad.
  activables = new Map();
  const faseB = miTurno && v.jugada && !v.habilidadUsada && !v.cronomantePendiente
    ? (opcionesFaseB(partida).opciones || []) : [];
  faseB.filter(o => !o.disabled).forEach(o => {
    const [tipo, k] = o.val.split(':');
    activables.set(tipo === 'own' ? `${turno}:${k}` : `n:${k}`, o);
  });

  const rivales = v.rivales.map(a => rivalHtml(a, turno, v.rivales.length === 1)).join('');

  const centrales = v.centrales.map((pv, k) => portalHtml(pv, {
    dest: `n:${k}`, obj: claveObjetivo(null, k), clave: `n:${k}`,
    etiqueta: v.centrales.length > 1 ? `Central ${k + 1}` : 'Portal central', tam: 'm',
  })).join('');

  const propios = v.propio.portales.map((pv, j) => portalHtml(pv, {
    dest: claveJugar(turno, v.propio.idx, j),
    obj: claveObjetivo(v.propio.idx, j),
    clave: `${v.propio.idx}:${j}`,
    etiqueta: v.propio.portales.length > 1 ? `Tu Portal ${j + 1}` : 'Tu Portal',
    tam: 'l',
  })).join('');

  const puedeHabilidad = v.cronomantePendiente ? miTurno : activables.size > 0;
  const textoHabilidad = !miTurno || !v.jugada || v.habilidadUsada || v.cronomantePendiente || activables.size
    ? '✦ Habilidad' : 'Sin habilidades';
  const pista = pistaTurno(v, { haySeleccion: haySel, eligiendoObjetivo });
  const colorPropio = COLORES_JUGADORA[v.propio.idx % COLORES_JUGADORA.length];

  const acciones = v.activa.automata
    ? `<div class="m-pensando"><span class="m-spinner"></span>${escapeHtml(pista)}</div>`
    : !miTurno
      ? `<div class="m-pensando">Turno de ${escapeHtml(v.activa.nombre)}</div>`
      : `<p class="m-pista">${escapeHtml(pista)}${haySel && !v.jugada ? ' <button type="button" class="m-mini-btn" data-accion="cancelar">✕ Soltar</button>' : ''}</p>`
        + `<div class="m-botones">`
        + `<button type="button" class="m-btn m-btn--habilidad" data-accion="habilidad" ${puedeHabilidad ? '' : 'disabled'}>${textoHabilidad}</button>`
        + `<button type="button" class="m-btn m-btn--fin ${v.jugada ? 'listo' : ''}" data-accion="terminar">Terminar turno ➜</button>`
        + `</div>`;

  const html = `
    <div class="m-fondo" aria-hidden="true"><span class="m-estrellas"></span><span class="m-niebla"></span></div>
    <header class="m-barra">
      <button type="button" class="m-btn-icono" data-accion="menu" aria-label="Menú">☰</button>
      ${invocacionHtml(v.invocacion)}
      <span class="m-mazo" title="Cartas en el mazo"><span class="m-mazo-pila"></span><b>${v.mazo}</b></span>
    </header>
    ${requeridosHtml(v.invocacion)}
    <main class="m-mesa">
      <div class="m-rivales ${v.rivales.length === 1 ? 'uno' : ''}">${rivales}</div>
      <div class="m-escena">
        <div class="m-plano">
          ${centrales ? `<div class="m-centro"><span class="m-centro-titulo">Portales centrales</span><div class="m-portales">${centrales}</div></div>` : ''}
          <div class="m-propios" style="--color:${colorPropio}"><div class="m-portales">${propios}</div></div>
        </div>
      </div>
    </main>
    <footer class="m-pie ${v.propio.activa ? 'activa' : ''}" style="--color:${colorPropio}">
      <div class="m-propio-cab">
        <span class="m-nombre">${nombreAsiento(v.propio)}${v.propio.activa ? ' <span class="m-turno-punto"></span>' : ''}</span>
        ${v.propio.clarividente ? '<span class="m-sello-txt">👁️ Clarividente: ves tus dos cartas</span>' : ''}
        ${gemasHtml(v.propio.gemas)}
      </div>
      <div class="m-mano ${puedeJugar ? 'puede-jugar' : ''}">${manoPropiaHtml(v.propio, puedeJugar)}</div>
      <div class="m-acciones">${acciones}</div>
    </footer>`;

  if (html !== ultimoHtml) {
    raiz.innerHTML = html;
    ultimoHtml = html;
  }
  if (vuelo && !vuelo.lanzado) lanzarVuelo();
  // Cuando acaba la animación más larga, se repinta sin sus clases.
  if (animHasta.size) programarLimpieza();
}

let limpiezaProgramada = null;
function programarLimpieza() {
  if (limpiezaProgramada) return;
  limpiezaProgramada = setTimeout(() => {
    limpiezaProgramada = null;
    if (vistaMesaActiva() && estado.partida.players.length) renderMesa3D();
  }, DURACION_ANIM + 30);
}

// ---------- Jugar una carta (tocar o arrastrar) ----------

function puedeJugarAhora() {
  const p = estado.partida;
  const actual = p.players[p.turn];
  return !!actual && actual.tipo !== 'auto' && !p.played && !p.juegoTerminado
    && !window.pickerObjetivoPortal && !document.querySelector('.m-telon');
}

/**
 * Juega la carta seleccionada en `dest` y, si la jugada vale, la hace volar
 * desde `rectOrigen` hasta su Portal.
 */
function jugarEn(dest, clave, rectOrigen) {
  const idx = window.selectedCardIdx;
  if (idx === null || idx === undefined) return;
  const img = document.querySelector(`[data-mano="${idx}"] .c3d-cara`)?.getAttribute('src') || CARTA_OCULTA_IMG;
  const rect = rectOrigen || document.querySelector(`[data-mano="${idx}"]`)?.getBoundingClientRect();
  vuelo = { dest, clave, rect, src: img, lanzado: false };
  const antes = estado.partida.played;
  window.tryPlayOnPortal(dest);
  if (antes || !estado.partida.played) {
    vuelo = null;
    mostrarAviso('No puedes jugar esa carta ahí');
    ultimoHtml = '';
    renderMesa3D();
  }
}

function lanzarVuelo() {
  const v = vuelo;
  v.lanzado = true;
  const destino = document.querySelector(`.m-portal[data-clave="${v.clave}"] .m-pila`);
  if (!v.rect || !destino || !document.body.animate) { terminarVuelo(); return; }
  const r1 = v.rect;
  const r2 = destino.getBoundingClientRect();
  const capa = document.createElement('div');
  capa.className = 'm-vuelo';
  capa.innerHTML = `<img src="${v.src}" alt="">`;
  Object.assign(capa.style, { left: `${r1.left}px`, top: `${r1.top}px`, width: `${r1.width}px`, height: `${r1.height}px` });
  document.body.appendChild(capa);
  const dx = r2.left + r2.width / 2 - (r1.left + r1.width / 2);
  const dy = r2.top + r2.height / 2 - (r1.top + r1.height / 2);
  const esc = r2.width / r1.width;
  const anim = capa.animate([
    { transform: 'translate(0,0) scale(1) rotateX(0deg) rotateZ(0deg)', offset: 0 },
    { transform: `translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) scale(${1 + (esc - 1) * 0.3 + 0.15}) rotateX(35deg) rotateZ(-8deg)`, offset: 0.45 },
    { transform: `translate(${dx}px, ${dy}px) scale(${esc}) rotateX(18deg) rotateZ(0deg)`, offset: 1 },
  ], { duration: 560, easing: 'cubic-bezier(.3,.6,.25,1)' });
  anim.onfinish = () => { capa.remove(); terminarVuelo(); };
  anim.oncancel = anim.onfinish;
}

function terminarVuelo() {
  const clave = vuelo?.clave;
  vuelo = null;
  if (clave) animHasta.set(clave, { clase: 'anim-aterriza', hasta: Date.now() + 500 });
  ultimoHtml = '';
  renderMesa3D();
}

// Arrastrar con el dedo (o el ratón) una carta de la mano a un Portal.
function alEmpezarArrastre(e) {
  const carta = e.target.closest('[data-mano]');
  if (!carta || !puedeJugarAhora()) return;
  if (e.button !== undefined && e.button !== 0) return;
  arrastre = { idx: parseInt(carta.dataset.mano, 10), x0: e.clientX, y0: e.clientY, activo: false, fantasma: null, sobre: null };
}

function portalBajo(x, y) {
  const el = document.elementFromPoint(x, y);
  return el?.closest?.('.m-portal') || null;
}

function alMoverArrastre(e) {
  if (!arrastre) return;
  const dx = e.clientX - arrastre.x0, dy = e.clientY - arrastre.y0;
  if (!arrastre.activo) {
    if (Math.hypot(dx, dy) < 12) return;
    arrastre.activo = true;
    if (window.selectedCardIdx !== arrastre.idx) window.selectHandCard(arrastre.idx);
    const origen = document.querySelector(`[data-mano="${arrastre.idx}"]`);
    const r = origen?.getBoundingClientRect();
    if (!r) { arrastre = null; return; }
    const f = document.createElement('div');
    f.className = 'm-fantasma';
    f.innerHTML = `<img src="${origen.querySelector('.c3d-cara')?.getAttribute('src') || CARTA_OCULTA_IMG}" alt="">`;
    Object.assign(f.style, { width: `${r.width}px`, height: `${r.height}px` });
    arrastre.fantasma = f;
    arrastre.w = r.width; arrastre.h = r.height;
    document.body.appendChild(f);
    origen.classList.add('arrastrando');
  }
  e.preventDefault();
  const f = arrastre.fantasma;
  f.style.transform = `translate(${e.clientX - arrastre.w / 2}px, ${e.clientY - arrastre.h * 0.6}px) rotate(${Math.max(-12, Math.min(12, dx / 12))}deg)`;
  const portal = portalBajo(e.clientX, e.clientY);
  if (portal !== arrastre.sobre) {
    arrastre.sobre?.classList.remove('sobre');
    portal?.classList.add('sobre');
    arrastre.sobre = portal;
  }
}

function alSoltarArrastre(e) {
  if (!arrastre) return;
  const a = arrastre;
  arrastre = null;
  if (!a.activo) return;
  ignorarClickHasta = Date.now() + 400;
  const rect = a.fantasma.getBoundingClientRect();
  a.fantasma.remove();
  a.sobre?.classList.remove('sobre');
  const portal = portalBajo(e.clientX, e.clientY);
  if (portal) {
    jugarEn(portal.dataset.dest, portal.dataset.clave, rect);
  } else {
    ultimoHtml = '';
    renderMesa3D();
  }
}

function cancelarArrastre() {
  if (!arrastre) return;
  arrastre.fantasma?.remove();
  arrastre.sobre?.classList.remove('sobre');
  arrastre = null;
  ultimoHtml = '';
  renderMesa3D();
}

// ---------- Toques ----------

function alClicar(e) {
  if (Date.now() < ignorarClickHasta) return;
  const accion = e.target.closest('[data-accion]')?.dataset.accion;
  if (accion) { ejecutarAccion(accion); return; }

  const cartaMano = e.target.closest('[data-mano]');
  if (cartaMano) {
    const idx = parseInt(cartaMano.dataset.mano, 10);
    if (puedeJugarAhora()) {
      window.selectHandCard(idx);
    } else {
      inspeccionarCarta(cartaMano, 'Carta de tu mano');
    }
    return;
  }

  const portal = e.target.closest('.m-portal');
  if (portal) { tocarPortal(portal); return; }

  const mini = e.target.closest('[data-ver-mano]');
  if (mini) inspeccionarCarta(mini, 'Carta en la mano de una rival');
}

function tocarPortal(portal) {
  const objetivo = window.pickerObjetivoPortal;
  if (objetivo) {
    const op = objetivo.opciones.find(o => o.val === portal.dataset.obj);
    if (!op || op.disabled) {
      portal.classList.remove('sacude');
      void portal.offsetWidth;
      portal.classList.add('sacude');
      mostrarAviso('Ese Portal no es un objetivo válido');
      return;
    }
    cerrarHoja();
    window.selectPortalObjetivo(portal.dataset.obj);
    return;
  }
  const haySel = window.selectedCardIdx !== null && window.selectedCardIdx !== undefined;
  if (haySel && puedeJugarAhora()) {
    jugarEn(portal.dataset.dest, portal.dataset.clave);
    return;
  }
  inspeccionarCarta(portal.querySelector('.m-pila'), portal.getAttribute('aria-label')?.split(':')[0] || 'Portal', portal,
    activables.get(portal.dataset.clave));
}

function ejecutarAccion(accion) {
  switch (accion) {
    case 'menu': return abrirMenu();
    case 'invocacion': return verInvocacion();
    case 'habilidad': return document.querySelector('#btnAbility')?.click();
    case 'terminar': return document.querySelector('#btnEndTurn')?.click();
    case 'cancelar': return document.querySelector('#btnPlayCancel')?.click();
    default: return undefined;
  }
}

// ---------- Hojas inferiores (picker, menú, detalles) ----------

/** ¿Hay un picker de la mesa abierto? (render.js lo consulta.) */
export function hayPickerMesaAbierto() {
  return hojaActual?.tipo === 'picker';
}

function cerrarHoja() {
  document.querySelector('.m-hoja-capa')?.remove();
  hojaActual = null;
}

/**
 * Abre una hoja inferior. `compacta`: sin velo, para que se pueda seguir
 * tocando la mesa (elegir un Portal objetivo).
 */
function abrirHoja({ tipo, titulo, cuerpo = '', botones = [], alElegir, alCancelar, compacta = false, cancelable = true }) {
  cerrarHoja();
  const capa = document.createElement('div');
  capa.className = `m-hoja-capa ${compacta ? 'compacta' : ''}`;
  const lista = botones.map(b => `<button type="button" class="m-opcion" data-val="${escapeHtml(b.val)}" ${b.disabled ? 'disabled' : ''}>`
    + `${b.disabled ? '🚫 ' : ''}${escapeHtml(b.lbl)}</button>`).join('');
  capa.innerHTML = `<div class="m-hoja" role="dialog" aria-label="${escapeHtml(titulo)}">`
    + `<span class="m-hoja-asa"></span><h3>${escapeHtml(titulo)}</h3>${cuerpo}`
    + (lista ? `<div class="m-opciones">${lista}</div>` : '')
    + (cancelable ? `<button type="button" class="m-opcion m-opcion--cancelar" data-cancelar>${alElegir ? 'Cancelar' : 'Cerrar'}</button>` : '')
    + `</div>`;
  const hoja = { tipo, alElegir, alCancelar, opciones: botones };
  hojaActual = hoja;
  capa.addEventListener('click', e => {
    const op = e.target.closest('.m-opcion[data-val]');
    if (op && !op.disabled) {
      cerrarHoja();
      hoja.alElegir?.(op.dataset.val);
      return;
    }
    if (e.target.closest('[data-cancelar]') || (e.target === capa && cancelable && !compacta)) {
      cerrarHoja();
      hoja.alCancelar?.();
      return;
    }
    const enlace = e.target.closest('[data-menu]');
    if (enlace) accionMenu(enlace.dataset.menu);
  });
  document.body.appendChild(capa);
  return capa;
}

/**
 * picker() de render.js en la mesa: botones grandes en una hoja inferior.
 * Si es la elección de un Portal (pickerPortal), la hoja es compacta y los
 * Portales válidos brillan en la mesa para tocarlos directamente.
 */
export function pickerMesa(titulo, opciones, cb, onCancel) {
  const dePortal = !!window.pickerObjetivoPortal;
  abrirHoja({
    tipo: 'picker',
    titulo: dePortal ? `${titulo} — toca un Portal o elige:` : titulo,
    botones: opciones.map(o => ({ val: o.val, lbl: o.lbl, disabled: !!o.disabled })),
    alElegir: cb,
    alCancelar: () => onCancel?.(),
    compacta: dePortal,
  });
}

function abrirMenu() {
  const esc = espectaculoActivo();
  abrirHoja({
    tipo: 'info',
    titulo: 'Menú',
    cuerpo: `<div class="m-menu">
      <button type="button" class="m-opcion" data-menu="escenas">✨ Escenas animadas: ${esc ? 'sí' : 'no'}</button>
      <button type="button" class="m-opcion" data-menu="pantalla">⛶ Pantalla completa</button>
      <button type="button" class="m-opcion" data-menu="ayuda">❓ Carta de ayuda</button>
      <a class="m-opcion" href="docs/reglamento/reglamento-invocadores.pdf" target="_blank" rel="noopener">📖 Reglamento</a>
      <button type="button" class="m-opcion" data-menu="clasica">▦ Cambiar a la vista clásica</button>
    </div>`,
  });
}

function accionMenu(opcion) {
  if (opcion === 'escenas') { fijarEspectaculo(!espectaculoActivo()); abrirMenu(); return; }
  if (opcion === 'pantalla') {
    cerrarHoja();
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => mostrarAviso('Este navegador no permite pantalla completa'));
    return;
  }
  if (opcion === 'ayuda') {
    abrirHoja({
      tipo: 'info', titulo: 'Carta de ayuda',
      cuerpo: `<div class="m-ayuda"><img src="assets/cards/ayuda-anverso.png" alt="Resumen de habilidades"><img src="assets/cards/ayuda-reverso.png" alt="Secuencia de turno"></div>`,
    });
    return;
  }
  if (opcion === 'clasica') { cerrarHoja(); fijarVista('clasica'); }
}

function verInvocacion() {
  const v = construirVistaMesa(estado.partida, { asientoPropio: estado.partida.turn });
  const inv = v.invocacion;
  if (!inv) return;
  const criatura = rutaCriatura(inv.nombre);
  abrirHoja({
    tipo: 'info',
    titulo: `Invocación ${inv.nivel}: ${inv.nombre}`,
    cuerpo: (criatura ? `<img class="m-hoja-criatura" src="${criatura}" alt="">` : '')
      + `<p class="m-hoja-txt">Se completa cuando, al final de un turno, cada personaje requerido está visible en lo alto de un Portal.</p>`
      + requeridosHtml(inv),
  });
}

/** Ver en grande lo que hay en un Portal o una carta visible. */
function inspeccionarCarta(el, titulo, portal, activable) {
  const img = el?.querySelector('.c3d-cara');
  const visible = img && !el.querySelector('.c3d.dorso');
  let cuerpo;
  if (visible) {
    cuerpo = `<div class="m-zoom">${carta3d({ visible: true, nombre: img.getAttribute('alt') }, { anim: 'anim-zoom' })}</div>`;
  } else if (img) {
    cuerpo = `<div class="m-zoom">${carta3d({ visible: false }, { anim: 'anim-zoom' })}</div><p class="m-hoja-txt">Carta oculta: no puedes ver qué es.</p>`;
  } else {
    cuerpo = `<p class="m-hoja-txt">Este Portal está vacío.</p>`;
  }
  if (portal) {
    const altura = portal.querySelector('.m-altura')?.textContent || '0';
    cuerpo += `<p class="m-hoja-txt">${altura} carta${altura === '1' ? '' : 's'} en la pila.</p>`;
  }
  if (activable) {
    abrirHoja({
      tipo: 'info', titulo, cuerpo,
      botones: [{ val: activable.val, lbl: `✦ Activar: ${activable.lbl}` }],
      alElegir: activarDesde,
    });
    return;
  }
  abrirHoja({ tipo: 'info', titulo, cuerpo });
}

/**
 * Activa la habilidad de un origen concreto ('own:j' | 'central:k') por el
 * mismo camino que el botón Habilidad: se pulsa #btnAbility y se contesta
 * su primer picker con ese origen.
 */
function activarDesde(origen) {
  document.querySelector('#btnAbility')?.click();
  const h = hojaActual;
  if (h?.tipo === 'picker' && h.opciones?.some(o => o.val === origen && !o.disabled)) {
    cerrarHoja();
    h.alElegir(origen);
  }
}

// ---------- Avisos y cambio de turno ----------

/** Aviso flotante que no bloquea (sustituye a alert() en la mesa). */
export function mostrarAviso(texto, { duracion } = {}) {
  let pila = document.querySelector('.m-avisos');
  if (!pila) {
    pila = document.createElement('div');
    pila.className = 'm-avisos';
    pila.setAttribute('role', 'status');
    pila.setAttribute('aria-live', 'polite');
    document.body.appendChild(pila);
  }
  const el = document.createElement('div');
  el.className = 'm-aviso';
  el.textContent = texto;
  pila.appendChild(el);
  while (pila.children.length > 3) pila.firstElementChild.remove();
  const quitar = () => {
    el.classList.add('saliendo');
    setTimeout(() => el.remove(), 300);
  };
  el.addEventListener('click', quitar);
  setTimeout(quitar, duracion ?? Math.min(7000, 2500 + texto.length * 35));
}

/**
 * Cambio de turno en la mesa (sustituye al alert() de nextTurn). Con varias
 * humanas compartiendo el móvil sale un telón para pasarlo sin enseñar la
 * mano; contra autómatas, solo un rótulo. Devuelve false si la mesa no está
 * activa (entonces game.js usa el alert de siempre).
 */
export function anunciarTurnoMesa(jugadora, esAutomata) {
  if (!vistaMesaActiva()) return false;
  document.querySelector('.m-telon')?.remove();
  const humanas = contarHumanas(estado.partida.players);
  if (!esAutomata && humanas > 1) {
    const telon = document.createElement('div');
    telon.className = 'm-telon';
    telon.innerHTML = `<div class="m-telon-caja">
      <span class="m-telon-runa"></span>
      <p>Pasa el dispositivo a</p>
      <h2>${escapeHtml(jugadora.name)}</h2>
      <button type="button" class="m-btn m-btn--fin listo">Ver mi mano ➜</button>
    </div>`;
    telon.querySelector('button').addEventListener('click', () => {
      telon.classList.add('saliendo');
      setTimeout(() => telon.remove(), 350);
    });
    document.body.appendChild(telon);
    return true;
  }
  const rotulo = document.createElement('div');
  rotulo.className = 'm-rotulo';
  rotulo.textContent = esAutomata ? `🤖 Turno de ${jugadora.name}` : `✦ ¡Tu turno, ${jugadora.name}! ✦`;
  document.body.appendChild(rotulo);
  setTimeout(() => rotulo.remove(), 1800);
  return true;
}
