// Velocidad de las animaciones (1.37.0): un solo deslizador, de tortuga a
// conejo, que vale para la Mesa (escenas animadas), el Escenario 3D y el
// ritmo de las autómatas. Solo presentación: no toca ninguna regla.
//
// La velocidad es un factor (1 = normal; 0,4 = tortuga, 2,5 = conejo). El
// deslizador va de 0 a 100 con una escala exponencial, para que el centro
// sea la velocidad normal.

const CLAVE = 'invocadores.velocidad';
export const VELOCIDAD_MIN = 0.4;
export const VELOCIDAD_MAX = 2.5;

let actual = leer();
const oyentes = new Set();

function leer() {
  try {
    const v = parseFloat(localStorage.getItem(CLAVE));
    if (Number.isFinite(v)) return limitar(v);
  } catch { /* sin almacenamiento */ }
  return 1;
}

const limitar = v => Math.min(VELOCIDAD_MAX, Math.max(VELOCIDAD_MIN, v));

/** Factor de velocidad actual (1 = normal). */
export function velocidadAnimaciones() {
  return actual;
}

export function fijarVelocidadAnimaciones(v) {
  actual = limitar(v);
  try { localStorage.setItem(CLAVE, String(actual)); } catch { /* nada */ }
  oyentes.forEach(f => { try { f(actual); } catch (e) { console.warn(e); } });
  document.querySelectorAll?.('input[data-velocidad]').forEach(el => { if (document.activeElement !== el) el.value = String(posicionDeVelocidad(actual)); });
}

/** Avisa de cada cambio; devuelve la función para dejar de escuchar. */
export function alCambiarVelocidad(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

// Escala del deslizador: 0 → tortuga, 50 → normal, 100 → conejo.
export function posicionDeVelocidad(v) {
  const k = v >= 1 ? 0.5 + 0.5 * Math.log(v) / Math.log(VELOCIDAD_MAX) : 0.5 - 0.5 * Math.log(v) / Math.log(VELOCIDAD_MIN);
  return Math.round(Math.min(1, Math.max(0, k)) * 100);
}
export function velocidadDePosicion(p) {
  const k = Math.min(100, Math.max(0, p)) / 100;
  return k >= 0.5 ? Math.pow(VELOCIDAD_MAX, (k - 0.5) * 2) : Math.pow(VELOCIDAD_MIN, (0.5 - k) * 2);
}

/** HTML del deslizador (🐢 … 🐇). Se conecta solo con conectarDeslizadores(). */
export function deslizadorVelocidadHtml(clase = '') {
  return `<label class="m-velocidad ${clase}" title="Velocidad de las animaciones">`
    + `<span aria-hidden="true">🐢</span>`
    + `<input type="range" min="0" max="100" step="1" data-velocidad aria-label="Velocidad de las animaciones" value="${posicionDeVelocidad(actual)}">`
    + `<span aria-hidden="true">🐇</span></label>`;
}

let conectado = false;
/** Un solo oyente para todos los deslizadores de la página (también los que se pinten después). */
export function conectarDeslizadores() {
  if (conectado) return;
  conectado = true;
  document.querySelectorAll('input[data-velocidad]').forEach(el => { el.value = String(posicionDeVelocidad(actual)); });
  document.addEventListener('input', e => {
    const el = e.target;
    if (el?.matches?.('input[data-velocidad]')) fijarVelocidadAnimaciones(velocidadDePosicion(parseFloat(el.value)));
  });
}
