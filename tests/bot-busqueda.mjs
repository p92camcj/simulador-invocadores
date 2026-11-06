// tests/bot-busqueda.mjs — dificultad 'experta' (js/bot-busqueda.js) y el
// simulador de partidas (tools/arena.mjs). Ejecutar: node tests/bot-busqueda.mjs
import assert from 'node:assert/strict';
import { determinizar, enumerarFasesB } from '../js/bot-busqueda.js';
import { sembrarAzar, prepararPartida, jugarPartida, torneo } from '../tools/arena.mjs';

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ok  ${nombre}`);
}

const clonar = o => JSON.parse(JSON.stringify(o));

test('determinizar no filtra información oculta: partidas que solo difieren en lo oculto dan el mismo mundo', () => {
  sembrarAzar(7);
  const real = prepararPartida(['experta', 'normal', 'normal']);
  const otra = clonar(real);
  // Cambia todo lo que la autómata 0 no puede ver: su carta oculta, las
  // cartas privadas de las rivales, el mazo y el valor de las Gemas ajenas.
  const nombres = ['Pícaro', 'Maestro', 'Cronista', 'Centinela'];
  otra.players[0].hand.find(c => c.vis.owner !== true).name = nombres[0];
  otra.players[1].hand.find(c => c.vis.owner === true).name = nombres[1];
  otra.players[2].hand.find(c => c.vis.owner === true).name = nombres[2];
  otra.deck.reverse().forEach((c, i) => { c.name = nombres[i % nombres.length]; });
  otra.players[1].gems.push({ valor: 9, nivel: 'A', esAsterisco: true });
  real.players[1].gems.push({ valor: 8, nivel: 'A', esAsterisco: false });

  sembrarAzar(123);
  const m1 = determinizar(real, 0);
  sembrarAzar(123);
  const m2 = determinizar(otra, 0);
  assert.deepEqual(m1, m2);
});

test('determinizar conserva lo que la autómata sí ve: Portales, su carta conocida y las cartas públicas ajenas', () => {
  sembrarAzar(3);
  const real = prepararPartida(['experta', 'normal', 'normal']);
  real.neutrals[0].push({ name: 'Ocultista', vis: { public: true } });
  const m = determinizar(real, 0);
  assert.equal(m.neutrals[0][0].name, 'Ocultista');
  const conocida = p => p.hand.find(c => c.vis.owner === true).name;
  const publica = p => p.hand.find(c => c.vis.others === true).name;
  assert.equal(conocida(m.players[0]), conocida(real.players[0]));
  assert.equal(publica(m.players[1]), publica(real.players[1]));
  assert.equal(m.deck.length, real.deck.length);
});

test('enumerarFasesB siempre incluye "no activar nada" y solo habilidades legales', () => {
  sembrarAzar(5);
  const p = prepararPartida(['experta', 'normal']);
  p.players[0].portals[0].push({ name: 'Ocultista', vis: { public: true } });
  p.played = true;
  const acciones = enumerarFasesB(p, 0);
  assert.equal(acciones[0], null);
  assert.ok(acciones.length > 1);
  assert.ok(acciones.slice(1).every(a => a.origen === 'own:0' && a.guion.length === 1));
});

test('el simulador juega partidas completas con las tres dificultades', () => {
  sembrarAzar(11);
  const r = jugarPartida(['experta', 'dificil', 'normal']);
  assert.ok(r.turnos > 0 && r.ganadoras.length >= 1);
  const t = torneo({ partidas: 4, mesa: ['dificil', 'normal'], semilla: 2 });
  assert.equal(t.partidas, 4);
});

console.log(`\n${ok} tests OK (bot-busqueda)`);
