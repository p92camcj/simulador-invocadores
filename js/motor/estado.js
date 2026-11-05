// js/motor/estado.js
//
// Fase 1 de la separación motor / interfaz (ver docs/ARQUITECTURA_MOTOR.md).
//
// Todo el estado de una partida vive en UN objeto plano (`estado.partida`),
// serializable con JSON: se puede guardar, cargar o enviar por red tal cual.
// El estado propio de la interfaz (carta seleccionada, picker abierto,
// callbacks pendientes...) va aparte en `estado.ui`, porque no forma parte
// de la partida y puede contener funciones.
//
// Compatibilidad: el resto del código sigue leyendo y escribiendo
// `window.players`, `window.turn`, etc. Esas propiedades son ahora alias
// (getter/setter) que apuntan a este objeto, así que no hace falta tocar
// ningún otro módulo de golpe. Las fases siguientes irán sustituyendo esos
// accesos por llamadas al motor.
//
// Sin DOM: este módulo funciona igual en el navegador y en Node.

/** Claves del estado de partida (serializable). */
export const CLAVES_PARTIDA = [
  'players', 'neutrals', 'deck', 'levelIdx', 'turn', 'played',
  'habilidadUsadaEsteTurno', 'invocationSet', 'juegoTerminado',
  'cronomantePortalInvestigado', 'invocacionesCompletadas', 'memoriaBots',
];

/** Claves del estado de interfaz (no serializable, no es parte de la partida). */
export const CLAVES_UI = [
  'selectedCardIdx', 'cronomanteOnComplete', 'pickerObjetivoPortal',
  'avanceTurnoPendiente',
];

/** Estado de partida vacío. `invocationSet` se conserva si se pasa. */
export function crearEstadoPartida(invocationSet = 'normal') {
  return {
    players: [],
    neutrals: [],
    deck: [],
    levelIdx: 0,
    turn: 0,
    played: false,
    habilidadUsadaEsteTurno: false,
    invocationSet,
    juegoTerminado: false,
    cronomantePortalInvestigado: null,
    invocacionesCompletadas: [],
    memoriaBots: [],
  };
}

/** Estado de interfaz vacío. */
export function crearEstadoUi() {
  return {
    selectedCardIdx: null,
    cronomanteOnComplete: null,
    pickerObjetivoPortal: null,
    avanceTurnoPendiente: false,
  };
}

/** Contenedor único: `estado.partida` (reglas) y `estado.ui` (interfaz). */
export const estado = {
  partida: crearEstadoPartida(),
  ui: crearEstadoUi(),
};

/**
 * Restablece los campos de turno (lo que antes repetían initGame/nextTurn).
 * Toca un campo de partida y tres de interfaz.
 */
export function reiniciarCamposDeTurno() {
  estado.partida.played = false;
  estado.partida.habilidadUsadaEsteTurno = false;
  estado.partida.cronomantePortalInvestigado = null;
  estado.ui.selectedCardIdx = null;
  estado.ui.cronomanteOnComplete = null;
  estado.ui.pickerObjetivoPortal = null;
}

/**
 * Vacía la partida (vuelta al menú). Conserva el set de invocación elegido.
 */
export function reiniciarPartida() {
  estado.partida = crearEstadoPartida(estado.partida.invocationSet);
  estado.ui = crearEstadoUi();
}

/** Copia profunda del estado de partida como texto JSON. */
export function serializarPartida(partida = estado.partida) {
  return JSON.stringify(partida);
}

/**
 * Sustituye el estado de partida por el contenido de un JSON generado con
 * `serializarPartida`. Las claves que falten toman su valor por defecto y las
 * desconocidas se descartan. El estado de interfaz se reinicia.
 */
export function cargarPartida(json) {
  const datos = typeof json === 'string' ? JSON.parse(json) : json;
  const base = crearEstadoPartida(datos?.invocationSet ?? 'normal');
  for (const clave of CLAVES_PARTIDA) {
    if (datos && clave in datos) base[clave] = datos[clave];
  }
  estado.partida = base;
  estado.ui = crearEstadoUi();
  return estado.partida;
}

/**
 * Define `destino.players`, `destino.turn`, etc. como alias del estado.
 * En el navegador `destino` es `window`; en los tests, cualquier objeto.
 * Idempotente.
 */
export function instalarAliasGlobales(destino = globalThis) {
  const definir = (grupo, clave) => {
    Object.defineProperty(destino, clave, {
      configurable: true,
      enumerable: true,
      get: () => estado[grupo][clave],
      set: v => { estado[grupo][clave] = v; },
    });
  };
  CLAVES_PARTIDA.forEach(c => definir('partida', c));
  CLAVES_UI.forEach(c => definir('ui', c));
  destino.estado = estado;
}
