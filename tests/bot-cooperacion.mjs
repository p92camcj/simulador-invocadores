// tests/bot-cooperacion.mjs — parte cooperativa de las autómatas
// (PESOS.invocar / PESOS.progreso en js/bot-estrategia.js).
// Ejecutar: node tests/bot-cooperacion.mjs
import assert from 'node:assert/strict';
import { PESOS, evaluarJugadasFaseA, valorProgreso, tableroDesdeVista } from '../js/bot-estrategia.js';

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ok  ${nombre}`);
}

function conPesos(pesos, fn) {
  const previos = { ...PESOS };
  Object.assign(PESOS, pesos);
  try { return fn(); } finally { Object.assign(PESOS, previos); }
}

const need = ['Reena', 'Sora', 'Lumo'];
// La autómata (0) tiene Lumo; la rival (1) tiene Reena visible en su
// Portal; un Portal central con Sora y otro vacío. Jugar Lumo en el
// central vacío cierra la invocación, pero la única Gema es para la rival.
const vista = {
  botIdx: 0,
  jugadoras: [
    { idx: 0, esUnoMismo: true, portales: [{ name: 'Cronista' }] },
    { idx: 1, esUnoMismo: false, portales: [{ name: 'Reena' }] },
    { idx: 2, esUnoMismo: false, portales: [{ name: 'Pícaro' }] },
  ],
  neutrales: [{ name: 'Sora' }, null],
  propiaCartaConocida: { name: 'Lumo' },
  tieneCartaOcultaPropia: false,
};
const probs = { Reena: 0.3, Sora: 0.3, Lumo: 0.4 };
const mejor = cands => cands.reduce((a, b) => (b.valor > a.valor ? b : a));
const cierre = cands => cands.find(c => c.destKey === 'n:1');

test('sin la parte cooperativa, cerrar una invocación cuyas Gemas son de otras vale menos que nada', () => {
  const c = conPesos({ invocar: 0, progreso: 0 }, () => cierre(evaluarJugadasFaseA(vista, need, 2, probs)));
  assert.equal(c.cierra, true);
  assert.ok(c.valor < 0);
  const elegida = conPesos({ invocar: 0, progreso: 0 }, () => mejor(evaluarJugadasFaseA(vista, need, 2, probs)));
  assert.equal(elegida.cierra, false);
});

test('con la parte cooperativa, cerrar vale aunque cobren otras; y aún prefiere poner su requisito en su Portal y dejar el cierre servido', () => {
  const cands = evaluarJugadasFaseA(vista, need, 2, probs);
  assert.ok(cierre(cands).valor > PESOS.invocar / 2);
  // Lumo en su propio Portal: la invocación queda a una carta (cualquiera
  // en el central vacío) y la Gema de Lumo será suya.
  assert.equal(mejor(cands).destKey, 'p:0');
});

test('valorProgreso cuenta requisitos en Portales centrales y resta Portales vacíos', () => {
  const tablero = tableroDesdeVista(vista);
  // Reena (ajena) y Sora (central) presentes; un Portal vacío.
  assert.equal(valorProgreso(tablero, need), PESOS.progreso * (2 - 0.5));
  assert.equal(conPesos({ progreso: 0 }, () => valorProgreso(tablero, need)), 0);
});

console.log(`\n${ok} OK`);
