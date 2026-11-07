// Tests del historial de jugadas (js/historial.js): sin DOM.
import assert from 'node:assert/strict';
import {
  registrarEnHistorial, escucharHistorial, claveDeDestino, claveDeOrigenHabilidad, etiquetaPortal,
  fotoPortales, portalesCambiados, textoJugada, textoHabilidad, textoInvocacion, trazosHabilidad,
  turnoActual, MAX_ENTRADAS,
} from '../js/historial.js';

const carta = (name, pub = true) => ({ name, vis: { public: pub, owner: pub, others: pub } });
function partidaDePrueba() {
  return {
    players: [
      { name: 'Ana', tipo: 'humano', portals: [[carta('Cronista')], []], hand: [] },
      { name: 'Robo', tipo: 'auto', portals: [[carta('Estratega')], [carta('Ocultista', false)]], hand: [] },
    ],
    neutrals: [[carta('Maestro')]],
    historial: [],
  };
}

let n = 0;
const test = (nombre, fn) => { fn(); n++; };

test('claves de destino y de origen', () => {
  assert.equal(claveDeDestino('p:1', 0), '0:1');
  assert.equal(claveDeDestino('a:1:0', 0), '1:0');
  assert.equal(claveDeDestino('n:0', 1), 'n:0');
  assert.equal(claveDeOrigenHabilidad('own:1', 1), '1:1');
  assert.equal(claveDeOrigenHabilidad('central:0', 1), 'n:0');
});

test('etiquetas en tercera persona', () => {
  const p = partidaDePrueba();
  assert.equal(etiquetaPortal(p, '1:0', 1), 'su Portal 1');
  assert.equal(etiquetaPortal(p, '0:1', 1), 'el Portal 2 de Ana');
  assert.equal(etiquetaPortal(p, 'n:0', 1), 'el Portal central 1');
});

test('turnos, entradas y oyentes', () => {
  const p = partidaDePrueba();
  const vistas = [];
  const dejar = escucharHistorial(e => vistas.push(e));
  registrarEnHistorial(p, { tipo: 'turno', jugadora: 1, texto: 'Turno de Robo' });
  registrarEnHistorial(p, { tipo: 'jugada', jugadora: 1, texto: 'x', portales: ['0:0'], trazos: [{ desde: 'mano:1', hacia: '0:0' }] });
  dejar();
  registrarEnHistorial(p, { tipo: 'turno', jugadora: 0, texto: 'Turno de Ana' });
  assert.equal(turnoActual(p), 2);
  assert.equal(p.historial[1].turno, 1);
  assert.equal(p.historial[1].auto, true);
  assert.equal(p.historial[1].trazos, undefined, 'las estelas no se guardan en la partida');
  assert.equal(vistas.length, 2);
  assert.equal(vistas[1].trazos.length, 1);
  assert.doesNotThrow(() => JSON.stringify(p.historial));
});

test('tope de entradas', () => {
  const p = partidaDePrueba();
  for (let k = 0; k < MAX_ENTRADAS + 20; k++) registrarEnHistorial(p, { tipo: 'jugada', jugadora: 0, texto: String(k) });
  assert.equal(p.historial.length, MAX_ENTRADAS);
  assert.equal(p.historial.at(-1).texto, String(MAX_ENTRADAS + 19));
});

test('frases de jugada sin desvelar nada que no sea público', () => {
  const p = partidaDePrueba();
  assert.equal(textoJugada(p, { jugadora: 1, carta: carta('Cronista'), conocida: true, clave: '0:0' }),
    'Robo jugó Cronista en el Portal 1 de Ana.');
  assert.match(textoJugada(p, { jugadora: 1, carta: carta('Cronista'), conocida: false, clave: '1:0' }),
    /carta oculta, sin saber cuál era \(resultó ser Cronista\) en su Portal 1/);
  const t = textoHabilidad(p, { jugadora: 1, personaje: 'Ocultista', origen: '1:0', detalle: 'algo', cambiados: ['1:1'] });
  assert.match(t, /Robo activó la habilidad de Ocultista desde su Portal 1: algo\. Ahora su Portal 2 queda bocabajo\./);
  assert.doesNotMatch(t, /Ocultista\b.*Ocultista\b.*Ocultista/);
  assert.equal(textoInvocacion({ nivel: 'C', nombre: 'Cirelia', recompensas: [{ jugadora: 'Ana', gemas: 2 }, { jugadora: 'Robo', gemas: 0 }] }),
    '✨ Invocación C completada (Cirelia): Ana +2 Gemas.');
});

test('qué Portales cambiaron', () => {
  const p = partidaDePrueba();
  const antes = fotoPortales(p);
  const [a, b] = [p.players[0].portals[0], p.players[1].portals[0]];
  p.players[0].portals[0] = b; p.players[1].portals[0] = a;
  assert.deepEqual(portalesCambiados(antes, fotoPortales(p)).sort(), ['0:0', '1:0']);
});

test('estelas de cada habilidad', () => {
  const p = partidaDePrueba();
  assert.deepEqual(trazosHabilidad(p, { personaje: 'Estratega', jugadora: 1, origen: '1:0', cambiados: ['0:0', '1:0'] }),
    [{ desde: '0:0', hacia: '1:0', motivo: 'Estratega' }, { desde: '1:0', hacia: '0:0', motivo: 'Estratega' }]);
  assert.deepEqual(trazosHabilidad(p, { personaje: 'Cronista', jugadora: 1, origen: '1:0', cambiados: ['0:0'] }),
    [{ desde: '0:0', hacia: 'mano:1', motivo: 'Cronista' }]);
  assert.deepEqual(trazosHabilidad(p, { personaje: 'Maestro', jugadora: 1, origen: 'n:0', cambiados: ['0:1'] }),
    [{ desde: 'mano:0', hacia: '0:1', motivo: 'Maestro' }]);
  assert.equal(trazosHabilidad(p, { personaje: 'Aprendiz', jugadora: 1, origen: '1:0', cambiados: [], elegidos: ['0', '1'] }).length, 2);
  assert.deepEqual(trazosHabilidad(p, { personaje: 'Metamorfo', jugadora: 1, origen: '1:0', cambiados: [] }),
    [{ desde: '1:0', hacia: '1:0', motivo: 'Metamorfo' }]);
});

console.log(`\n${n} tests OK (historial)`);
