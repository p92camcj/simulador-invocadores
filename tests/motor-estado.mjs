// tests/motor-estado.mjs
//
// Tests de js/motor/estado.js (fase 1 de la separación motor / interfaz,
// ver docs/ARQUITECTURA_MOTOR.md). Sin DOM. Ejecutar con
// `node tests/motor-estado.mjs`.

import assert from 'node:assert/strict';
import {
  estado, crearEstadoPartida, instalarAliasGlobales, reiniciarCamposDeTurno,
  reiniciarPartida, serializarPartida, cargarPartida, CLAVES_PARTIDA,
} from '../js/motor/estado.js';

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ✓ ${nombre}`);
}

const falsoWindow = {};
instalarAliasGlobales(falsoWindow);

test('los alias leen y escriben en estado.partida / estado.ui', () => {
  falsoWindow.players = [{ name: 'Ana', hand: [], portals: [[]], gems: [] }];
  falsoWindow.turn = 1;
  falsoWindow.selectedCardIdx = 0;
  assert.equal(estado.partida.players[0].name, 'Ana');
  assert.equal(estado.partida.turn, 1);
  assert.equal(estado.ui.selectedCardIdx, 0);
  estado.partida.levelIdx = 2;
  assert.equal(falsoWindow.levelIdx, 2);
  assert.equal(falsoWindow.estado, estado);
});

test('mutar el array devuelto por el alias muta el estado (como antes con window.*)', () => {
  falsoWindow.memoriaBots = [];
  falsoWindow.memoriaBots[0] = { portales: {} };
  assert.deepEqual(estado.partida.memoriaBots, [{ portales: {} }]);
});

test('reiniciarCamposDeTurno limpia solo los campos de turno', () => {
  falsoWindow.played = true;
  falsoWindow.habilidadUsadaEsteTurno = true;
  falsoWindow.cronomantePortalInvestigado = '0:1';
  falsoWindow.cronomanteOnComplete = () => {};
  reiniciarCamposDeTurno();
  assert.equal(falsoWindow.played, false);
  assert.equal(falsoWindow.habilidadUsadaEsteTurno, false);
  assert.equal(falsoWindow.cronomantePortalInvestigado, null);
  assert.equal(falsoWindow.cronomanteOnComplete, null);
  assert.equal(falsoWindow.selectedCardIdx, null);
  assert.equal(falsoWindow.turn, 1); // no se toca
});

test('serializar y cargar devuelve una partida idéntica e independiente', () => {
  falsoWindow.invocationSet = 'floral';
  falsoWindow.deck = [{ name: 'Ocultista' }, { name: 'Metamorfo', aspecto: 'Maestro' }];
  falsoWindow.neutrals = [[{ name: 'Centinela' }]];
  falsoWindow.invocacionesCompletadas = [0];
  const json = serializarPartida();
  const antes = JSON.parse(json);
  cargarPartida(json);
  assert.deepEqual(estado.partida, antes);
  assert.equal(falsoWindow.deck[1].aspecto, 'Maestro');
  falsoWindow.deck.pop();
  assert.equal(antes.deck.length, 2); // copia, no referencia
  assert.equal(falsoWindow.selectedCardIdx, null); // la UI se reinicia
});

test('el estado de interfaz nunca entra en el JSON', () => {
  falsoWindow.cronomanteOnComplete = () => {};
  falsoWindow.selectedCardIdx = 3;
  const datos = JSON.parse(serializarPartida());
  assert.deepEqual(Object.keys(datos).sort(), [...CLAVES_PARTIDA].sort());
});

test('cargarPartida rellena claves que faltan y descarta las desconocidas', () => {
  cargarPartida({ turn: 2, basura: 1 });
  assert.equal(falsoWindow.turn, 2);
  assert.deepEqual(falsoWindow.deck, []);
  assert.equal('basura' in estado.partida, false);
});

test('reiniciarPartida vacía la partida pero conserva el set de invocación', () => {
  falsoWindow.invocationSet = 'introductorio';
  falsoWindow.players = [{}];
  falsoWindow.juegoTerminado = true;
  reiniciarPartida();
  assert.deepEqual(estado.partida, crearEstadoPartida('introductorio'));
  assert.deepEqual(falsoWindow.players, []);
});

console.log(`\n${ok} tests OK (motor/estado)`);
