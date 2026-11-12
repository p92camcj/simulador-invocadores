// Personajes 3D (1.35.0): interruptor y cargador perezoso de las escenas
// tridimensionales. Capa de presentación pura, como espectaculo.js: no decide
// nada del juego. Three.js y los modelos (js/personajes3d/, vendor/three)
// solo se descargan si la jugadora activa esta opción; desactivada (lo
// normal), la partida no carga ni un byte de todo eso.

const CLAVE = 'invocadores.personajes3d';
const CLAVE_SONIDO = 'inv3d.sonido';

let activo = false;
let sonido = false;
try {
  activo = localStorage.getItem(CLAVE) === '1';
  sonido = localStorage.getItem(CLAVE_SONIDO) === '1';
} catch { /* sin almacenamiento: se queda desactivado */ }

let cargando = null;
let modulo = null;

export function escenas3dActivas() {
  return activo && typeof document !== 'undefined';
}

export function sonido3dActivo() {
  return sonido;
}

function cargar() {
  cargando ??= import('./personajes3d/juego.js')
    .then(m => { modulo = m; m.fijarSonido(sonido); return m; })
    .catch(e => { cargando = null; throw e; });
  return cargando;
}

/** Activa o desactiva las escenas 3D. Al activarlas se empiezan a descargar. */
export function fijarEscenas3D(valor) {
  activo = !!valor;
  try { localStorage.setItem(CLAVE, activo ? '1' : '0'); } catch { /* nada */ }
  if (activo) cargar().catch(e => console.warn('Personajes 3D no disponibles:', e));
  else detener3D();
  const chk = document.querySelector('#chk3D');
  if (chk) chk.checked = activo;
}

/** Sonido de las escenas 3D (sintetizado, sin archivos). Hay que llamarlo desde un clic. */
export function fijarSonido3D(valor) {
  sonido = !!valor;
  try { localStorage.setItem(CLAVE_SONIDO, sonido ? '1' : '0'); } catch { /* nada */ }
  modulo?.fijarSonido(sonido, true);
}

/**
 * Reproduce una escena 3D a pantalla completa. Devuelve true si se vio (entera
 * o saltándola) y null si no se pudo (sin WebGL, sin red la primera vez…),
 * para que espectaculo.js recurra a su escena 2D de siempre.
 */
export async function reproducir3D(descriptor, opciones) {
  try {
    const m = await cargar();
    return await m.reproducirEscenaJuego(descriptor, opciones);
  } catch (e) {
    console.warn('Escena 3D no disponible, se usa la escena 2D:', e);
    return null;
  }
}

export function detener3D() {
  modulo?.saltar();
}

export function initEscenas3D() {
  const chk = document.querySelector('#chk3D');
  if (!chk) return;
  chk.checked = activo;
  chk.addEventListener('change', e => fijarEscenas3D(e.target.checked));
}
