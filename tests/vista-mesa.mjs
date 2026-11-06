// tests/vista-mesa.mjs
//
// Modelo de la vista Mesa 3D (js/vista-mesa.js): qué enseña cada asiento en
// la pantalla compartida. Sin DOM. Ejecutar con `node tests/vista-mesa.mjs`.

import assert from 'node:assert/strict';
import { crearEstadoPartida } from '../js/motor/estado.js';
import {
  construirVistaMesa, elegirAsientoPropio, claveJugar, claveObjetivo, firmaPortal, cambioPortal,
  estadoInvocacion, pistaTurno,
} from '../js/vista-mesa.js';

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ✓ ${nombre}`);
}

const propia = name => ({ name, vis: { owner: true, others: false, public: false } });
const ajena = name => ({ name, vis: { owner: false, others: true, public: false } });
const publica = name => ({ name, vis: { public: true } });
const oculta = name => ({ name, vis: { public: false } });
const unidades = n => Array.from({ length: n }, () => ({ valor: 1, nivel: 'unitaria' }));

function partida(tipos = ['humano', 'humano', 'humano']) {
  const p = crearEstadoPartida('normal');
  p.players = tipos.map((tipo, i) => ({
    name: `J${i}`, tipo, hand: [propia(`Propia${i}`), ajena(`Ajena${i}`)], portals: [[]], gems: unidades(3),
  }));
  p.neutrals = [[publica('Pícaro')], [oculta('Cronista')]];
  p.deck = [{ name: 'Maestro' }];
  return p;
}

/** Ningún nombre de carta no visible aparece en la vista. */
function sinFugas(vista, prohibidos) {
  const txt = JSON.stringify(vista);
  prohibidos.forEach(n => assert.ok(!txt.includes(n), `la vista filtra ${n}`));
}

test('la activa humana ve su carta propia y no la que ven las demás', () => {
  const p = partida();
  const v = construirVistaMesa(p, { asientoPropio: 0 });
  assert.deepEqual(v.propio.mano.map(c => c.nombre), ['Propia0', null]);
  assert.equal(v.propio.gemas.total, 3);
  sinFugas(v, ['Ajena0', 'Propia1', 'Propia2', 'Cronista']);
});

test('las rivales enseñan solo su carta pública y van en orden de turno', () => {
  const p = partida();
  const v = construirVistaMesa(p, { asientoPropio: 1 });
  assert.deepEqual(v.rivales.map(r => r.idx), [2, 0]);
  assert.deepEqual(v.rivales[0].mano.map(c => c.nombre), [null, 'Ajena2']);
  assert.equal(v.rivales[0].gemas.total, null);
});

test('una Clarividente visible oculta la mano entera al resto y la enseña a su dueña', () => {
  const p = partida();
  p.players[1].hasClariActivo = true;
  const v = construirVistaMesa(p, { asientoPropio: 0 });
  assert.deepEqual(v.rivales[0].mano.map(c => c.nombre), [null, null]);
  p.turn = 1;
  const v1 = construirVistaMesa(p, { asientoPropio: 1 });
  assert.deepEqual(v1.propio.mano.map(c => c.nombre), ['Propia1', 'Ajena1']);
});

test('el asiento propio no ve sus cartas fuera de su turno si hay más humanas', () => {
  const p = partida();
  p.turn = 1;
  const v = construirVistaMesa(p, { asientoPropio: 0 });
  assert.deepEqual(v.propio.mano.map(c => c.nombre), [null, 'Ajena0']);
  sinFugas(v, ['Propia0']);
});

test('contra autómatas, la única humana sigue abajo y ve su carta', () => {
  const p = partida(['humano', 'auto', 'auto']);
  p.turn = 2;
  const asiento = elegirAsientoPropio(p.players, p.turn, 0);
  assert.equal(asiento, 0);
  const v = construirVistaMesa(p, { asientoPropio: asiento });
  assert.equal(v.propio.mano[0].nombre, 'Propia0');
  sinFugas(v, ['Propia1', 'Propia2']);
  assert.equal(pistaTurno(v, {}), 'J2 está pensando…');
});

test('solo autómatas: abajo va la activa y no se ve su carta propia', () => {
  const p = partida(['auto', 'auto']);
  p.turn = 1;
  const asiento = elegirAsientoPropio(p.players, p.turn, null);
  assert.equal(asiento, 1);
  sinFugas(construirVistaMesa(p, { asientoPropio: asiento }), ['Propia0', 'Propia1']);
});

test('Portales: top público con nombre, oculto sin él', () => {
  const v = construirVistaMesa(partida(), { asientoPropio: 0 });
  assert.deepEqual(v.centrales[0], { altura: 1, top: { visible: true, nombre: 'Pícaro', apariencia: 'Pícaro' } });
  assert.deepEqual(v.centrales[1], { altura: 1, top: { visible: false, nombre: null } });
});

test('un Metamorfo transformado se enseña como Metamorfo con la ficha del personaje', () => {
  const p = partida();
  p.players[0].portals[0].push({ name: 'Metamorfo', aspecto: 'Maestro', vis: { public: true } });
  const v = construirVistaMesa(p, { asientoPropio: 0 });
  assert.deepEqual(v.propio.portales[0].top, { visible: true, nombre: 'Metamorfo', apariencia: 'Maestro', ficha: 'Maestro' });
});

test('transformar un Metamorfo es un cambio propio (no un volteo)', () => {
  const antes = firmaPortal({ altura: 2, top: { visible: true, nombre: 'Metamorfo' } });
  const ahora = firmaPortal({ altura: 2, top: { visible: true, nombre: 'Metamorfo', ficha: 'Pícaro' } });
  assert.equal(cambioPortal(antes, ahora), 'transforma');
});

test('recuento de la invocación activa por apariencia', () => {
  const p = partida();
  p.players[0].portals[0].push(publica('Aprendiz'));
  p.players[1].portals[0].push(publica('Aprendiz'));
  const inv = estadoInvocacion(p);
  assert.equal(inv.nombre, 'Cirelia');
  const porNombre = Object.fromEntries(inv.requeridos.map(r => [r.nombre, r.estado]));
  assert.deepEqual(porNombre, { Aprendiz: 'repetido', Pícaro: 'esta', Centinela: 'falta' });
});

test('claves de destino y objetivo con el formato de actions.js', () => {
  assert.equal(claveJugar(1, 1, 0), 'p:0');
  assert.equal(claveJugar(1, 2, 1), 'a:2:1');
  assert.equal(claveObjetivo(2, 1), '2:1');
  assert.equal(claveObjetivo(null, 0), 'n:0');
});

test('cambios de Portal para animar', () => {
  const vacio = firmaPortal({ altura: 0, top: null });
  const una = firmaPortal({ altura: 1, top: { visible: true, nombre: 'Maestro' } });
  const volteada = firmaPortal({ altura: 1, top: { visible: false, nombre: null } });
  assert.equal(cambioPortal(undefined, una), null);
  assert.equal(cambioPortal(vacio, una), 'entra');
  assert.equal(cambioPortal(una, volteada), 'voltea');
  assert.equal(cambioPortal(una, vacio), 'sale');
  assert.equal(cambioPortal(una, una), null);
});

console.log(`\n${ok} tests de la vista Mesa 3D OK`);
