// tools/arena.mjs
// Simulador de partidas SIN navegador: enfrenta autómatas entre sí usando el
// motor de reglas (js/motor/) y las mismas decisiones que en la web
// (js/bot.js, con un ejecutor que solo usa el motor). Sirve para medir si un
// cambio en la IA la hace jugar mejor, con cientos o miles de partidas en
// segundos, y para ajustar sus pesos.
//
// Uso:
//   node tools/arena.mjs [--partidas 500] [--jugadoras 3]
//                        [--mesa dificil,normal,normal] [--set normal]
//                        [--semilla 1] [--pesos '{"rival":0.75}']
//                        [--perfiles '{"b":{"rival":0.5}}']  (asiento 'dificil@b')
//
// `--mesa` dice la dificultad de cada asiento. Los asientos rotan en cada
// partida para que nadie tenga siempre la ventaja de empezar. `--pesos`
// cambia los pesos de js/bot-estrategia.js (PESOS) solo para esta ejecución.
// Con la misma semilla, dos ejecuciones reparten exactamente las mismas
// cartas, así que se pueden comparar versiones partida a partida.

import { estado, crearEstadoPartida } from '../js/motor/estado.js';
import { terminarTurno, pasarTurno, comprobarFinPorManoVacia } from '../js/motor/acciones.js';
import { aplicarEleccionClarividente } from '../js/motor/habilidades.js';
import {
  shuffle, draw, composicionMazoTotal, calcularResultadoFinal, sumaGemas,
  tieneClarividenteVisible, LEVELS, INVOCATION_SETS,
} from '../js/utils.js';
import { decidirYJugarTurno, crearEjecutorMotor } from '../js/bot.js';
import { PESOS } from '../js/bot-estrategia.js';

/** PRNG con semilla (mulberry32): mismas partidas en cada ejecución. */
export function sembrarAzar(semilla) {
  let a = semilla >>> 0;
  Math.random = () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Prepara una partida como setup.js + initGame() (game.js), sin DOM. */
export function prepararPartida(dificultades, invocationSet = 'normal') {
  const partida = crearEstadoPartida(invocationSet);
  const n = dificultades.length;
  partida.players = dificultades.map((dificultad, i) => ({
    name: `${dificultad}-${i}`, tipo: 'auto', dificultad, hand: [], portals: [],
    gems: Array.from({ length: 3 }, () => ({ valor: 1, nivel: 'unitaria' })),
  }));
  // Reparto de Portales del reglamento (setup.js).
  const porJugadora = n === 2 ? 2 : 1;
  const centrales = { 2: 1, 3: 2, 4: 1, 5: 0 }[n];
  partida.players.forEach(p => { p.portals = Array.from({ length: porJugadora }, () => []); });
  partida.neutrals = Array.from({ length: centrales }, () => []);
  // Mazo (game.js): se baraja y se apartan 2 cartas sin mirar.
  const nombres = Object.entries(composicionMazoTotal(invocationSet)).flatMap(([nm, c]) => Array(c).fill(nm));
  shuffle(nombres);
  nombres.splice(0, 2);
  partida.deck = nombres.map(name => ({ name }));
  partida.players.forEach(p => { draw(p, true, partida.deck); draw(p, false, partida.deck); });
  return partida;
}

/**
 * Clarividente al dejar de estar visible: la autómata elige qué carta sigue
 * viendo, con el mismo criterio que render.js (la que sea requisito de la
 * invocación activa; si no, al azar). Mientras la tenía visible veía las
 * dos, así que no es hacer trampa.
 */
function gestionarClarividente(partida) {
  const nivel = LEVELS[partida.levelIdx];
  const need = nivel ? INVOCATION_SETS[partida.invocationSet][nivel].need : null;
  partida.players.forEach(p => {
    const ahora = tieneClarividenteVisible(p);
    if (p._clariPrev && !ahora && p.hand.length === 2) {
      const req = c => !!need && need.includes(c.aspecto || c.name);
      const [c0, c1] = p.hand;
      const idx = req(c0) && !req(c1) ? 0 : req(c1) && !req(c0) ? 1 : (Math.random() < 0.5 ? 0 : 1);
      aplicarEleccionClarividente(p, idx);
    }
    p._clariPrev = ahora;
  });
}

/**
 * Juega una partida completa. Cada asiento es una dificultad ('normal',
 * 'dificil', 'experta') o 'dificultad@perfil': en ese caso, durante los
 * turnos de esa autómata los PESOS de js/bot-estrategia.js valen
 * `perfiles[perfil]` (para enfrentar dos ajustes de pesos en la misma mesa).
 * Devuelve { puntos, ganadoras, invocaciones, turnos }.
 */
export function jugarPartida(asientos, invocationSet = 'normal', perfiles = {}) {
  const base = { ...PESOS };
  const dificultades = asientos.map(a => a.split('@')[0]);
  const pesosDe = asientos.map(a => ({ ...base, ...(perfiles[a.split('@')[1]] || {}) }));
  const partida = prepararPartida(dificultades, invocationSet);
  estado.partida = partida;
  const ejecutor = crearEjecutorMotor();
  let turnos = 0;
  if (comprobarFinPorManoVacia(partida).length) partida.juegoTerminado = true;
  while (!partida.juegoTerminado && turnos < 500) {
    Object.assign(PESOS, pesosDe[partida.turn]);
    decidirYJugarTurno(partida.players, partida.neutrals, partida.turn,
      { levelIdx: partida.levelIdx, invocationSet }, ejecutor);
    gestionarClarividente(partida);
    if (!partida.played) throw new Error(`La autómata ${partida.turn} no jugó carta (turno ${turnos})`);
    terminarTurno(partida);
    gestionarClarividente(partida);
    if (!partida.juegoTerminado) pasarTurno(partida);
    turnos++;
  }
  Object.assign(PESOS, base);
  const resultado = calcularResultadoFinal(partida.players, partida.invocacionesCompletadas);
  return {
    puntos: partida.players.map(p => sumaGemas(p.gems)),
    ganadoras: resultado.ganadores.map(g => g.idx ?? partida.players.findIndex(p => p.name === g.nombre)),
    invocaciones: partida.invocacionesCompletadas.length,
    turnos,
  };
}

/**
 * Enfrenta la mesa `mesa` (dificultad por asiento) en `partidas` partidas,
 * rotando asientos. Devuelve, por dificultad, el % de victorias (los empates
 * se reparten) y los puntos medios, más las invocaciones medias por partida.
 */
export function torneo({ partidas = 500, mesa = ['dificil', 'normal', 'normal'], set = 'normal', semilla = 1, perfiles = {} } = {}) {
  sembrarAzar(semilla);
  const n = mesa.length;
  const stats = {};
  mesa.forEach(d => { stats[d] ??= { asientos: 0, victorias: 0, puntos: 0 }; });
  let invocaciones = 0;
  for (let g = 0; g < partidas; g++) {
    const rot = mesa.map((_, i) => mesa[(i + g) % n]);
    const r = jugarPartida(rot, set, perfiles);
    invocaciones += r.invocaciones;
    rot.forEach((d, i) => {
      stats[d].asientos++;
      stats[d].puntos += r.puntos[i];
      if (r.ganadoras.includes(i)) stats[d].victorias += 1 / r.ganadoras.length;
    });
  }
  const resumen = {};
  Object.entries(stats).forEach(([d, s]) => {
    resumen[d] = {
      victoriasPorAsiento: +(s.victorias / s.asientos).toFixed(3),
      puntosMedios: +(s.puntos / s.asientos).toFixed(2),
    };
  });
  return { partidas, mesa: mesa.join(','), invocacionesPorPartida: +(invocaciones / partidas).toFixed(2), resumen };
}

// ---------- Línea de comandos ----------
const esPrincipal = import.meta.url === `file://${process.argv[1]}`;
if (esPrincipal) {
  const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, arr) => {
    if (a.startsWith('--')) acc.push([a.slice(2), arr[i + 1]]);
    return acc;
  }, []));
  if (args.pesos) Object.assign(PESOS, JSON.parse(args.pesos));
  const perfiles = args.perfiles ? JSON.parse(args.perfiles) : {};
  const jugadoras = +(args.jugadoras || 3);
  const mesa = args.mesa ? args.mesa.split(',') : ['dificil', ...Array(jugadoras - 1).fill('normal')];
  const t0 = Date.now();
  const r = torneo({ partidas: +(args.partidas || 500), mesa, set: args.set || 'normal', semilla: +(args.semilla || 1), perfiles });
  console.log(JSON.stringify({ ...r, pesos: PESOS, segundos: (Date.now() - t0) / 1000 }, null, 1));
}
