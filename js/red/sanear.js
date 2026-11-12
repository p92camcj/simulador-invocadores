// js/red/sanear.js
//
// Juego online (ver js/red/sala.js): qué parte de la partida recibe cada
// dispositivo. El dispositivo que hace de mesa (la anfitriona) tiene la
// partida entera; a cada invitada le manda una copia en la que todo lo que
// su asiento no puede ver está tapado. Así, ni mirando las herramientas del
// navegador se puede ver la mano ni las Gemas de las demás.
//
// Mismas reglas de visibilidad que js/vista-mesa.js, pero sobre el estado
// de partida completo, para que la invitada pueda pintar la Mesa y el
// Escenario con el mismo código que la anfitriona.
//
// Puro: sin DOM ni `window` (tests en tests/red.mjs).

/** Carta tapada: se conserva solo lo público (su visibilidad), nunca el nombre. */
function tapar(carta) {
  return { name: null, oculta: true, vis: { ...(carta?.vis || {}) } };
}

/** ¿Ve el asiento `asiento` esta carta de la mano de `players[idx]`? */
function cartaDeManoVisible(jugadora, idx, carta, asiento) {
  if (idx === asiento) return !!(carta.vis?.owner || jugadora.hasClariActivo);
  return !jugadora.hasClariActivo && carta.vis?.others === true;
}

/** Gemas de otra jugadora: se ve cuántas hay y de qué invocación, no su valor. */
function taparGemas(gems) {
  return gems.map(g => {
    if (g.esAsterisco && g.revelada) return { ...g };
    if (g.nivel === 'unitaria') return { valor: 1, nivel: 'unitaria', ...(g.inicial ? { inicial: true } : {}) };
    return { valor: null, nivel: g.nivel };
  });
}

/**
 * Copia de `partida` tal como la puede conocer el asiento `asiento`.
 * - Manos: solo las cartas que ese asiento ve (su carta visible, o las dos
 *   con la Clarividente; de las demás, la carta que tienen a la vista).
 * - Portales: solo la carta de arriba si está bocarriba.
 * - Mazo: solo cuántas cartas quedan.
 * - Gemas ajenas y de la autómata central: sin valor, hasta el final.
 * - Nada de la memoria de las autómatas ni de los identificadores de red.
 */
export function sanearPartidaParaAsiento(partida, asiento) {
  const copia = JSON.parse(JSON.stringify(partida));
  const terminada = !!copia.juegoTerminado;
  copia.players.forEach((jugadora, idx) => {
    jugadora.hand = (jugadora.hand || []).map(c => (cartaDeManoVisible(jugadora, idx, c, asiento) ? c : tapar(c)));
    jugadora.portals = (jugadora.portals || []).map(taparPila);
    if (idx !== asiento && !terminada) jugadora.gems = taparGemas(jugadora.gems || []);
    delete jugadora.idRed;
  });
  copia.neutrals = (copia.neutrals || []).map(taparPila);
  copia.deck = (copia.deck || []).map(() => ({ name: null, oculta: true }));
  copia.memoriaBots = [];
  if (copia.automataCentral && !terminada) {
    copia.automataCentral = { ...copia.automataCentral, gems: taparGemas(copia.automataCentral.gems || []) };
  }
  return copia;
}

function taparPila(pila) {
  return pila.map((c, k) => (k === pila.length - 1 && c.vis?.public === true ? c : tapar(c)));
}
