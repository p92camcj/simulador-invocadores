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

    if (isNaN(n) || n < 2 || n > 5) {
      errorEl.textContent = 'El número de jugadoras debe estar entre 2 y 5.';
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
    window.invocationSet = $('#selInvocationSet')?.value || 'normal';

    // Leer nombres y crear objetos de jugador
    const nombresPorDefecto = ['Javi', 'Isa', 'Julio', 'Adrián'];
    let idx = 0;

    // Cada jugador recibe 3 Gemas de valor 1 (azules) en la preparación.
    new FormData($('#nameForm')).forEach(name => {
      const nombre = name.trim() || nombresPorDefecto[idx] || `Jugadora ${idx + 1}`;
      const gemasIniciales = Array.from({ length: 3 }, () => ({ valor: 1, nivel: 'unitaria' }));
      window.players.push({ name: nombre, hand: [], portals: [], gems: gemasIniciales });
      idx++;
    });

    // Configurar portales según número de jugadoras (docs/reglamento/REGLAMENTO.md, "Preparación"):
    //   2 jugadoras -> 2 portales/jugadora + 1 central
    //   3 jugadoras -> 1 portal/jugadora + 2 centrales
    //   4 jugadoras -> 1 portal/jugadora + 1 central
    //   5 jugadoras -> 1 portal/jugadora + 0 centrales
    const m = window.players.length;
    if (m === 2) {
      window.players.forEach(p => p.portals = [[], []]);
      window.neutrals = [[]];
    } else if (m === 3) {
      window.players.forEach(p => p.portals = [[]]);
      window.neutrals = [[], []];
    } else if (m === 4) {
      window.players.forEach(p => p.portals = [[]]);
      window.neutrals = [[]];
    } else {
      window.players.forEach(p => p.portals = [[]]);
      window.neutrals = [];
    }

    // Ocultar sección de setup y mostrar control de turno
    $('#setup').classList.add('hidden');
    $('#info').classList.remove('hidden');
    $('#boardGrid').classList.remove('hidden');
    $('#btnEndTurn').classList.remove('hidden');
    if ($('#btnCtrlPlay')) $('#btnCtrlPlay').classList.remove('hidden');
    if ($('#btnAbility')) $('#btnAbility').classList.remove('hidden');
    $('#mainTitle')?.classList.add('hidden');
    $('#mainSubtitle')?.classList.add('hidden');

    
    
    // Iniciar la partida
    initGame();
  };
}
