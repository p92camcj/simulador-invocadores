// tests/aprendizaje.mjs — aprendizaje de las autómatas a partir de las
// jugadas de las personas (js/aprendizaje.js). Ejecutar: node tests/aprendizaje.mjs
import assert from 'node:assert/strict';
import {
  ajustarModelo, logVerosimilitud, normalizarAlmacen, crearAlmacenVacio, anadirEjemplos,
  elegirJugadaComoPersona, modeloUtilizable, MAX_EJEMPLOS, MIN_EJEMPLOS_MODELO,
} from '../js/aprendizaje.js';
import { PESOS } from '../js/bot-estrategia.js';
import { sembrarAzar, jugarPartida, torneo } from '../tools/arena.mjs';
import { obtenerModeloPersonas } from '../js/bot.js';

let ok = 0;
function test(nombre, fn) {
  fn();
  ok++;
  console.log(`  ok  ${nombre}`);
}

// "Personas" simuladas: juegan como Difícil pero con otros pesos.
const PERFIL = { rival: 0.25, posicion: 1, amenaza: 0 };
function registrar(partidas, semilla) {
  sembrarAzar(semilla);
  let ejemplos = [];
  for (let g = 0; g < partidas; g++) {
    const registro = [];
    jugarPartida(['dificil', 'persona@h', 'persona@h'], 'normal', { h: PERFIL }, registro);
    ejemplos = ejemplos.concat(registro);
  }
  return ejemplos.slice(-MAX_EJEMPLOS);
}

test('los ejemplos no guardan nombres de jugadoras', () => {
  const ejemplos = registrar(1, 3);
  assert.ok(ejemplos.length > 0);
  ejemplos.forEach(e => e.vista.jugadoras.forEach(j => assert.equal(j.nombre, undefined)));
});

test('ajustarModelo recupera los pesos con los que juegan las personas simuladas', () => {
  const pesosAntes = { ...PESOS };
  const ejemplos = registrar(25, 4);
  const modelo = ajustarModelo(ejemplos);
  assert.ok(modeloUtilizable(modelo));
  assert.equal(modelo.rival, PERFIL.rival);
  assert.equal(modelo.amenaza, PERFIL.amenaza);
  assert.ok(modelo.acierto > 0.8, `acierto ${modelo.acierto}`);
  const porDefecto = logVerosimilitud(ejemplos, { ...pesosAntes, beta: 1, sesgoConocida: 0 });
  assert.ok(modelo.logVerosimilitud > porDefecto, 'explica las jugadas mejor que los pesos por defecto');
  assert.deepEqual({ ...PESOS }, pesosAntes, 'no deja PESOS cambiados');
});

test('sin jugadas suficientes no hay modelo', () => {
  assert.equal(ajustarModelo(registrar(1, 5).slice(0, MIN_EJEMPLOS_MODELO - 1)), null);
  assert.equal(modeloUtilizable(null), false);
});

test('normalizarAlmacen descarta datos corruptos y limita el tamaño', () => {
  assert.deepEqual(normalizarAlmacen(null), crearAlmacenVacio());
  assert.deepEqual(normalizarAlmacen({ version: 99, ejemplos: [1] }), crearAlmacenVacio());
  const almacen = crearAlmacenVacio();
  const ejemplo = registrar(1, 6)[0];
  anadirEjemplos(almacen, [...Array(MAX_EJEMPLOS + 10)].map(() => ejemplo).concat([{ basura: true }]));
  assert.equal(almacen.ejemplos.length, MAX_EJEMPLOS);
  const leido = normalizarAlmacen(JSON.parse(JSON.stringify({ ...almacen, partidas: 3 })));
  assert.equal(leido.ejemplos.length, MAX_EJEMPLOS);
  assert.equal(leido.partidas, 3);
});

test('elegirJugadaComoPersona devuelve una jugada posible', () => {
  const ejemplos = registrar(20, 7);
  const modelo = ajustarModelo(ejemplos);
  const e = ejemplos[0];
  const jugada = elegirJugadaComoPersona(e.vista, e.need, e.valorGemaNivel, e.probs, modelo, () => 0.5);
  assert.equal(typeof jugada.destKey, 'string');
  assert.equal(typeof jugada.usaConocida, 'boolean');
});

test('torneo con aprendizaje: la Experta juega contra personas simuladas y el modelo se limpia al acabar', () => {
  const r = torneo({ partidas: 2, mesa: ['experta', 'persona@h', 'persona@h'], perfiles: { h: PERFIL }, aprender: true, semilla: 8 });
  assert.equal(r.partidas, 2);
  assert.equal(obtenerModeloPersonas(), null);
});

console.log(`\n${ok} tests OK`);
