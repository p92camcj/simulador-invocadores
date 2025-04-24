// game.js
import { shuffle, draw } from './utils.js';
import { render } from './render.js';
import { initActions } from './actions.js';

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
const descartadas = sinMetamorfos.splice(0, 4);

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
  alert('Turno de ' + current.name);
  document.querySelector('#lblTurn').textContent = 'Turno de: ' + current.name;
  render(window.players, window.neutrals, window.levelIdx);
}
