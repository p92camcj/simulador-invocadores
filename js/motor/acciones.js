// js/motor/acciones.js
//
// Fase 2 de la separación motor / interfaz (ver docs/ARQUITECTURA_MOTOR.md).
//
// Las reglas del turno, como funciones puras sobre `partida` (el objeto de
// js/motor/estado.js): reciben una acción, la validan, cambian la partida y
// devuelven la lista de EVENTOS de lo que ha pasado. No tocan el DOM, ni
// `window`, ni muestran avisos: la interfaz (js/actions.js) traduce los
// eventos a render(), alert() o escenas del modo espectáculo. Una terminal,
// una interfaz 3D o un servidor de red podrían usar estas mismas funciones.
//
// Eventos que pueden salir (campo `tipo`):
// - 'accionInvalida'        { motivo }  (la partida no ha cambiado)
// - 'cartaJugada'           { jugadora, destino, carta }
// - 'manosRepuestas'        {}
// - 'invocacionCompletada'  { nivel, nombre, need, recompensas: [{ jugadora, gemas }],
//                             gemasAutomata, entusiastas: [{ jugadora, perdida }] }
// - 'partidaTerminada'      { motivo }
// - 'habilidadAplicada'     { jugadora, origen, personaje }
//
// Lo que hace cada habilidad está en js/motor/habilidades.js (fase 3).

import {
  invocacionDePartida, nivelesPartida, apilarEnPortal, generarVis, reponerManoSiFalta,
  todosLosPortales, construirPoolGemas, aplicarBonusPasivosInvocacion, aplicarEntusiastas,
  pagarActivacionPortalCentral, opcionesActivarHabilidad,
} from '../utils.js';
import { ocultarOtrasCentinelas } from './habilidades.js';
import { VARIANTES } from './variantes.js';

const invalida = motivo => [{ tipo: 'accionInvalida', motivo }];

/**
 * Traduce una clave de destino ('p:<j>' Portal propio, 'n:<k>' central,
 * 'a:<i>:<j>' Portal de otra jugadora) a su pila, o null si no existe.
 */
export function pilaDeDestino(partida, jugadora, destino) {
  const [tp, a, b] = String(destino).split(':');
  if (tp === 'p') return partida.players[jugadora]?.portals[+a] ?? null;
  if (tp === 'n') return partida.neutrals[+a] ?? null;
  if (tp === 'a') return partida.players[+a]?.portals[+b] ?? null;
  return null;
}

/** Invocación activa ({ nivel, nombre, need, gemas }) o null si no queda ninguna. */
export function invocacionActiva(partida) {
  return invocacionDePartida(partida);
}

/**
 * Fase A: la jugadora activa baja la carta `cartaIdx` de su mano a `destino`.
 * Incluye el efecto pasivo de Centinela (las demás se giran).
 */
export function jugarCarta(partida, { cartaIdx, destino }) {
  if (partida.juegoTerminado) return invalida('La partida ha terminado.');
  if (partida.played) return invalida('Ya jugaste');
  const jugadora = partida.turn;
  const pl = partida.players[jugadora];
  if (!pl?.hand[cartaIdx]) return invalida('Debes seleccionar una carta válida antes de jugar.');
  const stack = pilaDeDestino(partida, jugadora, destino);
  if (!stack) return invalida('Ese Portal no existe.');

  const card = pl.hand.splice(cartaIdx, 1)[0];
  // Una carta que viene de la mano nunca trae ficha de Metamorfo.
  // apilarEnPortal() retira la ficha de un Metamorfo transformado tapado.
  apilarEnPortal(stack, { name: card.name, vis: generarVis('portal', {}) });
  // Efecto pasivo de Centinela: solo puede haber una visible en mesa.
  if (card.name === 'Centinela') {
    ocultarOtrasCentinelas(stack, partida.players, partida.neutrals);
  }
  partida.played = true;
  return [{ tipo: 'cartaJugada', jugadora, destino, carta: card.name }];
}

/**
 * Comprueba si la invocación activa se cumple y, si es así, reparte Gemas,
 * aplica los bonus pasivos, abre un Portal central nuevo y sube de nivel.
 * Devuelve los eventos ('invocacionCompletada' y, si era la última,
 * 'partidaTerminada'), o [] si no se cumple.
 */
export function resolverInvocacion(partida) {
  const inv = invocacionActiva(partida);
  if (!inv) return [];
  const { players, neutrals } = partida;
  const { nivel, need } = inv;

  // Apariencia, no identidad: un Metamorfo transformado cuenta como el
  // personaje imitado para la combinación y el reparto de Gemas.
  const map = new Map();
  const todos = todosLosPortales(players, neutrals);
  todos.forEach(({ stack, playerIdx }) => {
    if (!stack.length || !stack.at(-1).vis?.public) return;
    const nombre = stack.at(-1).aspecto || stack.at(-1).name;
    if (!need.includes(nombre)) return;
    if (!map.has(nombre)) map.set(nombre, []);
    map.get(nombre).push(playerIdx);
  });
  const todosVisibles = todos.every(({ stack }) => stack.length && stack.at(-1).vis?.public);
  if (!todosVisibles || !need.every(k => map.get(k))) return [];

  const automata = partida.automataCentral || null;
  const gemasAntes = players.map(p => p.gems.length);
  const gemasAutomataAntes = automata ? automata.gems.length : 0;
  const pool = construirPoolGemas(inv.gemas);
  need.forEach(k => {
    const arr = map.get(k);
    // Solo cobra si el personaje está en un único Portal. Un Portal central
    // no tiene dueña: su Gema se pierde, salvo en Modo Experto, donde los
    // Portales centrales son de la autómata central y la cobra ella.
    if (arr.length !== 1) {
      // Variante de análisis (js/motor/variantes.js): cada copia duplicada
      // da una Gema de valor 1 a su dueña (en Experto, la central a la autómata).
      if (VARIANTES.duplicadoDaGema) {
        arr.forEach(i => (i !== null ? players[i] : automata)?.gems.push({ valor: 1, nivel: 'unitaria' }));
      }
      return;
    }
    const quien = arr[0] !== null ? players[arr[0]] : automata;
    if (!quien) return;
    const gema = pool.shift();
    if (gema) quien.gems.push({ valor: gema.valor, nivel, esAsterisco: gema.esAsterisco });
  });
  // El Maestro se evalúa antes de voltear a los Pícaros (utils.js).
  aplicarBonusPasivosInvocacion(players, neutrals, need, automata);
  const recompensas = players.map((p, i) => ({ jugadora: p.name, gemas: p.gems.length - gemasAntes[i] }));
  // El Entusiasta es lo último que se resuelve.
  const entusiastas = aplicarEntusiastas(players, neutrals);

  partida.invocacionesCompletadas.push(nivel);
  neutrals.push([]);
  partida.levelIdx++;

  const eventos = [{
    tipo: 'invocacionCompletada',
    nivel,
    nombre: inv.nombre,
    need,
    recompensas,
    // Gemas que se ha llevado la autómata central (Modo Experto).
    gemasAutomata: automata ? automata.gems.length - gemasAutomataAntes : 0,
    // Entusiastas que han actuado: [{ jugadora, perdida }].
    entusiastas: entusiastas.map(e => ({ jugadora: players[e.jugadora].name, perdida: e.perdida })),
  }];
  if (partida.levelIdx >= nivelesPartida(partida).length) {
    partida.juegoTerminado = true;
    eventos.push({ tipo: 'partidaTerminada', motivo: `Se ha completado la invocación ${nivel}. Fin de la partida.` });
  }
  return eventos;
}

/**
 * Fin de la Fase B: todas reponen mano y se comprueba la invocación. NO pasa
 * el turno: eso es `pasarTurno`, para que la interfaz pueda esperar a que
 * terminen las escenas sin mostrar todavía la mano de la siguiente jugadora.
 */
export function terminarTurno(partida) {
  if (partida.juegoTerminado) return invalida('La partida ha terminado.');
  if (!partida.played) return invalida('Juega una carta');
  partida.players.forEach(p => reponerManoSiFalta(p, partida.deck));
  return [{ tipo: 'manosRepuestas' }, ...resolverInvocacion(partida)];
}

/**
 * Pasa el turno a la siguiente jugadora y limpia los campos de turno. Si la
 * nueva jugadora activa no tiene cartas, la partida termina.
 */
export function pasarTurno(partida) {
  if (partida.juegoTerminado) return invalida('La partida ha terminado.');
  partida.turn = (partida.turn + 1) % partida.players.length;
  partida.played = false;
  partida.habilidadUsadaEsteTurno = false;
  partida.cronomantePortalInvestigado = null;
  return comprobarFinPorManoVacia(partida);
}

/** Fin de partida si la jugadora activa no tiene cartas en la mano. */
export function comprobarFinPorManoVacia(partida) {
  const actual = partida.players[partida.turn];
  if (actual && actual.hand.length === 0) {
    partida.juegoTerminado = true;
    return [{ tipo: 'partidaTerminada', motivo: `${actual.name} no tiene cartas en la mano. Fin de la partida.` }];
  }
  return [];
}

/**
 * Fase B: ¿puede la jugadora activa activar una habilidad este turno?
 * Devuelve [] si sí, o un 'accionInvalida' con el motivo.
 */
export function validarFaseB(partida) {
  if (partida.juegoTerminado) return invalida('La partida ha terminado.');
  if (!partida.played) return invalida('Primero debes jugar una carta.');
  if (partida.habilidadUsadaEsteTurno) return invalida('Ya has activado una habilidad este turno.');
  return [];
}

/**
 * Fase B: habilidades que la jugadora activa puede elegir ahora
 * (opcionesActivarHabilidad, utils.js). Devuelve { opciones } o, si no hay
 * ninguna o no se puede activar, { eventos } con 'accionInvalida'.
 */
export function opcionesFaseB(partida) {
  const eventos = validarFaseB(partida);
  if (eventos.length) return { eventos };
  const opciones = opcionesActivarHabilidad(partida.turn, partida.players, partida.neutrals);
  if (!opciones.length) return { eventos: invalida('No tienes ninguna habilidad activable ahora mismo.') };
  return { opciones };
}

/**
 * Fase B, después de aplicar la habilidad: cobra el acceso al Portal central
 * si hacía falta (con la Gema de asterisco si `usarAsterisco`) y marca la
 * habilidad del turno como usada. `origen` es la clave de opcionesActivarHabilidad ('own:<j>' | 'central:<k>').
 */
export function completarActivacion(partida, { origen, personaje, usarAsterisco = false }) {
  if (String(origen).startsWith('central:')) {
    // `usarAsterisco` solo cuenta si la jugadora tiene a la vez Gemas de 1 y
    // una de asterisco: preguntarlo es cosa de la interfaz, no del motor.
    pagarActivacionPortalCentral(partida.players[partida.turn], { usarAsterisco });
  }
  partida.habilidadUsadaEsteTurno = true;
  return [{ tipo: 'habilidadAplicada', jugadora: partida.turn, origen, personaje }];
}
