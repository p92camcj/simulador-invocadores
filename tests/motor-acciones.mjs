// tests/motor-acciones.mjs
//
// Tests de js/motor/acciones.js (fase 2 de la separación motor / interfaz,
// ver docs/ARQUITECTURA_MOTOR.md). Sin DOM ni `window`: el motor recibe la
// partida como argumento. Ejecutar con `node tests/motor-acciones.mjs`.

import assert from 'node:assert/strict';
import { crearEstadoPartida, serializarPartida } from '../js/motor/estado.js';
import {
  jugarCarta, terminarTurno, pasarTurno, comprobarFinPorManoVacia,
  validarFaseB, opcionesFaseB, completarActivacion, resolverInvocacion,
  pilaDeDestino, invocacionActiva,
} from '../js/motor/acciones.js';

assert.equal(typeof globalThis.window, 'undefined', 'el motor no debe necesitar window');

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ✓ ${nombre}`);
}

const enMano = (name, owner) => ({ name, vis: { owner, others: !owner, public: false } });
const enPortal = name => ({ name, vis: { public: true } });
const unidades = n => Array.from({ length: n }, () => ({ valor: 1, nivel: 'unitaria' }));

/** Partida de 2 jugadoras, 2 Portales cada una y 1 central, set normal. */
function partidaBase() {
  const p = crearEstadoPartida('normal');
  p.players = [
    { name: 'Ana', tipo: 'humano', hand: [enMano('Centinela', true), enMano('Aprendiz', false)], portals: [[], []], gems: unidades(3) },
    { name: 'Bea', tipo: 'humano', hand: [enMano('Pícaro', true), enMano('Estratega', false)], portals: [[], []], gems: unidades(3) },
  ];
  p.neutrals = [[]];
  p.deck = [{ name: 'Cronista' }, { name: 'Ocultista' }, { name: 'Maestro' }, { name: 'Estratega' }];
  return p;
}

const tipos = ev => ev.map(e => e.tipo);

test('pilaDeDestino entiende Portal propio, central y ajeno', () => {
  const p = partidaBase();
  assert.equal(pilaDeDestino(p, 0, 'p:1'), p.players[0].portals[1]);
  assert.equal(pilaDeDestino(p, 0, 'n:0'), p.neutrals[0]);
  assert.equal(pilaDeDestino(p, 0, 'a:1:0'), p.players[1].portals[0]);
  assert.equal(pilaDeDestino(p, 0, 'n:5'), null);
  assert.equal(pilaDeDestino(p, 0, 'x'), null);
});

test('jugarCarta mueve la carta de la mano al Portal, bocarriba, y marca played', () => {
  const p = partidaBase();
  const ev = jugarCarta(p, { cartaIdx: 1, destino: 'p:0' });
  assert.deepEqual(ev, [{ tipo: 'cartaJugada', jugadora: 0, destino: 'p:0', carta: 'Aprendiz' }]);
  assert.equal(p.players[0].hand.length, 1);
  assert.equal(p.players[0].portals[0].at(-1).name, 'Aprendiz');
  assert.equal(p.players[0].portals[0].at(-1).vis.public, true);
  assert.equal(p.played, true);
});

test('jugarCarta rechaza segunda carta, carta inexistente, Portal inexistente y partida terminada', () => {
  const p = partidaBase();
  assert.deepEqual(tipos(jugarCarta(p, { cartaIdx: 5, destino: 'p:0' })), ['accionInvalida']);
  assert.deepEqual(tipos(jugarCarta(p, { cartaIdx: 0, destino: 'n:9' })), ['accionInvalida']);
  assert.equal(p.players[0].hand.length, 2, 'una acción inválida no cambia nada');
  jugarCarta(p, { cartaIdx: 0, destino: 'p:0' });
  assert.equal(jugarCarta(p, { cartaIdx: 0, destino: 'p:1' })[0].motivo, 'Ya jugaste');
  const q = partidaBase();
  q.juegoTerminado = true;
  assert.deepEqual(tipos(jugarCarta(q, { cartaIdx: 0, destino: 'p:0' })), ['accionInvalida']);
});

test('jugar una Centinela gira las demás Centinelas visibles', () => {
  const p = partidaBase();
  p.neutrals[0].push(enPortal('Centinela'));
  jugarCarta(p, { cartaIdx: 0, destino: 'p:0' });
  assert.equal(p.players[0].portals[0].at(-1).vis.public, true);
  assert.equal(p.neutrals[0].at(-1).vis.public, false);
});

test('terminarTurno exige haber jugado y repone manos del mazo de la partida', () => {
  const p = partidaBase();
  assert.equal(terminarTurno(p)[0].motivo, 'Juega una carta');
  jugarCarta(p, { cartaIdx: 0, destino: 'p:0' });
  const ev = terminarTurno(p);
  assert.deepEqual(tipos(ev), ['manosRepuestas']);
  assert.equal(p.players[0].hand.length, 2);
  assert.equal(p.players[0].hand.filter(c => c.vis.owner).length, 1);
  assert.equal(p.deck.length, 3);
  assert.equal(p.turn, 0, 'terminarTurno no pasa el turno');
});

test('pasarTurno rota la jugadora activa y limpia los campos de turno', () => {
  const p = partidaBase();
  p.played = true;
  p.habilidadUsadaEsteTurno = true;
  p.cronomantePortalInvestigado = '0:1';
  assert.deepEqual(pasarTurno(p), []);
  assert.equal(p.turn, 1);
  assert.equal(p.played, false);
  assert.equal(p.habilidadUsadaEsteTurno, false);
  assert.equal(p.cronomantePortalInvestigado, null);
  pasarTurno(p);
  assert.equal(p.turn, 0);
});

test('la partida termina si la siguiente jugadora no tiene cartas', () => {
  const p = partidaBase();
  p.players[1].hand = [];
  const ev = pasarTurno(p);
  assert.deepEqual(tipos(ev), ['partidaTerminada']);
  assert.match(ev[0].motivo, /Bea no tiene cartas/);
  assert.equal(p.juegoTerminado, true);
  assert.deepEqual(tipos(comprobarFinPorManoVacia(partidaBase())), []);
});

/** Mesa con la invocación C (Aprendiz, Pícaro, Centinela) a punto. */
function mesaInvocacionC() {
  const p = partidaBase();
  p.players[0].portals = [[enPortal('Aprendiz')], [enPortal('Ocultista')]];
  p.players[1].portals = [[enPortal('Centinela')], [enPortal('Estratega')]];
  p.neutrals = [[enPortal('Cronista')]];
  return p;
}

test('sin todos los Portales visibles o sin la combinación no hay invocación', () => {
  const p = mesaInvocacionC();
  assert.deepEqual(resolverInvocacion(p), []); // falta el Pícaro
  p.players[0].portals[1].push(enPortal('Pícaro'));
  p.neutrals[0].at(-1).vis.public = false;
  assert.deepEqual(resolverInvocacion(p), []); // central bocabajo
  assert.equal(p.levelIdx, 0);
});

test('invocación completa: Gemas a quien tiene cada personaje, Pícaro cobra y se gira, nuevo central, sube nivel', () => {
  const p = mesaInvocacionC();
  p.players[0].portals[1].push(enPortal('Pícaro'));
  const ev = resolverInvocacion(p);
  assert.deepEqual(tipos(ev), ['invocacionCompletada']);
  assert.equal(ev[0].nivel, 'C');
  assert.equal(ev[0].nombre, 'Cirelia');
  // Ana: Aprendiz + Pícaro (2 Gemas de nivel) + 1 unitaria del Pícaro. Bea: Centinela.
  assert.deepEqual(ev[0].recompensas, [{ jugadora: 'Ana', gemas: 3 }, { jugadora: 'Bea', gemas: 1 }]);
  assert.equal(p.players[0].portals[1].at(-1).vis.public, false);
  assert.equal(p.neutrals.length, 2);
  assert.equal(p.levelIdx, 1);
  assert.deepEqual(p.invocacionesCompletadas, ['C']);
  assert.equal(invocacionActiva(p).nombre, 'Baelorith');
});

test('un personaje requerido solo en un Portal central no da Gema', () => {
  const p = mesaInvocacionC();
  p.players[0].portals[1].push(enPortal('Ocultista'));
  p.neutrals[0].push(enPortal('Pícaro'));
  const ev = resolverInvocacion(p);
  assert.deepEqual(ev[0].recompensas, [{ jugadora: 'Ana', gemas: 1 }, { jugadora: 'Bea', gemas: 1 }]);
});

test('un Metamorfo transformado cuenta por su aspecto', () => {
  const p = mesaInvocacionC();
  p.players[1].portals[1].push({ name: 'Metamorfo', aspecto: 'Pícaro', vis: { public: true } });
  const ev = resolverInvocacion(p);
  assert.deepEqual(tipos(ev), ['invocacionCompletada']);
  assert.equal(ev[0].recompensas[1].gemas, 2);
});

test('la última invocación termina la partida', () => {
  const p = mesaInvocacionC();
  p.players[0].portals[1].push(enPortal('Pícaro'));
  p.levelIdx = 2;
  p.players[0].portals = [[enPortal('Clarividente')], [enPortal('Maestro')]];
  p.players[1].portals = [[enPortal('Ocultista')], [enPortal('Estratega')]];
  const ev = resolverInvocacion(p);
  assert.deepEqual(tipos(ev), ['invocacionCompletada', 'partidaTerminada']);
  assert.equal(p.juegoTerminado, true);
});

test('Fase B: hay que haber jugado y solo una habilidad por turno', () => {
  const p = partidaBase();
  p.players[0].portals[0].push(enPortal('Ocultista'));
  assert.equal(validarFaseB(p)[0].motivo, 'Primero debes jugar una carta.');
  p.played = true;
  assert.deepEqual(validarFaseB(p), []);
  const { opciones } = opcionesFaseB(p);
  assert.ok(opciones.some(o => o.val === 'own:0'));
  assert.deepEqual(tipos(completarActivacion(p, { origen: 'own:0', personaje: 'Ocultista' })), ['habilidadAplicada']);
  assert.equal(p.players[0].gems.length, 3, 'la habilidad propia es gratis');
  assert.equal(validarFaseB(p)[0].motivo, 'Ya has activado una habilidad este turno.');
});

test('Fase B: activar desde un Portal central cuesta una Gema de 1', () => {
  const p = partidaBase();
  p.played = true;
  completarActivacion(p, { origen: 'central:0', personaje: 'Cronista' });
  assert.equal(p.players[0].gems.length, 2);
});

test('Fase B sin habilidades activables da un motivo', () => {
  const p = partidaBase();
  p.played = true;
  const { opciones, eventos } = opcionesFaseB(p);
  assert.equal(opciones, undefined);
  assert.match(eventos[0].motivo, /ninguna habilidad/);
});

test('una partida jugada solo con el motor sigue siendo serializable', () => {
  const p = partidaBase();
  jugarCarta(p, { cartaIdx: 0, destino: 'p:0' });
  terminarTurno(p);
  pasarTurno(p);
  jugarCarta(p, { cartaIdx: 0, destino: 'a:0:1' });
  assert.deepEqual(JSON.parse(serializarPartida(p)), p);
});

console.log(`\n${ok} tests OK (motor/acciones)`);
