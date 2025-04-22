// utils.js
// ---------- Constantes generales ----------
export const LEVELS = ['C', 'B', 'A'];
export const COMBOS = {
  C: ['Pícaro', 'Centinela', 'Aprendiz'],
  B: ['Cronomante', 'Cronista', 'Estratega'],
  A: ['Maestro', 'Clarividente', 'Ocultista'],
};
export const REWARD = { C: 1, B: 2, A: 3 };

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
  'Metamorfo': '🌈'
};
export const mostrarCarta = card => `${iconos[card.name] || ''} ${card.name}`;

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


/**
 * Permite a los jugadores con un Metamorfo visible y en el top
 * decidir si quieren transformarlo temporalmente para alterar una invocación.
 * 
 * @param {Array} players - Jugadoras actuales
 * @param {Array} neutrals - Portales neutrales
 * @param {string} lvl - Letra de la invocación actual (A, B, C)
 * @param {Array} need - Array con los nombres de personajes necesarios
 * @returns {Map} - Mapa de transformaciones temporales: 'jugador:portal' -> personaje elegido
 */
export async function gestionarMetamorfos(players, neutrals, lvl, need) {
  const transformaciones = new Map();

  const portalesConMetamorfo = [];

  // Buscar todos los metamorfos visibles en el top de portales
  players.forEach((player, i) => {
    player.portals.forEach((stack, j) => {
      const top = stack.at(-1);
      if (top && top.name === 'Metamorfo' && top.vis?.public && player.gems > 0) {
        portalesConMetamorfo.push({ player, i, j, stack, top });
      }
    });
  });

  // Si no hay metamorfos disponibles, devolver vacío
  if (portalesConMetamorfo.length === 0) return transformaciones;

  for (const { player, i, j, stack, top } of portalesConMetamorfo) {
    const confirmar = confirm(`🌀 ${player.name}, ¿quieres activar tu Metamorfo del portal ${j + 1}?`);

    if (!confirmar) continue;

    const opciones = need.map(p => ({ val: p, lbl: `Transformarse en ${p}` }));

    const elegido = await new Promise(resolve => {
      window.picker('¿En qué personaje quieres transformarlo?', opciones, v => resolve(v));
    });

    if (player.gems <= 0) {
      alert(`${player.name} no tiene suficientes gemas.`);
      continue;
    }

    // Restar gema y registrar transformación
    player.gems--;
    transformaciones.set(`${i}:${j}`, elegido);
  }

  return transformaciones;
}
