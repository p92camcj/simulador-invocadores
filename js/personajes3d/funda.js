// «Fundas» del Escenario (1.41.0): la estética intercambiable de la vista 3D.
// El motor (tablero.js: partida, animaciones, cámara, toques) es siempre el
// mismo; cada funda solo aporta cómo se ven las cosas:
//   construirModelo(nombre) → { raiz, art, tipo, alto } con el mismo esqueleto
//                             que modelos.js (o null para usar el de serie)
//   crearPortal(v, semilla)  → un Portal con la misma interfaz que portales.js
//   crearSuelo({ mojado })   → el suelo que va bajo la mesa
// La funda 'clasica' es la de serie (modelos.js y portales.js), sin cambios.
// Para inventar otro modo de ver la partida basta con registrar otra funda.

const FUNDAS = new Map();
let actual = 'clasica';

export function registrarFunda(nombre, funda) { FUNDAS.set(nombre, funda); }

/** Cambia la funda activa. Devuelve true si ha cambiado. */
export function fijarFunda(nombre) {
  const n = FUNDAS.has(nombre) ? nombre : 'clasica';
  if (n === actual) return false;
  actual = n; return true;
}
export const nombreFunda = () => actual;
/** La funda activa (null = la clásica, la de serie). */
export const fundaActual = () => FUNDAS.get(actual) ?? null;
