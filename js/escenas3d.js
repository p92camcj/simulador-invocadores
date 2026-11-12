// Modos de ver la partida (1.36.0): «Mesa» (cartas en perspectiva con
// escenas 2D, la de siempre) y «Escenario» (todo en 3D con los personajes,
// js/personajes3d/tablero.js). Capa de presentación pura: no decide nada del
// juego. Three.js y los modelos (js/personajes3d/, vendor/three) solo se
// descargan si la jugadora elige el Escenario; con la Mesa (lo normal) la
// partida no carga ni un byte de todo eso.

const CLAVE = 'invocadores.personajes3d';   // '1' = Escenario (nombre antiguo de la preferencia)
const CLAVE_SONIDO = 'inv3d.sonido';

let activo = false;
let sonido = false;
try {
  activo = localStorage.getItem(CLAVE) === '1';
  sonido = localStorage.getItem(CLAVE_SONIDO) === '1';
} catch { /* sin almacenamiento: Mesa */ }

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
    .then(m => { m.iniciar(); m.fijarSonido(sonido); modulo = m; return m; })
    .catch(e => { cargando = null; throw e; });
  return cargando;
}

/** Elige el modo: true = Escenario, false = Mesa. */
export function fijarEscenario(valor) {
  activo = !!valor;
  try { localStorage.setItem(CLAVE, activo ? '1' : '0'); } catch { /* nada */ }
  if (!activo) modulo?.ocultar();
  const chk = document.querySelector('#chk3D');
  if (chk) chk.checked = activo;
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
  const chk = document.querySelector('#chk3D');
  if (!chk) return;
  chk.checked = activo;
  chk.addEventListener('change', e => {
    fijarEscenario(e.target.checked);
    if (e.target.checked) cargarTablero().catch(() => {});   // se adelanta la descarga
  });
}
