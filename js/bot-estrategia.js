// bot-estrategia.js
// Evaluación ESTRATÉGICA de una jugada de Fase A para la dificultad
// 'dificil' (ver js/bot.js). Sustituye la puntuación "un solo paso" de
// valorEsperadoDeAccion() en Fase A por una que entiende las consecuencias
// reales de la jugada según el reglamento:
//
// 1. **Quién cobra.** Si la jugada cierra la invocación, se calcula el
//    reparto exacto de Gemas (requisito visible y no duplicado en el Portal
//    de cada jugadora, bonus de Pícaro y de Maestro) y se puntúa lo que gana
//    la bot MENOS lo que gana la rival que más se lleva. Antes, cerrar una
//    invocación siempre sumaba, aunque solo cobrasen las rivales.
// 2. **Qué deja para la siguiente jugadora.** Si la jugada NO cierra, se
//    mira si la siguiente jugadora podría cerrarla con su carta privada
//    (desconocida para la bot: se usa la distribución del conteo de cartas)
//    y, si le conviene cerrarla, cuánto ganaría o perdería la bot en ese
//    caso. Así la bot evita "dejar la invocación servida" a una rival, y en
//    cambio se la deja preparada si la mayor parte de las Gemas son suyas.
// 3. **Posición.** Requisitos visibles en exclusiva en Portales propios
//    valen algo aunque la invocación no se cierre aún (pueden taparse, por
//    eso cuentan solo una parte); los de las rivales restan.
//
// La carta oculta propia (que ni la propia bot conoce) se evalúa como
// media ponderada de todas sus identidades posibles — un muestreo
// exhaustivo en vez de aleatorio de los "mundos posibles" (determinización
// en la literatura de IA de juegos de información oculta).
//
// Todo es puro (sin DOM, sin `window`, sin `players`/`neutrals` reales):
// solo recibe la vista saneada de `construirEstadoVisibleParaBot()` y la
// distribución de `estimarProbabilidadesPersonajes()`, así que la bot sigue
// sin poder hacer trampa.

// Pesos heurísticos (no son reglas del juego; ajustables).
// Cuánto pesa lo que gana la mejor rival frente a lo que gana la bot:
// <1 porque en partidas de 3-5 jugadoras ayudar un poco a una rival no es
// tan grave como ganar una misma.
export const PESO_RIVAL = 0.75;
// Fracción del valor de un requisito ya colocado que se cuenta antes de
// que la invocación se cierre (puede taparse o duplicarse por el camino).
export const FACTOR_POSICION = 0.4;
// Probabilidad de que la siguiente jugadora vea y aproveche un cierre que
// tiene a su alcance (no todas juegan perfecto).
export const FACTOR_AMENAZA = 0.8;
// Valor de cada Gema extra de Pícaro / Maestro (siempre valor 1).
const VALOR_GEMA_UNITARIA = 1;

/**
 * Tablero simplificado a partir de la vista: un elemento por Portal con
 * `destKey` (mismo formato que `listaPortalesConDestino()` de bot.js),
 * `dueña` (índice absoluto de jugadora, o `null` si es central), `nombre`
 * visible en la cima (o `null`) y `bloqueado` (vacío u oculto).
 */
export function tableroDesdeVista(vista) {
  const tablero = [];
  vista.jugadoras.forEach(j => {
    j.portales.forEach((estado, idx) => {
      tablero.push({
        destKey: j.esUnoMismo ? `p:${idx}` : `a:${j.idx}:${idx}`,
        dueña: j.idx,
        nombre: estado?.name ?? null,
        bloqueado: !estado?.name,
      });
    });
  });
  vista.neutrales.forEach((estado, idx) => {
    tablero.push({ destKey: `n:${idx}`, dueña: null, nombre: estado?.name ?? null, bloqueado: !estado?.name });
  });
  return tablero;
}

/**
 * Copia del tablero tras jugar `nombre` boca arriba en `destKey`. Respeta el
 * efecto pasivo de la Centinela (REGLAMENTO.md): si se juega una Centinela,
 * las demás Centinelas visibles se giran.
 */
export function aplicarJugadaEnTablero(tablero, destKey, nombre) {
  return tablero.map(p => {
    if (p.destKey === destKey) return { ...p, nombre, bloqueado: false };
    if (nombre === 'Centinela' && p.nombre === 'Centinela') return { ...p, nombre: null, bloqueado: true };
    return p;
  });
}

/** ¿Está cerrada la invocación en este tablero? (todos los Portales visibles y los 3 requisitos presentes) */
export function invocacionCerrada(tablero, need) {
  if (!need.length) return false;
  if (tablero.some(p => p.bloqueado)) return false;
  return need.every(n => tablero.some(p => p.nombre === n));
}

/**
 * Gemas que ganaría cada jugadora (array indexado por jugadora) si la
 * invocación se cierra con este tablero — mismas reglas que
 * `#btnEndTurn` (actions.js) y `aplicarBonusPasivosInvocacion()` (utils.js):
 * requisito visible no duplicado en un Portal con dueña → una Gema del
 * nivel (se usa su valor medio, la Gema concreta es al azar); Maestro
 * requisito, único y sin Pícaro visible → 3 Gemas de 1; cada Pícaro visible
 * en un Portal con dueña → 1 Gema de 1.
 *
 * Simplificación honesta: la vista solo muestra la apariencia, así que un
 * Metamorfo transformado en Pícaro o Maestro se trata como el real.
 */
export function recompensasSiCierra(tablero, need, valorGemaNivel, nJugadoras) {
  const ganancias = new Array(nJugadoras).fill(0);
  need.forEach(n => {
    const con = tablero.filter(p => p.nombre === n);
    if (con.length === 1 && con[0].dueña !== null) ganancias[con[0].dueña] += valorGemaNivel;
  });
  const picaros = tablero.filter(p => p.nombre === 'Pícaro');
  const maestros = tablero.filter(p => p.nombre === 'Maestro');
  if (need.includes('Maestro') && !picaros.length && maestros.length === 1 && maestros[0].dueña !== null) {
    ganancias[maestros[0].dueña] += 3 * VALOR_GEMA_UNITARIA;
  }
  picaros.forEach(p => { if (p.dueña !== null) ganancias[p.dueña] += VALOR_GEMA_UNITARIA; });
  return ganancias;
}

/** Lo que gana `idx` menos `PESO_RIVAL` × lo que gana la rival que más se lleva. */
export function valorRelativo(ganancias, idx) {
  const rivales = ganancias.filter((_, i) => i !== idx);
  const mejorRival = rivales.length ? Math.max(...rivales) : 0;
  return ganancias[idx] - PESO_RIVAL * mejorRival;
}

/**
 * Valor de posición para `idx` de un tablero sin cerrar: requisitos
 * visibles en exclusiva en Portales propios, menos los de la rival mejor
 * colocada, todo multiplicado por `FACTOR_POSICION`.
 */
export function valorPosicional(tablero, need, valorGemaNivel, nJugadoras, idx) {
  const porJugadora = new Array(nJugadoras).fill(0);
  need.forEach(n => {
    const con = tablero.filter(p => p.nombre === n);
    if (con.length === 1 && con[0].dueña !== null) porJugadora[con[0].dueña] += valorGemaNivel;
  });
  return FACTOR_POSICION * valorRelativo(porJugadora, idx);
}

/**
 * Mejor cierre que tiene `jugadora` con una carta `nombre` en este
 * tablero, desde SU punto de vista: devuelve el tablero resultante del
 * cierre que más le conviene (y que le conviene, valor > 0), o `null` si
 * no puede o no le interesa cerrar.
 */
function mejorCierrePara(tablero, need, valorGemaNivel, nJugadoras, jugadora, nombre) {
  const bloqueados = tablero.filter(p => p.bloqueado);
  if (bloqueados.length > 1) return null;
  const destinos = bloqueados.length ? bloqueados : tablero;
  let mejor = null;
  let mejorValor = 0;
  destinos.forEach(p => {
    const t = aplicarJugadaEnTablero(tablero, p.destKey, nombre);
    if (!invocacionCerrada(t, need)) return;
    const v = valorRelativo(recompensasSiCierra(t, need, valorGemaNivel, nJugadoras), jugadora);
    if (v > mejorValor) { mejorValor = v; mejor = t; }
  });
  return mejor;
}

/**
 * Valor esperado, para la bot, de lo que hará la siguiente jugadora con
 * este tablero: para cada identidad posible de su carta privada
 * (`probabilidadPorNombre`), si puede y le conviene cerrar la invocación,
 * se suma lo que ganaría/perdería la bot en ese cierre. Su carta pública
 * (la que ella no ve) no cuenta: no sabe qué es, así que no la jugaría
 * para cerrar a propósito.
 */
export function valorAmenazaSiguiente(tablero, need, valorGemaNivel, nJugadoras, botIdx, siguienteIdx, probabilidadPorNombre) {
  if (siguienteIdx === botIdx || tablero.filter(p => p.bloqueado).length > 1) return 0;
  let ev = 0;
  Object.entries(probabilidadPorNombre).forEach(([nombre, prob]) => {
    if (!prob) return;
    const t = mejorCierrePara(tablero, need, valorGemaNivel, nJugadoras, siguienteIdx, nombre);
    if (t) ev += prob * valorRelativo(recompensasSiCierra(t, need, valorGemaNivel, nJugadoras), botIdx);
  });
  return FACTOR_AMENAZA * ev;
}

/**
 * Valor de jugar una carta de identidad CIERTA `nombre` en `destKey`.
 * Devuelve `{ valor, cierra }`.
 */
export function valorJugadaCierta(tablero, destKey, nombre, ctx) {
  const { need, valorGemaNivel, nJugadoras, botIdx, siguienteIdx, probabilidadPorNombre } = ctx;
  const t = aplicarJugadaEnTablero(tablero, destKey, nombre);
  if (invocacionCerrada(t, need)) {
    return { valor: valorRelativo(recompensasSiCierra(t, need, valorGemaNivel, nJugadoras), botIdx), cierra: true };
  }
  const valor = valorPosicional(t, need, valorGemaNivel, nJugadoras, botIdx)
    + valorAmenazaSiguiente(t, need, valorGemaNivel, nJugadoras, botIdx, siguienteIdx, probabilidadPorNombre);
  return { valor, cierra: false };
}

/**
 * Valor esperado de jugar la carta oculta propia (identidad desconocida
 * para la bot) en `destKey`: media de `valorJugadaCierta` sobre todas sus
 * identidades posibles.
 */
export function valorJugadaOculta(tablero, destKey, ctx) {
  let ev = 0;
  let total = 0;
  Object.entries(ctx.probabilidadPorNombre).forEach(([nombre, prob]) => {
    if (!prob) return;
    ev += prob * valorJugadaCierta(tablero, destKey, nombre, ctx).valor;
    total += prob;
  });
  return total > 0 ? ev / total : 0;
}

/**
 * Puntúa todas las jugadas de Fase A posibles (carta conocida y carta
 * oculta × cada Portal). Devuelve `[{ usaConocida, destKey, valor, cierra }]`.
 */
export function evaluarJugadasFaseA(vista, need, valorGemaNivel, probabilidadPorNombre) {
  const tablero = tableroDesdeVista(vista);
  const nJugadoras = vista.jugadoras.length;
  const ctx = {
    need, valorGemaNivel, nJugadoras, probabilidadPorNombre,
    botIdx: vista.botIdx,
    siguienteIdx: (vista.botIdx + 1) % nJugadoras,
  };
  const conocida = vista.propiaCartaConocida?.name ?? null;
  const resultado = [];
  tablero.forEach(p => {
    if (conocida) {
      const { valor, cierra } = valorJugadaCierta(tablero, p.destKey, conocida, ctx);
      resultado.push({ usaConocida: true, destKey: p.destKey, valor, cierra });
    }
    if (vista.tieneCartaOcultaPropia === false) return; // sin carta oculta (final de partida): no es una jugada posible
    resultado.push({ usaConocida: false, destKey: p.destKey, valor: valorJugadaOculta(tablero, p.destKey, ctx), cierra: false });
  });
  return resultado;
}
