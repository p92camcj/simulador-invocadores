// tests/red.mjs
//
// Juego online (js/red/sanear.js): cada dispositivo recibe solo lo que su
// asiento puede ver. Sin DOM. Ejecutar con `node tests/red.mjs`.

import assert from 'node:assert/strict';
import { crearEstadoPartida } from '../js/motor/estado.js';
import { sanearPartidaParaAsiento } from '../js/red/sanear.js';
import { construirVistaMesa } from '../js/vista-mesa.js';
import { opcionesFaseB, jugarCarta } from '../js/motor/acciones.js';

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

function partida() {
  const p = crearEstadoPartida('normal');
  p.players = [0, 1, 2].map(i => ({
    name: `J${i}`, tipo: 'humano', idRed: `secreto${i}`,
    hand: [propia(`Propia${i}`), ajena(`Ajena${i}`)],
    portals: [[publica(`Debajo${i}`), publica(`Arriba${i}`)]],
    gems: [{ valor: 1, nivel: 'unitaria' }, { valor: 7, nivel: 'C' }, { valor: 9, nivel: 'B', esAsterisco: true }],
  }));
  p.neutrals = [[publica('Ocultista')], [publica('Fondo'), oculta('BocaAbajo')]];
  p.deck = [{ name: 'EnElMazo' }, { name: 'OtraDelMazo' }];
  p.memoriaBots = [{ portales: { 'n:0': ['Recuerdo'] } }];
  return p;
}

const texto = obj => JSON.stringify(obj);

test('la invitada ve su carta propia y la que las demás tienen a la vista', () => {
  const s = sanearPartidaParaAsiento(partida(), 1);
  assert.equal(s.players[1].hand[0].name, 'Propia1');
  assert.equal(s.players[1].hand[1].name, null);
  assert.equal(s.players[0].hand[1].name, 'Ajena0');
  assert.equal(s.players[2].hand[1].name, 'Ajena2');
  ['Ajena1', 'Propia0', 'Propia2'].forEach(n => assert.ok(!texto(s).includes(n), `se filtra ${n}`));
});

test('ni el mazo, ni las cartas tapadas, ni las de debajo de un Portal', () => {
  const s = sanearPartidaParaAsiento(partida(), 0);
  assert.equal(s.deck.length, 2);
  ['EnElMazo', 'OtraDelMazo', 'BocaAbajo', 'Debajo0', 'Debajo1', 'Fondo'].forEach(n => assert.ok(!texto(s).includes(n), `se filtra ${n}`));
  assert.equal(s.players[2].portals[0].at(-1).name, 'Arriba2');
  assert.equal(s.neutrals[0][0].name, 'Ocultista');
  assert.equal(s.neutrals[1].length, 2);
});

test('Gemas ajenas sin valor (ni si son de asterisco); las propias, enteras', () => {
  const s = sanearPartidaParaAsiento(partida(), 0);
  assert.deepEqual(s.players[0].gems.map(g => g.valor), [1, 7, 9]);
  assert.deepEqual(s.players[1].gems, [{ valor: 1, nivel: 'unitaria' }, { valor: null, nivel: 'C' }, { valor: null, nivel: 'B' }]);
});

test('al terminar la partida las Gemas de todas se ven', () => {
  const p = partida();
  p.juegoTerminado = true;
  const s = sanearPartidaParaAsiento(p, 0);
  assert.deepEqual(s.players[2].gems.map(g => g.valor), [1, 7, 9]);
});

test('Clarividente: su dueña ve sus dos cartas y nadie más ve ninguna', () => {
  const p = partida();
  p.players[2].hasClariActivo = true;
  assert.deepEqual(sanearPartidaParaAsiento(p, 2).players[2].hand.map(c => c.name), ['Propia2', 'Ajena2']);
  assert.deepEqual(sanearPartidaParaAsiento(p, 0).players[2].hand.map(c => c.name), [null, null]);
});

test('sin memoria de las autómatas ni identificadores de red', () => {
  const s = sanearPartidaParaAsiento(partida(), 1);
  assert.ok(!texto(s).includes('secreto'));
  assert.ok(!texto(s).includes('Recuerdo'));
});

test('no toca la partida original', () => {
  const p = partida();
  const antes = texto(p);
  sanearPartidaParaAsiento(p, 1);
  assert.equal(texto(p), antes);
});

test('con la copia se pinta la mesa igual que con la partida entera', () => {
  const p = partida();
  const vReal = construirVistaMesa(p, { asientoPropio: 1, pantallaPrivada: true });
  const vCopia = construirVistaMesa(sanearPartidaParaAsiento(p, 1), { asientoPropio: 1, pantallaPrivada: true });
  // Solo cambia el total de Gemas ajenas, que en la vista ya es null.
  assert.deepEqual(vCopia, vReal);
});

test('pantalla privada: la persona ve su carta también fuera de su turno', () => {
  const p = partida();
  p.turn = 0;
  assert.equal(construirVistaMesa(p, { asientoPropio: 1 }).propio.mano[0].nombre, null);
  assert.equal(construirVistaMesa(p, { asientoPropio: 1, pantallaPrivada: true }).propio.mano[0].nombre, 'Propia1');
});

test('en su copia la invitada puede comprobar jugadas y ver qué habilidades tiene', () => {
  const p = partida();
  p.turn = 1;
  const s = sanearPartidaParaAsiento(p, 1);
  // Juega la carta que no ve (tapada en su copia): vale igual.
  assert.ok(jugarCarta(JSON.parse(texto(s)), { cartaIdx: 1, destino: 'n:0' }).some(e => e.tipo === 'cartaJugada'));
  s.played = true;
  p.played = true;
  assert.deepEqual(opcionesFaseB(s).opciones, opcionesFaseB(p).opciones);
});

console.log(`\n${ok} pruebas del juego online superadas.`);
