// narrador.js
//
// Hace legible lo que pasa en la mesa, sobre todo en los turnos de las
// autómatas (solo presentación, nunca decide nada ni toca reglas):
//
// - Narración: un rótulo que cuenta cada paso de la autómata y se queda en
//   pantalla mientras ella hace una pausa (game.js espera `pausaTrasPaso`).
// - Resaltado: los Portales afectados en el turno brillan con el color del
//   motivo y un número de paso (1 = carta jugada, 2 = habilidad). Lo leen
//   render.js y mesa3d.js con `atributosDestacado()`.
// - Estelas: un rastro de polvo mágico de donde sale la carta a donde llega,
//   con un color según el motivo (jugar, Estratega, Cronista...).
// - Historial: ventana con todas las jugadas de la partida (js/historial.js).
//
// Nunca enseña una carta que no sea pública: los textos vienen del
// historial, que solo nombra cartas bocarriba.

import { escucharHistorial } from './historial.js';
import { cuandoTermineEspectaculo } from './espectaculo.js';
import { estado } from './motor/estado.js';

/** Color de la estela y del resaltado según el motivo del movimiento. */
export const COLOR_MOTIVO = {
  jugada: '#ffd36b',
  Estratega: '#6fb7ff',
  Cronista: '#7ee0a1',
  Ocultista: '#c08bff',
  Cronomante: '#5fe3e0',
  Maestro: '#ffa25f',
  Aprendiz: '#ff8fc8',
  Metamorfo: '#e9ff6b',
};
const COLOR_POR_DEFECTO = '#ffffff';

export function colorMotivo(motivo) {
  return COLOR_MOTIVO[motivo] || COLOR_POR_DEFECTO;
}

// ---------- Ritmo de las autómatas ----------

const CLAVE_RITMO = 'invocadores.ritmoAutomatas';
export const RITMOS = { rapido: 0.45, normal: 1, pausado: 1.8 };

export function ritmoAutomatas() {
  try {
    const r = localStorage.getItem(CLAVE_RITMO);
    if (r && r in RITMOS) return r;
  } catch { /* sin almacenamiento */ }
  return 'normal';
}

export function fijarRitmoAutomatas(ritmo) {
  if (!(ritmo in RITMOS)) return;
  try { localStorage.setItem(CLAVE_RITMO, ritmo); } catch { /* nada */ }
}

/** Pausa (ms) tras cada paso de una autómata, para poder seguirlo. */
export function pausaTrasPaso(fase) {
  const base = fase === 'faseB' ? 3400 : 2600;
  return Math.round(base * RITMOS[ritmoAutomatas()]);
}

/** Pausa (ms) antes de que la autómata empiece su turno ("pensando…"). */
export function pausaAntesDeJugar(base) {
  return Math.round(Math.max(base, 1100) * RITMOS[ritmoAutomatas()]);
}

// ---------- Resaltado de Portales ----------

const destacados = new Map(); // clave "i:j" | "n:k" → { paso, color }
let pasoEnTurno = 0;

/** ` data-paso=".." style="--traza:.."` y la clase, si el Portal está resaltado. */
export function atributosDestacado(clave) {
  const d = destacados.get(clave);
  if (!d) return { clase: '', attrs: '' };
  return { clase: 'traza-destacado', attrs: ` data-paso="${d.paso}" style="--traza:${d.color}"` };
}

function limpiarDestacados() {
  destacados.clear();
  pasoEnTurno = 0;
}

// ---------- Narración ----------

let rotulo = null;
let temporizadorRotulo = null;

function asegurarRotulo() {
  if (rotulo?.isConnected) return rotulo;
  rotulo = document.createElement('div');
  rotulo.className = 'narrador hidden';
  rotulo.setAttribute('role', 'status');
  rotulo.setAttribute('aria-live', 'polite');
  rotulo.innerHTML = '<span class="narrador-paso"></span><span class="narrador-texto"></span>'
    + '<button type="button" class="narrador-btn" title="Ver todas las jugadas de la partida">📜 Historial</button>'
    + '<button type="button" class="narrador-cerrar" aria-label="Ocultar">✕</button>';
  rotulo.querySelector('.narrador-btn').addEventListener('click', abrirHistorial);
  rotulo.querySelector('.narrador-cerrar').addEventListener('click', ocultarRotulo);
  document.body.appendChild(rotulo);
  return rotulo;
}

function narrar(texto, { paso = '', color = COLOR_POR_DEFECTO, duracion = null } = {}) {
  const el = asegurarRotulo();
  el.querySelector('.narrador-paso').textContent = paso;
  el.querySelector('.narrador-texto').textContent = texto;
  el.style.setProperty('--traza', color);
  el.classList.remove('hidden', 'saliendo');
  el.classList.remove('entra');
  void el.offsetWidth; // reinicia la animación de entrada
  el.classList.add('entra');
  clearTimeout(temporizadorRotulo);
  if (duracion) temporizadorRotulo = setTimeout(ocultarRotulo, duracion);
}

function ocultarRotulo() {
  clearTimeout(temporizadorRotulo);
  if (!rotulo || rotulo.classList.contains('hidden')) return;
  rotulo.classList.add('saliendo');
  setTimeout(() => rotulo?.classList.add('hidden'), 300);
}

/** Al salir de la partida: fuera rótulo, resaltados y estelas. */
export function reiniciarNarrador() {
  limpiarDestacados();
  ocultarRotulo();
  document.querySelector('.traza-capa')?.replaceChildren();
  cerrarHistorial();
}

function alNuevaEntrada(entrada, partida) {
  const actual = partida.players[partida.turn];
  if (entrada.tipo === 'turno') {
    if (entrada.auto) {
      limpiarDestacados();
      narrar(`${entrada.nombre} está pensando…`, { paso: '🤖' });
    } else {
      // Lo último que hizo la autómata sigue resaltado hasta que la persona
      // juegue; el rótulo se va solo al rato. Lo de otra persona, no.
      if (![...destacados.values()].some(d => d.deAutomata)) limpiarDestacados();
      if (rotulo && !rotulo.classList.contains('hidden')) {
        clearTimeout(temporizadorRotulo);
        temporizadorRotulo = setTimeout(ocultarRotulo, Math.round(9000 * RITMOS[ritmoAutomatas()]));
      }
    }
    return;
  }

  const deAutomata = entrada.tipo === 'invocacion' ? actual?.tipo === 'auto' : entrada.auto;
  if (entrada.tipo !== 'invocacion') {
    if (!deAutomata) {
      // Una persona ya está jugando: lo de la autómata deja de resaltarse.
      if ([...destacados.values()].some(d => d.deAutomata)) limpiarDestacados();
      ocultarRotulo();
    }
    pasoEnTurno++;
    const color = colorMotivo(entrada.tipo === 'jugada' ? 'jugada' : entrada.personaje);
    entrada.portales.forEach(c => destacados.set(c, { paso: pasoEnTurno, color, deAutomata }));
    if (deAutomata) narrar(entrada.texto, { paso: `🤖 ${pasoEnTurno}`, color });
  } else if (deAutomata) {
    narrar(entrada.texto, { paso: '✨', color: '#ffe9a8' });
  }
  if (entrada.trazos?.length) programarEstelas(entrada.trazos);
}

// ---------- Estelas de polvo mágico ----------

function reducirMovimiento() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

function capaEstelas() {
  let capa = document.querySelector('.traza-capa');
  if (!capa) {
    capa = document.createElement('div');
    capa.className = 'traza-capa';
    capa.setAttribute('aria-hidden', 'true');
    document.body.appendChild(capa);
  }
  return capa;
}

/** Primer elemento visible que case con el selector (clásica o Mesa 3D). */
function visible(selector) {
  for (const el of document.querySelectorAll(selector)) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return r;
  }
  return null;
}

/** Rectángulo de un extremo de la estela: Portal "i:j"/"n:k" o "mano:i". */
function rectExtremo(punto) {
  if (punto.startsWith('mano:')) {
    const i = punto.slice(5);
    return visible(`[data-mano-de="${i}"]`) || visible(`[data-jugadora-col="${i}"]`);
  }
  return visible(`[data-clave="${CSS.escape(punto)}"]`);
}

function programarEstelas(trazos) {
  // Después del pintado (el DOM ya muestra la mesa nueva) y, si hay escena
  // del modo espectáculo, cuando termine (si no, quedaría debajo).
  setTimeout(() => {
    cuandoTermineEspectaculo().then(() => requestAnimationFrame(() => {
      trazos.forEach((t, k) => setTimeout(() => dibujarEstela(t), k * 180));
    }));
  }, 60);
}

function dibujarEstela({ desde, hacia, motivo }) {
  const a = rectExtremo(desde);
  const b = rectExtremo(hacia);
  if (!b) return;
  const color = colorMotivo(motivo);
  const capa = capaEstelas();
  const centro = r => ({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
  const fin = centro(b);
  if (!a || desde === hacia) {
    destello(capa, fin, color);
    return;
  }
  const ini = centro(a);
  const dx = fin.x - ini.x, dy = fin.y - ini.y;
  const largo = Math.hypot(dx, dy) || 1;
  // Curva suave hacia un lado (siempre hacia arriba de la línea).
  const curva = Math.min(120, largo * 0.3);
  const ctrl = { x: (ini.x + fin.x) / 2 + (dy / largo) * curva, y: (ini.y + fin.y) / 2 - Math.abs(dx / largo) * curva };

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('class', 'traza-svg');
  const path = document.createElementNS(svgNS, 'path');
  path.setAttribute('d', `M${ini.x},${ini.y} Q${ctrl.x},${ctrl.y} ${fin.x},${fin.y}`);
  path.setAttribute('class', 'traza-linea');
  path.style.setProperty('--traza', color);
  svg.appendChild(path);
  capa.appendChild(svg);
  const longitud = path.getTotalLength();
  path.style.strokeDasharray = `${longitud}`;
  path.style.strokeDashoffset = `${longitud}`;

  const duracion = reducirMovimiento() ? 1 : 900;
  const carta = document.createElement('div');
  carta.className = 'traza-carta';
  carta.style.setProperty('--traza', color);
  if (!reducirMovimiento()) capa.appendChild(carta);

  const t0 = performance.now();
  let ultimaChispa = 0;
  const cuadro = ahora => {
    const t = Math.min(1, (ahora - t0) / duracion);
    const e = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; // suave
    const p = path.getPointAtLength(longitud * e);
    path.style.strokeDashoffset = `${longitud * (1 - e)}`;
    carta.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -50%) rotate(${(e - 0.5) * 30}deg)`;
    if (!reducirMovimiento() && ahora - ultimaChispa > 28) {
      ultimaChispa = ahora;
      chispa(capa, p, color);
    }
    if (t < 1) requestAnimationFrame(cuadro);
    else {
      carta.remove();
      destello(capa, fin, color);
      svg.classList.add('apagando');
      setTimeout(() => svg.remove(), 2600);
    }
  };
  requestAnimationFrame(cuadro);
}

function chispa(capa, p, color) {
  const c = document.createElement('span');
  c.className = 'traza-chispa';
  const tam = 3 + Math.random() * 4;
  c.style.cssText = `left:${p.x}px;top:${p.y}px;width:${tam}px;height:${tam}px;--traza:${color};`
    + `--dx:${(Math.random() - 0.5) * 26}px;--dy:${10 + Math.random() * 22}px;`;
  capa.appendChild(c);
  setTimeout(() => c.remove(), 1300);
}

function destello(capa, p, color) {
  const d = document.createElement('span');
  d.className = 'traza-destello';
  d.style.cssText = `left:${p.x}px;top:${p.y}px;--traza:${color};`;
  capa.appendChild(d);
  setTimeout(() => d.remove(), 1000);
  if (reducirMovimiento()) return;
  for (let k = 0; k < 10; k++) {
    const ang = (k / 10) * Math.PI * 2;
    chispa(capa, { x: p.x + Math.cos(ang) * 18, y: p.y + Math.sin(ang) * 18 }, color);
  }
}

// ---------- Ventana de historial ----------

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function cerrarHistorial() {
  document.querySelector('.historial-capa')?.remove();
}

/** Abre la ventana con todas las jugadas de la partida, la más reciente arriba. */
export function abrirHistorial() {
  cerrarHistorial();
  const entradas = estado.partida.historial || [];
  const porTurno = new Map();
  entradas.forEach(e => {
    if (!porTurno.has(e.turno)) porTurno.set(e.turno, []);
    porTurno.get(e.turno).push(e);
  });
  const bloques = [...porTurno.entries()].reverse().map(([n, lista]) => {
    const cab = lista.find(e => e.tipo === 'turno');
    const titulo = cab ? `Turno ${n} · ${cab.auto ? '🤖 ' : ''}${escapeHtml(cab.nombre)}` : 'Inicio';
    const filas = lista.filter(e => e.tipo !== 'turno').map(e => {
      const color = e.tipo === 'invocacion' ? '#ffe9a8' : colorMotivo(e.tipo === 'jugada' ? 'jugada' : e.personaje);
      const icono = e.tipo === 'jugada' ? '🃏' : e.tipo === 'habilidad' ? '✦' : '✨';
      return `<li style="--traza:${color}"><span class="historial-icono">${icono}</span>${escapeHtml(e.texto)}</li>`;
    }).join('') || '<li class="historial-vacio">Todavía no ha hecho nada.</li>';
    return `<section><h4>${titulo}</h4><ol>${filas}</ol></section>`;
  }).join('') || '<p class="historial-vacio">Aún no hay jugadas en esta partida.</p>';

  const leyenda = [['jugada', 'Carta jugada'], ...Object.keys(COLOR_MOTIVO).filter(k => k !== 'jugada').map(k => [k, k])]
    .map(([k, lbl]) => `<span style="--traza:${colorMotivo(k)}">${lbl}</span>`).join('');

  const capa = document.createElement('div');
  capa.className = 'historial-capa';
  capa.innerHTML = `<div class="historial-caja" role="dialog" aria-modal="true" aria-label="Historial de jugadas">
      <header><h3>📜 Historial de jugadas</h3><button type="button" class="historial-cerrar" aria-label="Cerrar">✕</button></header>
      <div class="historial-leyenda">${leyenda}</div>
      <div class="historial-lista">${bloques}</div>
    </div>`;
  capa.addEventListener('click', e => {
    if (e.target === capa || e.target.closest('.historial-cerrar')) cerrarHistorial();
  });
  document.body.appendChild(capa);
}

/** Se llama una vez al cargar la página. */
export function initNarrador() {
  escucharHistorial(alNuevaEntrada);
  document.querySelector('#btnHistorial')?.addEventListener('click', abrirHistorial);
  const sel = document.querySelector('#selRitmoBots');
  if (sel) {
    sel.value = ritmoAutomatas();
    sel.addEventListener('change', () => fijarRitmoAutomatas(sel.value));
  }
  document.addEventListener('keydown', e => { if (e.key === 'Escape') cerrarHistorial(); });
}
