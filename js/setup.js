// setup.js
import { $ } from './utils.js';
import { initGame } from './game.js';
import { nombresDisponiblesParaBots } from './bot.js';

/**
 * Inicializa la UI de configuración de la partida.
 * Muestra el formulario de nombres y arranca el juego.
 */
export function initSetup() {
  // Al pulsar 'Continuar', generar inputs según número de jugadoras (entre 2 y 5)
  // y número de autómatas (0..jugadoras). Convención simple: los últimos
  // `nBots` puestos son autómatas, el resto humanas — no configurable por
  // posición en este MVP.
  $('#cfgNext').onclick = () => {
    const n = parseInt($('#numPlayers').value);
    const errorEl = $('#numError');
    const nBots = parseInt($('#numBots').value);
    const botsErrorEl = $('#botsError');

    if (isNaN(n) || n < 2 || n > 5) {
      errorEl.textContent = 'El número de jugadoras debe estar entre 2 y 5.';
      errorEl.classList.remove('hidden');
      return;
    }
    errorEl.classList.add('hidden');

    if (isNaN(nBots) || nBots < 0 || nBots > n) {
      botsErrorEl.textContent = 'El número de autómatas no puede superar el de jugadoras.';
      botsErrorEl.classList.remove('hidden');
      return;
    }
    botsErrorEl.classList.add('hidden');

    const form = $('#nameForm');

    // Si ya hay exactamente los campos necesarios (mismo total Y mismo
    // reparto humanas/bots), no los volvemos a generar.
    const nHumanas = n - nBots;
    const yaGenerado = form.children.length === n
      && Array.from(form.elements).filter(el => el.dataset.tipo === 'humano').length === nHumanas;
    if (yaGenerado) {
      $('#nameWrap').classList.remove('hidden');
      return;
    }

    // Si hay que cambiar el reparto, regeneramos conservando lo que
    // podamos de los nombres humanos ya escritos.
    const valoresPreviosHumanos = Array.from(form.elements)
      .filter(el => el.dataset.tipo === 'humano')
      .map(el => el.value);
    const nombresBots = nombresDisponiblesParaBots(nBots);

    // DEUDA_TECNICA.md ítem 5 (resuelto de paso, al tocar este código para
    // los bots): nombres insertados vía innerHTML sin escapar. Se
    // construyen los <input> con createElement/propiedades en vez de
    // interpolar valores en una plantilla de string.
    form.textContent = '';
    let idxHumanaPrevia = 0;
    for (let i = 0; i < n; i++) {
      const esBot = i >= nHumanas;
      const input = document.createElement('input');
      input.name = `p${i}`;
      if (esBot) {
        input.value = nombresBots[i - nHumanas];
        input.readOnly = true;
        input.dataset.tipo = 'auto';
        input.title = 'Nombre asignado automáticamente a este autómata';
      } else {
        input.placeholder = `Jugadora ${i + 1}`;
        input.value = valoresPreviosHumanos[idxHumanaPrevia] || '';
        input.dataset.tipo = 'humano';
        input.required = true;
        idxHumanaPrevia++;
      }
      form.appendChild(input);
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

    // Leer nombres y crear objetos de jugador. Recorre los propios
    // elementos del formulario (en vez de FormData) para poder distinguir
    // humanas de autómatas vía su dataset.tipo.
    const nombresPorDefecto = ['Javi', 'Isa', 'Julio', 'Adrián'];
    let idxHumana = 0;

    // Cada jugador recibe 3 Gemas de valor 1 (azules) en la preparación,
    // sea humana o autómata.
    Array.from($('#nameForm').elements).forEach(input => {
      const esBot = input.dataset.tipo === 'auto';
      const nombre = esBot
        ? input.value
        : (input.value.trim() || nombresPorDefecto[idxHumana] || `Jugadora ${idxHumana + 1}`);
      if (!esBot) idxHumana++;

      const gemasIniciales = Array.from({ length: 3 }, () => ({ valor: 1, nivel: 'unitaria' }));
      const jugador = { name: nombre, tipo: esBot ? 'auto' : 'humano', hand: [], portals: [], gems: gemasIniciales };
      if (esBot) jugador.dificultad = 'normal'; // único nivel del MVP; ver js/bot.js
      window.players.push(jugador);
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
    $('#boardNeutrals').classList.remove('hidden');
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
