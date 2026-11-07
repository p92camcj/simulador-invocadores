// js/mesa3d.js
//
// Vista "Mesa 3D": la interfaz del simulador (la vista clásica en columnas
// se retiró en 1.32.3). Pensada para jugar con el dedo en un móvil, también
// se usa en ordenador. Mesa en perspectiva con cartas 3D (CSS 3D, sin
// librerías), tu mano abajo en abanico, los rivales arriba y los Portales
// centrales en medio.
//
// No contiene reglas. Lee lo que se enseña de `construirVistaMesa()`
// (js/vista-mesa.js, puro) y actúa con las acciones de la interfaz de
// actions.js (seleccionarCartaMano, jugarEnPortal, elegirPortalObjetivo,
// activarHabilidad, cancelarSeleccion, ejecutarFinDeTurno) y salirAlMenu
// (game.js), las mismas que usa el autómata para jugar y terminar turno.
//
// Se engancha en tres sitios:
// - render() (render.js) llama a renderMesa3D() en cada pintado.
// - picker() (render.js) delega en pickerMesa(): hoja inferior con botones
//   grandes.
// - nextTurn() (game.js) llama a anunciarTurnoMesa().
// Además, durante la partida alert() se muestra como aviso flotante que no
// bloquea.

import { cardImages, CARTA_OCULTA_IMG, escapeHtml, iconos } from './utils.js';
import { rutaFigura, rutaCriatura, espectaculoActivo, fijarEspectaculo } from './espectaculo.js';
import { estado } from './motor/estado.js';
import { opcionesFaseB } from './motor/acciones.js';
import { atributosDestacado, abrirHistorial } from './narrador.js';
import {
  seleccionarCartaMano, jugarEnPortal, elegirPortalObjetivo, activarHabilidad,
  cancelarSeleccion, ejecutarFinDeTurno,
} from './actions.js';
import { salirAlMenu } from './game.js';
import {
  construirVistaMesa, elegirAsientoPropio, claveJugar, claveObjetivo, firmaPortal,
  cambioPortal, pistaTurno, contarHumanas,
} from './vista-mesa.js';

const COLORES_JUGADORA = ['#ff6b6b', '#4dabf7', '#ffd43b', '#b197fc', '#69db7c'];
const DURACION_ANIM = 750;

/** Retardo antes de que juegue una autómata. */
export function retardoAutomata() {
  return 1300;
}

/** Al volver al menú: la mesa desaparece. */
export function salirDeMesa() {
  document.body.classList.remove('mesa-en-partida');
  cerrarHoja();
  document.querySelector('.m-telon')?.remove();
  document.querySelector('.m-fin')?.remove();
  const raiz = document.querySelector('#mesa3d');
  if (raiz) raiz.innerHTML = '';
  ultimoHtml = '';
  firmas.clear();
  gemasPrevias.clear();
  requeridosPrevios.clear();
  invocacionesVistas = null;
  efectosPendientes = [];
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
let efectosPendientes = [];    // efectos detectados al pintar, se lanzan después
const gemasPrevias = new Map(); // jugadora → nº de Gemas en el pintado anterior
const requeridosPrevios = new Map();
let invocacionesVistas = null;

// ---------- Inicialización ----------

export function initMesa3D() {
  // Preferencia de la antigua vista clásica (retirada en 1.32.3).
  try { localStorage.removeItem('invocadores.vista'); } catch { /* nada */ }

  // alert() → aviso flotante mientras se juega en la mesa.
  const alertOriginal = window.alert.bind(window);
  window.alert = msg => {
    if (document.body.classList.contains('mesa-en-partida')) mostrarAviso(String(msg));
    else alertOriginal(msg);
  };

  prepararPantallaInicio();

  const raiz = asegurarRaiz();
  raiz.addEventListener('click', alClicar);
  raiz.addEventListener('pointerdown', alEmpezarArrastre);
  window.addEventListener('pointermove', alMoverArrastre, { passive: false });
  window.addEventListener('pointerup', alSoltarArrastre);
  window.addEventListener('pointercancel', cancelarArrastre);
}

/**
 * Pantalla de inicio: héroe con las criaturas y botones − / + en los campos
 * numéricos (mesa3d.css).
 */
function prepararPantallaInicio() {
  const titulo = document.querySelector('#mainTitle');
  if (titulo && !document.querySelector('.m-heroe')) {
    const heroe = document.createElement('div');
    heroe.className = 'm-heroe';
    heroe.setAttribute('aria-hidden', 'true');
    heroe.innerHTML = '<span class="m-heroe-portal"></span>'
      + ['baelorith', 'cirelia', 'aelgorth'].map(n => `<img src="assets/invocaciones/${n}.webp" alt="" draggable="false">`).join('');
    titulo.before(heroe);
  }
  const numJug = document.querySelector('#numPlayers');
  const numBots = document.querySelector('#numBots');
  const limites = { numPlayers: () => [2, 5], numBots: () => [0, parseInt(numJug?.value, 10) || 5] };
  [numJug, numBots].forEach(input => {
    if (!input || input.parentElement.classList.contains('m-paso-campo')) return;
    const caja = document.createElement('span');
    caja.className = 'm-paso m-paso-campo';
    const menos = document.createElement('button');
    const mas = document.createElement('button');
    menos.type = mas.type = 'button';
    menos.textContent = '−';
    mas.textContent = '+';
    menos.setAttribute('aria-label', 'Uno menos');
    mas.setAttribute('aria-label', 'Uno más');
    input.before(caja);
    caja.append(menos, input, mas);
    const ajustar = delta => {
      const [min, max] = limites[input.id]();
      const actual = parseInt(input.value, 10);
      const nuevo = Math.min(max, Math.max(min, (Number.isNaN(actual) ? min : actual) + delta));
      input.value = String(nuevo);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      sincronizar();
    };
    menos.addEventListener('click', () => ajustar(-1));
    mas.addEventListener('click', () => ajustar(1));
  });
  function sincronizar() {
    if (numBots && numJug && parseInt(numBots.value, 10) > parseInt(numJug.value, 10)) numBots.value = numJug.value;
    document.querySelectorAll('.m-paso-campo').forEach(caja => {
      const input = caja.querySelector('input');
      const [min, max] = limites[input.id]();
      const v = parseInt(input.value, 10);
      caja.children[0].disabled = v <= min;
      caja.children[2].disabled = v >= max;
    });
  }
  numJug?.addEventListener('input', sincronizar);
  numBots?.addEventListener('input', sincronizar);
  sincronizar();
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
  const alt = visible ? escapeHtml(cv.ficha ? `${cv.nombre} (como ${cv.ficha})` : cv.nombre) : 'Carta oculta';
  return `<span class="c3d ${visible ? '' : 'dorso'} ${cv?.ficha ? 'con-ficha' : ''} ${clase} ${anim}"`
    + (visible ? ` data-nombre="${escapeHtml(cv.nombre)}"${cv.ficha ? ` data-ficha="${escapeHtml(cv.ficha)}"` : ''}` : '') + `>`
    + `<span class="c3d-cuerpo">`
    + `<img class="c3d-cara" src="${frente}" alt="${alt}" draggable="false">`
    + `<img class="c3d-trasera" src="${CARTA_OCULTA_IMG}" alt="" draggable="false">`
    + `</span>`
    + (visible && cv.ficha ? fichaHtml(cv.ficha) : '')
    + `</span>`;
}

/**
 * Ficha de transformación del Metamorfo: como en la mesa real, un medallón
 * con la cara del personaje encima de la carta del Metamorfo, y una cinta
 * que dice en qué se ha convertido.
 */
function fichaHtml(nombre) {
  const fig = rutaFigura(nombre);
  return `<span class="c3d-ficha" aria-hidden="true">`
    + (fig ? `<img src="${fig}" alt="" draggable="false">` : `<b>${iconos[nombre] || '?'}</b>`)
    + `</span><span class="c3d-ficha-cinta" aria-hidden="true">como ${escapeHtml(nombre)}</span>`;
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
function gemasHtml(g, idx) {
  const niveles = [['unitaria', 'u'], ['C', 'c'], ['B', 'b'], ['A', 'a']];
  const puntos = niveles
    .filter(([n]) => g.porNivel[n] > 0)
    .map(([n, c]) => `<span class="m-gema m-gema--${c}" title="Gemas de nivel ${n}"></span><b>${g.porNivel[n]}</b>`)
    .join('');
  const total = g.total !== null ? `<span class="m-gemas-total">💎 ${g.total}</span>` : '';
  const rev = g.reveladas.length ? `<span class="m-gemas-rev">${g.reveladas.map(v => `${v}*`).join(' ')}</span>` : '';
  const antes = gemasPrevias.get(idx);
  if (antes !== undefined && g.cantidad > antes) efectosPendientes.push({ gemas: idx, mas: g.cantidad - antes });
  gemasPrevias.set(idx, g.cantidad);
  return `<span class="m-gemas" data-gemas="${idx}">${total}${puntos || '<i>sin Gemas</i>'}${rev}</span>`;
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
  if (cambio && !esperandoVuelo) efectosPendientes.push({ clave, tipo: cambio });

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

  // Resaltado de lo último que ha pasado (js/narrador.js).
  const traza = atributosDestacado(clave);
  return `<button type="button" class="m-portal m-portal--${tam} ${estadoCls} ${esperandoVuelo ? 'esperando-vuelo' : ''} ${traza.clase}"`
    + ` data-dest="${dest}" data-obj="${obj}" data-clave="${clave}"${traza.attrs}`
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
    + `<header class="m-rival-cab"><span class="m-nombre">${nombreAsiento(a)}${a.activa ? ' <span class="m-turno-punto"></span>' : ''}</span>${gemasHtml(a.gemas, a.idx)}</header>`
    + `<div class="m-rival-cuerpo"><div class="m-portales">${portales}</div>`
    + `<div class="m-mano-mini" data-mano-de="${a.idx}" aria-label="Mano de ${escapeHtml(a.nombre)}">${mano}</div></div>`
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
    return `<span class="m-req m-req--${r.estado}" data-req="${escapeHtml(r.nombre)}" title="${escapeHtml(r.nombre)}: ${txt}">`
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

/** Pinta la mesa. La llama render() (render.js) en cada pintado. */
export function renderMesa3D() {
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
      <button type="button" class="m-btn-icono" data-accion="historial" aria-label="Historial de jugadas" title="Historial de jugadas">📜</button>
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
        ${gemasHtml(v.propio.gemas, v.propio.idx)}
      </div>
      <div class="m-mano ${puedeJugar ? 'puede-jugar' : ''}" data-mano-de="${v.propio.idx}">${manoPropiaHtml(v.propio, puedeJugar)}</div>
      <div class="m-acciones">${acciones}</div>
    </footer>`;

  // Invocación completada (sin escenas): gran destello en la mesa.
  const nivelesHechos = (partida.invocacionesCompletadas || []).length;
  if (invocacionesVistas !== null && nivelesHechos > invocacionesVistas && !espectaculoActivo()) {
    const ultima = partida.invocacionesCompletadas.at(-1);
    efectosPendientes.push({ invocacion: ultima });
  }
  invocacionesVistas = nivelesHechos;
  // Personajes requeridos que acaban de aparecer en la mesa.
  (v.invocacion?.requeridos || []).forEach(r => {
    const k = `${v.invocacion.nivel}:${r.nombre}`;
    if (requeridosPrevios.has(k) && requeridosPrevios.get(k) === 'falta' && r.estado !== 'falta') efectosPendientes.push({ req: r.nombre });
    requeridosPrevios.set(k, r.estado);
  });

  if (html !== ultimoHtml) {
    raiz.innerHTML = html;
    ultimoHtml = html;
  }
  lanzarEfectos();
  if (vuelo && !vuelo.lanzado) lanzarVuelo();
  // Cuando acaba la animación más larga, se repinta sin sus clases.
  if (animHasta.size) programarLimpieza();
}

let limpiezaProgramada = null;
function programarLimpieza() {
  if (limpiezaProgramada) return;
  limpiezaProgramada = setTimeout(() => {
    limpiezaProgramada = null;
    if (estado.partida.players.length) renderMesa3D();
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
  jugarEnPortal(dest);
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
  if (clave) lanzarEfecto({ clave, tipo: 'aterriza' });
}

// ---------- Efectos: impactos, destellos, Gemas ----------

/** Los efectos detectados en el último pintado (se lanzan tras el DOM). */
function lanzarEfectos() {
  const lista = efectosPendientes;
  efectosPendientes = [];
  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  lista.forEach(lanzarEfecto);
}

const COLOR_EFECTO = {
  entra: ['#7fd8ff', '#b48cff'], aterriza: ['#ffe08b', '#ff9a3c'], voltea: ['#b48cff', '#ffffff'],
  transforma: ['#ff9ad6', '#7fb4ff'], sale: ['#c9bfe8', '#6b5aa0'],
};

function capaEfectos() {
  let capa = document.querySelector('.m-efectos');
  if (!capa) {
    capa = document.createElement('div');
    capa.className = 'm-efectos';
    capa.setAttribute('aria-hidden', 'true');
    document.body.appendChild(capa);
  }
  return capa;
}

/** Un efecto puntual sobre un elemento de la mesa (se borra solo). */
function lanzarEfecto(ef) {
  if (ef.invocacion) return efectoInvocacion(ef.invocacion);
  let el;
  if (ef.clave) el = document.querySelector(`.m-portal[data-clave="${ef.clave}"] .m-pila`);
  else if (ef.gemas !== undefined) el = document.querySelector(`[data-gemas="${ef.gemas}"]`);
  else if (ef.req) el = document.querySelector(`.m-requeridos [data-req="${CSS.escape(ef.req)}"]`);
  if (!el) return;
  const r = el.getBoundingClientRect();
  const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
  const capa = capaEfectos();
  const caja = document.createElement('div');
  caja.style.left = `${cx}px`;
  caja.style.top = `${cy}px`;

  if (ef.gemas !== undefined) {
    caja.className = 'm-ef m-ef-gema';
    caja.innerHTML = `<b>+${ef.mas} 💎</b>` + '<i></i>'.repeat(8);
    el.classList.add('m-salta');
  } else if (ef.req) {
    caja.className = 'm-ef m-ef-req';
    caja.innerHTML = '<span></span>';
    el.classList.add('m-salta');
  } else {
    const [c1, c2] = COLOR_EFECTO[ef.tipo] || COLOR_EFECTO.entra;
    const fuerte = ef.tipo === 'aterriza' || ef.tipo === 'entra' || ef.tipo === 'transforma';
    caja.className = `m-ef m-ef-${ef.tipo}`;
    caja.style.setProperty('--c1', c1);
    caja.style.setProperty('--c2', c2);
    caja.style.setProperty('--w', `${r.width}px`);
    caja.style.setProperty('--h', `${r.height}px`);
    let chispas = '';
    const n = fuerte ? 16 : 8;
    for (let i = 0; i < n; i++) {
      const ang = (i / n) * Math.PI * 2 + Math.random() * 0.4;
      const dist = r.width * (0.7 + Math.random() * 0.9);
      chispas += `<i style="--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist * 0.7).toFixed(0)}px;--s:${(0.5 + Math.random()).toFixed(2)}"></i>`;
    }
    caja.innerHTML = `<span class="m-ef-onda"></span><span class="m-ef-onda m-ef-onda--2"></span>`
      + (fuerte ? '<span class="m-ef-pilar"></span>' : '') + chispas;
    if (ef.tipo === 'aterriza') {
      const escena = document.querySelector('.m-escena');
      escena?.classList.remove('m-temblor');
      void escena?.offsetWidth;
      escena?.classList.add('m-temblor');
      navigator.vibrate?.(18);
    }
  }
  capa.appendChild(caja);
  setTimeout(() => { caja.remove(); el.classList?.remove('m-salta'); }, 1300);
}

/** Invocación completada sin escenas: la criatura aparece sobre la mesa. */
function efectoInvocacion(nivel) {
  const set = estado.partida.invocationSet;
  const inv = window.INVOCATION_SETS?.[set]?.[nivel];
  if (!inv) return;
  const criatura = rutaCriatura(inv.nombre);
  const capa = capaEfectos();
  const caja = document.createElement('div');
  caja.className = 'm-ef-invocacion';
  caja.innerHTML = `<span class="m-ef-inv-rayos"></span>`
    + (criatura ? `<img src="${criatura}" alt="">` : '')
    + `<strong>¡${escapeHtml(inv.nombre)} invocada!</strong>`;
  capa.appendChild(caja);
  navigator.vibrate?.([30, 60, 30]);
  setTimeout(() => caja.remove(), 2600);
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
    if (window.selectedCardIdx !== arrastre.idx) seleccionarCartaMano(arrastre.idx);
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
      seleccionarCartaMano(idx);
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
    elegirPortalObjetivo(portal.dataset.obj);
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
    case 'historial': return abrirHistorial();
    case 'invocacion': return verInvocacion();
    case 'habilidad': return activarHabilidad();
    case 'terminar': return ejecutarFinDeTurno();
    case 'cancelar': return cancelarSeleccion();
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

/** Pregunta con botones grandes y sin "Cancelar" (sustituye a confirm()). */
export function preguntarMesa(titulo, opciones, responder) {
  abrirHoja({ tipo: 'picker', titulo, botones: opciones, alElegir: responder, cancelable: false });
}

/**
 * Marcador final de la mesa (sustituye al confirm() de finalizarPartida):
 * podio con la ganadora, recuento de Gemas y desempate, confeti, y los
 * botones "Jugar otra vez" y "Ver la mesa".
 */
export function mostrarFinMesa({ motivo, resultado }, alJugarOtra) {
  cerrarHoja();
  document.querySelector('.m-fin')?.remove();
  const { stats, ganadores, motivoDesempate } = resultado;
  const ids = new Set(ganadores.map(g => g.idx));
  const titulo = ganadores.length === 1 ? `¡Gana ${ganadores[0].nombre}!` : '¡Empate!';
  const sub = ganadores.length === 1
    ? (motivoDesempate ? `Desempate: ${motivoDesempate}` : '')
    : `Comparten la victoria ${ganadores.map(g => g.nombre).join(', ')}${motivoDesempate ? ` (${motivoDesempate})` : ''}`;
  let confeti = '';
  const colores = ['#ffe08b', '#ff9ad6', '#7fd8ff', '#b48cff', '#5dff9a'];
  for (let i = 0; i < 40; i++) {
    confeti += `<i style="left:${(Math.random() * 100).toFixed(1)}%;background:${colores[i % colores.length]};`
      + `animation-delay:${(Math.random() * 1.6).toFixed(2)}s;animation-duration:${(2.4 + Math.random() * 2).toFixed(2)}s;--r:${Math.floor(Math.random() * 720)}deg"></i>`;
  }
  const filas = stats.map((st, k) => `<li class="${ids.has(st.idx) ? 'gana' : ''}" style="--d:${0.6 + k * 0.15}s">`
    + `<span class="m-fin-pos">${ids.has(st.idx) ? '👑' : k + 1}</span>`
    + `<span class="m-fin-nombre">${escapeHtml(st.nombre)}</span>`
    + `<span class="m-fin-gemas">💎 ${st.total}</span></li>`).join('');
  const fin = document.createElement('div');
  fin.className = 'm-fin';
  fin.innerHTML = `<div class="m-fin-confeti" aria-hidden="true">${confeti}</div>
    <div class="m-fin-caja" role="dialog" aria-label="Final de la partida">
      <span class="m-fin-corona" aria-hidden="true">👑</span>
      <p class="m-fin-motivo">${escapeHtml(motivo)}</p>
      <h2>${escapeHtml(titulo)}</h2>
      ${sub ? `<p class="m-fin-sub">${escapeHtml(sub)}</p>` : ''}
      <ol class="m-fin-lista">${filas}</ol>
      <button type="button" class="m-btn m-btn--fin listo" data-fin="otra">Jugar otra vez ➜</button>
      <button type="button" class="m-fin-ver" data-fin="ver">Ver cómo ha quedado la mesa</button>
    </div>`;
  fin.addEventListener('click', e => {
    const accion = e.target.closest('[data-fin]')?.dataset.fin;
    if (accion === 'otra') { fin.remove(); alJugarOtra(); }
    if (accion === 'ver') {
      fin.classList.add('minimizada');
    } else if (fin.classList.contains('minimizada') && e.target.closest('.m-fin-caja')) {
      fin.classList.remove('minimizada');
    }
  });
  document.body.appendChild(fin);
  navigator.vibrate?.([40, 80, 40, 80, 120]);
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
      <button type="button" class="m-opcion" data-menu="historial">📜 Historial de jugadas</button>
      <a class="m-opcion" href="docs/reglamento/reglamento-invocadores.pdf" target="_blank" rel="noopener">📖 Reglamento</a>
      <button type="button" class="m-opcion" data-menu="salir">🚪 Salir al menú de inicio</button>
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
  if (opcion === 'historial') { cerrarHoja(); abrirHistorial(); return; }
  if (opcion === 'ayuda') {
    abrirHoja({
      tipo: 'info', titulo: 'Carta de ayuda',
      cuerpo: `<div class="m-ayuda"><img src="assets/cards/ayuda-anverso.png" alt="Resumen de habilidades"><img src="assets/cards/ayuda-reverso.png" alt="Secuencia de turno"></div>`,
    });
    return;
  }
  if (opcion === 'salir') { cerrarHoja(); salirAlMenu(); }
}

/** Aviso público de cuántos Portales impiden aún la invocación (vacíos o boca abajo). */
function portalesSinPersonajeHtml() {
  const { players, neutrals } = estado.partida;
  const pilas = [...players.flatMap(p => p.portals), ...neutrals];
  const libres = pilas.filter(st => !st.length || !st.at(-1).vis?.public).length;
  return libres
    ? `<p class="m-hoja-txt">Falta${libres === 1 ? '' : 'n'} ${libres} Portal${libres === 1 ? '' : 'es'} sin personaje bocarriba.</p>`
    : `<p class="m-hoja-txt">Todos los Portales tienen un personaje bocarriba.</p>`;
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
      + `<p class="m-hoja-txt">Se completa cuando, al final de un turno, cada personaje requerido está visible en lo alto de un Portal y todos los Portales (también los centrales) tienen un personaje bocarriba.</p>`
      + requeridosHtml(inv)
      + portalesSinPersonajeHtml(),
  });
}

/** Ver en grande lo que hay en un Portal o una carta visible. */
function inspeccionarCarta(el, titulo, portal, activable) {
  const img = el?.querySelector('.c3d-cara');
  const c = el?.querySelector('.c3d');
  const visible = img && !el.querySelector('.c3d.dorso');
  let cuerpo;
  if (visible) {
    const ficha = c?.dataset.ficha;
    cuerpo = `<div class="m-zoom">${carta3d({ visible: true, nombre: c?.dataset.nombre, ficha }, { anim: 'anim-zoom' })}</div>`
      + (ficha ? `<p class="m-hoja-txt">🎭 Es un <b>Metamorfo</b> con la ficha de <b>${escapeHtml(ficha)}</b>: cuenta como ${escapeHtml(ficha)} para la invocación, pero no tiene su habilidad.</p>` : '');
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
 * mismo camino que el botón Habilidad: activarHabilidad() y se contesta su
 * primer picker con ese origen.
 */
function activarDesde(origen) {
  activarHabilidad();
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
 * mano; contra autómatas, solo un rótulo.
 */
export function anunciarTurnoMesa(jugadora, esAutomata) {
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
