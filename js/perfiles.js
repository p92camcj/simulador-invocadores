// js/perfiles.js
//
// Perfil, historial de partidas y ranking (1.42.0). Todo vive en ESTE
// dispositivo (localStorage), sin servidor: cada móvil guarda las partidas
// que ha visto terminar, tanto en la mesa como en cada invitada online.
//
// La parte pura (crearRegistroPartida, anadirAlHistorial, calcularRanking,
// normalizarNombre) no toca el DOM ni window: se prueba en tests/perfiles.mjs.
// La parte de navegador (leer/guardar en localStorage) va al final y nunca
// lanza errores: sin almacenamiento, simplemente no se guarda nada.

export const CLAVE_HISTORIAL = 'invocadores.historialPartidas';
// El perfil es el mismo nombre que se usa para jugar online (panel "Jugar online").
export const CLAVE_PERFIL = 'invocadores.nombreOnline';
export const MAX_PARTIDAS = 300;

/** Nombre comparable: sin espacios de más y sin distinguir mayúsculas ni tildes. */
export function normalizarNombre(n) {
  return String(n ?? '').trim().replace(/\s+/g, ' ').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

/** Identificador nuevo para una partida (se guarda en estado.partida.idPartida). */
export function nuevoIdPartida(ahora = Date.now(), azar = Math.random) {
  return `${ahora.toString(36)}-${Math.floor(azar() * 36 ** 6).toString(36).padStart(6, '0')}`;
}

/**
 * Registro de una partida terminada a partir del marcador final.
 * - `resultado`: el de calcularResultadoFinal()/resultadoFinalExperto().
 * - `jugadoras`: [{ nombre, tipo: 'humano'|'auto' }] en el orden de asiento.
 * - `yo`: nombre de quien usa este dispositivo (su asiento online, o su
 *   perfil si juega en esta pantalla), o null.
 * Devuelve null si no hay con qué identificar la partida.
 */
export function crearRegistroPartida({ id, fecha, resultado, jugadoras = [], modo = null, invocaciones = 0, online = false, yo = null }) {
  if (!id || !resultado?.stats) return null;
  const ganan = new Set((resultado.ganadores || []).map(g => g.idx));
  const lista = resultado.stats.map((st, puesto) => ({
    nombre: String(st.nombre ?? ''),
    tipo: st.esAutomataCentral ? 'central' : (jugadoras[st.idx]?.tipo === 'auto' ? 'auto' : 'humano'),
    gemas: Number(st.total) || 0,
    puesto: puesto + 1,
    gana: ganan.has(st.idx),
  }));
  return {
    id: String(id),
    fecha: fecha || new Date().toISOString(),
    modo,
    invocaciones: Number(invocaciones) || 0,
    objetivoCumplido: resultado.objetivoCumplido !== false,
    online: !!online,
    yo: yo ? String(yo) : null,
    jugadoras: lista,
  };
}

/** Añade un registro al principio del historial, sin duplicados (mismo id) y con tope. */
export function anadirAlHistorial(historial, registro, max = MAX_PARTIDAS) {
  const base = Array.isArray(historial) ? historial : [];
  if (!registro || base.some(r => r?.id === registro.id)) return base;
  return [registro, ...base].slice(0, max);
}

/**
 * Ranking por nombre: partidas, victorias, % de victorias y Gemas medias.
 * Junta a la misma persona aunque escriba su nombre con otras mayúsculas o
 * tildes. Las autómatas salen marcadas (`automata: true`); la autómata
 * central del Modo Experto no entra. Ordenado por victorias, luego %,
 * luego partidas y luego Gemas medias.
 */
export function calcularRanking(historial, { conAutomatas = true } = {}) {
  const porNombre = new Map();
  for (const r of Array.isArray(historial) ? historial : []) {
    for (const j of r?.jugadoras || []) {
      if (j.tipo === 'central' || !j.nombre) continue;
      if (!conAutomatas && j.tipo === 'auto') continue;
      const clave = `${j.tipo === 'auto' ? 'a' : 'h'}:${normalizarNombre(j.nombre)}`;
      const e = porNombre.get(clave) || { nombre: j.nombre, automata: j.tipo === 'auto', partidas: 0, victorias: 0, gemas: 0 };
      e.partidas++;
      if (j.gana) e.victorias++;
      e.gemas += Number(j.gemas) || 0;
      porNombre.set(clave, e);
    }
  }
  return [...porNombre.values()]
    .map(e => ({ ...e, porcentaje: e.partidas ? Math.round((100 * e.victorias) / e.partidas) : 0, gemasMedias: e.partidas ? Math.round((10 * e.gemas) / e.partidas) / 10 : 0 }))
    .sort((a, b) => b.victorias - a.victorias || b.porcentaje - a.porcentaje || b.partidas - a.partidas || b.gemasMedias - a.gemasMedias || a.nombre.localeCompare(b.nombre));
}

// ---------------------------------------------------------------- navegador

function almacen() {
  try { return globalThis.localStorage || null; } catch { return null; }
}

export function leerHistorial() {
  try {
    const h = JSON.parse(almacen()?.getItem(CLAVE_HISTORIAL) || '[]');
    return Array.isArray(h) ? h.filter(r => r && r.id && Array.isArray(r.jugadoras)) : [];
  } catch { return []; }
}

export function guardarHistorial(h) {
  try { almacen()?.setItem(CLAVE_HISTORIAL, JSON.stringify(h)); return true; } catch { return false; }
}

/** Guarda una partida terminada en este dispositivo (una sola vez por id). */
export function registrarPartidaTerminada(datos) {
  const registro = crearRegistroPartida(datos);
  if (!registro) return false;
  const antes = leerHistorial();
  const despues = anadirAlHistorial(antes, registro);
  if (despues === antes) return false;
  return guardarHistorial(despues);
}

export function borrarHistorial() {
  try { almacen()?.removeItem(CLAVE_HISTORIAL); } catch { /* nada */ }
}

export function leerPerfil() {
  try { return almacen()?.getItem(CLAVE_PERFIL) || ''; } catch { return ''; }
}

export function guardarPerfil(nombre) {
  try { almacen()?.setItem(CLAVE_PERFIL, String(nombre ?? '').trim().slice(0, 24)); } catch { /* nada */ }
}
