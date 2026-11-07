// abilities.js
//
// Adaptador web de las habilidades (fase 3 de la separación motor /
// interfaz, ver docs/ARQUITECTURA_MOTOR.md). Las reglas de cada habilidad
// están en js/motor/habilidades.js; aquí solo se contestan sus peticiones
// con los picker() del navegador y sus avisos con alert().
//
// La firma de applyAbility() no cambia: la usan actions.js (Fase B humana)
// y bot.js (que contesta los mismos picker() por JS, de forma síncrona).

import { picker, pickerPortal, render } from './render.js';
import { estado } from './motor/estado.js';
import { aplicarHabilidad, bajarCartaMaestro as bajarCartaMaestroMotor } from './motor/habilidades.js';

// Funciones puras que otros módulos y los tests siguen importando de aquí.
export {
  ocultarOtrasCentinelas, girarOtrasCentinelasSiAparece, candidatosObjetivoMaestro,
} from './motor/habilidades.js';

/** Igual que la del motor, pero por defecto roba de `window.deck`. */
export function bajarCartaMaestro(players, neutrals, targetIdx, portalIdx, mazo = window.deck) {
  bajarCartaMaestroMotor(players, neutrals, targetIdx, portalIdx, mazo);
}

/** Interfaz web para las peticiones del motor. */
export const uiNavegador = {
  pedir({ tipo, pregunta, opciones }, responder, cancelar) {
    const abrir = tipo === 'portal' ? pickerPortal : picker;
    // Tras cancelar se vuelve a dibujar la mesa: cancelar puede dejar estado
    // nuevo (p. ej. el Portal fijado del Cronomante) y sin esto la Mesa 3D
    // seguía ofreciendo, al tocar un Portal, habilidades que ya no se pueden
    // activar (el botón llevaba de vuelta al Cronomante pendiente).
    abrir(pregunta, opciones, responder, () => {
      cancelar?.();
      render(window.players, window.neutrals, window.levelIdx);
    });
  },
  avisar(evento) {
    if (evento.tipo === 'accionInvalida') alert(evento.motivo);
  },
};

/**
 * Aplica la habilidad de `name` desde el Portal `stack` de
 * `players[ownerIdx]`. `onComplete` se llama una sola vez, cuando la
 * habilidad tiene efecto de verdad (nunca si se cancela a medias).
 * `players`, `neutrals`, `levelIdx` y `need` se mantienen en la firma por
 * compatibilidad: el motor lee la partida de `estado.partida`, que son los
 * mismos arrays.
 */
export function applyAbility(name, ownerIdx, stack, players, neutrals, levelIdx, need = [], onComplete = () => {}) {
  // Lo elegido se apunta para el historial de jugadas. Si se retoma un
  // Cronomante a medias, se conserva lo elegido en su primer paso.
  const retomaCronomante = name === 'Cronomante' && !!estado.partida.cronomantePortalInvestigado;
  if (!retomaCronomante) elegidos = [];
  const ui = {
    ...uiNavegador,
    pedir(peticion, responder, cancelar) {
      uiNavegador.pedir(peticion, valor => {
        elegidos.push(valor);
        responder(valor);
      }, cancelar);
    },
  };
  aplicarHabilidad(estado.partida, { personaje: name, jugadora: ownerIdx, pila: stack }, ui, onComplete);
}

let elegidos = [];

/** Valores elegidos en los picker() de la última habilidad humana (historial). */
export function eleccionesUltimaHabilidad() {
  return [...elegidos];
}
