// game.js
import { shuffle, draw, composicionMazoTotal, calcularResultadoFinal } from './utils.js';
import { render } from './render.js';
import { initActions } from './actions.js';
import { decidirYJugarTurno } from './bot.js';

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
  const composicion = composicionMazoTotal(window.invocationSet);
  const chars = Object.entries(composicion).flatMap(
    ([name, cantidad]) => Array(cantidad).fill(name)
  );

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
  window.cronomanteOnComplete = null;
  window.pickerObjetivoPortal = null;
  // Memoria propia de cada autómata en dificultad 'dificil' (motor
  // probabilístico, ver js/bot-probabilidad.js): vive solo en memoria JS de
  // ESTA partida, nunca se persiste ni sale de la sesión de juego actual.
  window.memoriaBots = [];
  // Orden REAL en que se completan las invocaciones en ESTA partida (se
  // empuja el nivel en actions.js, justo donde ya se reparten sus Gemas) —
  // necesario para el desempate de marcador final (REGLAMENTO.md, "Final
  // de la partida"): la partida puede terminar antes de completar todas,
  // así que no se puede asumir que siempre fue C→B→A completo.
  window.invocacionesCompletadas = [];

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
  window.cronomanteOnComplete = null;
  window.pickerObjetivoPortal = null;
  const current = window.players[window.turn];
  //Se comprueba si hay condición de fin de partida, sin cartas en mano
  if (current.hand.length === 0) {
    finalizarPartida(`${current.name} no tiene cartas en la mano. Fin de la partida.`);
    return;
  }
  
  // Durante el turno de una autómata se ocultan los controles de acción
  // humanos (jugar carta/activar habilidad/terminar turno) para que nadie
  // interfiera a mitad de su turno — el propio bot los sigue invocando por
  // JS (window.tryPlayOnPortal, #btnEndTurn.click()), ocultarlos con CSS
  // no le afecta a él, solo a los clics humanos.
  const esBot = current.tipo === 'auto';
  document.querySelector('#btnCtrlPlay')?.classList.toggle('hidden', esBot);
  document.querySelector('#btnAbility')?.classList.toggle('hidden', esBot);
  document.querySelector('#btnEndTurn')?.classList.toggle('hidden', esBot);

  alert(esBot ? `🤖 ${current.name} está pensando…` : 'Turno de ' + current.name);
  document.querySelector('#lblTurn').textContent =
  `Turno de: ${current.name} — Mazo: ${window.deck.length}`;
  render(window.players, window.neutrals, window.levelIdx);

  if (esBot) {
    setTimeout(() => {
      decidirYJugarTurno(window.players, window.neutrals, window.turn, {
        levelIdx: window.levelIdx,
        invocationSet: window.invocationSet,
      });
    }, 500);
  }
}

/**
 * Construye el texto del recuento final de Gemas y el veredicto (ganadora
 * única, o empate compartido con el motivo del desempate) a partir de
 * `calcularResultadoFinal()` (`utils.js`) — ver REGLAMENTO.md, "Final de la
 * partida". Solo formatea texto plano, sin mutar nada.
 */
function construirMensajeResultadoFinal(players, invocacionesCompletadas) {
  const { stats, ganadores, motivoDesempate } = calcularResultadoFinal(players, invocacionesCompletadas);
  const lineas = stats.map(s => `- ${s.nombre}: ${s.total} Gema${s.total === 1 ? '' : 's'}`);
  const veredicto = ganadores.length === 1
    ? `Ganadora: ${ganadores[0].nombre}` + (motivoDesempate ? ` (desempate: ${motivoDesempate})` : '')
    : `Empate compartido entre ${ganadores.map(g => g.nombre).join(', ')}` + (motivoDesempate ? ` (${motivoDesempate})` : '');
  return `Recuento final de Gemas:\n${lineas.join('\n')}\n\n${veredicto}`;
}

// Finaliza la partida: muestra el recuento final de Gemas y la ganadora (o
// el empate) según REGLAMENTO.md, "Final de la partida", y luego pregunta
// si queremos una nueva partida.
export function finalizarPartida(motivo) {
  const resultado = construirMensajeResultadoFinal(window.players, window.invocacionesCompletadas || []);
  const jugarOtra = confirm(`${motivo}\n\n${resultado}\n\n¿Quieres jugar otra vez?`);
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
  window.cronomanteOnComplete = null;
  window.pickerObjetivoPortal = null;
  window.juegoTerminado = false;
  window.memoriaBots = [];
  window.invocacionesCompletadas = [];

  // Volver al menú inicial
  initSetup();
}


