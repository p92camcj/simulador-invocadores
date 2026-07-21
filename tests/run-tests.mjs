// tests/run-tests.mjs
//
// Runner mínimo sin dependencias (docs/DEUDA_TECNICA.md ítem 6): cubre las
// funciones puras más críticas de js/utils.js y js/abilities.js (economía de
// Gemas, visibilidad, protección de Centinela, y las opciones de Fase B) con
// node:assert nativo — sin framework, sin build step, coherente con el resto
// del proyecto. Ejecutar con `node tests/run-tests.mjs`.
//
// Alcance deliberado (NO es cobertura completa del proyecto, ver el propio
// ítem 6): no cubre actions.js/game.js/render.js (dependen del DOM real, ver
// docs/DEUDA_TECNICA.md), ni todos los `case` de abilities.js (varios abren
// un picker() de UI y no son fácilmente probables sin esa capa). Es un punto
// de partida real, no la solución completa a la falta de tests automatizados.

import assert from 'node:assert/strict';
import {
  sumaGemas, contarGemasPorNivel, tieneGemaAsterisco, gastarGemaAsterisco,
  gastarGemaUnitaria, construirPoolGemas, todosLosPortales,
  jugadoraProtegidaPorCentinela, estaProtegidoParaActivar,
  opcionesActivarHabilidad, generarVis,
} from '../js/utils.js';
import { ocultarOtrasCentinelas } from '../js/abilities.js';

// pagarActivacionPortalCentral usa confirm()/alert() nativos del navegador;
// en Node no existen como globales, así que se stubean antes de importar
// cualquier función que pueda llamarlos.
global.alert = () => {};
global.confirm = () => false;

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    fail++;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
  }
}

console.log('Economía de Gemas (utils.js)');

test('sumaGemas suma los valores reales de todas las Gemas', () => {
  assert.equal(sumaGemas([{ valor: 1 }, { valor: 3 }, { valor: 5 }]), 9);
  assert.equal(sumaGemas([]), 0);
});

test('contarGemasPorNivel agrupa por nivel sin revelar el valor real', () => {
  const r = contarGemasPorNivel([
    { valor: 1, nivel: 'unitaria' },
    { valor: 3, nivel: 'C' },
    { valor: 1, nivel: 'unitaria' },
  ]);
  assert.deepEqual(r, { unitaria: 2, C: 1 });
});

test('gastarGemaUnitaria gasta una Gema unitaria suelta si existe', () => {
  const player = { gems: [{ valor: 1, nivel: 'unitaria' }, { valor: 3, nivel: 'C' }] };
  assert.equal(gastarGemaUnitaria(player), true);
  assert.deepEqual(player.gems, [{ valor: 3, nivel: 'C' }]);
});

test('gastarGemaUnitaria cambia la Gema de menor valor si no hay unitaria suelta', () => {
  const player = { gems: [{ valor: 3, nivel: 'C' }] };
  assert.equal(gastarGemaUnitaria(player), true);
  assert.deepEqual(player.gems, [{ valor: 1, nivel: 'unitaria' }, { valor: 1, nivel: 'unitaria' }]);
});

test('gastarGemaUnitaria falla si no hay ninguna Gema con la que pagar', () => {
  const player = { gems: [] };
  assert.equal(gastarGemaUnitaria(player), false);
});

test('gastarGemaAsterisco solo gasta la Gema marcada como tal', () => {
  const player = { gems: [{ valor: 2, esAsterisco: true }, { valor: 3 }] };
  assert.equal(tieneGemaAsterisco(player), true);
  assert.equal(gastarGemaAsterisco(player), true);
  assert.deepEqual(player.gems, [{ valor: 3 }]);
  assert.equal(gastarGemaAsterisco(player), false);
});

test('construirPoolGemas marca como asterisco solo la primera Gema de menor valor', () => {
  const pool = construirPoolGemas([2, 3, 3, 3, 4]);
  assert.equal(pool.length, 5);
  const asteriscos = pool.filter(g => g.esAsterisco);
  assert.equal(asteriscos.length, 1);
  assert.equal(asteriscos[0].valor, 2);
});

console.log('Portales y protección de Centinela (utils.js)');

test('todosLosPortales recorre jugadoras + neutrales con el playerIdx correcto', () => {
  const players = [{ portals: [['a'], ['b']] }, { portals: [['c']] }];
  const neutrals = [['d'], ['e']];
  const r = todosLosPortales(players, neutrals);
  assert.equal(r.length, 5);
  assert.deepEqual(r.map(t => t.playerIdx), [0, 0, 1, null, null]);
});

test('jugadoraProtegidaPorCentinela exige una Centinela realmente visible', () => {
  const conCentinela = { portals: [[{ name: 'Centinela', vis: { public: true } }]] };
  const oculta = { portals: [[{ name: 'Centinela', vis: { public: false } }]] };
  assert.equal(jugadoraProtegidaPorCentinela(conCentinela), true);
  assert.equal(jugadoraProtegidaPorCentinela(oculta), false);
});

test('estaProtegidoParaActivar exime a la propia dueña actuando sobre sí misma', () => {
  const players = [
    { portals: [[{ name: 'Centinela', vis: { public: true } }]] },
    { portals: [[]] },
  ];
  const stack = players[0].portals[0];
  assert.equal(estaProtegidoParaActivar('0:0', stack, players, 1), true);
  assert.equal(estaProtegidoParaActivar('0:0', stack, players, 0), false);
});

test('ocultarOtrasCentinelas oculta cualquier otra Centinela visible, deja la recién jugada', () => {
  const mk = pub => [{ name: 'Centinela', vis: { public: pub } }];
  const players = [{ portals: [mk(true)] }, { portals: [mk(true)] }];
  const neutrals = [mk(true)];
  ocultarOtrasCentinelas(neutrals[0], players, neutrals);
  assert.equal(players[0].portals[0][0].vis.public, false);
  assert.equal(players[1].portals[0][0].vis.public, false);
  assert.equal(neutrals[0][0].vis.public, true);
});

console.log('Fase B: opciones de habilidad activable (utils.js) — regresión deuda ítem 16');

test('opcionesActivarHabilidad no ofrece un Portal central sin Gemas suficientes', () => {
  const players = [{ portals: [], gems: [] }];
  const neutrals = [[{ name: 'Ocultista', vis: { public: true } }]];
  const r = opcionesActivarHabilidad(0, players, neutrals);
  assert.equal(r.some(o => o.val.startsWith('central')), false);
});

test('opcionesActivarHabilidad exige el doble de valor en Gemas para Metamorfo central', () => {
  const neutrals = [[{ name: 'Metamorfo', vis: { public: true } }]];
  const players = [{ portals: [], gems: [{ valor: 1, nivel: 'unitaria' }] }];
  assert.equal(opcionesActivarHabilidad(0, players, neutrals).some(o => o.val.startsWith('central')), false);
  players[0].gems = [{ valor: 2, nivel: 'C' }];
  assert.equal(opcionesActivarHabilidad(0, players, neutrals).some(o => o.val.startsWith('central')), true);
});

test('opcionesActivarHabilidad siempre ofrece los Portales propios, aunque no haya Gemas', () => {
  const players = [{ portals: [[{ name: 'Ocultista', vis: { public: true } }]], gems: [] }];
  const r = opcionesActivarHabilidad(0, players, []);
  assert.equal(r.some(o => o.val === 'own:0'), true);
});

console.log('Visibilidad de cartas (utils.js)');

test('generarVis: una carta jugada en un Portal siempre es pública', () => {
  assert.deepEqual(generarVis('portal', {}), { public: true });
});

test('generarVis: carta robada del mazo respeta el parámetro visible', () => {
  assert.deepEqual(
    generarVis('mano', { origen: 'mazo', visible: true }),
    { owner: true, others: false, public: false }
  );
  assert.deepEqual(
    generarVis('mano', { origen: 'mazo', visible: false }),
    { owner: false, others: true, public: false }
  );
});

console.log(`\n${pass} OK, ${fail} fallidos`);
process.exit(fail ? 1 : 0);
