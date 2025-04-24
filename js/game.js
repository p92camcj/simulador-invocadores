// game.js
import { shuffle, draw } from './utils.js';
import { render } from './render.js';
import { initActions } from './actions.js';

import { initSetup } from './setup.js';
import { $ } from './utils.js';

/**
 * Inicia la partida: prepara el mazo, reparte cartas, y lanza el primer turno.
 */
export function initGame() {
  // Construir mazo de personajes
  const chars = [
    ...Array(2).fill('Maestro'),
    ...Array(3).fill('Clarividente'),
    ...Array(3).fill('Ocultista'),
    ...Array(4).fill('Cronomante'),
    ...Array(4).fill('Estratega'),
    ...Array(4).fill('Aprendiz'),
    ...Array(6).fill('Cronista'),
    ...Array(6).fill('Centinela'),
    ...Array(8).fill('Pícaro'),
    ...Array(2).fill('Metamorfo')
  ];
  // Separar metamorfos
const metamorfos = chars.filter(c => c === 'Metamorfo');
let sinMetamorfos = chars.filter(c => c !== 'Metamorfo');

// Quitar 4 cartas aleatorias que no sean metamorfos
shuffle(sinMetamorfos);
const descartadas = sinMetamorfos.splice(0, 38);

// Formar mazo final con metamorfos incluidos
const mazoFinal = [...sinMetamorfos, ...metamorfos];
shuffle(mazoFinal);
window.deck = mazoFinal.map(name => ({ name }));

  // Reparto inicial: 1 visible y 1 oculta por jugadora
  window.players.forEach(p => {
    draw(p, true);
    draw(p, false);
  });

  // Inicializar estado de turnos
  window.levelIdx = 0;
  window.turn = 0;
  window.played = false;

  // Configurar controladores de acciones
  initActions(window.players, window.neutrals);

  // Iniciar primer turno
  nextTurn();

 
}

/**
 * Ejecuta el cambio de turno: alerta, actualiza etiqueta y renderiza.
 */
export function nextTurn() {
  window.played = false;
  const current = window.players[window.turn];
  //Se comprueba si hay condición de fin de partida, sin cartas en mano
  if (current.hand.length === 0) {
    finalizarPartida(`${current.name} no tiene cartas en la mano. Fin de la partida.`);
    return;
  }
  
  alert('Turno de ' + current.name);
  document.querySelector('#lblTurn').textContent =
  `Turno de: ${current.name} — Mazo: ${window.deck.length}`;
  render(window.players, window.neutrals, window.levelIdx);
}

// Finaliza la partida y se pregunta si queremos una nueva partida
function finalizarPartida(motivo) {
  const jugarOtra = confirm(`${motivo}\n\n¿Quieres jugar otra vez?`);
  if (jugarOtra) {
    // Reset completo
    resetJuego(); // o podríamos llamar a initSetup() si quieres mantener el estado sin recarga
  } else {
    window.juegoTerminado = true;
    document.body.innerHTML = `
      <div style="text-align:center; padding: 40px;">
        <h2>Gracias por jugar a «Invocadores» 🧙‍♂️</h2>
        <p>Puedes cerrar esta pestaña o recargar la página si quieres volver a empezar.</p>
        <button onclick="location.reload()" style="padding:10px 20px; font-size:1rem;">Volver a empezar</button>
      </div>
    `;
  }
}



export function resetJuego() {
  // Ocultar zonas de juego
  $('#info')?.classList.add('hidden');
  $('#zoneActive')?.classList.add('hidden');
  $('#zoneOthers')?.classList.add('hidden');
  $('#zoneNeutral')?.classList.add('hidden');
  $('#ctrlPlay')?.classList.add('hidden');
  $('#sectionflex').classList.add('hidden');

  // Mostrar zona de configuración
  $('#setup')?.classList.remove('hidden');
  $('#btnEndTurn')?.classList.add('hidden');
  $('#btnCtrlPlay')?.classList.add('hidden');

  // Mostrar título y subtítulo
  $('#mainTitle')?.classList.remove('hidden');
  $('#mainSubtitle')?.classList.remove('hidden');

  // Limpiar variables globales
  window.players = [];
  window.deck = [];
  window.neutrals = [];
  window.levelIdx = 0;
  window.turn = 0;
  window.played = false;
  window.juegoTerminado = false;

  // Volver al menú inicial
  initSetup();
}


