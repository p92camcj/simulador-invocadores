// setup.js
import { $ } from './utils.js';
import { initGame } from './game.js';

/**
 * Inicializa la UI de configuración de la partida.
 * Muestra el formulario de nombres y arranca el juego.
 */
export function initSetup() {
  // Al pulsar 'Continuar', generar inputs según número de jugadoras (entre 2 y 4)
  $('#cfgNext').onclick = () => {
    const n = parseInt($('#numPlayers').value);
    const errorEl = $('#numError');

    if (isNaN(n) || n < 2 || n > 4) {
      errorEl.textContent = 'El número de jugadoras debe estar entre 2 y 4.';
      errorEl.classList.remove('hidden');
      return;
    }

    errorEl.classList.add('hidden');
    const form = $('#nameForm');

    // Si ya hay los campos necesarios, no los volvemos a generar
    if (form.children.length === n) {
      $('#nameWrap').classList.remove('hidden');
      return;
    }

    // Si hay que cambiar el número, regeneramos y conservamos lo que podamos
    const valoresPrevios = Array.from(form.elements).map(input => input.value);

    form.innerHTML = '';
    for (let i = 0; i < n; i++) {
      const nombre = valoresPrevios[i] || '';
      form.innerHTML += `<input name="p${i}" placeholder="Jugadora ${i + 1}" value="${nombre}" required>`;
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
    const nombresPorDefecto = ['Javi', 'Isa', 'Julio', 'Adrián'];
    let idx = 0;

    new FormData($('#nameForm')).forEach(name => {
      const nombre = name.trim() || nombresPorDefecto[idx] || `Jugadora ${idx + 1}`;
      window.players.push({ name: nombre, hand: [], portals: [], gems: 1 });
      idx++;
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
    $('#info').classList.remove('hidden');
    $('#zoneActive').classList.remove('hidden');
    $('#zoneOthers').classList.remove('hidden');
    $('#btnEndTurn').classList.remove('hidden');
    $('#info').classList.remove('hidden');
    $('#sectionflex').classList.remove('hidden');
    if ($('#btnCtrlPlay')) $('#btnCtrlPlay').classList.remove('hidden');
    $('#mainTitle')?.classList.add('hidden');
    $('#mainSubtitle')?.classList.add('hidden');

    
    
    // Iniciar la partida
    initGame();
  };
}
