// game.js
import { shuffle, draw, PERSONAJES_NO_ANIMALES } from './utils.js';
import { render } from './render.js';
import { initActions } from './actions.js';

import { initSetup } from './setup.js';
import { $ } from './utils.js';

/**
 * Inicia la partida: prepara el mazo, reparte cartas, y lanza el primer turno.
 */
export function initGame() {
  // Construir mazo de personajes — cantidades reales de "Modo normal" según
  // docs/reglamento/REGLAMENTO.md ("Preparación del mazo de personajes"): no
  // incluye Entusiasta (expansión aparte) ni Animales salvo que el set de
  // invocación elegido sea 'introductorio'. El set 'floral' NO es una
  // tercera variante de mazo: reutiliza este mismo mazo de "Modo normal"
  // (solo cambian nombre/combo de las cartas de invocación en
  // INVOCATION_SETS.floral), porque sus personajes requeridos (Ocultista,
  // Centinela, Maestro, Clarividente...) no existen en el mazo introductorio.
  const cantidadesModoNormal = {
    Maestro: 2, Clarividente: 2, Ocultista: 2, Cronomante: 3, Estratega: 3,
    Cronista: 4, Aprendiz: 4, Centinela: 4, 'Pícaro': 6, Metamorfo: 2,
  };
  const charsBase = PERSONAJES_NO_ANIMALES.flatMap(
    name => Array(cantidadesModoNormal[name]).fill(name)
  );
  const necesitaAnimales = window.invocationSet === 'introductorio';
  const chars = necesitaAnimales
    ? [...charsBase, ...Array(3).fill('Reena'), ...Array(3).fill('Sora'), ...Array(3).fill('Lumo')]
    : charsBase;

  // El Metamorfo ya forma parte del mazo desde el principio (no se baraja
  // aparte). Se saca al azar 2 cartas sin mirarlas y se dejan en la caja.
  shuffle(chars);
  const descartadas = chars.splice(0, 2);
  window.deck = chars.map(name => ({ name }));

  // Reparto inicial: 1 visible y 1 oculta por jugadora
  window.players.forEach(p => {
    draw(p, true);
    draw(p, false);
  });

  // Inicializar estado de turnos
  window.levelIdx = 0;
  window.turn = 0;
  window.played = false;
  window.habilidadUsadaEsteTurno = false;
  window.selectedCardIdx = null;
  window.cronomantePortalInvestigado = null;
  window.pickerObjetivoPortal = null;

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
  window.habilidadUsadaEsteTurno = false;
  window.selectedCardIdx = null;
  window.cronomantePortalInvestigado = null;
  window.pickerObjetivoPortal = null;
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
export function finalizarPartida(motivo) {
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
  $('#boardNeutrals')?.classList.add('hidden');
  $('#boardGrid')?.classList.add('hidden');
  $('#btnPlayCancel')?.classList.add('hidden');
  $('#ctrlPlay')?.classList.add('hidden');

  // Mostrar zona de configuración
  $('#setup')?.classList.remove('hidden');
  $('#btnEndTurn')?.classList.add('hidden');
  $('#btnCtrlPlay')?.classList.add('hidden');
  $('#btnAbility')?.classList.add('hidden');

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
  window.habilidadUsadaEsteTurno = false;
  window.selectedCardIdx = null;
  window.cronomantePortalInvestigado = null;
  window.pickerObjetivoPortal = null;
  window.juegoTerminado = false;

  // Volver al menú inicial
  initSetup();
}


