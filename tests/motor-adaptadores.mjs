// tests/motor-adaptadores.mjs
//
// Fase 4 de la separación motor / interfaz (docs/ARQUITECTURA_MOTOR.md): el
// autómata contesta las peticiones del motor con crearUiAutomata()
// (js/bot.js) en vez de pulsar los picker() del DOM. Sin DOM.
// Ejecutar con `node tests/motor-adaptadores.mjs`.

import assert from 'node:assert/strict';
import { crearEstadoPartida } from '../js/motor/estado.js';
import { aplicarHabilidad } from '../js/motor/habilidades.js';
import { completarActivacion } from '../js/motor/acciones.js';
import { crearUiAutomata, construirEstadoVisibleParaBot } from '../js/bot.js';

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ✓ ${nombre}`);
}

const enMano = (name, owner) => ({ name, vis: { owner, others: !owner, public: false } });
const enPortal = name => ({ name, vis: { public: true } });
const unidades = n => Array.from({ length: n }, () => ({ valor: 1, nivel: 'unitaria' }));

function partida() {
  const p = crearEstadoPartida('normal');
  p.players = [
    { name: 'Robot', tipo: 'auto', hand: [enMano('Pícaro', true)], portals: [[enPortal('Estratega')]], gems: unidades(2) },
    { name: 'Bea', tipo: 'humano', hand: [enMano('Cronista', true), enMano('Maestro', false)], portals: [[enPortal('Aprendiz'), enPortal('Ocultista')]], gems: unidades(3) },
  ];
  p.neutrals = [[enPortal('Cronomante')], [{ name: 'Centinela', vis: { public: false } }]];
  p.played = true;
  return p;
}

const vista = p => construirEstadoVisibleParaBot(p.players, p.neutrals, 0);

test('contesta cada paso con el objetivo preferido de la heurística', () => {
  const p = partida();
  const ui = crearUiAutomata(vista(p), ['0:0', 'n:0']);
  let aplicada = 0;
  aplicarHabilidad(p, { personaje: 'Estratega', jugadora: 0, pila: p.players[0].portals[0] }, ui, () => aplicada++);
  assert.deepEqual(ui.elegidos, ['0:0', 'n:0']);
  assert.equal(aplicada, 1);
  assert.equal(p.players[0].portals[0].at(-1).name, 'Cronomante');
});

test('sin preferencia prefiere un Portal oculto', () => {
  const p = partida();
  const ui = crearUiAutomata(vista(p), undefined);
  aplicarHabilidad(p, { personaje: 'Ocultista', jugadora: 0, pila: null }, ui, () => {});
  assert.deepEqual(ui.elegidos, ['n:1']);
  assert.equal(p.neutrals[1].at(-1).vis.public, true);
});

test('un preferido que no está entre las opciones habilitadas no se usa', () => {
  const p = partida();
  const ui = crearUiAutomata(vista(p), 'n:9');
  aplicarHabilidad(p, { personaje: 'Cronista', jugadora: 0, pila: null }, ui, () => {});
  assert.equal(ui.elegidos.length, 1);
  assert.notEqual(ui.elegidos[0], 'n:9');
});

test('segundo paso de Cronomante: elige la carta por el nombre de la etiqueta', () => {
  const p = partida();
  const ui = crearUiAutomata(vista(p), ['1:0', 'Aprendiz']);
  let aplicada = 0;
  aplicarHabilidad(p, { personaje: 'Cronomante', jugadora: 0, pila: null }, ui, () => aplicada++);
  assert.equal(aplicada, 1);
  assert.equal(p.players[1].portals[0].at(-1).name, 'Aprendiz');
  assert.equal(p.cronomantePortalInvestigado, null);
});

test('sin opciones habilitadas cancela y no aplica', () => {
  const p = partida();
  p.players[1].portals[0] = [enPortal('Ocultista')]; // Cronomante necesita 2+ cartas
  p.players[0].portals[0] = [enPortal('Estratega')];
  p.neutrals = [[enPortal('Cronomante')]];
  const ui = crearUiAutomata(vista(p), undefined);
  let aplicada = 0;
  aplicarHabilidad(p, { personaje: 'Cronomante', jugadora: 0, pila: null }, ui, () => aplicada++);
  assert.equal(aplicada, 0);
  assert.deepEqual(ui.elegidos, []);
});

test('los avisos del motor quedan en la ui del autómata, sin alert()', () => {
  const p = partida();
  p.players[1].hand = [enMano('Cronista', true)];
  const ui = crearUiAutomata(vista(p), undefined);
  aplicarHabilidad(p, { personaje: 'Maestro', jugadora: 0, pila: null }, ui, () => {});
  assert.match(ui.avisos[0].motivo, /No hay ninguna jugadora/);
});

test('completarActivacion: el autómata paga el acceso central con una Gema de 1 aunque tenga asterisco', () => {
  const p = partida();
  p.players[0].gems.push({ valor: 2, nivel: 'C', esAsterisco: true });
  completarActivacion(p, { origen: 'central:0', personaje: 'Cronomante', usarAsterisco: false });
  assert.equal(p.players[0].gems.filter(g => g.valor === 1).length, 1);
  assert.equal(p.players[0].gems.find(g => g.esAsterisco).revelada ?? false, false);
  assert.equal(p.habilidadUsadaEsteTurno, true);
});

console.log(`\n${ok} tests OK (motor/adaptadores)`);
