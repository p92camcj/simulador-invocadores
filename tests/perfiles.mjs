// Tests de perfiles, historial de partidas y ranking (js/perfiles.js): sin DOM.
import assert from 'node:assert/strict';
import {
  crearRegistroPartida, anadirAlHistorial, calcularRanking, normalizarNombre, nuevoIdPartida,
  registrarPartidaTerminada, leerHistorial, borrarHistorial, MAX_PARTIDAS,
} from '../js/perfiles.js';
import { calcularResultadoFinal, resultadoFinalExperto } from '../js/utils.js';

let ok = 0;
const test = (nombre, fn) => { fn(); ok++; console.log(`  ✓ ${nombre}`); };
const gemas = (...v) => v.map(valor => ({ valor, nivel: 'C' }));

const players = [
  { name: 'Ana', tipo: 'humano', gems: gemas(3, 2) },
  { name: 'Robo', tipo: 'auto', gems: gemas(1) },
  { name: 'Julio', tipo: 'humano', gems: gemas(4, 4) },
];
const jugadoras = players.map(p => ({ nombre: p.name, tipo: p.tipo }));
const reg = (id, resultado, extra = {}) => crearRegistroPartida({ id, fecha: '2026-11-20T10:00:00Z', resultado, jugadoras, modo: 'normal', invocaciones: 2, ...extra });

test('el registro guarda puesto, Gemas, tipo y quién gana', () => {
  const r = reg('p1', calcularResultadoFinal(players, ['C', 'B']));
  assert.equal(r.id, 'p1');
  assert.equal(r.objetivoCumplido, true);
  assert.deepEqual(r.jugadoras.map(j => [j.nombre, j.tipo, j.gemas, j.puesto, j.gana]), [
    ['Julio', 'humano', 8, 1, true], ['Ana', 'humano', 5, 2, false], ['Robo', 'auto', 1, 3, false],
  ]);
});

test('sin invocaciones nadie gana', () => {
  const r = reg('p0', calcularResultadoFinal(players, []), { invocaciones: 0 });
  assert.equal(r.objetivoCumplido, false);
  assert.ok(r.jugadoras.every(j => !j.gana));
});

test('Experto: la autómata central queda marcada y no entra en el ranking', () => {
  const r = reg('px', resultadoFinalExperto(players, { gems: gemas(9, 9) }, ['C']));
  assert.equal(r.jugadoras[0].tipo, 'central');
  assert.equal(r.jugadoras[0].gana, true);
  assert.ok(calcularRanking([r]).every(e => e.nombre !== r.jugadoras[0].nombre));
});

test('sin id o sin resultado no hay registro', () => {
  assert.equal(crearRegistroPartida({ id: null, resultado: calcularResultadoFinal(players, ['C']) }), null);
  assert.equal(crearRegistroPartida({ id: 'x', resultado: null }), null);
});

test('la misma partida no se guarda dos veces y el historial tiene tope', () => {
  const r = reg('p1', calcularResultadoFinal(players, ['C']));
  const h1 = anadirAlHistorial([], r);
  const h2 = anadirAlHistorial(h1, { ...r });
  assert.equal(h2, h1);
  assert.equal(h2.length, 1);
  let h = [];
  for (let i = 0; i < MAX_PARTIDAS + 5; i++) h = anadirAlHistorial(h, { ...r, id: `p${i}` });
  assert.equal(h.length, MAX_PARTIDAS);
  assert.equal(h[0].id, `p${MAX_PARTIDAS + 4}`);
});

test('ranking: partidas, victorias, % y Gemas medias, juntando nombres iguales', () => {
  const r1 = reg('a', calcularResultadoFinal(players, ['C']));
  const otra = [{ ...players[0], name: 'ana ', gems: gemas(9) }, players[1], players[2]];
  const r2 = reg('b', calcularResultadoFinal(otra, ['C']));
  const rk = calcularRanking([r1, r2]);
  const ana = rk.find(e => normalizarNombre(e.nombre) === 'ana');
  const julio = rk.find(e => e.nombre === 'Julio');
  assert.deepEqual([ana.partidas, ana.victorias, ana.porcentaje, ana.gemasMedias], [2, 1, 50, 7]);
  assert.deepEqual([julio.partidas, julio.victorias, julio.porcentaje, julio.gemasMedias], [2, 1, 50, 8]);
  assert.ok(rk.find(e => e.nombre === 'Robo').automata);
  assert.equal(calcularRanking([r1, r2], { conAutomatas: false }).some(e => e.automata), false);
});

test('normalizarNombre ignora mayúsculas, tildes y espacios', () => {
  assert.equal(normalizarNombre('  Ánä   María '), 'ana maria');
});

test('nuevoIdPartida da ids distintos', () => {
  assert.notEqual(nuevoIdPartida(1, () => 0.1), nuevoIdPartida(1, () => 0.2));
});

test('navegador: guarda en localStorage una sola vez por partida', () => {
  const mem = new Map();
  globalThis.localStorage = { getItem: k => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, String(v)), removeItem: k => mem.delete(k) };
  const datos = { id: 'z', resultado: calcularResultadoFinal(players, ['C']), jugadoras };
  assert.equal(registrarPartidaTerminada(datos), true);
  assert.equal(registrarPartidaTerminada(datos), false);
  assert.equal(leerHistorial().length, 1);
  borrarHistorial();
  assert.equal(leerHistorial().length, 0);
  delete globalThis.localStorage;
});

console.log(`\n${ok} tests OK (perfiles)`);
