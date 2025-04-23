// setup.js
import { $ } from './utils.js';
import { initGame } from './game.js';

/**
 * Inicializa la UI de configuración de la partida.
 * Muestra el formulario de nombres y arranca el juego.
 */
export function initSetup() {
  // Al pulsar 'Continuar', generar inputs según número de jugadoras
  $('#cfgNext').onclick = () => {
    const n = parseInt($('#numPlayers').value);
    const form = $('#nameForm');
    form.innerHTML = '';
    for (let i = 0; i < n; i++) {
      form.innerHTML += `<input name="p${i}" placeholder="Jugadora ${i+1}" required>`;
    }
    $('#nameWrap').classList.remove('hidden');
  };

  // Al pulsar 'Iniciar', leer nombres y configurar jugadores
  $('#btnStart').onclick = e => {
    e.preventDefault();
    // Inicializar arrays globales
    window.players = [];
    window.neutrals = [];

    // Leer nombres y crear objetos de jugador
    new FormData($('#nameForm')).forEach(name => {
      window.players.push({ name, hand: [], portals: [], gems: 1 });
    });

    // Configurar portales según número de jugadoras
    const m = window.players.length;
    if (m === 2) {
      window.players.forEach(p => p.portals = [[], []]);
    } else if (m === 3) {
      window.players.forEach(p => p.portals = [[]]);
      window.neutrals = [[]];
      document.querySelector('#zoneNeutral').classList.remove('hidden');
    } else {
      window.players.forEach(p => p.portals = [[]]);
    }

    // Ocultar sección de setup y mostrar control de turno
    $('#setup').classList.add('hidden');
    $('#btnEndTurn').classList.remove('hidden');
    if ($('#btnCtrlPlay')) $('#btnCtrlPlay').classList.remove('hidden');
    
    // Iniciar la partida
    initGame();
  };
}
