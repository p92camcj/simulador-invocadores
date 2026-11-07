// tests/modos.mjs
//
// Modos de juego (Introductorio, Normal, Avanzado, Experto), expansión del
// Entusiasta, cuarta invocación (Madain) y autómata central del Modo
// Experto. Reglas confirmadas por Julio el 2026-11-07. Sin DOM.
// Ejecutar con `node tests/modos.mjs`.

import assert from 'node:assert/strict';
import { crearEstadoPartida } from '../js/motor/estado.js';
import { resolverInvocacion, invocacionActiva } from '../js/motor/acciones.js';
import {
  composicionMazoTotal, prepararMazo, MODOS_JUEGO, modoDe, nivelesPartida, invocacionDePartida,
  aplicarEntusiastas, crearAutomataCentral, jugadorasConMenosPuntos, resultadoFinalExperto,
  convieneIntercambioAutomata, sumaGemas, transformacionesDisponiblesMetamorfo,
} from '../js/utils.js';

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ✓ ${nombre}`);
}

const total = comp => Object.values(comp).reduce((a, b) => a + b, 0);
const enPortal = (name, extra = {}) => ({ name, vis: { public: true }, ...extra });
const unidades = n => Array.from({ length: n }, () => ({ valor: 1, nivel: 'unitaria' }));
const gema = (valor, nivel = 'C') => ({ valor, nivel });

test('tamaño del mazo de cada modo, con y sin Entusiasta', () => {
  const cfg = (modo, entusiasta = false) => ({ modo, entusiasta });
  assert.equal(total(composicionMazoTotal(cfg('introductorio'))), 29);
  assert.equal(total(composicionMazoTotal(cfg('normal'))), 32);
  assert.equal(total(composicionMazoTotal(cfg('avanzado'))), 41);
  assert.equal(total(composicionMazoTotal(cfg('experto'))), 41);
  assert.equal(total(composicionMazoTotal(cfg('normal', true))), 34);
  // Cartas que se juegan: Normal y Avanzado apartan 2; Introductorio y Experto, ninguna.
  assert.equal(prepararMazo(cfg('introductorio')).length, 29);
  assert.equal(prepararMazo(cfg('normal')).length, 30);
  assert.equal(prepararMazo(cfg('avanzado')).length, 39);
  assert.equal(prepararMazo(cfg('experto', true)).length, 43);
  // Introductorio: sin Centinela, Ocultista, Maestro, Clarividente ni Metamorfo.
  const intro = composicionMazoTotal(cfg('introductorio'));
  ['Centinela', 'Ocultista', 'Maestro', 'Clarividente', 'Metamorfo'].forEach(n => assert.equal(intro[n], undefined));
});

test('el Entusiasta se baraja antes de apartar: a veces queda fuera de la partida', () => {
  let fuera = 0;
  for (let i = 0; i < 400; i++) {
    const n = prepararMazo({ modo: 'normal', entusiasta: true }).filter(c => c.name === 'Entusiasta').length;
    if (n < 2) fuera++;
  }
  assert.ok(fuera > 0, 'con 400 mazos alguno debería haber apartado un Entusiasta');
});

test('partidas guardadas sin modo: se deduce del set, como antes', () => {
  assert.equal(modoDe({ invocationSet: 'introductorio' }), 'avanzado');
  assert.equal(modoDe({ invocationSet: 'floral' }), 'normal');
  assert.equal(modoDe('normal'), 'normal');
  assert.equal(total(composicionMazoTotal('introductorio')), 41);
});

test('cada modo solo ofrece sets que su mazo puede completar', () => {
  Object.values(MODOS_JUEGO).forEach(modo => {
    const comp = composicionMazoTotal({ modo: Object.keys(MODOS_JUEGO).find(k => MODOS_JUEGO[k] === modo) });
    modo.sets.forEach(set => {
      nivelesPartida({ madain: modo.madain === 'siempre' }).forEach(nivel => {
        const inv = invocacionDePartida({ invocationSet: set, madain: modo.madain === 'siempre', levelIdx: nivelesPartida({ madain: modo.madain === 'siempre' }).indexOf(nivel) });
        inv.need.forEach(n => assert.ok(comp[n] > 0, `${modo.nombre}/${set}/${nivel}: falta ${n}`));
      });
    });
  });
});

test('Madain es la cuarta invocación, tras la A', () => {
  const p = crearEstadoPartida('normal');
  p.madain = true;
  assert.deepEqual(nivelesPartida(p), ['C', 'B', 'A', '*']);
  p.levelIdx = 3;
  assert.equal(invocacionActiva(p).nombre, 'Madain');
  p.levelIdx = 4;
  assert.equal(invocacionActiva(p), null);
});

/** Partida de 3 jugadoras (1 Portal cada una) y 2 centrales, Modo Experto, en Madain. */
function partidaMadain() {
  const p = crearEstadoPartida('normal');
  Object.assign(p, { modo: 'experto', madain: true, levelIdx: 3, automataCentral: crearAutomataCentral() });
  p.players = [
    { name: 'Ana', hand: [], portals: [[enPortal('Reena')]], gems: unidades(2) },
    { name: 'Bea', hand: [], portals: [[enPortal('Sora')]], gems: unidades(1) },
    { name: 'Cris', hand: [], portals: [[enPortal('Entusiasta')]], gems: unidades(1) },
  ];
  p.neutrals = [[enPortal('Metamorfo')], [enPortal('Lumo')]];
  p.invocacionesCompletadas = ['C', 'B', 'A'];
  return p;
}

test('Madain: la autómata central cobra los requeridos de los Portales centrales', () => {
  const p = partidaMadain();
  const ev = resolverInvocacion(p);
  assert.equal(ev[0].tipo, 'invocacionCompletada');
  assert.equal(ev[0].nivel, '*');
  assert.equal(ev[0].gemasAutomata, 2);
  assert.equal(p.automataCentral.gems.length, 2);
  assert.ok(p.automataCentral.gems.every(g => g.nivel === '*' && g.valor >= 11));
  assert.equal(p.players[0].gems.length, 3);
  assert.equal(ev.at(-1).tipo, 'partidaTerminada');
});

test('Madain no se completa con un Metamorfo transformado', () => {
  const p = partidaMadain();
  p.neutrals[0] = [enPortal('Metamorfo', { aspecto: 'Pícaro' })];
  assert.deepEqual(resolverInvocacion(p), []);
});

test('Entusiasta: lo último que se resuelve, quita una Gema de valor 1 a su dueña', () => {
  const p = partidaMadain();
  const ev = resolverInvocacion(p);
  assert.deepEqual(ev[0].entusiastas, [{ jugadora: 'Cris', perdida: true }]);
  assert.equal(p.players[2].gems.length, 0);
});

test('Entusiasta sin Gemas de valor 1 o en un Portal central: no hace nada', () => {
  const players = [{ name: 'Ana', portals: [[enPortal('Entusiasta')]], gems: [gema(3)] }];
  const neutrals = [[enPortal('Entusiasta')]];
  assert.deepEqual(aplicarEntusiastas(players, neutrals), [{ jugadora: 0, perdida: false }]);
  assert.equal(players[0].gems.length, 1);
});

test('el Metamorfo no puede transformarse en Entusiasta', () => {
  assert.ok(!transformacionesDisponiblesMetamorfo([], [], enPortal('Metamorfo')).includes('Entusiasta'));
});

test('autómata central: cobra los bonus de Pícaro y Maestro de los Portales centrales', () => {
  const p = crearEstadoPartida('normal');
  Object.assign(p, { modo: 'experto', madain: true, levelIdx: 2, automataCentral: crearAutomataCentral() });
  // Invocación A del set normal: Clarividente, Maestro, Ocultista.
  p.players = [
    { name: 'Ana', hand: [], portals: [[enPortal('Clarividente')]], gems: [] },
    { name: 'Bea', hand: [], portals: [[enPortal('Ocultista')]], gems: [] },
  ];
  p.neutrals = [[enPortal('Maestro')]];
  resolverInvocacion(p);
  // 1 Gema de la invocación + 3 de valor 1 del Maestro (no hay Pícaro visible).
  assert.equal(p.automataCentral.gems.length, 4);
  assert.equal(p.automataCentral.gems.filter(g => g.nivel === 'unitaria').length, 3);
});

test('final de Experto: la última puede cambiar sus Gemas con la autómata', () => {
  const players = [
    { name: 'Ana', gems: [gema(9, 'A')] },
    { name: 'Bea', gems: [gema(2)] },
  ];
  const automata = { gems: [gema(10, 'A'), gema(3)] };
  assert.deepEqual(jugadorasConMenosPuntos(players), [1]);
  assert.ok(convieneIntercambioAutomata(players, automata, 1));
  const sin = resultadoFinalExperto(players, automata, ['C', 'A'], []);
  assert.equal(sin.ganadores.length, 1);
  assert.ok(sin.ganadores[0].esAutomataCentral, 'sin cambio gana la autómata (13 > 9)');
  const con = resultadoFinalExperto(players, automata, ['C', 'A'], [1]);
  assert.equal(con.ganadores[0].nombre, 'Bea');
  assert.deepEqual(con.intercambios, ['Bea']);
  // No toca las Gemas reales.
  assert.equal(sumaGemas(players[1].gems), 2);
  // Solo puede cambiar quien va última.
  assert.deepEqual(resultadoFinalExperto(players, automata, [], [0]).intercambios, []);
});

test('final de Experto: empatadas en el último puesto, victoria compartida', () => {
  const players = [
    { name: 'Ana', gems: [gema(2)] },
    { name: 'Bea', gems: [gema(2)] },
    { name: 'Cris', gems: [gema(5, 'B')] },
  ];
  const automata = { gems: [gema(9, 'A')] };
  assert.deepEqual(jugadorasConMenosPuntos(players), [0, 1]);
  const r = resultadoFinalExperto(players, automata, ['C', 'B', 'A'], [0, 1]);
  assert.deepEqual(r.ganadores.map(g => g.nombre).sort(), ['Ana', 'Bea']);
});

console.log(`\n${ok} tests de modos OK`);
