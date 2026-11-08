// js/motor/habilidades.js
//
// Fase 3 de la separación motor / interfaz (ver docs/ARQUITECTURA_MOTOR.md).
//
// Lo que hace cada habilidad activable en Fase B (Ocultista, Cronista,
// Cronomante, Estratega, Aprendiz, Maestro, Metamorfo) y los efectos
// pasivos de Centinela, Clarividente incluida su elección al perderla.
// Sin DOM, sin `window`, sin avisos.
//
// Cuando una habilidad necesita que alguien elija algo, el motor no abre
// ventanas: hace una PETICIÓN a la interfaz que recibe (`ui`):
//
//   ui.pedir(peticion, responder, cancelar)
//     peticion = { tipo: 'portal' | 'eleccion', pregunta, opciones }
//     opciones = [{ val, lbl, disabled? }]  ('portal': val = "j:p" | "n:k")
//     responder(val) aplica la elección; cancelar() la abandona.
//   ui.avisar(evento)   (por ahora solo { tipo: 'accionInvalida', motivo })
//
// Quien conteste da igual: el picker() del navegador (js/abilities.js), el
// teclado en una terminal, el autómata o un test. Las respuestas son
// callbacks (no promesas) a propósito: así una interfaz que contesta en el
// acto, como el autómata o los tests, recorre todos los pasos de forma
// síncrona.
//
// `alAplicar()` se llama UNA sola vez y solo cuando la habilidad tiene
// efecto de verdad. Cancelar cualquier paso no cuesta nada ni marca la
// habilidad como usada. Excepción matizada, Cronomante: una vez elegido el
// Portal que investiga, ese compromiso queda en
// `partida.cronomantePortalInvestigado` aunque se cancele el segundo paso.

import {
  stackFrom, portalesConEstado, mostrarCarta, generarVis, gastarGemaUnitaria,
  contarGemasUnitarias, transformacionesDisponiblesMetamorfo, apilarEnPortal, retirarFichaMetamorfo,
  jugadoraProtegidaPorCentinela, estaProtegidoParaActivar,
  todosLosPortales, reponerManoSiFalta, tieneClarividenteVisible,
} from '../utils.js';

import { VARIANTES } from './variantes.js';
const invalida = motivo => ({ tipo: 'accionInvalida', motivo });

/**
 * ¿Su carta superior es una Centinela visible? Restricción propia de
 * Ocultista ("no puede aplicarse sobre una Centinela visible"), que vale
 * incluso para la dueña de esa Centinela.
 */
export const esCentinelaVisible = st =>
  st.length > 0 && st.at(-1).name === 'Centinela' && st.at(-1).vis?.public === true;

/**
 * ¿Bloquea la Centinela que `jugadorIdx` sea objetivo de una habilidad que
 * elige JUGADORAS (Aprendiz, Maestro)? Quien activa nunca se bloquea a sí
 * misma.
 */
export function jugadorProtegidoComoObjetivo(jugadorIdx, players, actingPlayerIdx) {
  if (jugadorIdx === actingPlayerIdx) return false;
  return jugadoraProtegidaPorCentinela(players[jugadorIdx]);
}

/**
 * Efecto pasivo de Centinela: solo puede haber una visible en mesa. Gira
 * cualquier otra Centinela visible que no esté en `stackJugada`.
 */
export function ocultarOtrasCentinelas(stackJugada, players, neutrals) {
  todosLosPortales(players, neutrals).forEach(({ stack: st }) => {
    if (st !== stackJugada && esCentinelaVisible(st)) {
      st.at(-1).vis.public = false;
    }
  });
}

/**
 * Si la cima de `stack` ha pasado a ser una Centinela REAL visible (la
 * Cronista se llevó lo que la tapaba, el Cronomante la subió...), se giran
 * las demás.
 */
export function girarOtrasCentinelasSiAparece(stack, players, neutrals) {
  if (esCentinelaVisible(stack)) ocultarOtrasCentinelas(stack, players, neutrals);
}

/**
 * Jugadoras objetivo del Maestro: otra jugadora, con una carta que el resto
 * ve (`vis.others`), sin Clarividente visible y sin Centinela que la proteja.
 */
export function candidatosObjetivoMaestro(players, ownerIdx) {
  return players
    .map((p, i) => ({ idx: i, cartaOculta: p.hand.find(c => c.vis?.others === true) }))
    .filter(({ idx, cartaOculta }) =>
      idx !== ownerIdx &&
      cartaOculta &&
      !tieneClarividenteVisible(players[idx]) &&
      !jugadorProtegidoComoObjetivo(idx, players, ownerIdx)
    );
}

/**
 * Efecto del Maestro ya decidido: baja la carta que el resto ve de la mano
 * de `targetIdx` a su PROPIO Portal `portalIdx`, re-dispara Centinela si
 * hace falta y esa jugadora repone mano robando de `mazo` (el de la partida).
 */
export function bajarCartaMaestro(players, neutrals, targetIdx, portalIdx, mazo = []) {
  const target = players[targetIdx];
  const cartaOculta = target.hand.find(c => c.vis?.others === true);
  const carta = target.hand.splice(target.hand.indexOf(cartaOculta), 1)[0];
  // Viene de la mano: nunca trae ficha de Metamorfo. Si tapa a un Metamorfo
  // transformado, este pierde la suya (apilarEnPortal).
  apilarEnPortal(target.portals[portalIdx], { name: carta.name, vis: generarVis('portal', {}) });
  if (carta.name === 'Centinela') {
    ocultarOtrasCentinelas(target.portals[portalIdx], players, neutrals);
  }
  reponerManoSiFalta(target, mazo);
}

/**
 * Clarividente, al dejar de estar visible: la jugadora se queda viendo la
 * carta `idxElegida` (0 o 1) y la otra pasa a verla el resto.
 */
export function aplicarEleccionClarividente(player, idxElegida) {
  const [c0, c1] = player.hand;
  if (!c0 || !c1) return false;
  const elegida = idxElegida === 0 ? c0 : c1;
  const otra = idxElegida === 0 ? c1 : c0;
  elegida.vis = { owner: true, others: false, public: false };
  otra.vis = { owner: false, others: true, public: false };
  return true;
}

// ---------- Habilidades activables (Fase B) ----------

function ocultista(partida, { jugadora }, ui, alAplicar) {
  const { players, neutrals } = partida;
  const opciones = portalesConEstado(players, neutrals, (st, val) =>
    esCentinelaVisible(st) ||
    estaProtegidoParaActivar(val, st, players, jugadora) ||
    st.length === 0
  );
  ui.pedir({ tipo: 'portal', pregunta: '¿Qué portal quieres alterar?', opciones }, key => {
    const st = stackFrom(key, players, neutrals);
    const carta = st.at(-1);
    carta.vis.public = !carta.vis.public;
    // Poner bocabajo a un Metamorfo transformado cuenta como taparlo.
    if (!carta.vis.public) retirarFichaMetamorfo(carta);
    // Revelar una Centinela REAL vuelve a disparar el auto-giro.
    if (carta.name === 'Centinela' && carta.vis.public) {
      ocultarOtrasCentinelas(st, players, neutrals);
    }
    alAplicar();
  });
}

function cronista(partida, { jugadora }, ui, alAplicar) {
  const { players, neutrals } = partida;
  const owner = players[jugadora];
  const opciones = portalesConEstado(players, neutrals, (st, val) =>
    estaProtegidoParaActivar(val, st, players, jugadora) || st.length === 0
  );
  ui.pedir({ tipo: 'portal', pregunta: 'Portal objetivo', opciones }, key => {
    const st = stackFrom(key, players, neutrals);
    const carta = st.pop();
    // La orientación en mano depende de lo que le falte a la mano para
    // tener una carta visible y una oculta (en Fase B le queda 1).
    const visible = owner.hand[0]?.vis?.owner !== true;
    const vis = generarVis('mano', { origen: 'cronista', visible, esPropietaria: true });
    // Un Metamorfo transformado vuelve a la mano sin su ficha (sin .aspecto).
    owner.hand.push({ name: carta.name, vis });
    girarOtrasCentinelasSiAparece(st, players, neutrals);
    alAplicar();
  });
}

function cronomante(partida, { jugadora }, ui, alAplicar) {
  const { players, neutrals } = partida;

  const elegirCarta = key => {
    const st = stackFrom(key, players, neutrals);
    const opciones = st.map((carta, idx) => ({
      val: idx,
      lbl: carta.vis?.public ? mostrarCarta(carta) : 'Carta Oculta',
    }));
    ui.pedir(
      { tipo: 'eleccion', pregunta: '¿Qué carta quieres subir al top?', opciones },
      idx => {
        const seleccionada = st.splice(Number(idx), 1)[0];
        // La carta que queda tapada pierde su ficha de Metamorfo si la tenía.
        apilarEnPortal(st, seleccionada);
        girarOtrasCentinelasSiAparece(st, players, neutrals);
        partida.cronomantePortalInvestigado = null;
        alAplicar();
      },
      // Cancelar aquí no cuesta nada, pero el Portal investigado se queda
      // fijado: al volver a activar se sigue con el mismo.
      () => {}
    );
  };

  if (partida.cronomantePortalInvestigado) {
    elegirCarta(partida.cronomantePortalInvestigado);
    return;
  }
  const opciones = portalesConEstado(players, neutrals, (st, val) =>
    estaProtegidoParaActivar(val, st, players, jugadora) || st.length <= 1
  );
  // Cancelar este primer paso no fija nada: aún no se ha mirado ningún Portal.
  ui.pedir({ tipo: 'portal', pregunta: 'Elige un portal para manipular', opciones }, key => {
    partida.cronomantePortalInvestigado = key;
    elegirCarta(key);
  });
}

function estratega(partida, { jugadora }, ui, alAplicar) {
  const { players, neutrals } = partida;
  const validos = portalesConEstado(players, neutrals, (st, val) =>
    estaProtegidoParaActivar(val, st, players, jugadora)
  );
  ui.pedir({ tipo: 'portal', pregunta: '1er portal', opciones: validos }, first => {
    ui.pedir({ tipo: 'portal', pregunta: '2º portal', opciones: validos.filter(o => o.val !== first) }, second => {
      const s1 = stackFrom(first, players, neutrals);
      const s2 = stackFrom(second, players, neutrals);
      const p1Protegido = estaProtegidoParaActivar(first, s1, players, jugadora);
      const p2Protegido = estaProtegidoParaActivar(second, s2, players, jugadora);
      if (p1Protegido && p2Protegido) {
        ui.avisar(invalida('Ambos portales están protegidos por Centinela.'));
        return;
      }
      if (p1Protegido) {
        s2.splice(0, s2.length, ...s1);
      } else if (p2Protegido) {
        s1.splice(0, s1.length, ...s2);
      } else {
        const tmp = [...s1];
        s1.splice(0, s1.length, ...s2);
        s2.splice(0, s2.length, ...tmp);
      }
      alAplicar();
    });
  });
}

function aprendiz(partida, { jugadora }, ui, alAplicar) {
  const { players } = partida;
  const opciones = players
    .map((p, i) => ({ val: i, lbl: p.name }))
    .filter(o => !jugadorProtegidoComoObjetivo(o.val, players, jugadora));

  ui.pedir({ tipo: 'eleccion', pregunta: 'Primera jugadora', opciones }, v1 => {
    v1 = parseInt(v1, 10);
    const segunda = opciones.filter(o => o.val !== v1);
    ui.pedir({ tipo: 'eleccion', pregunta: 'Segunda jugadora', opciones: segunda }, v2 => {
      v2 = parseInt(v2, 10);
      // Intercambio de manos con inversión de visibilidad.
      [players[v1].hand, players[v2].hand] = [players[v2].hand, players[v1].hand];
      [players[v1], players[v2]].forEach(p => p.hand.forEach(c => {
        const temp = c.vis.owner;
        c.vis.owner = c.vis.others;
        c.vis.others = temp;
      }));
      alAplicar();
    });
  });
}

function maestro(partida, { jugadora }, ui, alAplicar) {
  const { players, neutrals, deck } = partida;
  const candidatas = candidatosObjetivoMaestro(players, jugadora);
  if (!candidatas.length) {
    ui.avisar(invalida('No hay ninguna jugadora con una carta visible-para-el-resto que puedas bajar.'));
    return;
  }

  const elegirPortalDestino = targetIdx => {
    const target = players[targetIdx];
    if (target.portals.length === 1) {
      bajarCartaMaestro(players, neutrals, targetIdx, 0, deck);
      alAplicar();
      return;
    }
    ui.pedir(
      {
        tipo: 'eleccion',
        pregunta: `¿En qué Portal de ${target.name} baja la carta?`,
        opciones: target.portals.map((_, idx) => ({ val: idx, lbl: `Portal ${idx + 1}` })),
      },
      v => {
        bajarCartaMaestro(players, neutrals, targetIdx, parseInt(v, 10), deck);
        alAplicar();
      }
    );
  };

  if (candidatas.length === 1) {
    elegirPortalDestino(candidatas[0].idx);
    return;
  }
  ui.pedir(
    {
      tipo: 'eleccion',
      pregunta: '¿De qué jugadora coges la carta?',
      opciones: candidatas.map(({ idx }) => ({ val: idx, lbl: players[idx].name })),
    },
    v => elegirPortalDestino(parseInt(v, 10))
  );
}

function metamorfo(partida, { jugadora, pila }, ui, alAplicar) {
  const { players, neutrals } = partida;
  const owner = players[jugadora];
  // Variante de análisis (js/motor/variantes.js): gratis en un Portal propio.
  const gratis = VARIANTES.metamorfoGratisPropio && owner.portals.includes(pila);
  // La transformación solo se paga con una Gema de valor 1 (no se da cambio).
  if (!gratis && contarGemasUnitarias(owner) === 0) {
    ui.avisar(invalida('No tienes ninguna Gema de valor 1 con la que pagar la transformación (no se da cambio).'));
    return;
  }
  // Sin Metamorfo ni las fichas que ya lleve otro Metamorfo en mesa.
  const opciones = transformacionesDisponiblesMetamorfo(players, neutrals, pila.at(-1));
  if (!opciones.length) {
    ui.avisar(invalida('No queda ninguna ficha de transformación disponible.'));
    return;
  }
  ui.pedir(
    { tipo: 'eleccion', pregunta: 'Metamorfo cambia a', opciones: opciones.map(m => ({ val: m, lbl: m })) },
    v => {
      if (!gratis && !gastarGemaUnitaria(owner)) return;
      // Solo apariencia: `.name` sigue siendo 'Metamorfo' (protecciones y
      // bonus pasivos miran la identidad real); `.aspecto` cuenta para la
      // invocación y es lo que se muestra.
      pila.at(-1).aspecto = v;
      alAplicar();
    }
  );
}

const HABILIDADES = {
  Ocultista: ocultista,
  Cronista: cronista,
  Cronomante: cronomante,
  Estratega: estratega,
  Aprendiz: aprendiz,
  Maestro: maestro,
  Metamorfo: metamorfo,
};

/**
 * Aplica la habilidad de `personaje` para la jugadora `jugadora`. `pila` es
 * el Portal de origen (solo lo usa Metamorfo: es la carta que se
 * transforma; para retomar un Cronomante pendiente puede ser null).
 * Centinela y Clarividente no están: son pasivas.
 * Devuelve true si el personaje tiene habilidad activable.
 */
export function aplicarHabilidad(partida, { personaje, jugadora, pila }, ui, alAplicar = () => {}) {
  const fn = HABILIDADES[personaje];
  if (!fn) return false;
  fn(partida, { jugadora, pila }, ui, alAplicar);
  return true;
}
