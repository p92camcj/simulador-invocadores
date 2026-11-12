import { VARIANTES } from './motor/variantes.js';

// utils.js
// ---------- Constantes generales ----------
export const LEVELS = ['C', 'B', 'A'];

// Sets de invocación con nombre (ver docs/reglamento/REGLAMENTO.md, "Preparación" > "Invocaciones").
// Cada nivel indica el nombre de la criatura, los personajes requeridos y los
// 5 valores de Gema asociados (el valor más bajo es siempre la Gema "asterisco").
export const INVOCATION_SETS = {
  introductorio: {
    C: { nombre: 'Cilast', need: ['Reena', 'Pícaro', 'Sora'], gemas: [2, 3, 3, 3, 4] },
    B: { nombre: 'Burnio', need: ['Aprendiz', 'Cronista', 'Lumo'], gemas: [5, 6, 6, 6, 7] },
    A: { nombre: 'Aspir', need: ['Cronomante', 'Estratega', 'Sora'], gemas: [8, 9, 9, 9, 10] },
  },
  normal: {
    C: { nombre: 'Cirelia', need: ['Aprendiz', 'Pícaro', 'Centinela'], gemas: [2, 3, 3, 3, 4] },
    B: { nombre: 'Baelorith', need: ['Estratega', 'Cronomante', 'Cronista'], gemas: [5, 6, 6, 6, 7] },
    A: { nombre: 'Aelgorth', need: ['Clarividente', 'Maestro', 'Ocultista'], gemas: [8, 9, 9, 9, 10] },
  },
  floral: {
    C: { nombre: 'Caisis', need: ['Cronista', 'Ocultista', 'Centinela'], gemas: [2, 3, 3, 3, 4] },
    B: { nombre: 'Brose', need: ['Aprendiz', 'Maestro', 'Estratega'], gemas: [5, 6, 6, 6, 7] },
    A: { nombre: 'Aures', need: ['Pícaro', 'Clarividente', 'Cronomante'], gemas: [8, 9, 9, 9, 10] },
  },
};

// Cuarta invocación ("Asterisco", Madain): obligatoria en Modo Experto y
// opcional en Modo Avanzado (REGLAMENTO.md, "Modo experto"). Nivel '*'.
// El Metamorfo debe estar SIN transformar: como se compara por apariencia
// (`aspecto || name`), un Metamorfo transformado ya no cuenta como tal.
export const INVOCATION_ASTERISCO = {
  nombre: 'Madain',
  need: ['Reena', 'Metamorfo', 'Sora', 'Lumo'],
  gemas: [11, 12, 12, 12, 13],
};
export const NIVEL_ASTERISCO = '*';
// Niveles cuyas Gemas cuentan como "invocación" en el desempate final.
export const NIVELES_CON_GEMAS = [...LEVELS, NIVEL_ASTERISCO];

// Personajes cuya habilidad se activa manualmente en la Fase B del turno
// (ver docs/reglamento/REGLAMENTO.md, "Secuencia del turno"). Centinela y
// Clarividente quedan fuera a propósito: sus efectos son pasivos/automáticos.
export const PERSONAJES_CON_HABILIDAD = ['Ocultista', 'Cronista', 'Cronomante', 'Estratega', 'Aprendiz', 'Metamorfo', 'Maestro'];

// Roster de personajes NO animales del mazo base ("Modo normal", ver
// docs/reglamento/REGLAMENTO.md, "Preparación del mazo de personajes").
// Lo usa game.js para construir el mazo (junto con las cantidades por
// personaje) y abilities.js (case 'Metamorfo') para saber en qué personajes
// puede transformarse — el Metamorfo puede imitar a cualquiera de estos,
// independientemente de si esa carta sigue en el mazo, está en juego, o fue
// una de las 2 apartadas al azar (sin mirar) al preparar la partida.
export const PERSONAJES_NO_ANIMALES = [
  'Maestro', 'Clarividente', 'Ocultista', 'Cronomante', 'Estratega',
  'Cronista', 'Aprendiz', 'Centinela', 'Pícaro', 'Metamorfo'
];

// Cantidades reales de "Modo normal" (docs/reglamento/REGLAMENTO.md,
// "Preparación del mazo de personajes"): 32 cartas repartidas entre los 10
// personajes no-animales. Única fuente — antes vivía como literal duplicado
// dentro de `initGame()` (`game.js`); ahora también la usa
// `composicionMazoTotal()` (más abajo), necesaria para el motor
// probabilístico del autómata en dificultad 'dificil' (`js/bot-probabilidad.js`),
// que necesita saber cuántas copias de cada personaje existen en total en el
// mazo configurado — dato público de las reglas, no supone ninguna trampa.
export const CANTIDADES_MODO_NORMAL = {
  Maestro: 2, Clarividente: 2, Ocultista: 2, Cronomante: 3, Estratega: 3,
  Cronista: 4, Aprendiz: 4, Centinela: 4, 'Pícaro': 6, Metamorfo: 2,
};

// Cantidades de los 3 Animales (Reena/Sora/Lumo).
export const CANTIDADES_ANIMALES = { Reena: 3, Sora: 3, Lumo: 3 };

// Mazo del Modo introductorio: 29 cartas (REGLAMENTO.md, "Preparación del
// mazo de personajes"; copias confirmadas por Julio el 2026-11-07).
export const CANTIDADES_MODO_INTRODUCTORIO = {
  ...CANTIDADES_ANIMALES,
  'Pícaro': 6, Aprendiz: 4, Cronista: 4, Estratega: 3, Cronomante: 3,
};

// Expansión: los 2 Entusiastas.
export const CANTIDADES_ENTUSIASTA = { Entusiasta: 2 };

/**
 * Modos de juego (REGLAMENTO.md, "Preparación" y "Variantes y modos de
 * juego"; dudas resueltas por Julio el 2026-11-07):
 * - `sets`: sets de invocación que se pueden completar con ese mazo.
 * - `apartar`: cartas que se sacan al azar sin mirar y no juegan.
 * - `madain`: 'nunca' | 'opcional' | 'siempre' (cuarta invocación).
 * - `automata`: autómata central que cobra lo de los Portales centrales.
 */
export const MODOS_JUEGO = {
  introductorio: {
    nombre: 'Introductorio', sets: ['introductorio'], apartar: 0, madain: 'nunca', automata: false,
    cantidades: CANTIDADES_MODO_INTRODUCTORIO,
    descripcion: 'Para aprender: 29 cartas sin habilidades complicadas.',
  },
  normal: {
    nombre: 'Normal', sets: ['normal', 'floral'], apartar: 2, madain: 'nunca', automata: false,
    cantidades: CANTIDADES_MODO_NORMAL,
    descripcion: 'Los 10 personajes sin Animales; se apartan 2 cartas al azar.',
  },
  avanzado: {
    nombre: 'Avanzado', sets: ['introductorio', 'normal', 'floral'], apartar: 2, madain: 'opcional', automata: false,
    cantidades: { ...CANTIDADES_MODO_NORMAL, ...CANTIDADES_ANIMALES },
    descripcion: 'Todas las cartas, Animales incluidos; se apartan 2 cartas al azar.',
  },
  experto: {
    nombre: 'Experto', sets: ['introductorio', 'normal', 'floral'], apartar: 0, madain: 'siempre', automata: true,
    cantidades: { ...CANTIDADES_MODO_NORMAL, ...CANTIDADES_ANIMALES },
    descripcion: 'Todas las cartas, Madain como cuarta invocación y una autómata central que también puntúa.',
  },
};

/**
 * Modo de una partida o configuración. Las partidas guardadas antes de que
 * existieran los modos solo traen `invocationSet`: el set introductorio
 * usaba el mazo completo con Animales (= Avanzado) y el resto el Normal.
 */
export function modoDe(cfg) {
  if (typeof cfg === 'string') return cfg === 'introductorio' ? 'avanzado' : 'normal';
  if (cfg?.modo && MODOS_JUEGO[cfg.modo]) return cfg.modo;
  return cfg?.invocationSet === 'introductorio' ? 'avanzado' : 'normal';
}

/**
 * Lo que necesitan saber el motor y las autómatas de la configuración de
 * una partida (sin nada oculto): nivel actual, set, modo y opciones.
 */
export function configPartida(partida) {
  return {
    levelIdx: partida.levelIdx,
    invocationSet: partida.invocationSet,
    modo: modoDe(partida),
    entusiasta: !!partida.entusiasta,
    madain: !!partida.madain,
  };
}

/** Niveles de invocación de la partida, en orden: C, B, A (y * si hay Madain). */
export function nivelesPartida(cfg) {
  return cfg && typeof cfg === 'object' && cfg.madain ? [...LEVELS, NIVEL_ASTERISCO] : LEVELS;
}

/** Datos ({ nombre, need, gemas }) de la invocación de nivel `nivel`. */
export function datosInvocacion(cfg, nivel) {
  if (nivel === NIVEL_ASTERISCO) return INVOCATION_ASTERISCO;
  const set = typeof cfg === 'string' ? cfg : cfg.invocationSet;
  return INVOCATION_SETS[set]?.[nivel];
}

/** Invocación activa ({ nivel, nombre, need, gemas }) o null si no queda. */
export function invocacionDePartida(cfg) {
  const nivel = nivelesPartida(cfg)[cfg.levelIdx];
  return nivel ? { nivel, ...datosInvocacion(cfg, nivel) } : null;
}

/**
 * Composición total del mazo configurado: `{ nombrePersonaje: cantidad }`
 * (incluye las cartas que se apartan al azar, que nadie sabe cuáles son).
 * Es dato público de las reglas: la usan `prepararMazo()` y el conteo de
 * cartas de las autómatas, así que nunca se desincronizan. `cfg` es la
 * partida, `configPartida(partida)` o, por compatibilidad, un set.
 */
export function composicionMazoTotal(cfg) {
  const modo = MODOS_JUEGO[modoDe(cfg)];
  const conEntusiasta = typeof cfg === 'object' && cfg?.entusiasta;
  return { ...modo.cantidades, ...(conEntusiasta ? CANTIDADES_ENTUSIASTA : {}) };
}

/**
 * Mazo de robo de una partida nueva: la composición del modo (con los
 * Entusiastas si se juega con la expansión), barajada, y sin las cartas que
 * el modo aparta al azar. Los Entusiastas se barajan ANTES de apartar, así
 * que pueden quedarse fuera (Julio, 2026-11-07). Devuelve [{ name }].
 */
export function prepararMazo(cfg) {
  const nombres = Object.entries(composicionMazoTotal(cfg))
    .flatMap(([name, cantidad]) => Array(cantidad).fill(name));
  shuffle(nombres);
  nombres.splice(0, MODOS_JUEGO[modoDe(cfg)].apartar);
  return nombres.map(name => ({ name }));
}

// ---------- Iconos de personajes ----------
export const iconos = {
  'Pícaro': '💎',
  'Centinela': '🛡️',
  'Aprendiz': '📘',
  'Cronomante': '⏳',
  'Estratega': '🚪',
  'Cronista': '✍️',
  'Clarividente': '🔮',
  'Maestro': '🧙‍♂️',
  'Ocultista': '🙈',
  'Metamorfo': '🌈',
  'Reena': '🐿️',
  'Sora': '🦋',
  'Lumo': '🐦'
};
// Muestra la APARIENCIA de la carta (card.aspecto si el Metamorfo está
// transformado, si no card.name) — ver DEUDA_TECNICA.md ítem 14: lo que se
// enseña en pantalla sigue al disfraz, nunca a la identidad real.
export const mostrarCarta = card => {
  const nombre = card.aspecto || card.name;
  return `${iconos[nombre] || ''} ${nombre}`;
};

// ---------- Imágenes de cartas ----------
// render.js resuelve la imagen a partir de card.aspecto || card.name (ítem
// 14 de DEUDA_TECNICA.md), así que un Metamorfo transformado ya muestra la
// imagen del personaje imitado. TODO (ver docs/MEJORAS_FUTURAS.md, "Metamorfo:
// representación visual de la transformación"): falta la insignia con
// transparencia que deje ver, a través de ella, que la carta base sigue
// siendo un Metamorfo — hoy no queda ningún rastro visual de eso.
export const cardImages = {
  'Maestro': 'assets/cards/maestro.png',
  'Clarividente': 'assets/cards/clarividente.png',
  'Ocultista': 'assets/cards/ocultista.png',
  'Cronomante': 'assets/cards/cronomante.png',
  'Estratega': 'assets/cards/estratega.png',
  'Cronista': 'assets/cards/cronista.png',
  'Aprendiz': 'assets/cards/aprendiz.png',
  'Centinela': 'assets/cards/centinela.png',
  'Pícaro': 'assets/cards/picaro.png',
  'Metamorfo': 'assets/cards/metamorfo.png',
  'Entusiasta': 'assets/cards/entusiasta.png',
  'Reena': 'assets/cards/reena.png',
  'Sora': 'assets/cards/sora.png',
  'Lumo': 'assets/cards/lumo.png',
};
export const CARTA_OCULTA_IMG = 'assets/cards/carta-oculta-reverso.png';

// ---------- Utilidades DOM y lógica básica ----------
export const $ = selector => document.querySelector(selector);

// Escapa texto de origen no confiable (p. ej. nombres de jugadora) antes de
// interpolarlo en una plantilla de string que se asigna vía innerHTML.
export function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function draw(player, visible, mazo = globalThis.window?.deck) {
  if (mazo && mazo.length) {
    const cartaDelMazo = mazo.shift();
    const vis = generarVis('mano', { origen: 'mazo', visible, esPropietaria: true });
    player.hand.push({ name: cartaDelMazo.name, vis });
  }
}

/**
 * Repone la mano de `player` a las 2 cartas habituales (una visible para su
 * dueña, una oculta) robando del mazo lo que falte. Misma lógica que ya usaba
 * `ejecutarFinDeTurno()` (`actions.js`, vía `terminarTurno()` del motor) al terminar el turno — centralizada
 * aquí porque la habilidad activa del Maestro (`abilities.js`, "la jugadora
 * afectada repone mano robando del mazo") necesita exactamente el mismo
 * comportamiento, no una copia con matices distintos.
 */
export function reponerManoSiFalta(player, mazo = globalThis.window?.deck) {
  if (player.hand.length >= 2) return;
  if (!player.hand.some(h => h.vis?.owner)) draw(player, true, mazo);
  if (player.hand.filter(h => !h.vis?.owner).length < 1) draw(player, false, mazo);
}

/**
 * Recorre todos los Portales del tablero (de cada jugadora + los
 * centrales/neutrales) y devuelve un array plano de
 * `{ stack, playerIdx, portalIdx }` — `playerIdx` es `null` para un Portal
 * neutral. Centraliza el patrón "players.forEach(p => p.portals.forEach(...))
 * seguido de neutrals.forEach(...)" repetido en varios sitios (ver
 * docs/DEUDA_TECNICA.md ítem 4).
 */
export function todosLosPortales(players, neutrals) {
  const arr = [];
  players.forEach((p, playerIdx) => {
    p.portals.forEach((stack, portalIdx) => {
      arr.push({ stack, playerIdx, portalIdx });
    });
  });
  neutrals.forEach((stack, portalIdx) => {
    arr.push({ stack, playerIdx: null, portalIdx });
  });
  return arr;
}

// ---------- Ficha de transformación del Metamorfo ----------
// REGLAMENTO.md, "Metamorfo" (confirmado por el dueño del proyecto,
// 2026-11-05): la transformación es una ficha con la cara del personaje
// colocada sobre la carta. Se mantiene solo mientras el Metamorfo siga
// visible en la cima de su Portal: en cuanto se tapa con otra carta, se
// pone bocabajo o sale del Portal, la ficha vuelve a la reserva y, si
// después se destapa (Cronista, Cronomante...), vuelve a ser un Metamorfo
// original. En el modelo de datos la ficha es `carta.aspecto`.

/** Devuelve la ficha de transformación a la reserva (borra `.aspecto`). */
export function retirarFichaMetamorfo(carta) {
  if (carta && 'aspecto' in carta) delete carta.aspecto;
}

/**
 * Apila `carta` encima de `stack`. Si la carta que queda tapada es un
 * Metamorfo transformado, pierde su ficha. Úsese para TODA carta que llegue
 * a la cima de un Portal tapando a otra (Fase A, Maestro, Cronomante...).
 */
export function apilarEnPortal(stack, carta) {
  retirarFichaMetamorfo(stack.at(-1));
  stack.push(carta);
}

/**
 * Personajes en los que puede transformarse `cartaMetamorfo`: cualquiera no
 * animal salvo el propio Metamorfo y salvo los que ya estén siendo imitados
 * por OTRO Metamorfo en mesa (cada ficha es única: dos Metamorfos no pueden
 * tener a la vez la misma transformación).
 */
export function transformacionesDisponiblesMetamorfo(players, neutrals, cartaMetamorfo) {
  const ocupadas = new Set();
  todosLosPortales(players, neutrals).forEach(({ stack }) => {
    stack.forEach(c => {
      if (c !== cartaMetamorfo && c.aspecto) ocupadas.add(c.aspecto);
    });
  });
  return PERSONAJES_NO_ANIMALES.filter(n => n !== 'Metamorfo' && !ocupadas.has(n));
}

export function listPortals(players, neutrals) {
  const arr = [];
  players.forEach((p, pi) => {
    p.portals.forEach((_, idx) => {
      arr.push({ val: `${pi}:${idx}`, lbl: `${p.name} P${idx + 1}` });
    });
  });
  neutrals.forEach((_, ni) => {
    arr.push({ val: `n:${ni}`, lbl: `Neutral ${ni + 1}` });
  });
  return arr;
}

export function stackFrom(key, players, neutrals) {
  const [p, q] = key.split(':');
  if (p === 'n') return neutrals[+q];
  return players[+p].portals[+q];
}


/**
 * Genera una lista de portales disponibles con su estado (habilitado o deshabilitado).
 * Se usa normalmente con picker() para mostrar opciones bloqueadas con 🚫.
 *
 * @param {Array} players - Lista de jugadoras
 * @param {Array} neutrals - Lista de portales neutrales
 * @param {Function} esInvalido - Función que recibe (stack, val) y devuelve true si debe estar deshabilitado
 * @returns {Array<{ val: string, lbl: string, disabled?: boolean }>}
 */
export function portalesConEstado(players, neutrals, esInvalido) {
  return listPortals(players, neutrals).map(({ val, lbl }) => {
    const st = stackFrom(val, players, neutrals);
    return {
      val,
      lbl,
      disabled: esInvalido(st, val)
    };
  });
}

/**
 * ¿Está esta jugadora protegida ahora mismo por una Centinela propia
 * visible? La protección cubre TODOS sus Portales, no solo el que
 * contiene la Centinela — ver REGLAMENTO.md, "Centinela" ("mientras una
 * Centinela esté visible en un Portal de un jugador, ninguna habilidad
 * puede afectar a sus Portales") y la FAQ de la variante a 2 jugadoras
 * ("protege ambos Portales del jugador"), que es un caso particular de
 * esta regla general, no una excepción aparte.
 */
export function jugadoraProtegidaPorCentinela(player) {
  return player.portals.some(
    st => st.length && st.at(-1).name === 'Centinela' && st.at(-1).vis?.public
  );
}

/**
 * ¿Es el Portal identificado por `stackKey` (formato de `listPortals`,
 * `"i:j"` para el Portal `j` de la jugadora `i`, o `"n:k"` para el Portal
 * central `k`) un objetivo INVÁLIDO para que `actingPlayerIdx` dirija una
 * habilidad contra él?
 *
 * - Portal central: nunca. La Centinela protege a una jugadora (sus
 *   Portales), no un Portal: en un Portal central no protege a nadie
 *   (Julio, 2026-11-12; reglamento: "en un Portal de un jugador").
 * - Portal de una jugadora: protegido si ESA jugadora está protegida por
 *   su propia Centinela (`jugadoraProtegidaPorCentinela`) — EXCEPTO si
 *   quien activa la habilidad es ella misma. Interpretación del texto de
 *   la FAQ según indicación del diseñador del juego: la Centinela protege
 *   frente a las DEMÁS jugadoras, no frente a la propia dueña actuando
 *   sobre sus propios Portales (ver nota en docs/reglamento/REGLAMENTO.md,
 *   "Centinela").
 */
export function estaProtegidoParaActivar(stackKey, stack, players, actingPlayerIdx) {
  const [p] = stackKey.split(':');
  if (p === 'n') return false;
  const portalOwnerIdx = parseInt(p, 10);
  if (portalOwnerIdx === actingPlayerIdx) return false;
  return jugadoraProtegidaPorCentinela(players[portalOwnerIdx]);
}

/**
 * Construye las opciones de la Fase B (activar habilidad): los portales
 * PROPIOS del jugador activo (gratis) y los portales centrales/neutrales
 * (con coste de 1 Gema unitaria), filtrando solo los que tienen visible en
 * su cima un personaje con habilidad activable.
 *
 * @param {number} playerIdx - Índice del jugador activo
 * @param {Array} players - Lista de jugadoras
 * @param {Array} neutrals - Lista de portales neutrales
 * @returns {Array<{ val: string, lbl: string }>} val: 'own:<idx>' | 'central:<idx>'
 */
export function opcionesActivarHabilidad(playerIdx, players, neutrals) {
  // La etiqueta de cada opción usa la IDENTIDAD real (top.name), no
  // mostrarCarta() (que muestra la apariencia) — a propósito, porque la
  // habilidad que de verdad se activa aquí es la del personaje real (p. ej.
  // un Metamorfo transformado en Ocultista solo puede volver a
  // transformarse, no usar la habilidad de Ocultista — ver
  // docs/reglamento/REGLAMENTO.md, nota de interpretación de Metamorfo), y
  // etiquetarlo con la apariencia confundiría sobre qué picker se abre al
  // elegir la opción.
  const etiqueta = card => `${iconos[card.name] || ''} ${card.name}`;
  const opciones = [];
  players[playerIdx].portals.forEach((stack, idx) => {
    const top = stack.at(-1);
    if (top && top.vis?.public && PERSONAJES_CON_HABILIDAD.includes(top.name)) {
      opciones.push({ val: `own:${idx}`, lbl: `Tu portal ${idx + 1}: ${etiqueta(top)} (gratis)` });
    }
  });
  // Solo se ofrece si la jugadora puede pagar el coste real SIN cambio
  // (puedePagarActivacionCentral): 1 Gema unitaria o revelar una de
  // asterisco por activar el Portal central, y si el personaje es el propio
  // Metamorfo, otra Gema unitaria aparte por su transformación (case
  // 'Metamorfo' en abilities.js). El coste se cobra DESPUÉS de que el efecto
  // ya se haya aplicado (dentro de onComplete, ver actions.js), así que esta
  // comprobación previa es la que impide activar gratis sin poder pagar.
  neutrals.forEach((stack, idx) => {
    const top = stack.at(-1);
    if (!top || !top.vis?.public || !PERSONAJES_CON_HABILIDAD.includes(top.name)) return;
    if (!puedePagarActivacionCentral(players[playerIdx], top.name === 'Metamorfo')) return;
    const coste = top.name === 'Metamorfo' ? '1 Gema de valor 1 o un *, más 1 Gema de valor 1' : '1 Gema de valor 1 o un *';
    opciones.push({ val: `central:${idx}`, lbl: `Neutral ${idx + 1}: ${etiqueta(top)} (cuesta ${coste})` });
  });
  return opciones;
}

// ---------- Economía de Gemas ----------
// player.gems es un array de { valor: number, nivel: 'C'|'B'|'A'|'experto'|'unitaria', esAsterisco?: boolean, revelada?: boolean }
// `revelada`: Gema de asterisco ya usada (bocarriba, valor público, no reutilizable).

export function sumaGemas(gems) {
  // Variante de análisis (js/motor/variantes.js): las Gemas de partida no puntúan.
  const cuenta = g => !(VARIANTES.gemasInicialesNoPuntuan && g.inicial);
  return gems.reduce((acc, g) => acc + (cuenta(g) ? (g.valor || 0) : 0), 0);
}

/**
 * Cuenta las Gemas de un jugador por nivel/color de invocación (p. ej.
 * `{ C: 2, B: 1, unitaria: 3 }`), sin revelar el valor real de cada Gema —
 * a diferencia de `sumaGemas()`, apto para mostrar a jugadoras que no son
 * la dueña (ver REGLAMENTO.md: las Gemas se roban al azar y en secreto,
 * solo se muestran bocarriba al final de la partida).
 */
export function contarGemasPorNivel(gems) {
  return gems.reduce((acc, g) => {
    acc[g.nivel] = (acc[g.nivel] || 0) + 1;
    return acc;
  }, {});
}

/** ¿Tiene el jugador alguna Gema de asterisco todavía sin revelar? */
export function tieneGemaAsterisco(player) {
  return player.gems.some(g => g.esAsterisco && !g.revelada);
}

/**
 * Revela (bocarriba) una Gema de asterisco sin revelar del jugador para
 * activar gratis una habilidad de un Portal central. La Gema NO se descarta:
 * el jugador se la queda y sigue sumando sus puntos, pero su valor pasa a
 * ser público y ya no puede volver a usarse (REGLAMENTO.md, fase B —
 * confirmado con el autor, 2026-11-05). Devuelve true si había alguna.
 */
export function gastarGemaAsterisco(player) {
  const gema = player.gems.find(g => g.esAsterisco && !g.revelada);
  if (!gema) return false;
  gema.revelada = true;
  return true;
}

/**
 * Número de Gemas unitarias (valor 1, sin asterisco) que tiene el jugador.
 * Son las únicas con las que se puede pagar un coste en Gemas: en
 * Invocadores NO se da cambio (REGLAMENTO.md, "Secuencia del turno", fase B
 * — decisión del dueño del proyecto, 2026-11-05).
 */
export function contarGemasUnitarias(player) {
  return player.gems.filter(g => g.valor === 1 && !g.esAsterisco).length;
}

/**
 * Gasta una Gema unitaria (valor 1). NO se da cambio: si el jugador no tiene
 * ninguna Gema de valor 1 suelta, no puede pagar aunque tenga Gemas de valor
 * superior (REGLAMENTO.md, fase B). Devuelve false (sin tocar nada) en ese caso.
 */
export function gastarGemaUnitaria(player) {
  // Con la variante de Gemas de partida sin puntos, se paga primero con ellas.
  const inicial = VARIANTES.gemasInicialesNoPuntuan
    ? player.gems.findIndex(g => g.valor === 1 && !g.esAsterisco && g.inicial) : -1;
  const idxUnitaria = inicial >= 0 ? inicial : player.gems.findIndex(g => g.valor === 1 && !g.esAsterisco);
  if (idxUnitaria === -1) return false;
  player.gems.splice(idxUnitaria, 1);
  return true;
}

/**
 * ¿Puede el jugador pagar la activación de un personaje de un Portal
 * central? Acceso al centro: 1 Gema unitaria o revelar una Gema de
 * asterisco. Si el personaje es el Metamorfo, además 1 Gema unitaria por la
 * transformación (no se puede pagar con asterisco). Sin cambio.
 */
export function puedePagarActivacionCentral(player, esMetamorfo = false) {
  const unitarias = contarGemasUnitarias(player);
  const asterisco = tieneGemaAsterisco(player);
  if (esMetamorfo) return unitarias >= 2 || (asterisco && unitarias >= 1);
  return unitarias >= 1 || asterisco;
}

/**
 * Cobra el coste de activar la habilidad de un personaje visible en un
 * Portal central: gratis si el jugador revela una Gema de asterisco (se la
 * queda, ver gastarGemaAsterisco), o 1 Gema unitaria — nunca se da cambio.
 * Si el jugador tiene ambas opciones se le pregunta, salvo que el llamante
 * pase `opciones.usarAsterisco` (true/false) para decidir sin diálogo (lo
 * usa el autómata). Si solo tiene una de las dos, se usa esa.
 * Devuelve false (y no cobra nada) si el jugador no puede pagar.
 */
export function pagarActivacionPortalCentral(player, opciones = {}) {
  const asterisco = tieneGemaAsterisco(player);
  const unitarias = contarGemasUnitarias(player);
  if (!asterisco && unitarias === 0) {
    alert(`${player.name} no tiene Gemas de valor 1 ni Gema de asterisco con las que pagar la activación (no se da cambio).`);
    return false;
  }
  let usarAsterisco = asterisco && unitarias === 0;
  if (asterisco && unitarias > 0) {
    usarAsterisco = typeof opciones.usarAsterisco === 'boolean'
      ? opciones.usarAsterisco
      : confirm(`${player.name}: tienes una Gema de asterisco. ¿Revelarla para activar la habilidad gratis? (Cancelar para pagar 1 Gema de valor 1)`);
  }
  return usarAsterisco ? gastarGemaAsterisco(player) : gastarGemaUnitaria(player);
}

/**
 * Construye el pool de 5 Gemas de una invocación a partir de sus valores,
 * marcando la de menor valor como Gema de asterisco, y lo mezcla para que
 * el reparto posterior (pool.shift()) equivalga a un robo al azar.
 *
 * @param {number[]} valores - Los 5 valores de Gema de la invocación
 * @returns {Array<{ valor: number, esAsterisco: boolean }>}
 */
export function construirPoolGemas(valores) {
  const minVal = Math.min(...valores);
  let marcada = false;
  const pool = valores.map(v => {
    const esAsterisco = !marcada && v === minVal;
    if (esAsterisco) marcada = true;
    return { valor: v, esAsterisco };
  });
  shuffle(pool);
  return pool;
}

/**
 * Bonus pasivos que se cobran al completarse una invocación (REGLAMENTO.md,
 * "Pícaro" y "Maestro"). Se llama justo después de repartir las Gemas de la
 * invocación.
 *
 * - Maestro: si es requisito de la invocación y no hay ningún Pícaro
 *   visible en toda la mesa, la dueña del Maestro visible gana 3 Gemas de
 *   valor 1. Se comprueba ANTES de voltear a los Pícaros: hacerlo después
 *   escondía a los Pícaros de las jugadoras y el Maestro cobraba igualmente.
 * - Pícaro: cada jugadora con un Pícaro visible en su Portal gana 1 Gema de
 *   valor 1 y su Pícaro se voltea bocabajo. Los Portales centrales no tienen
 *   dueña, así que su Pícaro ni cobra ni se voltea.
 *
 * Modo Experto: si se pasa `automata` (la autómata central, `{ gems }`), los
 * Portales centrales son suyos: cobra el bonus del Maestro y el del Pícaro
 * de un Portal central (y ese Pícaro también se voltea).
 *
 * Ambos miran la identidad real (`.name`), no la apariencia de un
 * Metamorfo transformado (DEUDA_TECNICA.md ítem 14). Función pura, ver
 * `tests/run-tests.mjs`.
 */
export function aplicarBonusPasivosInvocacion(players, neutrals, need, automata = null) {
  const portales = todosLosPortales(players, neutrals);
  const cimaVisibleEs = (st, nombre) =>
    st.length > 0 && st.at(-1).name === nombre && st.at(-1).vis?.public === true;
  // Quién cobra lo de un Portal: su dueña, o la autómata central en Experto.
  const cobradora = playerIdx => (playerIdx !== null ? players[playerIdx] : automata);
  const unitaria = () => ({ valor: 1, nivel: 'unitaria' });

  const maestros = portales.filter(({ stack }) => cimaVisibleEs(stack, 'Maestro'));
  // Variante de análisis (js/motor/variantes.js): solo anula un Pícaro de la
  // misma dueña que el Maestro.
  const anulaPicaro = ({ stack, playerIdx }) => cimaVisibleEs(stack, 'Pícaro')
    && (!VARIANTES.maestroSoloPicaroPropio || (maestros.length === 1 && playerIdx === maestros[0].playerIdx));
  const hayPicaroVisible = portales.some(anulaPicaro);
  if (need.includes('Maestro') && !hayPicaroVisible && maestros.length === 1) {
    cobradora(maestros[0].playerIdx)?.gems.push(unitaria(), unitaria(), unitaria());
  }

  portales.forEach(({ stack, playerIdx }) => {
    const quien = cobradora(playerIdx);
    if (!quien || !cimaVisibleEs(stack, 'Pícaro')) return;
    quien.gems.push(unitaria());
    stack.at(-1).vis.public = false;
  });
}

/**
 * Expansión del Entusiasta: lo último que se resuelve en una invocación con
 * éxito (Julio, 2026-11-07). Cada Entusiasta bocarriba en el Portal de una
 * jugadora le quita una Gema de valor 1 (sin cambio: si no tiene, no
 * pierde nada). En un Portal central no hace nada. Mira la identidad real.
 * Devuelve [{ jugadora, perdida }] por cada Entusiasta que ha actuado.
 */
export function aplicarEntusiastas(players, neutrals) {
  const efectos = [];
  todosLosPortales(players, neutrals).forEach(({ stack, playerIdx }) => {
    const top = stack.at(-1);
    if (playerIdx === null || !top || top.name !== 'Entusiasta' || top.vis?.public !== true) return;
    efectos.push({ jugadora: playerIdx, perdida: gastarGemaUnitaria(players[playerIdx]) });
  });
  return efectos;
}

/**
 * Clasificación final de la partida (REGLAMENTO.md, "Final de la
 * partida"): mayor suma total de Gemas gana; en caso de empate, quien haya
 * participado en más invocaciones DISTINTAS (nº de niveles de `LEVELS`
 * presentes en `player.gems` — las Gemas unitarias sueltas de Pícaro/
 * Maestro, `nivel: 'unitaria'`, no cuentan como invocación, a propósito:
 * `nivel` solo vale 'C'/'B'/'A' para las Gemas repartidas por completar una
 * invocación real); si persiste, la Gema de mayor valor de la ÚLTIMA
 * invocación completada en esta partida (0 si ninguna); si persiste, se
 * repite con la invocación completada inmediatamente anterior, y así hacia
 * atrás; si el empate se mantiene tras agotar todas las invocaciones
 * completadas, victoria compartida.
 *
 * `invocacionesCompletadas` es el orden REAL en que se completaron en ESTA
 * partida (`window.invocacionesCompletadas`, ver `js/actions.js`) — no se
 * puede asumir que siempre fue C→B→A completo, la partida puede terminar
 * antes por mano vacía.
 *
 * Función pura (sin DOM/alert) para que sea testable directamente — ver
 * `tests/run-tests.mjs`. Devuelve `{ stats, ganadores, motivoDesempate }`:
 * `stats` ya viene ordenado de mejor a peor puesto; `ganadores` es el/los
 * jugadoras empatadas en el primer puesto; `motivoDesempate` es `null` si
 * la suma total ya decidió sin empate, o el nombre del criterio que
 * finalmente desempató (o "empate total" si ninguno lo consiguió).
 */
export function calcularResultadoFinal(players, invocacionesCompletadas = []) {
  const nivelesDesdeElMasReciente = [...invocacionesCompletadas].reverse();

  const stats = players.map((p, idx) => {
    const gemasPorNivelReal = {};
    p.gems.forEach(g => {
      if (!NIVELES_CON_GEMAS.includes(g.nivel)) return;
      gemasPorNivelReal[g.nivel] = Math.max(gemasPorNivelReal[g.nivel] || 0, g.valor || 0);
    });
    return {
      idx,
      nombre: p.name,
      total: sumaGemas(p.gems),
      numInvocaciones: Object.keys(gemasPorNivelReal).length,
      gemasPorNivelReal,
    };
  });

  // Compara dos jugadoras aplicando la cadena de desempate completa.
  // `cmp < 0` si `a` va por delante de `b`. Devuelve también el CRITERIO
  // que decidió la comparación (o "empate total" si ninguno lo hizo), para
  // poder anunciarlo en el resultado final.
  function comparar(a, b) {
    if (a.total !== b.total) return { cmp: b.total - a.total, criterio: 'suma total de Gemas' };
    if (a.numInvocaciones !== b.numInvocaciones) {
      return { cmp: b.numInvocaciones - a.numInvocaciones, criterio: 'número de invocaciones distintas' };
    }
    for (const nivel of nivelesDesdeElMasReciente) {
      const va = a.gemasPorNivelReal[nivel] || 0;
      const vb = b.gemasPorNivelReal[nivel] || 0;
      if (va !== vb) return { cmp: vb - va, criterio: `Gema de mayor valor en la invocación ${nivel === NIVEL_ASTERISCO ? 'Madain' : nivel}` };
    }
    return { cmp: 0, criterio: 'empate total' };
  }

  const ordenados = [...stats].sort((a, b) => comparar(a, b).cmp);

  const ganadores = [ordenados[0]];
  let motivoDesempate = null;
  for (let i = 1; i < ordenados.length; i++) {
    const { cmp, criterio } = comparar(ordenados[0], ordenados[i]);
    if (cmp !== 0) {
      // La suma total ya diferenciaba (nunca hubo empate real que resolver)
      // → no hay nada que anunciar. Cualquier otro criterio significa que
      // la suma SÍ estaba empatada y algo más abajo en la cadena decidió.
      if (i === 1 && criterio !== 'suma total de Gemas') motivoDesempate = criterio;
      break; // ordenado: a partir de aquí ya no hay más empatadas con el primer puesto
    }
    ganadores.push(ordenados[i]);
    motivoDesempate = criterio; // solo puede ser 'empate total' cuando cmp === 0
  }

  return { stats: ordenados, ganadores, motivoDesempate };
}

// ---------- Modo Experto: autómata central ----------

export const NOMBRE_AUTOMATA_CENTRAL = 'Autómata central';

/** Autómata central vacía (Modo Experto): solo tiene Gemas. */
export function crearAutomataCentral() {
  return { gems: [] };
}

/** Índices de las jugadoras con la suma de Gemas más baja (puede haber empate). */
export function jugadorasConMenosPuntos(players) {
  if (!players.length) return [];
  const minimo = Math.min(...players.map(p => sumaGemas(p.gems)));
  return players.map((p, i) => (sumaGemas(p.gems) === minimo ? i : -1)).filter(i => i >= 0);
}

/**
 * ¿Le conviene a la jugadora `idx` cambiar sus Gemas por las de la
 * autómata? (decisión de una autómata jugadora: solo si suma más).
 */
export function convieneIntercambioAutomata(players, automata, idx) {
  return sumaGemas(automata.gems) > sumaGemas(players[idx].gems);
}

/**
 * Final del Modo Experto (REGLAMENTO.md, "Modo experto"; empates resueltos
 * por Julio el 2026-11-07). La jugadora con menos puntos PUEDE cambiar
 * todas sus Gemas por las de la autómata central; si varias empatan en el
 * último puesto, cada una que acepte puntúa con las Gemas de la autómata
 * (y si eso gana, la victoria es compartida). La autómata se queda con las
 * de la primera que cambia (todas suman lo mismo). Después, la autómata
 * entra en la clasificación como una jugadora más: si queda primera, gana
 * ella; un empate con ella se resuelve con el desempate habitual.
 *
 * `cambian`: índices de jugadoras que aceptan el cambio (solo cuentan los
 * de `jugadorasConMenosPuntos`). Pura: no toca `players` ni `automata`.
 * Devuelve el resultado de `calcularResultadoFinal` (la autómata tiene
 * `idx === players.length` y `esAutomataCentral`) más `intercambios`.
 */
export function resultadoFinalExperto(players, automata, invocacionesCompletadas = [], cambian = []) {
  const ultimas = new Set(jugadorasConMenosPuntos(players));
  const quienes = cambian.filter(i => ultimas.has(i));
  const copia = gems => gems.map(g => ({ ...g }));
  const participantes = players.map((p, i) => ({
    name: p.name,
    gems: quienes.includes(i) ? copia(automata.gems) : p.gems,
  }));
  participantes.push({
    name: NOMBRE_AUTOMATA_CENTRAL,
    gems: quienes.length ? copia(players[quienes[0]].gems) : automata.gems,
  });
  const resultado = calcularResultadoFinal(participantes, invocacionesCompletadas);
  const idxAutomata = players.length;
  resultado.stats.forEach(st => { if (st.idx === idxAutomata) st.esAutomataCentral = true; });
  resultado.ganadores.forEach(st => { if (st.idx === idxAutomata) st.esAutomataCentral = true; });
  resultado.intercambios = quienes.map(i => players[i].name);
  return resultado;
}

/**
 * Genera el objeto de visibilidad de una carta según el contexto.
 * @param {string} destino - 'mano' | 'portal'
 * @param {Object} opciones
 *   - origen: 'mazo' | 'cronista' | 'aprendiz' | 'clarividente'
 *   - visible: boolean  (solo aplica a 'cronista' y 'mazo')
 *   - esPropietaria: boolean (jugadora que recibe la carta)
 * @returns {{ owner: boolean, others: boolean, public: boolean }}
 */
export function generarVis(destino, { origen, visible, esPropietaria }) {
  if (destino === 'portal') {
    return { public: true }; // siempre se juega bocarriba
  }

  if (destino === 'mano') {
    switch (origen) {
      case 'cronista':
        return visible
          ? { owner: true, others: false, public: false }
          : { owner: false, others: true, public: false };

      case 'clarividente':
        return { owner: true, others: false, public: false };

      case 'mazo':
        return visible
          ? { owner: true, others: false, public: false }
          : { owner: false, others: true, public: false };

      case 'aprendiz':
        return esPropietaria
          ? { owner: true, others: false, public: false }
          : { owner: false, others: true, public: false };

      default:
        return { owner: false, others: false, public: false };
    }
  }

  return { owner: false, others: false, public: false };
}



/**
 * Actualiza `player.hasClariActivo`: true si la jugadora tiene una
 * Clarividente visible en el top de un portal. Sin periodo de gracia — ver
 * `docs/reglamento/REGLAMENTO.md`, nota de interpretación de Clarividente:
 * la pérdida de visibilidad es inmediata, siempre. La reacción a la
 * transición true→false (elegir qué carta seguir viendo) vive en
 * `render.js` (`gestionarTransicionesClarividente`), no aquí — esta función
 * solo calcula el estado actual.
 */
export function actualizarClarividente(players) {
  players.forEach(player => {
    player.hasClariActivo = tieneClarividenteVisible(player);
  });
}

/**
 * ¿Tiene la jugadora una Clarividente REAL visible en la cima de alguno de
 * sus Portales? Mientras sea así, su mano completa queda oculta para el
 * resto (decisión de mesa, ver REGLAMENTO.md), así que nadie puede "ver"
 * su carta oculta: ni el Maestro puede elegirla ni el autómata conocerla.
 * Se calcula en el momento, sin depender de `hasClariActivo` (que solo se
 * refresca en render()).
 */
export function tieneClarividenteVisible(player) {
  return player.portals.some(
    stack => stack.length &&
      stack.at(-1).name === 'Clarividente' &&
      stack.at(-1).vis?.public === true
  );
}
