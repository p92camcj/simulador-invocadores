// bot-busqueda.js
// Dificultad 'experta' de las autómatas: búsqueda del turno completo
// (Fase A + Fase B) simulando con el motor de reglas real (js/motor/) sobre
// "mundos posibles". Es la técnica que la literatura llama determinización
// o PIMC (Perfect Information Monte Carlo):
//
// 1. Se generan K mundos posibles (`determinizar`): copias de la partida en
//    las que todo lo que la autómata NO puede saber (su propia carta oculta,
//    la carta privada de cada rival, el orden y contenido del mazo, el valor
//    de las Gemas ajenas) se rellena al azar de forma coherente con lo que
//    sí sabe. Lo que sí sabe es lo que ve cualquiera en la mesa: todas las
//    cartas de los Portales (todas se jugaron boca arriba en algún momento),
//    las cartas de mano que el resto ve y su propia carta conocida.
// 2. En cada mundo se prueba cada jugada de Fase A seguida de cada Fase B
//    posible (ninguna, o cada habilidad con cada combinación de objetivos),
//    se termina el turno con el motor (reponer manos, comprobar invocación,
//    repartir Gemas) y se puntúa el resultado.
// 3. Se elige la jugada de Fase A con mejor media entre mundos (contando en
//    cada mundo su mejor Fase B). Tras jugarla de verdad, se repite para
//    elegir la Fase B con la mesa ya actualizada.
//
// Antitrampa: la ÚNICA función que recibe la partida real es
// `determinizar()`, y lo primero que hace es copiar y sobrescribir todo lo
// oculto. Los tests comprueban que dos partidas que solo difieren en
// información oculta producen exactamente los mismos mundos.

import { aplicarHabilidad } from './motor/habilidades.js';
import { jugarCarta, terminarTurno, pasarTurno, completarActivacion, invocacionActiva } from './motor/acciones.js';
import {
  composicionMazoTotal, sumaGemas, tieneClarividenteVisible, opcionesActivarHabilidad,
  todosLosPortales, shuffle, nivelesPartida, datosInvocacion,
} from './utils.js';
import {
  PESOS, tableroDesdeVista, valorPosicional, valorAmenazaSiguiente,
} from './bot-estrategia.js';

// Presupuesto de búsqueda (ajustable desde tools/arena.mjs).
// - mundos: cuántos mundos posibles se generan por decisión.
// - ronda: 1 = tras el turno propio se simula el turno de cada rival hasta
//   que vuelve a tocarle a la autómata (ver puntuarRonda); 0 = solo el
//   turno propio.
// - rival: PESOS.rival mientras decide la 'experta'. Con 0,5 juega igual de
//   fuerte que con 0,75 pero cierra más invocaciones (partidas más vivas).
export const BUSQUEDA = { mundos: 8, ronda: 1, rival: 0.5 };

const clonar = obj => JSON.parse(JSON.stringify(obj));

/** ¿Conoce la autómata `botIdx` la identidad de esta carta de la mano de `duenaIdx`? */
function cartaDeManoConocida(carta, duenaIdx, botIdx, partida) {
  if (duenaIdx === botIdx) return carta.vis?.owner === true;
  return carta.vis?.others === true && !tieneClarividenteVisible(partida.players[duenaIdx]);
}

/**
 * Un mundo posible para la autómata `botIdx`: copia de `partida` donde las
 * cartas que no conoce (su carta oculta, las privadas de las rivales, el
 * mazo) se reparten al azar entre las cartas que le faltan por ver, y las
 * Gemas ajenas pasan a valer la media de su nivel. Nada de lo oculto de la
 * partida real sobrevive en la copia.
 */
export function determinizar(partida, botIdx) {
  // El historial de jugadas es solo para personas: no se copia a cada mundo.
  const mundo = clonar({ ...partida, historial: [] });
  mundo.memoriaBots = [];

  // Cartas que la autómata conoce: todas las de los Portales y las de mano
  // que ve. El resto de la composición pública del mazo está "por ver".
  const porVer = { ...composicionMazoTotal(mundo) };
  const restar = nombre => { if (porVer[nombre] > 0) porVer[nombre]--; };
  todosLosPortales(mundo.players, mundo.neutrals).forEach(({ stack }) => stack.forEach(c => restar(c.name)));
  // Cartas sacadas del mazo como requisito (solo en el análisis de
  // equilibrio, tools/equilibrio.mjs): están bocarriba, se conocen.
  (mundo.cartasRequisito || []).forEach(restar);

  const huecos = [];
  mundo.players.forEach((p, i) => {
    p.hand.forEach(c => {
      if (cartaDeManoConocida(c, i, botIdx, mundo)) restar(c.name);
      else huecos.push(c);
    });
  });
  mundo.deck.forEach(c => huecos.push(c));

  // Se sacan al azar tantas cartas "por ver" como huecos haya (sobran las 2
  // que se apartaron al empezar, que nadie sabe cuáles son).
  const bolsa = Object.entries(porVer).flatMap(([nombre, n]) => Array(n).fill(nombre));
  shuffle(bolsa);
  const todos = Object.keys(porVer);
  huecos.forEach((c, k) => {
    // Nunca se conserva el nombre real: si faltaran cartas en la bolsa (no
    // debería), se usa un personaje cualquiera de la composición.
    c.name = bolsa[k] ?? todos[Math.floor(Math.random() * todos.length)];
    delete c.aspecto;
  });
  shuffle(mundo.deck);

  // Valor de las Gemas ajenas: solo se sabe el nivel (y el de las reveladas).
  const medias = {};
  nivelesPartida(mundo).forEach(nivel => {
    const { gemas } = datosInvocacion(mundo, nivel);
    medias[nivel] = gemas.reduce((a, b) => a + b, 0) / gemas.length;
  });
  const ocultarValores = gems => gems.forEach(g => {
    if (g.revelada || g.nivel === 'unitaria') return;
    if (medias[g.nivel] !== undefined) g.valor = medias[g.nivel];
    g.esAsterisco = false;
  });
  mundo.players.forEach((p, i) => { if (i !== botIdx) ocultarValores(p.gems); });
  // Las Gemas de la autómata central (Modo Experto) tampoco se ven.
  if (mundo.automataCentral) ocultarValores(mundo.automataCentral.gems);
  return mundo;
}

/** Índice de la carta conocida / oculta de la mano de `botIdx`. */
function indiceCarta(mano, usaConocida) {
  return usaConocida ? mano.findIndex(c => c.vis?.owner === true) : mano.findIndex(c => c.vis?.owner !== true);
}

/** Pila real (en `partida`) de un origen de habilidad 'own:j' / 'central:k'. */
function pilaDeOrigen(partida, botIdx, origen) {
  const [tipo, i] = origen.split(':');
  return tipo === 'own' ? partida.players[botIdx].portals[+i] : partida.neutrals[+i];
}

/**
 * Aplica sobre `partida` la habilidad del origen `origen` siguiendo el
 * guion de elecciones `guion` (valores). Si una petición pide más pasos de
 * los que trae el guion, anota cuántas opciones tenía en `descubrir` y
 * elige la primera, para que el enumerador pueda generar las hermanas.
 * Devuelve false si el guion no es aplicable en este mundo.
 */
export function aplicarConGuion(partida, botIdx, origen, guion, descubrir) {
  const pila = pilaDeOrigen(partida, botIdx, origen);
  const personaje = pila?.at(-1)?.name;
  if (!personaje) return false;
  let paso = 0;
  let valido = true;
  const ui = {
    pedir(peticion, responder, cancelar) {
      const opciones = peticion.opciones.filter(o => !o.disabled);
      if (paso < guion.length) {
        const elegida = opciones.find(o => String(o.val) === String(guion[paso]));
        paso++;
        if (!elegida) { valido = false; cancelar?.(); return; }
        responder(elegida.val);
        return;
      }
      if (!opciones.length) { valido = false; cancelar?.(); return; }
      descubrir?.push(opciones.map(o => String(o.val)));
      paso++;
      responder(opciones[0].val);
    },
    avisar() { valido = false; },
  };
  let aplicada = false;
  aplicarHabilidad(partida, { personaje, jugadora: botIdx, pila }, ui, () => {
    aplicada = true;
    completarActivacion(partida, { origen, personaje, usarAsterisco: false });
  });
  partida.cronomantePortalInvestigado = null;
  return valido && aplicada;
}

/**
 * Todas las Fases B posibles en `partida` (ya con la carta de Fase A
 * jugada): `[{ origen, guion }]`, más la opción de no activar nada
 * (`null`). Recorre el árbol de elecciones de cada habilidad probando en
 * copias desechables.
 */
export function enumerarFasesB(partida, botIdx) {
  const acciones = [null];
  if (partida.habilidadUsadaEsteTurno) return acciones;
  opcionesActivarHabilidad(botIdx, partida.players, partida.neutrals).forEach(({ val: origen }) => {
    const pendientes = [[]];
    let guard = 0;
    while (pendientes.length && guard++ < 200) {
      const guion = pendientes.pop();
      const descubrir = [];
      const ok = aplicarConGuion(clonar(partida), botIdx, origen, guion, descubrir);
      if (descubrir.length) {
        // Hermanas del primer paso nuevo; el resto se descubrirá al probarlas.
        descubrir[0].forEach(v => pendientes.push([...guion, v]));
      } else if (ok) {
        acciones.push({ origen, guion });
      }
    }
  });
  return acciones;
}

/**
 * Puntuación, para `botIdx`, de un mundo al terminar su turno (`despues`)
 * respecto al de antes (`antes`): Gemas ganadas por la autómata menos
 * PESOS.rival × las de la rival que más gane, más el valor de posición y
 * la amenaza de la siguiente jugadora (js/bot-estrategia.js) sobre la mesa
 * que queda.
 */
export function puntuarMundo(antes, despues, botIdx, construirVista, probabilidadPorNombre) {
  const delta = despues.players.map((p, i) => sumaGemas(p.gems) - sumaGemas(antes.players[i].gems));
  const rivales = delta.filter((_, i) => i !== botIdx);
  let valor = delta[botIdx] - PESOS.rival * (rivales.length ? Math.max(...rivales) : 0);
  if (despues.juegoTerminado) return valor;

  const inv = invocacionActiva(despues);
  if (!inv) return valor;
  const valorGemaNivel = inv.gemas.reduce((a, b) => a + b, 0) / inv.gemas.length;
  const vista = construirVista(despues.players, despues.neutrals, botIdx);
  const tablero = tableroDesdeVista(vista);
  const n = despues.players.length;
  valor += valorPosicional(tablero, inv.need, valorGemaNivel, n, botIdx);
  valor += valorAmenazaSiguiente(tablero, inv.need, valorGemaNivel, n, botIdx, (botIdx + 1) % n, probabilidadPorNombre);
  return valor;
}

/** Valor de terminar el turno en `mundo` tras aplicar la Fase B `accionB` (o ninguna). */
function valorTrasFaseB(mundo, botIdx, accionB, construirVista, probabilidadPorNombre, antes, guardar) {
  const copia = clonar(mundo);
  if (accionB && !aplicarConGuion(copia, botIdx, accionB.origen, accionB.guion)) return null;
  terminarTurno(copia);
  if (guardar) guardar.mundo = copia;
  return puntuarMundo(antes, copia, botIdx, construirVista, probabilidadPorNombre);
}

/**
 * Simula, en un mundo donde la autómata ya ha terminado su turno, el turno
 * de cada rival hasta que vuelve a tocarle (o se acaba la partida). Cada
 * rival juega con `jugarRival(mundo, idx)` (una heurística rápida, con la
 * información que esa rival tiene en este mundo). Devuelve la puntuación,
 * para `botIdx`, de toda la ronda respecto a `antes`: así la autómata ve
 * qué hará cada rival con la mesa que le deja (cerrar la invocación, tapar
 * un requisito, gastar Gemas...) en vez de suponerlo.
 */
function puntuarRonda(antes, mundo, botIdx, jugarRival) {
  const n = mundo.players.length;
  let guard = 0;
  while (!mundo.juegoTerminado && guard++ < n) {
    pasarTurno(mundo);
    if (mundo.juegoTerminado || mundo.turn === botIdx) break;
    jugarRival(mundo, mundo.turn);
    if (!mundo.played) break;
    terminarTurno(mundo);
  }
  const delta = mundo.players.map((p, i) => sumaGemas(p.gems) - sumaGemas(antes.players[i].gems));
  const rivales = delta.filter((_, i) => i !== botIdx);
  let valor = delta[botIdx] - PESOS.rival * (rivales.length ? Math.max(...rivales) : 0);
  if (mundo.juegoTerminado) return valor;
  const inv = invocacionActiva(mundo);
  if (!inv) return valor;
  const valorGemaNivel = inv.gemas.reduce((a, b) => a + b, 0) / inv.gemas.length;
  const tablero = tableroDesdeVistaReal(mundo, botIdx);
  valor += valorPosicional(tablero, inv.need, valorGemaNivel, n, botIdx);
  return valor;
}

/** Tablero simplificado (formato de bot-estrategia.js) de un mundo ya determinizado. */
function tableroDesdeVistaReal(mundo, botIdx) {
  const tablero = [];
  const cima = s => (s.length && s.at(-1).vis?.public) ? (s.at(-1).aspecto || s.at(-1).name) : null;
  mundo.players.forEach((p, i) => p.portals.forEach((s, k) => {
    const nombre = cima(s);
    tablero.push({ destKey: i === botIdx ? `p:${k}` : `a:${i}:${k}`, dueña: i, nombre, bloqueado: !nombre });
  }));
  mundo.neutrals.forEach((s, k) => {
    const nombre = cima(s);
    tablero.push({ destKey: `n:${k}`, dueña: null, nombre, bloqueado: !nombre });
  });
  return tablero;
}

/**
 * Elige la jugada de Fase A. `candidatas` = `[{ usaConocida, destKey }]`.
 * Devuelve la candidata con mejor media (entre mundos) del mejor turno
 * posible tras ella, con su `valor`.
 */
export function elegirFaseAExperta(partida, botIdx, candidatas, construirVista, probabilidadPorNombre, jugarRival) {
  const mundos = Array.from({ length: BUSQUEDA.mundos }, () => determinizar(partida, botIdx));
  const totales = candidatas.map(() => 0);
  const conRonda = BUSQUEDA.ronda && jugarRival;
  mundos.forEach(mundo => {
    candidatas.forEach((cand, ci) => {
      const tras = clonar(mundo);
      const idx = indiceCarta(tras.players[botIdx].hand, cand.usaConocida);
      if (idx < 0) { totales[ci] -= 1e6; return; }
      jugarCarta(tras, { cartaIdx: idx, destino: cand.destKey });
      let mejor = -Infinity;
      let mejorMundo = null;
      enumerarFasesB(tras, botIdx).forEach(accionB => {
        const guardar = conRonda ? {} : null;
        const v = valorTrasFaseB(tras, botIdx, accionB, construirVista, probabilidadPorNombre, mundo, guardar);
        if (v !== null && v > mejor) { mejor = v; mejorMundo = guardar?.mundo; }
      });
      totales[ci] += conRonda && mejorMundo ? puntuarRonda(mundo, mejorMundo, botIdx, jugarRival) : mejor;
    });
  });
  let mejorIdx = 0;
  totales.forEach((t, i) => { if (t > totales[mejorIdx] + 1e-9) mejorIdx = i; });
  return { ...candidatas[mejorIdx], valor: totales[mejorIdx] / mundos.length };
}

/**
 * Elige la Fase B con la carta de Fase A ya jugada en la partida real.
 * Devuelve `null` (no activar) o `{ origen, guion, valor }`.
 */
export function elegirFaseBExperta(partida, botIdx, construirVista, probabilidadPorNombre) {
  const mundos = Array.from({ length: BUSQUEDA.mundos }, () => determinizar(partida, botIdx));
  const acciones = enumerarFasesB(mundos[0], botIdx);
  if (acciones.length === 1) return null;
  const totales = acciones.map(() => 0);
  mundos.forEach(mundo => {
    const base = valorTrasFaseB(mundo, botIdx, null, construirVista, probabilidadPorNombre, mundo);
    acciones.forEach((a, i) => {
      const v = a ? valorTrasFaseB(mundo, botIdx, a, construirVista, probabilidadPorNombre, mundo) : base;
      totales[i] += v === null ? base : v;
    });
  });
  let mejorIdx = 0;
  totales.forEach((t, i) => { if (t > totales[mejorIdx] + 1e-9) mejorIdx = i; });
  return acciones[mejorIdx] ? { ...acciones[mejorIdx], valor: totales[mejorIdx] / mundos.length } : null;
}
