// index.js
import { initSetup } from './setup.js';
import { initGame } from './game.js';
import { LEVELS, INVOCATION_SETS } from './utils.js';
import { initEspectaculo } from './espectaculo.js';
import { instalarAliasGlobales } from './motor/estado.js';
import { initMesa3D } from './mesa3d.js';
import { initAprendizaje } from './aprendizaje-navegador.js';

// Estado global: vive en un único objeto serializable (js/motor/estado.js).
// window.players, window.turn, etc. son alias de ese objeto, para que el
// resto de módulos siga funcionando sin cambios.
instalarAliasGlobales(window);


// Exponer constantes globales para legacy actions.js
window.LEVELS = LEVELS;
window.INVOCATION_SETS = INVOCATION_SETS;

// Al cargar el DOM, iniciar el setup
document.addEventListener('DOMContentLoaded', () => {
  initSetup();
  initEspectaculo();
  initMesa3D();
  initAprendizaje();
});
