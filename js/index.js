// index.js
import { initSetup } from './setup.js';
import { initGame } from './game.js';
import { LEVELS, INVOCATION_SETS } from './utils.js';

// Variables de estado global
window.players = [];
window.neutrals = [];
window.deck = [];
window.levelIdx = 0;
window.turn = 0;
window.played = false;
window.habilidadUsadaEsteTurno = false;
window.debugViewActive = false;
window.selectedCardIdx = null;
window.juegoTerminado = false;
window.invocationSet = 'normal';


// Exponer constantes globales para legacy actions.js
window.LEVELS = LEVELS;
window.INVOCATION_SETS = INVOCATION_SETS;

// Al cargar el DOM, iniciar el setup
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
});
