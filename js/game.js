// game.js
import { aprenderAlTerminarPartida } from './aprendizaje-navegador.js';
import { shuffle, draw, composicionMazoTotal, calcularResultadoFinal } from './utils.js';
import { render } from './render.js';
import { jugarTurnoAutomataPasoAPaso } from './bot.js';
import { registrarEnHistorial } from './historial.js';
import { pausaTrasPaso, pausaAntesDeJugar, reiniciarNarrador } from './narrador.js';

import { initSetup } from './setup.js';
import { $ } from './utils.js';
import { estado, reiniciarCamposDeTurno, reiniciarPartida, cargarPartida } from './motor/estado.js';
import { comprobarFinPorManoVacia } from './motor/acciones.js';
import { anunciarTurnoMesa, retardoAutomata, salirDeMesa, mostrarFinMesa, preguntarMesa } from './mesa3d.js';
import { detenerEspectaculo, cuandoTermineEspectaculo } from './espectaculo.js';
import { guardarPartidaEnCurso, leerPartidaGuardada, borrarPartidaGuardada } from './partida-guardada.js';

// Sube cada vez que se sale al menú: un turno de autómata que estaba
// esperando su setTimeout no debe jugar en una partida que ya no está.
let generacionPartida = 0;

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
  reiniciarCamposDeTurno();
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

  // Iniciar primer turno
  nextTurn();

 
}

/**
 * Ejecuta el cambio de turno: lo anuncia en la mesa y repinta.
 */
export function nextTurn() {
  reiniciarCamposDeTurno();
  const current = window.players[window.turn];
  // Fin de partida si la jugadora activa no tiene cartas (regla en el motor).
  const fin = comprobarFinPorManoVacia(estado.partida)[0];
  if (fin) {
    finalizarPartida(fin.motivo);
    return;
  }
  // Foto de la partida al empezar el turno: es la que se retoma al volver
  // desde el menú de inicio (o tras recargar la página).
  guardarPartidaEnCurso(estado.partida);
  // Historial de jugadas: empieza un turno (después de guardar, para que al
  // retomar la partida no salga dos veces).
  registrarEnHistorial(estado.partida, { tipo: 'turno', jugadora: window.turn, texto: `Turno de ${current.name}` });

  // En la Mesa 3D el cambio de turno es un telón o un rótulo (js/mesa3d.js).
  // El turno de una autómata además se narra paso a paso (js/narrador.js),
  // y mientras tanto la mesa no deja jugar a nadie (mesa3d.js).
  const esBot = current.tipo === 'auto';
  anunciarTurnoMesa(current, esBot);
  render(window.players, window.neutrals, window.levelIdx);

  if (esBot) {
    const generacion = generacionPartida;
    // Paso a paso: tras jugar carta y tras activar habilidad, la autómata
    // espera a que acaben las escenas y hace una pausa, para que se pueda
    // seguir lo que ha hecho (rótulo + Portales resaltados + estelas).
    const esperar = (fase, seguir, abortar) => {
      cuandoTermineEspectaculo().then(() => setTimeout(() => {
        if (generacion !== generacionPartida) abortar();
        else seguir();
      }, pausaTrasPaso(fase)));
    };
    setTimeout(() => {
      if (generacion !== generacionPartida) return;
      jugarTurnoAutomataPasoAPaso(window.players, window.neutrals, window.turn, {
        levelIdx: window.levelIdx,
        invocationSet: window.invocationSet,
      }, esperar);
    }, pausaAntesDeJugar(retardoAutomata()));
  }
}

// Finaliza la partida: muestra el recuento final de Gemas y la ganadora (o
// el empate) según REGLAMENTO.md, "Final de la partida", y luego pregunta
// si queremos una nueva partida.
export function finalizarPartida(motivo) {
  // Una partida terminada ya no se puede retomar.
  borrarPartidaGuardada();
  // Las autómatas aprenden de las jugadas de las personas de esta partida.
  aprenderAlTerminarPartida();
  // Marcador final de la mesa, con el botón de jugar otra vez.
  window.juegoTerminado = true;
  const resultado = calcularResultadoFinal(window.players, window.invocacionesCompletadas || []);
  mostrarFinMesa({ motivo, resultado }, () => resetJuego());
}



export function resetJuego() {
  // Mostrar zona de configuración
  $('#setup')?.classList.remove('hidden');
  reiniciarNarrador();
  $('#helpModal')?.classList.add('hidden');

  // Mostrar título y subtítulo
  $('#mainTitle')?.classList.remove('hidden');
  $('#mainSubtitle')?.classList.remove('hidden');

  salirDeMesa();

  // Limpiar el estado de partida (conserva el set de invocación elegido)
  reiniciarPartida();

  // Volver al menú inicial
  initSetup();
}



/** Oculta el menú de inicio; la mesa aparece con el primer render(). */
export function mostrarTablero() {
  $('#setup')?.classList.add('hidden');
  $('#mainTitle')?.classList.add('hidden');
  $('#mainSubtitle')?.classList.add('hidden');
}

/**
 * Botón "Salir": pide confirmación y vuelve al menú de inicio. La partida
 * queda guardada tal como estaba al empezar este turno (ver
 * js/partida-guardada.js), así que desde el menú se puede retomar.
 */
export function salirAlMenu() {
  const partida = estado.partida;
  const enCurso = partida.players.length && !partida.juegoTerminado;
  if (!enCurso) {
    volverAlMenu();
    return;
  }
  const actual = partida.players[partida.turn];
  const aMedias = partida.played || partida.habilidadUsadaEsteTurno;
  const aviso = aMedias
    ? `Lo hecho en este turno no se guarda: al retomar, ${actual.name} empezará su turno de nuevo.`
    : 'La partida queda guardada y podrás retomarla desde el menú de inicio.';
  preguntarMesa(`¿Salir al menú de inicio? ${aviso}`, [
    { val: 'salir', lbl: '🚪 Salir al menú' },
    { val: 'seguir', lbl: 'Seguir jugando' },
  ], val => { if (val === 'salir') volverAlMenu(); });
}

function volverAlMenu() {
  generacionPartida++;
  detenerEspectaculo();
  reiniciarNarrador();
  resetJuego();
}

/** Retoma la partida guardada (botón del menú de inicio). */
export function retomarPartida() {
  const registro = leerPartidaGuardada();
  if (!registro) return false;
  generacionPartida++;
  detenerEspectaculo();
  reiniciarNarrador();
  cargarPartida(registro.partida);
  mostrarTablero();
  nextTurn();
  return true;
}
