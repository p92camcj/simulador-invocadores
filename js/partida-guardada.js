// partida-guardada.js
//
// Salir de la partida y retomarla después. Al empezar cada turno se guarda
// una foto del estado de partida (`serializarPartida`, js/motor/estado.js)
// en localStorage. Al salir al menú, o si se recarga la página, la pantalla
// de inicio ofrece retomarla desde el principio de ese turno.
//
// Se guarda al EMPEZAR el turno a propósito: es un momento en el que la
// partida está completa y coherente (sin pickers abiertos, sin escenas ni
// habilidades a medias). Si alguien sale a mitad de turno, al volver repite
// ese turno desde el principio.

import { serializarPartida } from './motor/estado.js';

const CLAVE = 'invocadores.partidaGuardada';

// Copia en memoria por si el navegador no deja usar localStorage.
let enMemoria = null;

/** Guarda la partida actual (llamar al empezar cada turno). */
export function guardarPartidaEnCurso(partida) {
  if (!partida?.players?.length || partida.juegoTerminado) return;
  const registro = {
    partida: serializarPartida(partida),
    fecha: new Date().toISOString(),
    nombres: partida.players.map(p => p.name),
    turnoDe: partida.players[partida.turn]?.name || '',
    invocaciones: (partida.invocacionesCompletadas || []).length,
  };
  enMemoria = registro;
  try { localStorage.setItem(CLAVE, JSON.stringify(registro)); } catch { /* se queda en memoria */ }
}

/** La partida guardada, o null si no hay ninguna válida. */
export function leerPartidaGuardada() {
  let registro = enMemoria;
  try {
    const texto = localStorage.getItem(CLAVE);
    if (texto) registro = JSON.parse(texto);
  } catch { /* se usa la copia en memoria */ }
  if (!registro || typeof registro.partida !== 'string') return null;
  try {
    const partida = JSON.parse(registro.partida);
    if (!Array.isArray(partida.players) || !partida.players.length || partida.juegoTerminado) return null;
  } catch {
    return null;
  }
  return registro;
}

/** Olvida la partida guardada (al terminarla o al descartarla). */
export function borrarPartidaGuardada() {
  enMemoria = null;
  try { localStorage.removeItem(CLAVE); } catch { /* nada */ }
}

/** Texto corto para el aviso de la pantalla de inicio. */
export function describirPartidaGuardada(registro) {
  const nombres = (registro.nombres || []).join(', ');
  const hechas = registro.invocaciones || 0;
  let cuando = '';
  const fecha = new Date(registro.fecha);
  if (!Number.isNaN(fecha.getTime())) {
    cuando = ` · ${fecha.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}, ${fecha.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}`;
  }
  const progreso = hechas === 0 ? 'Ninguna invocación completada'
    : hechas === 1 ? '1 invocación completada' : `${hechas} invocaciones completadas`;
  return `${nombres}. Le toca a ${registro.turnoDe}. ${progreso}${cuando}.`;
}
