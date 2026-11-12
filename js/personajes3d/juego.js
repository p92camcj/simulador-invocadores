// Puente entre el juego y las escenas 3D: crea (una sola vez) el lienzo a
// pantalla completa, y reproduce la escena que pida espectaculo.js. Se carga
// con import() solo cuando la jugadora activa «Personajes 3D».
import { crearMundo, mundo, CANCELADO, pausar, reanudar } from './mundo.js';
import { crearEfectos } from './efectos.js';
import { montarEscenario, configurar, ponerNombres, escenaDeJuego, detenerEscena } from './escenas.js';
import { iniciarAudio, ponerSonido } from './sonido.js';

let capa = null, lienzo, rotulo, velo;

const CSS = `
#escena3d{position:fixed;inset:0;z-index:9000;background:#0a0f24;opacity:0;transition:opacity .35s ease;cursor:pointer;-webkit-tap-highlight-color:transparent}
#escena3d.visible{opacity:1}
#escena3d.oculta{display:none}
#escena3d canvas{position:absolute;inset:0;width:100%;height:100%;display:block}
#escena3d .e3-flash{position:absolute;inset:0;background:#fff;opacity:0;pointer-events:none}
#escena3d .e3-rotulo{position:absolute;left:0;right:0;bottom:max(18px,env(safe-area-inset-bottom));padding:0 16px;text-align:center;color:#fff;pointer-events:none;text-shadow:0 2px 10px #000,0 0 3px #000}
#escena3d .e3-rotulo strong{display:block;font:700 clamp(22px,5vw,34px)/1.15 Georgia,'Times New Roman',serif;color:#ffe9a8;letter-spacing:.02em}
#escena3d .e3-rotulo span{display:block;font:500 clamp(13px,3.2vw,17px)/1.35 system-ui,sans-serif;margin-top:4px}
#escena3d .e3-saltar{position:absolute;top:max(12px,env(safe-area-inset-top));right:14px;font:500 13px system-ui,sans-serif;color:rgba(255,255,255,.75);background:rgba(10,15,36,.55);border:1px solid rgba(255,255,255,.25);border-radius:999px;padding:5px 12px;pointer-events:none}
`;

function preparar() {
  if (capa) return;
  const estilo = document.createElement('style'); estilo.textContent = CSS; document.head.appendChild(estilo);
  capa = document.createElement('div'); capa.id = 'escena3d'; capa.className = 'oculta';
  capa.setAttribute('role', 'status'); capa.setAttribute('aria-live', 'polite');
  capa.innerHTML = '<canvas></canvas><div class="e3-flash"></div><div class="e3-saltar">Toca para saltar</div><div class="e3-rotulo"><strong></strong><span></span></div>';
  document.body.appendChild(capa);
  lienzo = capa.querySelector('canvas'); velo = capa.querySelector('.e3-flash'); rotulo = capa.querySelector('.e3-rotulo');
  let calidad = 'alta';
  try { calidad = localStorage.getItem('inv3d.calidad') ?? (Math.min(innerWidth, innerHeight) < 600 ? 'baja' : 'alta'); } catch { /* por defecto */ }
  try { crearMundo(lienzo, calidad, { controles: false }); } catch (e) { capa.remove(); capa = null; throw e; }
  crearEfectos(); montarEscenario({ colocar: false });
  configurar({
    di: () => {},
    flash: k => { velo.style.transition = 'none'; velo.style.opacity = k; requestAnimationFrame(() => { velo.style.transition = 'opacity 1.1s ease-out'; velo.style.opacity = 0; }); },
  });
  pausar();
  capa.addEventListener('click', saltar);
  window.addEventListener('unhandledrejection', e => { if (e.reason === CANCELADO) e.preventDefault(); });
}

/** Sonido sí/no; `gesto` indica que venimos de un clic (se puede abrir el audio). */
export function fijarSonido(si, gesto = false) { ponerSonido(si); if (si && gesto) iniciarAudio(); }

let enCurso = 0;
/** Reproduce la escena y resuelve true al terminar o al saltarla. */
export async function reproducirEscenaJuego(d, { titulo = '', subtitulo = '', nombres = [], ritmo = 1 } = {}) {
  preparar();
  const turno = ++enCurso;
  rotulo.querySelector('strong').textContent = titulo; rotulo.querySelector('span').textContent = subtitulo;
  ponerNombres(nombres);
  capa.classList.remove('oculta'); reanudar(); requestAnimationFrame(() => capa.classList.add('visible'));
  mundo.velocidad = 1.45 / Math.max(0.5, ritmo);
  const visto = await escenaDeJuego(d);
  if (turno !== enCurso) return true;        // otra escena ya ha tomado el lienzo
  capa.classList.remove('visible');
  await new Promise(r => setTimeout(r, 300));
  if (turno === enCurso) { capa.classList.add('oculta'); pausar(); }
  return visto === null ? null : true;
}

export function saltar() { if (capa) detenerEscena(); }
