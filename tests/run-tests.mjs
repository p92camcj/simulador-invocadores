// tests/run-tests.mjs
//
// Runner mínimo sin dependencias (docs/DEUDA_TECNICA.md ítem 6): cubre las
// funciones puras más críticas de js/utils.js y js/abilities.js (economía de
// Gemas, visibilidad, protección de Centinela, y las opciones de Fase B) con
// node:assert nativo — sin framework, sin build step, coherente con el resto
// del proyecto. Ejecutar con `node tests/run-tests.mjs`.
//
// Alcance deliberado (NO es cobertura completa del proyecto, ver el propio
// ítem 6): no cubre actions.js/game.js/render.js (dependen del DOM real, ver
// docs/DEUDA_TECNICA.md), ni todos los `case` de abilities.js (varios abren
// un picker() de UI y no son fácilmente probables sin esa capa). Es un punto
// de partida real, no la solución completa a la falta de tests automatizados.

import assert from 'node:assert/strict';
import {
  sumaGemas, contarGemasPorNivel, tieneGemaAsterisco, gastarGemaAsterisco,
  gastarGemaUnitaria, construirPoolGemas, todosLosPortales,
  jugadoraProtegidaPorCentinela, estaProtegidoParaActivar,
  opcionesActivarHabilidad, generarVis,
} from '../js/utils.js';
import { ocultarOtrasCentinelas, candidatosObjetivoMaestro, bajarCartaMaestro } from '../js/abilities.js';
import {
  actualizarMemoriaBot, estimarProbabilidadesPersonajes,
  valorMedioGemaNivel, valorEsperadoDeAccion, personajeMemorizadoEnPortal,
} from '../js/bot-probabilidad.js';
import { listaPortalesConDestino, describirObjetivoHabilidad } from '../js/bot.js';

// pagarActivacionPortalCentral usa confirm()/alert() nativos del navegador;
// en Node no existen como globales, así que se stubean antes de importar
// cualquier función que pueda llamarlos.
global.alert = () => {};
global.confirm = () => false;
// draw() (utils.js) lee window.deck — se stubea un `window` mínimo; cada
// test de Maestro que necesite que reponerManoSiFalta() robe con éxito fija
// window.deck a un array no vacío antes de llamar.
global.window = { deck: [] };

let pass = 0;
let fail = 0;

function test(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok  ${name}`);
  } catch (err) {
    fail++;
    console.error(`FAIL  ${name}`);
    console.error(`      ${err.message}`);
  }
}

console.log('Economía de Gemas (utils.js)');

test('sumaGemas suma los valores reales de todas las Gemas', () => {
  assert.equal(sumaGemas([{ valor: 1 }, { valor: 3 }, { valor: 5 }]), 9);
  assert.equal(sumaGemas([]), 0);
});

test('contarGemasPorNivel agrupa por nivel sin revelar el valor real', () => {
  const r = contarGemasPorNivel([
    { valor: 1, nivel: 'unitaria' },
    { valor: 3, nivel: 'C' },
    { valor: 1, nivel: 'unitaria' },
  ]);
  assert.deepEqual(r, { unitaria: 2, C: 1 });
});

test('gastarGemaUnitaria gasta una Gema unitaria suelta si existe', () => {
  const player = { gems: [{ valor: 1, nivel: 'unitaria' }, { valor: 3, nivel: 'C' }] };
  assert.equal(gastarGemaUnitaria(player), true);
  assert.deepEqual(player.gems, [{ valor: 3, nivel: 'C' }]);
});

test('gastarGemaUnitaria cambia la Gema de menor valor si no hay unitaria suelta', () => {
  const player = { gems: [{ valor: 3, nivel: 'C' }] };
  assert.equal(gastarGemaUnitaria(player), true);
  assert.deepEqual(player.gems, [{ valor: 1, nivel: 'unitaria' }, { valor: 1, nivel: 'unitaria' }]);
});

test('gastarGemaUnitaria falla si no hay ninguna Gema con la que pagar', () => {
  const player = { gems: [] };
  assert.equal(gastarGemaUnitaria(player), false);
});

test('gastarGemaAsterisco solo gasta la Gema marcada como tal', () => {
  const player = { gems: [{ valor: 2, esAsterisco: true }, { valor: 3 }] };
  assert.equal(tieneGemaAsterisco(player), true);
  assert.equal(gastarGemaAsterisco(player), true);
  assert.deepEqual(player.gems, [{ valor: 3 }]);
  assert.equal(gastarGemaAsterisco(player), false);
});

test('construirPoolGemas marca como asterisco solo la primera Gema de menor valor', () => {
  const pool = construirPoolGemas([2, 3, 3, 3, 4]);
  assert.equal(pool.length, 5);
  const asteriscos = pool.filter(g => g.esAsterisco);
  assert.equal(asteriscos.length, 1);
  assert.equal(asteriscos[0].valor, 2);
});

console.log('Portales y protección de Centinela (utils.js)');

test('todosLosPortales recorre jugadoras + neutrales con el playerIdx correcto', () => {
  const players = [{ portals: [['a'], ['b']] }, { portals: [['c']] }];
  const neutrals = [['d'], ['e']];
  const r = todosLosPortales(players, neutrals);
  assert.equal(r.length, 5);
  assert.deepEqual(r.map(t => t.playerIdx), [0, 0, 1, null, null]);
});

test('jugadoraProtegidaPorCentinela exige una Centinela realmente visible', () => {
  const conCentinela = { portals: [[{ name: 'Centinela', vis: { public: true } }]] };
  const oculta = { portals: [[{ name: 'Centinela', vis: { public: false } }]] };
  assert.equal(jugadoraProtegidaPorCentinela(conCentinela), true);
  assert.equal(jugadoraProtegidaPorCentinela(oculta), false);
});

test('estaProtegidoParaActivar exime a la propia dueña actuando sobre sí misma', () => {
  const players = [
    { portals: [[{ name: 'Centinela', vis: { public: true } }]] },
    { portals: [[]] },
  ];
  const stack = players[0].portals[0];
  assert.equal(estaProtegidoParaActivar('0:0', stack, players, 1), true);
  assert.equal(estaProtegidoParaActivar('0:0', stack, players, 0), false);
});

test('ocultarOtrasCentinelas oculta cualquier otra Centinela visible, deja la recién jugada', () => {
  const mk = pub => [{ name: 'Centinela', vis: { public: pub } }];
  const players = [{ portals: [mk(true)] }, { portals: [mk(true)] }];
  const neutrals = [mk(true)];
  ocultarOtrasCentinelas(neutrals[0], players, neutrals);
  assert.equal(players[0].portals[0][0].vis.public, false);
  assert.equal(players[1].portals[0][0].vis.public, false);
  assert.equal(neutrals[0][0].vis.public, true);
});

console.log('Fase B: opciones de habilidad activable (utils.js) — regresión deuda ítem 16');

test('opcionesActivarHabilidad no ofrece un Portal central sin Gemas suficientes', () => {
  const players = [{ portals: [], gems: [] }];
  const neutrals = [[{ name: 'Ocultista', vis: { public: true } }]];
  const r = opcionesActivarHabilidad(0, players, neutrals);
  assert.equal(r.some(o => o.val.startsWith('central')), false);
});

test('opcionesActivarHabilidad exige el doble de valor en Gemas para Metamorfo central', () => {
  const neutrals = [[{ name: 'Metamorfo', vis: { public: true } }]];
  const players = [{ portals: [], gems: [{ valor: 1, nivel: 'unitaria' }] }];
  assert.equal(opcionesActivarHabilidad(0, players, neutrals).some(o => o.val.startsWith('central')), false);
  players[0].gems = [{ valor: 2, nivel: 'C' }];
  assert.equal(opcionesActivarHabilidad(0, players, neutrals).some(o => o.val.startsWith('central')), true);
});

test('opcionesActivarHabilidad siempre ofrece los Portales propios, aunque no haya Gemas', () => {
  const players = [{ portals: [[{ name: 'Ocultista', vis: { public: true } }]], gems: [] }];
  const r = opcionesActivarHabilidad(0, players, []);
  assert.equal(r.some(o => o.val === 'own:0'), true);
});

console.log('Visibilidad de cartas (utils.js)');

test('generarVis: una carta jugada en un Portal siempre es pública', () => {
  assert.deepEqual(generarVis('portal', {}), { public: true });
});

test('generarVis: carta robada del mazo respeta el parámetro visible', () => {
  assert.deepEqual(
    generarVis('mano', { origen: 'mazo', visible: true }),
    { owner: true, others: false, public: false }
  );
  assert.deepEqual(
    generarVis('mano', { origen: 'mazo', visible: false }),
    { owner: false, others: true, public: false }
  );
});

console.log('Habilidad activa del Maestro (abilities.js)');

test('candidatosObjetivoMaestro excluye a quien activa y respeta la protección de Centinela', () => {
  const players = [
    { name: 'Maestro-owner', hand: [], portals: [[]], gems: [] }, // idx 0, activa la habilidad
    { // idx 1: protegida por su propia Centinela visible — excluida aunque tenga carta oculta pública
      name: 'Protegida',
      hand: [{ name: 'Aprendiz', vis: { owner: true, others: false, public: false } },
             { name: 'Cronista', vis: { owner: false, others: true, public: false } }],
      portals: [[{ name: 'Centinela', vis: { public: true } }]],
      gems: [],
    },
    { // idx 2: candidata válida
      name: 'Objetivo',
      hand: [{ name: 'Pícaro', vis: { owner: true, others: false, public: false } },
             { name: 'Estratega', vis: { owner: false, others: true, public: false } }],
      portals: [[]],
      gems: [],
    },
  ];
  const candidatas = candidatosObjetivoMaestro(players, 0);
  assert.deepEqual(candidatas.map(c => c.idx), [2]);
  assert.equal(candidatas[0].cartaOculta.name, 'Estratega');
});

test('bajarCartaMaestro mueve la carta oculta-para-el-resto al Portal de la jugadora objetivo (no al del Maestro)', () => {
  const owner = { name: 'Maestro-owner', hand: [], portals: [[]], gems: [] };
  const target = {
    name: 'Objetivo',
    hand: [{ name: 'Aprendiz', vis: { owner: true, others: false, public: false } },
           { name: 'Cronista', vis: { owner: false, others: true, public: false } }],
    portals: [[]],
    gems: [],
  };
  const players = [owner, target];
  global.window.deck = []; // sin cartas: no repone mano en este test, solo se comprueba el movimiento
  bajarCartaMaestro(players, [], 1, 0);
  assert.equal(owner.portals[0].length, 0, 'la carta no debe acabar en el Portal del Maestro');
  assert.equal(target.portals[0].length, 1);
  assert.equal(target.portals[0][0].name, 'Cronista');
  assert.equal(target.portals[0][0].vis.public, true);
  assert.equal(target.hand.some(c => c.name === 'Cronista'), false, 'la carta ya no debe estar en la mano');
});

test('bajarCartaMaestro repone la mano de la jugadora objetivo: acaba con 2 cartas', () => {
  const owner = { name: 'Maestro-owner', hand: [], portals: [[]], gems: [] };
  const target = {
    name: 'Objetivo',
    hand: [{ name: 'Pícaro', vis: { owner: true, others: false, public: false } },
           { name: 'Aprendiz', vis: { owner: false, others: true, public: false } }],
    portals: [[]],
    gems: [],
  };
  global.window.deck = [{ name: 'Cronomante' }];
  bajarCartaMaestro([owner, target], [], 1, 0);
  assert.equal(target.hand.length, 2);
});

test('bajarCartaMaestro re-dispara el auto-giro de Centinela si la carta movida es una Centinela', () => {
  const owner = { name: 'Maestro-owner', hand: [], portals: [[]], gems: [] };
  const target = {
    name: 'Objetivo',
    hand: [{ name: 'Pícaro', vis: { owner: true, others: false, public: false } },
           { name: 'Centinela', vis: { owner: false, others: true, public: false } }],
    portals: [[]],
    gems: [],
  };
  const otraJugadoraConCentinela = { name: 'Otra', hand: [], portals: [[{ name: 'Centinela', vis: { public: true } }]], gems: [] };
  global.window.deck = [{ name: 'Cronista' }];
  bajarCartaMaestro([owner, target, otraJugadoraConCentinela], [], 1, 0);
  assert.equal(target.portals[0][0].vis.public, true, 'la Centinela recién bajada queda visible');
  assert.equal(otraJugadoraConCentinela.portals[0][0].vis.public, false, 'la otra Centinela debe ocultarse');
});

console.log('Mensajes del autómata en tercera persona (bot.js) — Bloque 1');

test('listaPortalesConDestino etiqueta cada Portal en tercera persona, nunca en segunda ("tu")', () => {
  const vista = {
    jugadoras: [
      { idx: 0, nombre: 'Arcanobot', esUnoMismo: true, portales: [{ hidden: true }] },
      { idx: 1, nombre: 'Ana', esUnoMismo: false, portales: [{ hidden: true }, null] },
    ],
    neutrales: [{ hidden: true }],
  };
  const lista = listaPortalesConDestino(vista);
  assert.deepEqual(lista.map(p => p.etiqueta), [
    'su propio Portal 1',
    'el Portal 1 de Ana',
    'el Portal 2 de Ana',
    'el Portal Neutral 1',
  ]);
  lista.forEach(p => assert.ok(!/\btu\b/i.test(p.etiqueta), `no debe usar segunda persona: "${p.etiqueta}"`));
});

test('describirObjetivoHabilidad identifica correctamente de quién es cada Portal/mano afectada', () => {
  const vista = {
    jugadoras: [
      { idx: 0, nombre: 'Arcanobot', esUnoMismo: true },
      { idx: 1, nombre: 'Ana', esUnoMismo: false },
    ],
  };
  assert.equal(describirObjetivoHabilidad('Ocultista', ['1:0'], vista), 'cambió la visibilidad del Portal 1 de Ana');
  assert.equal(describirObjetivoHabilidad('Cronista', ['0:0'], vista), 'se llevó a la mano la carta superior de su propio Portal 1');
  assert.equal(describirObjetivoHabilidad('Maestro', ['1'], vista), 'bajó una carta de la mano de Ana a su propio Portal');
});

console.log('Motor probabilístico del autómata "dificil" (bot-probabilidad.js)');

test('estimarProbabilidadesPersonajes: conteo de cartas (composición total - contabilizadas = desconocidas)', () => {
  // Escenario reproducible a mano, modo 'normal' (32 cartas totales):
  // memoria del bot ya vio un Ocultista y un Pícaro (aunque ahora tapados);
  // otra jugadora tiene un Cronista público en la mano; el propio bot
  // conoce su Aprendiz.
  const memoria = { portales: { '0:0': ['Ocultista'], 'n:0': ['Pícaro'] } };
  const vista = {
    propiaCartaConocida: { name: 'Aprendiz' },
    jugadoras: [
      { idx: 0, esUnoMismo: true, portales: [{ hidden: true }], cartaOcultaPublica: null },
      { idx: 1, esUnoMismo: false, portales: [{ hidden: true }], cartaOcultaPublica: 'Cronista' },
    ],
    neutrales: [{ hidden: true }],
  };
  const r = estimarProbabilidadesPersonajes(vista, memoria, 'normal');
  // Composición modo normal: Maestro2 Clarividente2 Ocultista2 Cronomante3
  // Estratega3 Cronista4 Aprendiz4 Centinela4 Pícaro6 Metamorfo2 = 32.
  assert.equal(r.contabilizadas.Ocultista, 1);
  assert.equal(r.contabilizadas['Pícaro'], 1);
  assert.equal(r.contabilizadas.Cronista, 1);
  assert.equal(r.contabilizadas.Aprendiz, 1);
  assert.equal(r.desconocidos.Ocultista, 1); // 2 - 1
  assert.equal(r.desconocidos['Pícaro'], 5); // 6 - 1
  assert.equal(r.desconocidos.Cronista, 3); // 4 - 1
  assert.equal(r.desconocidos.Aprendiz, 3); // 4 - 1
  assert.equal(r.desconocidos.Centinela, 4); // sin contabilizar, intacto
  assert.equal(r.totalHuecosDesconocidos, 32 - 4); // 4 cartas contabilizadas en total
  assert.equal(r.probabilidadPorNombre['Pícaro'], 5 / (32 - 4));
});

test('estimarProbabilidadesPersonajes: nunca necesita ni acepta el estado real, solo la vista saneada + memoria (mismo resultado si el contenido real de un Portal oculto cambia)', () => {
  const memoria = { portales: {} }; // el bot nunca ha visto nada todavía
  const base = {
    propiaCartaConocida: { name: 'Aprendiz' },
    neutrales: [],
  };
  // Un Portal marcado "oculto" (hay carta, pero no se sabe cuál) frente al
  // mismo Portal simplemente vacío: como la memoria no registró nada en
  // ninguno de los dos casos, el resultado debe ser IDÉNTICO — la función
  // no puede estar mirando qué hay "de verdad" bajo la carta oculta, solo
  // lo que este bot ya memorizó.
  const vistaConPortalOculto = { ...base, jugadoras: [{ idx: 0, esUnoMismo: true, portales: [{ hidden: true }], cartaOcultaPublica: null }] };
  const vistaConPortalVacio = { ...base, jugadoras: [{ idx: 0, esUnoMismo: true, portales: [null], cartaOcultaPublica: null }] };
  const r1 = estimarProbabilidadesPersonajes(vistaConPortalOculto, memoria, 'normal');
  const r2 = estimarProbabilidadesPersonajes(vistaConPortalVacio, memoria, 'normal');
  assert.deepEqual(r1, r2);
});

test('actualizarMemoriaBot solo añade una entrada nueva si el nombre visible cambia (no duplica al alternar visibilidad de la misma carta)', () => {
  const memoria = { portales: {} };
  const vistaConOcultista = { jugadoras: [{ idx: 0, esUnoMismo: true, portales: [{ name: 'Ocultista' }], cartaOcultaPublica: null }], neutrales: [] };
  actualizarMemoriaBot(memoria, vistaConOcultista);
  actualizarMemoriaBot(memoria, vistaConOcultista); // se "vuelve a mirar" el mismo estado
  assert.deepEqual(memoria.portales['0:0'], ['Ocultista']);
  assert.equal(personajeMemorizadoEnPortal(memoria, '0:0'), 'Ocultista');

  const vistaConCronista = { jugadoras: [{ idx: 0, esUnoMismo: true, portales: [{ name: 'Cronista' }], cartaOcultaPublica: null }], neutrales: [] };
  actualizarMemoriaBot(memoria, vistaConCronista);
  assert.deepEqual(memoria.portales['0:0'], ['Ocultista', 'Cronista']);
});

test('valorEsperadoDeAccion valora más un Portal propio que uno central o ajeno para un personaje necesario', () => {
  const contexto = { need: ['Aprendiz', 'Pícaro', 'Centinela'], cumplidos: ['Pícaro'], valorGemaNivel: 3 };
  const probabilidades = { probabilidadPorNombre: {} };
  const evPropio = valorEsperadoDeAccion({ personaje: 'Aprendiz', esPropio: true, esCentral: false, completaInvocacionSiSeJuega: false }, probabilidades, contexto);
  const evAjeno = valorEsperadoDeAccion({ personaje: 'Aprendiz', esPropio: false, esCentral: false, completaInvocacionSiSeJuega: false }, probabilidades, contexto);
  const evCentral = valorEsperadoDeAccion({ personaje: 'Aprendiz', esPropio: false, esCentral: true, completaInvocacionSiSeJuega: false }, probabilidades, contexto);
  assert.ok(evPropio > evAjeno);
  assert.ok(evAjeno > evCentral);
  assert.equal(evCentral, 0);
});

test('valorEsperadoDeAccion no otorga valor por un personaje ya cumplido (duplicado) ni por uno fuera de need', () => {
  const contexto = { need: ['Aprendiz', 'Pícaro', 'Centinela'], cumplidos: ['Aprendiz'], valorGemaNivel: 3 };
  const probabilidades = { probabilidadPorNombre: {} };
  const evDuplicado = valorEsperadoDeAccion({ personaje: 'Aprendiz', esPropio: true, esCentral: false, completaInvocacionSiSeJuega: false }, probabilidades, contexto);
  const evFueraDeNeed = valorEsperadoDeAccion({ personaje: 'Metamorfo', esPropio: true, esCentral: false, completaInvocacionSiSeJuega: false }, probabilidades, contexto);
  assert.equal(evDuplicado, 0);
  assert.equal(evFueraDeNeed, 0);
});

test('valorMedioGemaNivel calcula la media real de los 5 valores de Gema del nivel', () => {
  assert.equal(valorMedioGemaNivel('normal', 'C'), (2 + 3 + 3 + 3 + 4) / 5);
});

console.log(`\n${pass} OK, ${fail} fallidos`);
process.exit(fail ? 1 : 0);
