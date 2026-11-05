// tests/motor-habilidades.mjs
//
// Tests de js/motor/habilidades.js (fase 3 de la separación motor /
// interfaz, ver docs/ARQUITECTURA_MOTOR.md). La "interfaz" es un guion de
// respuestas: cada petición del motor se contesta con la siguiente
// respuesta de la lista ('cancelar' la cancela). Sin DOM ni `window`.
// Ejecutar con `node tests/motor-habilidades.mjs`.

import assert from 'node:assert/strict';
import { crearEstadoPartida, serializarPartida } from '../js/motor/estado.js';
import { aplicarHabilidad, aplicarEleccionClarividente } from '../js/motor/habilidades.js';

assert.equal(typeof globalThis.window, 'undefined', 'el motor no debe necesitar window');

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ✓ ${nombre}`);
}

const enMano = (name, owner) => ({ name, vis: { owner, others: !owner, public: false } });
const enPortal = (name, extra = {}) => ({ name, vis: { public: true }, ...extra });
const unidades = n => Array.from({ length: n }, () => ({ valor: 1, nivel: 'unitaria' }));

/** 3 jugadoras con 1 Portal cada una y 2 centrales. Ana (0) activa, ya ha jugado. */
function partidaBase() {
  const p = crearEstadoPartida('normal');
  p.players = [
    { name: 'Ana', hand: [enMano('Pícaro', true)], portals: [[enPortal('Aprendiz')]], gems: unidades(2) },
    { name: 'Bea', hand: [enMano('Cronista', true), enMano('Maestro', false)], portals: [[enPortal('Estratega'), enPortal('Ocultista')]], gems: unidades(3) },
    { name: 'Cris', hand: [enMano('Clarividente', true), enMano('Centinela', false)], portals: [[enPortal('Cronomante')]], gems: unidades(3) },
  ];
  p.neutrals = [[enPortal('Pícaro')], []];
  p.deck = [{ name: 'Aprendiz' }, { name: 'Estratega' }];
  p.played = true;
  return p;
}

/** Interfaz de guion: devuelve { ui, peticiones, avisos }. */
function guion(respuestas) {
  const peticiones = [];
  const avisos = [];
  const cola = [...respuestas];
  const ui = {
    pedir(peticion, responder, cancelar) {
      peticiones.push(peticion);
      const r = cola.shift();
      if (r === undefined) return; // se queda esperando
      if (r === 'cancelar') cancelar?.();
      else responder(r);
    },
    avisar(evento) { avisos.push(evento); },
  };
  return { ui, peticiones, avisos };
}

function activar(p, personaje, respuestas, { jugadora = 0, pila = null } = {}) {
  const g = guion(respuestas);
  let aplicada = 0;
  const existe = aplicarHabilidad(p, { personaje, jugadora, pila }, g.ui, () => aplicada++);
  return { ...g, aplicada, existe };
}

const habilitadas = pet => pet.opciones.filter(o => !o.disabled).map(o => o.val);

test('personajes sin habilidad activable no hacen nada', () => {
  const p = partidaBase();
  assert.equal(activar(p, 'Centinela', []).existe, false);
  assert.equal(activar(p, 'Clarividente', []).existe, false);
});

test('Ocultista: pide un Portal (vacíos deshabilitados) y gira la carta', () => {
  const p = partidaBase();
  const r = activar(p, 'Ocultista', ['1:0']);
  assert.equal(r.peticiones[0].tipo, 'portal');
  assert.ok(!habilitadas(r.peticiones[0]).includes('n:1'), 'Portal vacío deshabilitado');
  assert.equal(p.players[1].portals[0].at(-1).vis.public, false);
  assert.equal(r.aplicada, 1);
});

test('Ocultista: no puede elegir una Centinela visible ni Portales protegidos', () => {
  const p = partidaBase();
  p.players[2].portals[0].push(enPortal('Centinela'));
  const r = activar(p, 'Ocultista', ['cancelar']);
  assert.ok(!habilitadas(r.peticiones[0]).includes('2:0'));
  assert.equal(r.aplicada, 0, 'cancelar no aplica');
});

test('Ocultista: revelar una Centinela gira las demás', () => {
  const p = partidaBase();
  p.players[1].portals[0].push({ name: 'Centinela', vis: { public: false } });
  p.neutrals[1].push(enPortal('Centinela'));
  activar(p, 'Ocultista', ['1:0']);
  assert.equal(p.players[1].portals[0].at(-1).vis.public, true);
  assert.equal(p.neutrals[1].at(-1).vis.public, false);
});

test('Cronista: se lleva la carta de arriba a la mano con la orientación que falta', () => {
  const p = partidaBase();
  const r = activar(p, 'Cronista', ['1:0']);
  assert.equal(p.players[1].portals[0].length, 1);
  assert.equal(p.players[0].hand.length, 2);
  const nueva = p.players[0].hand[1];
  assert.equal(nueva.name, 'Ocultista');
  assert.equal(nueva.vis.owner, false, 'la que quedaba era visible: la nueva va oculta');
  assert.equal(r.aplicada, 1);
});

test('Cronomante: pide Portal y carta; sube la elegida al top', () => {
  const p = partidaBase();
  const r = activar(p, 'Cronomante', ['1:0', '0']);
  assert.equal(r.peticiones[1].tipo, 'eleccion');
  assert.equal(p.players[1].portals[0].at(-1).name, 'Estratega');
  assert.equal(p.cronomantePortalInvestigado, null);
  assert.equal(r.aplicada, 1);
});

test('Cronomante: cancelar el 2º paso deja fijado el Portal y se retoma sin volver a elegirlo', () => {
  const p = partidaBase();
  const r1 = activar(p, 'Cronomante', ['1:0', 'cancelar']);
  assert.equal(r1.aplicada, 0);
  assert.equal(p.cronomantePortalInvestigado, '1:0');
  const r2 = activar(p, 'Cronomante', ['0']);
  assert.equal(r2.peticiones.length, 1);
  assert.equal(r2.peticiones[0].tipo, 'eleccion');
  assert.equal(r2.aplicada, 1);
  assert.equal(p.cronomantePortalInvestigado, null);
});

test('Estratega: intercambia dos Portales enteros', () => {
  const p = partidaBase();
  const r = activar(p, 'Estratega', ['0:0', 'n:0']);
  assert.ok(!r.peticiones[1].opciones.some(o => o.val === '0:0'), 'el 2º no ofrece el 1º');
  assert.equal(p.players[0].portals[0].at(-1).name, 'Pícaro');
  assert.equal(p.neutrals[0].at(-1).name, 'Aprendiz');
  assert.equal(r.aplicada, 1);
});

test('Aprendiz: intercambia manos e invierte quién ve cada carta', () => {
  const p = partidaBase();
  const r = activar(p, 'Aprendiz', ['1', '2']);
  assert.equal(p.players[1].hand[0].name, 'Clarividente');
  assert.equal(p.players[1].hand[0].vis.owner, false);
  assert.equal(p.players[1].hand[1].vis.owner, true);
  assert.equal(r.aplicada, 1);
});

test('Aprendiz: una jugadora protegida por Centinela no se ofrece', () => {
  const p = partidaBase();
  p.players[2].portals[0].push(enPortal('Centinela'));
  const r = activar(p, 'Aprendiz', []);
  assert.deepEqual(r.peticiones[0].opciones.map(o => o.val), [0, 1]);
});

test('Maestro: baja la carta que el resto ve al Portal de esa jugadora y repone su mano del mazo', () => {
  const p = partidaBase();
  const r = activar(p, 'Maestro', ['1']);
  // Bea y Cris son candidatas; con un solo Portal no se pregunta el destino.
  assert.equal(r.peticiones.length, 1);
  assert.equal(p.players[1].portals[0].at(-1).name, 'Maestro');
  assert.equal(p.players[1].hand.length, 2);
  assert.equal(p.deck.length, 1);
  assert.equal(r.aplicada, 1);
});

test('Maestro sin candidatas avisa y no aplica', () => {
  const p = partidaBase();
  p.players[1].hand = [enMano('Cronista', true)];
  p.players[2].hand = [enMano('Clarividente', true)];
  const r = activar(p, 'Maestro', []);
  assert.equal(r.peticiones.length, 0);
  assert.match(r.avisos[0].motivo, /No hay ninguna jugadora/);
  assert.equal(r.aplicada, 0);
});

test('Metamorfo: cobra una Gema de 1 y cambia solo el aspecto', () => {
  const p = partidaBase();
  p.players[0].portals[0].push(enPortal('Metamorfo'));
  const pila = p.players[0].portals[0];
  const r = activar(p, 'Metamorfo', ['Maestro'], { pila });
  assert.ok(!r.peticiones[0].opciones.some(o => o.val === 'Metamorfo'));
  assert.equal(pila.at(-1).name, 'Metamorfo');
  assert.equal(pila.at(-1).aspecto, 'Maestro');
  assert.equal(p.players[0].gems.length, 1);
  assert.equal(r.aplicada, 1);
});

test('Metamorfo sin Gemas de 1 avisa y no cobra', () => {
  const p = partidaBase();
  p.players[0].gems = [{ valor: 3, nivel: 'C' }];
  p.players[0].portals[0].push(enPortal('Metamorfo'));
  const r = activar(p, 'Metamorfo', [], { pila: p.players[0].portals[0] });
  assert.match(r.avisos[0].motivo, /no se da cambio/);
  assert.equal(r.aplicada, 0);
});

test('Clarividente: al perderla, la jugadora elige qué carta sigue viendo', () => {
  const p = partidaBase();
  const cris = p.players[2];
  assert.equal(aplicarEleccionClarividente(cris, 1), true);
  assert.equal(cris.hand[1].vis.owner, true);
  assert.equal(cris.hand[0].vis.others, true);
  assert.equal(aplicarEleccionClarividente(p.players[0], 0), false, 'con una sola carta no hay elección');
});

test('tras aplicar habilidades la partida sigue siendo serializable', () => {
  const p = partidaBase();
  activar(p, 'Estratega', ['0:0', '1:0']);
  activar(p, 'Cronomante', ['1:0', 'cancelar']);
  assert.deepEqual(JSON.parse(serializarPartida(p)), p);
});

console.log(`\n${ok} tests OK (motor/habilidades)`);
