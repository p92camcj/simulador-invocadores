// Modos de ver la partida: «Por bloques» (1.41.0, el de por defecto),
// «Escenario» (1.36.0) y «Mesa» (cartas en perspectiva con escenas 2D).
// Por bloques y Escenario son el mismo motor 3D (js/personajes3d/tablero.js)
// con distinta «funda» (js/personajes3d/funda.js): solo cambia la estética.
// Capa de presentación pura: no decide nada del juego. Three.js y los modelos
// (js/personajes3d/, vendor/three) solo se descargan si se usa una vista 3D.

const CLAVE = 'invocadores.vista';           // 'bloques' | 'escenario' | 'mesa'
const CLAVE_SONIDO = 'inv3d.sonido';
export const VISTAS = [['bloques', '🧱', 'Por bloques'], ['escenario', '🧙', 'Escenario 3D'], ['mesa', '🎴', 'Mesa de cartas']];
const FUNDA_DE = { bloques: 'bloques', escenario: 'clasica' };

let vista = 'bloques';
let sonido = false;
try {
  const v = localStorage.getItem(CLAVE);
  if (VISTAS.some(([k]) => k === v)) vista = v;
  sonido = localStorage.getItem(CLAVE_SONIDO) === '1';
} catch { /* sin almacenamiento: por bloques */ }
let activo = vista !== 'mesa';

/** La vista elegida: 'bloques' | 'escenario' | 'mesa'. */
export const vistaActual = () => vista;
export const nombreVista = (v = vista) => VISTAS.find(([k]) => k === v)?.[2] ?? v;

let cargando = null;
let modulo = null;

/** ¿Ha elegido la jugadora el Escenario? */
export function escenarioActivo() {
  return activo && typeof document !== 'undefined';
}

/** El módulo del Escenario si ya está cargado (si no, null). */
export function tablero() {
  return modulo;
}

/** ¿Se está viendo ahora mismo el Escenario (elegido y cargado)? */
export function escenarioEnUso() {
  return escenarioActivo() && !!modulo && document.body.classList.contains('modo-escenario');
}

export function sonido3dActivo() {
  return sonido;
}

/** Carga Three.js y el Escenario (una sola vez). */
export function cargarTablero() {
  cargando ??= import('./personajes3d/tablero.js')
    .then(m => { m.cambiarFunda(FUNDA_DE[vista] ?? 'bloques'); m.iniciar(); m.fijarSonido(sonido); modulo = m; return m; })
    .catch(e => { cargando = null; throw e; });
  return cargando;
}

/** Elige la vista: 'bloques' | 'escenario' | 'mesa'. */
export function fijarVista(v) {
  if (!VISTAS.some(([k]) => k === v)) return;
  vista = v; activo = v !== 'mesa';
  try { localStorage.setItem(CLAVE, v); } catch { /* nada */ }
  if (!activo) modulo?.ocultar();
  else modulo?.cambiarFunda(FUNDA_DE[v]);
  const sel = document.querySelector('#selVista');
  if (sel) sel.value = v;
}
/** Compatibilidad: true = una vista 3D (la última 3D elegida, o por bloques), false = Mesa. */
export function fijarEscenario(valor) {
  fijarVista(valor ? (vista === 'mesa' ? 'bloques' : vista) : 'mesa');
}

/** Sonido del Escenario (sintetizado, sin archivos). Hay que llamarlo desde un clic. */
export function fijarSonido3D(valor) {
  sonido = !!valor;
  try { localStorage.setItem(CLAVE_SONIDO, sonido ? '1' : '0'); } catch { /* nada */ }
  modulo?.fijarSonido(sonido, true);
}

/** Lo que ha pasado en la partida, para que el Escenario lo escenifique. */
export function anunciarEscenario(evento) {
  if (escenarioEnUso()) modulo.anunciar(evento);
}

/** ¿Está el Escenario a mitad de una animación? (el turno espera a que acabe). */
export function escenarioOcupado() {
  return escenarioEnUso() && modulo.ocupado();
}

export function cuandoLibreEscenario() {
  return escenarioEnUso() ? modulo.cuandoLibre() : Promise.resolve();
}

/** Partida nueva o vuelta al menú. */
export function reiniciarEscenario() {
  modulo?.reiniciar();
}

export function initEscenas3D() {
  const sel = document.querySelector('#selVista');
  if (!sel) return;
  sel.value = vista;
  sel.addEventListener('change', e => {
    fijarVista(e.target.value);
    if (activo) cargarTablero().catch(() => {});   // se adelanta la descarga
  });
}
