// tools/modelo-base.mjs
// Genera js/aprendizaje-base.js: el modelo de cómo juegan las personas que
// la Experta usa DE SERIE en cualquier dispositivo hasta que ese
// dispositivo haya observado jugadas suficientes de sus propias personas.
//
// Lee todos los registros de aprendizaje exportados desde la web (botón
// "Descargar" del panel de aprendizaje) que haya en datos/aprendizaje/,
// junta sus jugadas y ajusta el modelo con ajustarModelo() (js/aprendizaje.js).
//
//   node tools/modelo-base.mjs
//
// Añade un archivo nuevo a datos/aprendizaje/ y vuelve a ejecutarlo para
// actualizar el modelo de serie.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizarAlmacen, ajustarModelo } from '../js/aprendizaje.js';

const raiz = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const carpeta = path.join(raiz, 'datos', 'aprendizaje');
const archivos = fs.readdirSync(carpeta).filter(f => f.endsWith('.json')).sort();
let ejemplos = [];
let partidas = 0;
archivos.forEach(f => {
  const almacen = normalizarAlmacen(JSON.parse(fs.readFileSync(path.join(carpeta, f), 'utf8')));
  ejemplos = ejemplos.concat(almacen.ejemplos);
  partidas += almacen.partidas;
});
const modelo = ajustarModelo(ejemplos);
if (!modelo) throw new Error(`Solo hay ${ejemplos.length} jugadas: no bastan para ajustar un modelo`);
const salida = `// aprendizaje-base.js — GENERADO por tools/modelo-base.mjs, no editar a mano.
// Modelo de cómo juegan las personas que la Experta usa de serie (en
// cualquier dispositivo) hasta que el dispositivo tenga su propio modelo.
// Ajustado con ${ejemplos.length} jugadas de ${partidas} partidas reales
// (datos/aprendizaje/: ${archivos.join(', ')}).
export const MODELO_PERSONAS_BASE = Object.freeze(${JSON.stringify({ ...modelo, partidas, base: true })});
`;
fs.writeFileSync(path.join(raiz, 'js', 'aprendizaje-base.js'), salida);
console.log(salida);
