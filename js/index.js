// index.js
import { initSetup } from './setup.js';
import { initGame } from './game.js';
import { LEVELS, COMBOS, REWARD } from './utils.js';

// Variables de estado global
window.players = [];
window.neutrals = [];
window.deck = [];
window.levelIdx = 0;
window.turn = 0;
window.played = false;

// Exponer constantes globales para legacy actions.js
window.LEVELS = LEVELS;
window.COMBOS = COMBOS;
window.REWARD = REWARD;

// Al cargar el DOM, iniciar el setup
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
});
