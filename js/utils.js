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

// Cuarta invocación de Modo Experto ("Asterisco"). Se deja preparada pero
// todavía NO está conectada a ningún flujo de juego real (eso es el bloque
// de Modo Experto, aparte) — ver docs/MEJORAS_FUTURAS.md.
export const INVOCATION_ASTERISCO = {
  nombre: 'Madain',
  need: ['Reena', 'Metamorfo', 'Sora', 'Lumo'],
  gemas: [11, 12, 12, 12, 13],
};

// Personajes cuya habilidad se activa manualmente en la Fase B del turno
// (ver docs/reglamento/REGLAMENTO.md, "Secuencia del turno"). Centinela y
// Clarividente quedan fuera a propósito: sus efectos son pasivos/automáticos.
export const PERSONAJES_CON_HABILIDAD = ['Ocultista', 'Cronista', 'Cronomante', 'Estratega', 'Aprendiz', 'Metamorfo'];

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
export const mostrarCarta = card => `${iconos[card.name] || ''} ${card.name}`;

// ---------- Imágenes de cartas ----------
// TODO: cuando el Metamorfo tenga disfraz persistente (ver
// docs/MEJORAS_FUTURAS.md), mostrar la imagen del personaje imitado + una
// insignia indicando que es en realidad un Metamorfo, en vez de usar
// siempre metamorfo.png tal cual.
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

export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

export function draw(player, visible) {
  if (window.deck && window.deck.length) {
    const cartaDelMazo = window.deck.shift();
    const vis = generarVis('mano', { origen: 'mazo', visible, esPropietaria: true });
    player.hand.push({ name: cartaDelMazo.name, vis });
  }
}

export function hasClari(player) {
  return player.portals.some(
    stack => stack.length && stack.at(-1).name === 'Clarividente' && stack.at(-1).vis
  );
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
 * @param {Function} esInvalido - Función que recibe un stack y devuelve true si debe estar deshabilitado
 * @returns {Array<{ val: string, lbl: string, disabled?: boolean }>}
 */
export function portalesConEstado(players, neutrals, esInvalido) {
  return listPortals(players, neutrals).map(({ val, lbl }) => {
    const st = stackFrom(val, players, neutrals);
    return {
      val,
      lbl,
      disabled: esInvalido(st)
    };
  });
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
  const opciones = [];
  players[playerIdx].portals.forEach((stack, idx) => {
    const top = stack.at(-1);
    if (top && top.vis?.public && PERSONAJES_CON_HABILIDAD.includes(top.name)) {
      opciones.push({ val: `own:${idx}`, lbl: `Tu portal ${idx + 1}: ${mostrarCarta(top)} (gratis)` });
    }
  });
  neutrals.forEach((stack, idx) => {
    const top = stack.at(-1);
    if (top && top.vis?.public && PERSONAJES_CON_HABILIDAD.includes(top.name)) {
      opciones.push({ val: `central:${idx}`, lbl: `Neutral ${idx + 1}: ${mostrarCarta(top)} (cuesta 1 Gema)` });
    }
  });
  return opciones;
}

// ---------- Economía de Gemas ----------
// player.gems es un array de { valor: number, nivel: 'C'|'B'|'A'|'experto'|'unitaria', esAsterisco?: boolean }

export function sumaGemas(gems) {
  return gems.reduce((acc, g) => acc + (g.valor || 0), 0);
}

export function tieneGemaAsterisco(player) {
  return player.gems.some(g => g.esAsterisco);
}

/** Revela y descarta la Gema de asterisco del jugador. Devuelve true si había alguna. */
export function gastarGemaAsterisco(player) {
  const idx = player.gems.findIndex(g => g.esAsterisco);
  if (idx === -1) return false;
  player.gems.splice(idx, 1);
  return true;
}

/**
 * Gasta una Gema unitaria (valor 1). Si el jugador no tiene ninguna suelta,
 * cambia su Gema de menor valor por N Gemas unitarias (N = valor de la Gema
 * cambiada) y ya paga una de ellas en el propio cambio, dejando N-1 sueltas.
 * Devuelve false solo si el jugador no tiene ninguna Gema con la que pagar.
 */
export function gastarGemaUnitaria(player) {
  const idxUnitaria = player.gems.findIndex(g => g.valor === 1);
  if (idxUnitaria !== -1) {
    player.gems.splice(idxUnitaria, 1);
    return true;
  }
  if (player.gems.length === 0) return false;

  let menorIdx = 0;
  player.gems.forEach((g, i) => {
    if (g.valor < player.gems[menorIdx].valor) menorIdx = i;
  });
  const gemaCambiada = player.gems.splice(menorIdx, 1)[0];
  const nuevasUnitarias = Array.from({ length: gemaCambiada.valor - 1 }, () => ({ valor: 1, nivel: 'unitaria' }));
  player.gems.push(...nuevasUnitarias);
  return true;
}

/**
 * Cobra el coste de activar la habilidad de un personaje visible en un
 * Portal central: gratis si el jugador revela una Gema de asterisco
 * (se descarta), o 1 Gema unitaria en caso contrario.
 * Devuelve false (y no cobra nada) si el jugador no puede pagar.
 */
export function pagarActivacionPortalCentral(player) {
  if (tieneGemaAsterisco(player)) {
    const usarAsterisco = confirm(
      `${player.name}: tienes una Gema de asterisco. ¿Revelarla para activar la habilidad gratis? (Cancelar para pagar 1 Gema unitaria)`
    );
    if (usarAsterisco) return gastarGemaAsterisco(player);
  }
  if (player.gems.length === 0) {
    alert(`${player.name} no tiene Gemas con las que pagar la activación.`);
    return false;
  }
  return gastarGemaUnitaria(player);
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
 * Actualiza los flags de visibilidad relacionados con la Clarividente.
 * - hasClariActivo: true si la jugadora tiene una Clarividente visible en el top de un portal.
 * - haTenidoClarividente: permanece true mientras no se haya jugado una carta después.
 */
export function actualizarClarividente(players) {
  players.forEach(player => {
    const activa = player.portals.some(
      stack => stack.length &&
        stack.at(-1).name === 'Clarividente' &&
        stack.at(-1).vis?.public === true
    );
    if (activa) {
      player.hasClariActivo = true;
      player.haTenidoClarividente = true;
    } else {
      player.hasClariActivo = false;
      // haTenidoClarividente se mantiene hasta que juegue una carta
    }
  });
}


/**
 * Recorre las manos de todas las jugadoras y ajusta la visibilidad de sus cartas
 * según si tienen una Clarividente activa o reciente.
 */
export function actualizarVisibilidad(players) {
  players.forEach(player => {
    if (player.hasClariActivo || player.haTenidoClarividente) {
      player.hand.forEach(carta => {
        carta.vis.owner = true;
        carta.vis.others = false;
        carta.vis.public = false;
      });
    }
  });
}
