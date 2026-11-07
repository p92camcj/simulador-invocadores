// js/vista-mesa.js
//
// Modelo de la vista "Mesa 3D" (js/mesa3d.js): traduce `estado.partida` a lo
// que cada asiento de la mesa ENSEÑA en la pantalla compartida. Puro: sin
// DOM ni `window`, se prueba en Node (tests/vista-mesa.mjs).
//
// Regla de oro (la misma que render.js): una carta que quien mira no puede
// ver sale con `nombre: null`, así que el nombre de una carta oculta nunca
// llega al DOM.

import { LEVELS, INVOCATION_SETS, sumaGemas } from './utils.js';

/**
 * Carta tal y como se enseña: nombre solo si es visible. Un Metamorfo
 * transformado se enseña como en la mesa real: la carta del Metamorfo con
 * la ficha del personaje encima (`ficha`), no como si fuera ese personaje.
 * `apariencia` es lo que cuenta para la invocación (aspecto || name).
 */
function cartaVista(carta, visible) {
  if (!carta) return null;
  if (!visible) return { visible: false, nombre: null };
  const vista = { visible: true, nombre: carta.name, apariencia: carta.aspecto || carta.name };
  if (carta.aspecto && carta.aspecto !== carta.name) vista.ficha = carta.aspecto;
  return vista;
}

/** Un Portal: carta de arriba (si es pública) y altura de la pila. */
function portalVista(pila) {
  const top = pila.at(-1);
  return {
    altura: pila.length,
    top: top ? cartaVista(top, top.vis?.public === true) : null,
  };
}

/**
 * Gemas por nivel (lo que es público) y, si `exacto`, el total real. Con
 * `bocarriba` (partida terminada) se enseñan también todas, con su valor.
 */
function gemasVista(gems, exacto, bocarriba = false) {
  const porNivel = { unitaria: 0, C: 0, B: 0, A: 0 };
  gems.forEach(g => { if (g.nivel in porNivel) porNivel[g.nivel]++; });
  const reveladas = gems.filter(g => g.esAsterisco && g.revelada).map(g => g.valor);
  return {
    cantidad: gems.length,
    porNivel,
    reveladas,
    total: exacto || bocarriba ? sumaGemas(gems) : null,
    valores: bocarriba
      ? [...gems].sort((a, b) => a.valor - b.valor).map(g => ({ valor: g.valor, nivel: g.nivel, esAsterisco: !!g.esAsterisco }))
      : null,
  };
}

/** Número de jugadoras humanas en la partida. */
export function contarHumanas(players) {
  return players.filter(p => p.tipo !== 'auto').length;
}

/**
 * Qué asiento va abajo (el "tuyo"): la jugadora activa si es humana; si
 * juega una autómata, la última humana que tuvo el turno (o la primera
 * humana); sin humanas, la activa. Así, contra autómatas la humana no se
 * mueve de su sitio.
 */
export function elegirAsientoPropio(players, turno, ultimaHumana = null) {
  if (players[turno] && players[turno].tipo !== 'auto') return turno;
  if (ultimaHumana !== null && players[ultimaHumana] && players[ultimaHumana].tipo !== 'auto') return ultimaHumana;
  const primera = players.findIndex(p => p.tipo !== 'auto');
  return primera >= 0 ? primera : turno;
}

/**
 * ¿Ve el asiento propio sus cartas "de dueña"? Solo una humana, y solo en
 * su turno... salvo que sea la única humana de la partida: entonces no hay
 * nadie más mirando la pantalla a quien ocultárselas.
 */
function veComoDuena(players, idx, turno) {
  const p = players[idx];
  if (!p || p.tipo === 'auto') return false;
  return idx === turno || contarHumanas(players) === 1;
}

/** Mano vista por su dueña (igual que render.js para la activa humana). */
function manoDeDuena(p) {
  return p.hand.map(c => cartaVista(c, !!(c.vis?.owner || p.hasClariActivo)));
}

/** Mano vista por el resto (Clarividente visible: la oculta entera). */
function manoAjena(p) {
  return p.hand.map(c => cartaVista(c, !p.hasClariActivo && c.vis?.others === true));
}

/** Recuento de la invocación activa, por apariencia (como actions/render). */
export function estadoInvocacion(partida) {
  const nivel = LEVELS[partida.levelIdx];
  if (!nivel) return null;
  const inv = INVOCATION_SETS[partida.invocationSet][nivel];
  const cuenta = {};
  inv.need.forEach(n => { cuenta[n] = 0; });
  const contar = pila => {
    const top = pila.at(-1);
    if (top && top.vis?.public) {
      const n = top.aspecto || top.name;
      if (n in cuenta) cuenta[n]++;
    }
  };
  partida.players.forEach(p => p.portals.forEach(contar));
  partida.neutrals.forEach(contar);
  return {
    nivel,
    nombre: inv.nombre,
    requeridos: inv.need.map(n => ({
      nombre: n,
      estado: cuenta[n] === 0 ? 'falta' : cuenta[n] === 1 ? 'esta' : 'repetido',
    })),
  };
}

/**
 * Vista completa de la mesa desde el asiento `asientoPropio`.
 * Los rivales salen en orden de turno a partir del asiento propio.
 */
export function construirVistaMesa(partida, { asientoPropio }) {
  const { players, neutrals, turn } = partida;
  const n = players.length;
  const duena = veComoDuena(players, asientoPropio, turn);
  // Al terminar la partida se ponen bocarriba las Gemas de todas.
  const terminada = !!partida.juegoTerminado;

  const asiento = idx => {
    const p = players[idx];
    const comoDuena = idx === asientoPropio && duena;
    return {
      idx,
      nombre: p.name,
      automata: p.tipo === 'auto',
      activa: idx === turn,
      clarividente: !!p.hasClariActivo,
      gemas: gemasVista(p.gems, comoDuena, terminada),
      portales: p.portals.map(portalVista),
      mano: comoDuena ? manoDeDuena(p) : manoAjena(p),
      comoDuena,
    };
  };

  const rivales = [];
  for (let k = 1; k < n; k++) rivales.push(asiento((asientoPropio + k) % n));

  return {
    turno: turn,
    activa: { idx: turn, nombre: players[turn]?.name, automata: players[turn]?.tipo === 'auto' },
    mazo: partida.deck.length,
    jugada: !!partida.played,
    habilidadUsada: !!partida.habilidadUsadaEsteTurno,
    cronomantePendiente: !!partida.cronomantePortalInvestigado,
    terminada,
    invocacion: estadoInvocacion(partida),
    propio: asiento(asientoPropio),
    rivales,
    centrales: neutrals.map(portalVista),
  };
}

/**
 * Clave de destino para jugar una carta en un Portal, desde la jugadora
 * activa (formato de jugarCarta: 'p:j' propio, 'a:i:j' ajeno, 'n:k' central).
 */
export function claveJugar(turno, idxJugadora, idxPortal) {
  return idxJugadora === turno ? `p:${idxPortal}` : `a:${idxJugadora}:${idxPortal}`;
}

/** Clave de objetivo de habilidad (formato de portalesConEstado). */
export function claveObjetivo(idxJugadora, idxPortal) {
  return idxJugadora === null ? `n:${idxPortal}` : `${idxJugadora}:${idxPortal}`;
}

/**
 * Firma de lo que se ve en un Portal, para detectar cambios entre dos
 * pintados y animarlos. Solo usa información pública.
 */
export function firmaPortal(pv) {
  if (!pv.top) return '0';
  return `${pv.altura}|${pv.top.visible ? pv.top.nombre : '?'}|${pv.top.ficha || ''}`;
}

/**
 * Tipo de cambio entre dos firmas de Portal: 'entra' (carta nueva arriba),
 * 'voltea' (misma altura, cambia lo visible), 'sale' (baja la pila) o null.
 */
export function cambioPortal(antes, ahora) {
  if (antes === undefined || antes === ahora) return null;
  const alt = f => (f === '0' ? 0 : parseInt(f, 10));
  const a = alt(antes), b = alt(ahora);
  if (b > a) return 'entra';
  if (b < a) return 'sale';
  // Misma carta visible, solo cambia la ficha: el Metamorfo se transforma.
  const [, n1, f1] = antes.split('|');
  const [, n2, f2] = ahora.split('|');
  if (n1 === n2 && n1 !== '?' && f1 !== f2) return 'transforma';
  return 'voltea';
}

/** Texto de ayuda contextual de la barra de acciones. */
export function pistaTurno(vista, { haySeleccion, eligiendoObjetivo }) {
  if (vista.terminada) return 'La partida ha terminado';
  if (vista.activa.automata) return `${vista.activa.nombre} está pensando…`;
  if (eligiendoObjetivo) return 'Toca el Portal objetivo (los válidos brillan)';
  if (!vista.jugada) {
    return haySeleccion ? 'Toca un Portal para jugarla, o arrástrala' : 'Elige una carta de tu mano';
  }
  if (vista.cronomantePendiente) return 'Termina la investigación del Cronomante';
  if (!vista.habilidadUsada) return 'Puedes activar una habilidad o terminar el turno';
  return 'Termina tu turno';
}
