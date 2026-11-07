// historial.js
//
// Historial de jugadas de la partida: qué ha hecho cada jugadora (persona o
// autómata) en cada turno, en frases para leer en la mesa. Se guarda en
// `estado.partida.historial` (así se conserva al salir y retomar la
// partida) y avisa a quien escuche (js/narrador.js lo enseña en pantalla).
//
// Sin DOM: solo texto a partir de la partida. Nunca nombra una carta que no
// sea pública en la mesa en ese momento (las cartas se juegan bocarriba,
// así que la carta jugada sí se puede nombrar).

/** Máximo de entradas que se guardan por partida (las más antiguas se van). */
export const MAX_ENTRADAS = 400;

const oyentes = new Set();

/** `fn(entrada, partida)` se llama con cada entrada nueva. Devuelve cómo dejar de escuchar. */
export function escucharHistorial(fn) {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/** Número del turno en curso (cuántos turnos se han empezado). */
export function turnoActual(partida) {
  return (partida.historial || []).reduce((n, e) => (e.tipo === 'turno' ? Math.max(n, e.turno) : n), 0);
}

/**
 * Añade una entrada: `{ tipo, jugadora, personaje, texto, portales }`.
 * `tipo` es 'turno' | 'jugada' | 'habilidad' | 'invocacion'; `jugadora` el
 * índice (o null); `personaje` el de la habilidad; `portales` las claves
 * "i:j" / "n:k" de los Portales afectados. `trazos` (`[{ desde, hacia,
 * motivo }]`, con "i:j" / "n:k" / "mano:i") no se guarda: solo se pasa a
 * quien escucha, para dibujar las estelas de los movimientos.
 */
export function registrarEnHistorial(partida, { tipo, jugadora = null, personaje = null, texto, portales = [], trazos = [] }) {
  if (!Array.isArray(partida.historial)) partida.historial = [];
  const turno = tipo === 'turno' ? turnoActual(partida) + 1 : turnoActual(partida);
  const p = jugadora !== null ? partida.players[jugadora] : null;
  const entrada = {
    turno,
    tipo,
    jugadora,
    nombre: p?.name ?? null,
    auto: p?.tipo === 'auto',
    personaje,
    texto,
    portales,
  };
  partida.historial.push(entrada);
  if (partida.historial.length > MAX_ENTRADAS) partida.historial.splice(0, partida.historial.length - MAX_ENTRADAS);
  oyentes.forEach(fn => {
    try { fn({ ...entrada, trazos }, partida); } catch (e) { console.warn('Historial:', e); }
  });
  return entrada;
}

// ---------- Claves y etiquetas de Portal ----------

/** Destino de jugar ('p:j' | 'a:i:j' | 'n:k') → clave absoluta ("i:j" | "n:k"). */
export function claveDeDestino(destKey, jugadora) {
  const partes = destKey.split(':');
  if (partes[0] === 'p') return `${jugadora}:${partes[1]}`;
  if (partes[0] === 'a') return `${partes[1]}:${partes[2]}`;
  return `n:${partes[1]}`;
}

/** Origen de una habilidad ('own:j' | 'central:k') → clave absoluta. */
export function claveDeOrigenHabilidad(origen, jugadora) {
  const [tipo, idx] = origen.split(':');
  return tipo === 'own' ? `${jugadora}:${idx}` : `n:${idx}`;
}

/** Pila de la clave absoluta "i:j" / "n:k" (o null). */
export function pilaDeClave(partida, clave) {
  if (clave.startsWith('n:')) return partida.neutrals[+clave.slice(2)] ?? null;
  const [i, j] = clave.split(':').map(Number);
  return partida.players[i]?.portals[j] ?? null;
}

/** "su Portal 2" (de quien actúa), "el Portal 2 de Ana" o "el Portal central 1". */
export function etiquetaPortal(partida, clave, actorIdx) {
  if (clave.startsWith('n:')) return `el Portal central ${+clave.slice(2) + 1}`;
  const [i, j] = clave.split(':').map(Number);
  if (i === actorIdx) return `su Portal ${j + 1}`;
  return `el Portal ${j + 1} de ${partida.players[i]?.name ?? `jugadora ${i + 1}`}`;
}

/** Nombre con que se ve una carta bocarriba (Metamorfo transformado incluido). */
export function nombreVisible(carta) {
  return carta.aspecto ? `Metamorfo (como ${carta.aspecto})` : carta.name;
}

/** Lo que muestra ahora la cima de un Portal, en público. */
export function describirCima(partida, clave) {
  const pila = pilaDeClave(partida, clave);
  const cima = pila?.at(-1);
  if (!cima) return 'queda vacío';
  return cima.vis?.public ? `muestra ${nombreVisible(cima)}` : 'queda bocabajo';
}

// ---------- Fotos de la mesa (qué ha cambiado) ----------

/** Firma pública de cada Portal: altura de la pila y su cima si es pública. */
export function fotoPortales(partida) {
  const foto = new Map();
  const firma = pila => {
    const cima = pila.at(-1);
    return `${pila.length}|${cima?.vis?.public ? nombreVisible(cima) : '?'}`;
  };
  partida.players.forEach((p, i) => p.portals.forEach((pila, j) => foto.set(`${i}:${j}`, firma(pila))));
  partida.neutrals.forEach((pila, k) => foto.set(`n:${k}`, firma(pila)));
  return foto;
}

/** Claves de los Portales cuya firma pública cambió entre dos fotos. */
export function portalesCambiados(antes, despues) {
  return [...despues.keys()].filter(k => antes.get(k) !== despues.get(k));
}

// ---------- Frases ----------

/**
 * Fase A: `carta` es la carta ya jugada (bocarriba en `clave`), `conocida`
 * si quien jugaba sabía qué carta era.
 */
export function textoJugada(partida, { jugadora, carta, conocida, clave }) {
  const nombre = partida.players[jugadora]?.name ?? '';
  const cual = conocida
    ? nombreVisible(carta)
    : `su carta oculta, sin saber cuál era (resultó ser ${nombreVisible(carta)})`;
  return `${nombre} jugó ${cual} en ${etiquetaPortal(partida, clave, jugadora)}.`;
}

/**
 * Fase B: `detalle` (opcional) es la frase de lo elegido; `cambiados` los
 * Portales que cambiaron, cuya cima nueva se describe al final.
 */
export function textoHabilidad(partida, { jugadora, personaje, origen, detalle, cambiados = [] }) {
  const nombre = partida.players[jugadora]?.name ?? '';
  let texto = `${nombre} activó la habilidad de ${personaje}`;
  if (origen) texto += ` desde ${etiquetaPortal(partida, origen, jugadora)}`;
  texto += detalle ? `: ${detalle}.` : '.';
  if (cambiados.length) {
    const lista = cambiados.map(c => `${etiquetaPortal(partida, c, jugadora)} ${describirCima(partida, c)}`);
    texto += ` Ahora ${lista.join('; ')}.`;
  }
  return texto;
}

/** Invocación completada (evento 'invocacionCompletada' del motor). */
export function textoInvocacion({ nivel, nombre, recompensas = [] }) {
  const reparto = recompensas.filter(r => r.gemas > 0)
    .map(r => `${r.jugadora} +${r.gemas} ${r.gemas === 1 ? 'Gema' : 'Gemas'}`);
  return `✨ Invocación ${nivel} completada (${nombre})`
    + (reparto.length ? `: ${reparto.join(', ')}.` : ', sin Gemas para nadie.');
}

/**
 * Movimientos de una habilidad para dibujar sus estelas, a partir de los
 * Portales que cambiaron y de lo elegido (`elegidos`, valores de picker).
 */
export function trazosHabilidad(partida, { personaje, jugadora, origen, cambiados, elegidos = [] }) {
  const motivo = personaje;
  const duenaDe = c => (c.startsWith('n:') ? null : +c.split(':')[0]);
  switch (personaje) {
    case 'Estratega':
      if (cambiados.length >= 2) {
        const [a, b] = cambiados;
        return [{ desde: a, hacia: b, motivo }, { desde: b, hacia: a, motivo }];
      }
      break;
    case 'Cronista':
      return cambiados.map(c => ({ desde: c, hacia: `mano:${jugadora}`, motivo }));
    case 'Maestro':
      return cambiados.map(c => ({ desde: `mano:${duenaDe(c) ?? jugadora}`, hacia: c, motivo }));
    case 'Aprendiz': {
      const [a, b] = elegidos.map(v => parseInt(v, 10));
      if (Number.isInteger(a) && Number.isInteger(b)) {
        return [{ desde: `mano:${a}`, hacia: `mano:${b}`, motivo }, { desde: `mano:${b}`, hacia: `mano:${a}`, motivo }];
      }
      return [];
    }
    default:
      break;
  }
  const destinos = cambiados.length ? cambiados : (origen ? [origen] : []);
  return destinos.map(c => ({ desde: origen || c, hacia: c, motivo }));
}
