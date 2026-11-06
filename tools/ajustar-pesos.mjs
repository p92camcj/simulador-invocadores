// tools/ajustar-pesos.mjs
// Afinado de los PESOS de js/bot-estrategia.js por autojuego: cada
// candidata juega contra los pesos actuales (en 2 y 3 jugadoras, con la
// dificultad indicada) y se queda la que más gana por encima de lo esperado
// (50 % con 2 jugadoras, 33 % con 3). Búsqueda aleatoria alrededor de la
// mejor encontrada hasta el momento.
//
// Uso: node tools/ajustar-pesos.mjs [--candidatas 30] [--partidas 2000]
//                                   [--nivel dificil] [--semilla 1]
import { torneo, sembrarAzar } from './arena.mjs';
import { PESOS } from '../js/bot-estrategia.js';

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
  if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
  return acc;
}, []));
const candidatas = +(args.candidatas || 30);
const partidas = +(args.partidas || 2000);
const nivel = args.nivel || 'dificil';
const semilla = +(args.semilla || 1);

const RANGOS = { rival: [0, 1.5], posicion: [0, 1.2], amenaza: [0, 1.5] };

/** Ventaja de `perfil` sobre los PESOS actuales: (victorias − esperado) medio en 2 y 3 jugadoras. */
function ventaja(perfil) {
  const perfiles = { c: perfil };
  const r2 = torneo({ partidas, mesa: [`${nivel}@c`, nivel], semilla, perfiles }).resumen[`${nivel}@c`];
  const r3 = torneo({ partidas, mesa: [`${nivel}@c`, nivel, nivel], semilla: semilla + 1, perfiles }).resumen[`${nivel}@c`];
  return ((r2.victoriasPorAsiento - 1 / 2) + (r3.victoriasPorAsiento - 1 / 3)) / 2;
}

const base = { ...PESOS };
let mejor = { perfil: base, ventaja: 0 };
console.log('base', JSON.stringify(base));
let rng = semilla * 9973;
const azar = () => { rng = (rng * 16807) % 2147483647; return rng / 2147483647; };
for (let i = 0; i < candidatas; i++) {
  // La mitad, al azar en todo el rango; la otra mitad, cerca de la mejor.
  const perfil = {};
  Object.entries(RANGOS).forEach(([k, [lo, hi]]) => {
    const v = i % 2 === 0
      ? lo + azar() * (hi - lo)
      : Math.min(hi, Math.max(lo, mejor.perfil[k] + (azar() - 0.5) * (hi - lo) * 0.3));
    perfil[k] = +v.toFixed(2);
  });
  const v = ventaja(perfil);
  console.log(i, JSON.stringify(perfil), v.toFixed(3));
  if (v > mejor.ventaja) mejor = { perfil, ventaja: v };
}
sembrarAzar(Date.now());
console.log('MEJOR', JSON.stringify(mejor.perfil), mejor.ventaja.toFixed(3));
