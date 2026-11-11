// Arranque e interfaz de la maqueta (selector de escenas, sonido, calidad).
import { crearMundo, mundo, CANCELADO } from './mundo.js';
import { crearEfectos } from './efectos.js';
import { montarEscenario, ESCENAS, reproducir, configurar } from './escenas.js';
import { iniciarAudio, ponerSonido, sonidoActivo } from './sonido.js';

const $ = s => document.querySelector(s);
const guardado = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } };
const guardar = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin almacenamiento */ } };
window.addEventListener('unhandledrejection', e => { if (e.reason === CANCELADO) e.preventDefault(); });

const calidad = new URLSearchParams(location.search).get('calidad') ?? guardado('inv3d.calidad', 'alta');
crearMundo($('#lienzo'), calidad); crearEfectos(); montarEscenario();
configurar({
  di: t => { $('#texto').textContent = t; },
  flash: k => { const f = $('#flash'); f.style.transition = 'none'; f.style.opacity = k; requestAnimationFrame(() => { f.style.transition = 'opacity 1.1s ease-out'; f.style.opacity = 0; }); },
});

let actual = 0, seguidas = false, turno = 0;
async function ver(i) {
  actual = (i + ESCENAS.length) % ESCENAS.length; const e = ESCENAS[actual], mio = ++turno;
  $('#titulo').textContent = `${e.id} · ${e.titulo}`; $('#texto').textContent = '';
  document.querySelectorAll('#lista button').forEach((b, j) => b.classList.toggle('activa', j === actual));
  const fin = await reproducir(e.id);
  if (fin && seguidas && mio === turno && actual < ESCENAS.length - 1) ver(actual + 1);
}
// Lista de escenas agrupada.
let grupo = null; const lista = $('#lista');
ESCENAS.forEach((e, i) => {
  if (e.grupo !== grupo) { grupo = e.grupo; const h = document.createElement('h3'); h.textContent = grupo; lista.append(h); }
  const b = document.createElement('button'); b.innerHTML = `<b>${e.id}</b> ${e.titulo}`; b.onclick = () => { cerrar(); seguidas = false; ver(i); }; lista.append(b);
});
const cerrar = () => $('#hoja').classList.remove('abierta');
$('#btnEscenas').onclick = () => $('#hoja').classList.toggle('abierta');
$('#cerrarHoja').onclick = cerrar;
$('#btnAnt').onclick = () => { seguidas = false; ver(actual - 1); };
$('#btnSig').onclick = () => { seguidas = false; ver(actual + 1); };
$('#btnRepetir').onclick = () => ver(actual);
$('#btnTodas').onclick = () => { cerrar(); seguidas = true; ver(0); };
const pintarSonido = () => { $('#btnSonido').textContent = sonidoActivo() ? '🔊' : '🔇'; };
ponerSonido(guardado('inv3d.sonido', '1') === '1'); pintarSonido();
$('#btnSonido').onclick = () => { ponerSonido(!sonidoActivo()); guardar('inv3d.sonido', sonidoActivo() ? '1' : '0'); iniciarAudio(); pintarSonido(); };
$('#btnCalidad').textContent = calidad === 'alta' ? 'Calidad: alta' : 'Calidad: baja';
$('#btnCalidad').onclick = () => { guardar('inv3d.calidad', calidad === 'alta' ? 'baja' : 'alta'); location.href = location.pathname; };
setInterval(() => { $('#fps').textContent = mundo.fps + ' fps'; }, 500);
$('#empezar').onclick = () => { iniciarAudio(); $('#portada').remove(); ver(0); };
window.maqueta = { ver, ESCENAS, mundo, reproducir };
$('#empezar').disabled = false; $('#empezar').textContent = 'Empezar';
