// bot.js
// Lógica de decisión de jugadoras autómatas ("bots"). Todo lo que decide un
// bot pasa por construirEstadoVisibleParaBot() — una vista saneada del
// estado real, sin la carta oculta propia ni el contenido del mazo — para
// que quede auditable de un vistazo que el bot nunca hace trampa, aunque
// cambie la heurística en el futuro. Las acciones en sí (jugar carta,
// activar habilidad, terminar turno) reutilizan exactamente las mismas
// acciones que usa una jugadora humana: ejecutarJugada() y
// ejecutarFinDeTurno() (actions.js, que llaman al motor y presentan el
// resultado) y aplicarHabilidad() del motor (js/motor/habilidades.js), con
// una "interfaz de autómata" que contesta las peticiones del motor en vez
// de abrir picker(). El bot nunca duplica lógica de reglas ni pulsa botones
// del DOM: solo decide los parámetros por heurística en vez de por clic.
import {
  LEVELS, INVOCATION_SETS, shuffle, contarGemasPorNivel,
  opcionesActivarHabilidad,
  contarGemasUnitarias, tieneClarividenteVisible, todosLosPortales, jugadoraProtegidaPorCentinela,
} from './utils.js';
import { estado } from './motor/estado.js';
import { aplicarHabilidad } from './motor/habilidades.js';
import { completarActivacion, jugarCarta } from './motor/acciones.js';
import { ejecutarJugada, ejecutarFinDeTurno } from './actions.js';
import { envolverHabilidad } from './espectaculo.js';
import { render } from './render.js';
import {
  actualizarMemoriaBot, estimarProbabilidadesPersonajes,
  valorMedioGemaNivel, valorEsperadoDeAccion, personajeMemorizadoEnPortal,
  calcularNecesariosUnicosDeRivales, PESO_ADVERSARIAL,
} from './bot-probabilidad.js';
import { evaluarJugadasFaseA } from './bot-estrategia.js';
import { elegirFaseAExperta, elegirFaseBExperta } from './bot-busqueda.js';

// ---------- Nombres de autómatas ----------
// Pool temático "Invocadores", todos terminados en "bot", con margen de
// sobra para el máximo de 5 jugadoras de una partida.
const POOL_NOMBRES_BOT = [
  'Arcanobot', 'Nigrobot', 'Rúnabot', 'Encantobot', 'Oráculobot',
  'Hechizobot', 'Conjurobot', 'Místicobot', 'Videntebot', 'Brujobot',
];

/** Devuelve `cantidad` nombres únicos del pool, sin repetir dentro de la misma partida. */
export function nombresDisponiblesParaBots(cantidad) {
  const pool = [...POOL_NOMBRES_BOT];
  shuffle(pool);
  return pool.slice(0, cantidad);
}

// ---------- Vista saneada del estado (anti-trampa) ----------

/**
 * ¿Qué hay visible en el top de un Portal, desde el punto de vista de
 * CUALQUIER observadora (incluida la propia bot)? `null` si está vacío,
 * `{ hidden: true }` si tiene carta pero está oculta, `{ name }` (la
 * apariencia — aspecto del Metamorfo si aplica, ver DEUDA_TECNICA.md ítem
 * 14) si es una carta visible. Nunca expone la identidad real de un
 * Metamorfo disfrazado: eso tampoco lo sabría una jugadora humana mirando
 * el tablero.
 */
function estadoPortalVisible(stack) {
  if (!stack.length) return null;
  const top = stack.at(-1);
  if (!top.vis?.public) return { hidden: true };
  return { name: top.aspecto || top.name };
}

/**
 * Construye la vista saneada del estado del juego para la bot `botIdx`.
 * Toda función de decisión del bot debe recibir ÚNICAMENTE lo que devuelve
 * esta función, nunca `players`/`neutrals`/`window.deck` directamente —
 * así queda auditable que el bot no puede hacer trampa aunque cambie la
 * heurística en el futuro.
 *
 * Puede conocer (ver prompt del bot / CLAUDE.md): su propia carta visible,
 * la carta oculta de cualquier OTRA jugadora (pública por reglamento), todo
 * lo que hay boca arriba en cualquier Portal, qué Portales tienen carta
 * oculta (sin saber cuál es), y recuentos de Gemas por nivel de cualquier
 * jugadora (su propio total exacto, el de las demás solo por nivel).
 *
 * NUNCA incluye: su propia carta oculta, la carta visible (solo-dueña) de
 * ninguna otra jugadora, ni nada del mazo de robo.
 */
export function construirEstadoVisibleParaBot(players, neutrals, botIdx) {
  const yo = players[botIdx];
  const propiaVisible = yo.hand.find(c => c.vis?.owner === true) || null;

  return {
    botIdx,
    // La carta oculta propia NUNCA se expone — ni siquiera como `null` con
    // nombre: directamente no existe ningún campo para ella en esta vista.
    propiaCartaConocida: propiaVisible ? { name: propiaVisible.name } : null,
    // ¿Le queda una carta oculta en la mano? Solo el SÍ/NO (cuántas cartas
    // tiene en la mano lo ve cualquiera), nunca cuál es. Al final de la
    // partida, sin mazo, puede quedarle solo la carta que ve: sin este dato
    // la dificultad 'dificil' podía elegir "jugar la oculta" sin tenerla y
    // la partida se quedaba bloqueada.
    tieneCartaOcultaPropia: yo.hand.some(c => c.vis?.owner !== true),
    gemasPropiasTotalExacto: yo.gems.length ? yo.gems.reduce((a, g) => a + (g.valor || 0), 0) : 0,
    // Gemas de valor 1 propias: las únicas con las que se puede pagar un
    // coste (no se da cambio, REGLAMENTO.md fase B).
    gemasUnitariasPropias: contarGemasUnitarias(yo),
    // Fichas de transformación de Metamorfo en uso en la mesa (información
    // pública: la ficha está físicamente encima de la carta). Cada ficha es
    // única, así que ningún Metamorfo puede tomar una de estas.
    transformacionesOcupadas: todosLosPortales(players, neutrals)
      .flatMap(({ stack }) => stack.filter(c => c.aspecto).map(c => c.aspecto)),
    jugadoras: players.map((p, i) => ({
      idx: i,
      nombre: p.name,
      esUnoMismo: i === botIdx,
      portales: p.portals.map(estadoPortalVisible),
      // Carta oculta de cualquier OTRA jugadora: pública por reglamento
      // ("Carta oculta": el resto de jugadores sí puede verla).
      // Excepción: con la Clarividente visible, su mano completa queda oculta
      // para el resto (decisión de mesa, REGLAMENTO.md), así que tampoco se
      // expone aquí.
      cartaOcultaPublica: (i === botIdx || tieneClarividenteVisible(p))
        ? null
        : (p.hand.find(c => c.vis?.others === true)?.name ?? null),
      gemasPorNivel: contarGemasPorNivel(p.gems),
      // Público: una Centinela real visible en sus Portales la protege de
      // las habilidades de las demás (Maestro, Aprendiz...). Nunca aplica a
      // la propia bot frente a sí misma.
      protegidaPorCentinela: i !== botIdx && jugadoraProtegidaPorCentinela(p),
    })),
    neutrales: neutrals.map(estadoPortalVisible),
  };
}

/**
 * Memoria propia de la bot `botIdx`: qué personaje ha visto pasar por cada
 * Portal a lo largo de la partida, aunque ahora esté tapado. Vive en
 * `estado.partida.memoriaBots[botIdx]` (js/motor/estado.js), inicializada/reseteada junto al resto del
 * estado de partida en `initGame()`/`resetJuego()` (`game.js`) — solo en
 * memoria JS de esta partida, nunca se persiste ni sale de la sesión de
 * juego actual. Desde el Bloque 4 de esta tarea, AMBAS dificultades la
 * mantienen (antes solo 'dificil'): es simplemente "lo que este bot ha
 * visto", ni una jugadora humana necesitaría más para recordarlo — el
 * conteo de cartas/probabilidad de `js/bot-probabilidad.js` sigue siendo
 * exclusivo de 'dificil', esto es solo la memoria bruta que Cronomante
 * necesita para tener una decisión con sentido en cualquier nivel.
 */
function obtenerMemoriaBot(botIdx) {
  const memorias = estado.partida.memoriaBots;
  if (!memorias[botIdx]) memorias[botIdx] = { portales: {} };
  return memorias[botIdx];
}

// ---------- Utilidades de decisión (operan solo sobre la vista saneada) ----------

function elegirAlAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function personajesVisiblesActuales(vista) {
  const nombres = [];
  vista.jugadoras.forEach(j => j.portales.forEach(p => { if (p && p.name) nombres.push(p.name); }));
  vista.neutrales.forEach(p => { if (p && p.name) nombres.push(p.name); });
  return nombres;
}

/**
 * Lista de todos los Portales como destinos jugables, con su estado y una
 * etiqueta legible EN TERCERA PERSONA — quien lee el resumen del turno
 * (`mostrarResumenTurnoBot`) es siempre la persona humana observando la
 * partida, nunca la propia autómata, así que la etiqueta nunca puede decir
 * "tu Portal" (bug corregido: antes se generaba en segunda persona, como si
 * la autómata se hablase a sí misma). "su propio Portal" cuando es el
 * Portal de la propia autómata, "el Portal N de {nombre}" cuando es de otra
 * jugadora.
 */
export function listaPortalesConDestino(vista) {
  const lista = [];
  vista.jugadoras.forEach(j => {
    j.portales.forEach((estado, idx) => {
      lista.push({
        destKey: j.esUnoMismo ? `p:${idx}` : `a:${j.idx}:${idx}`,
        esPropio: j.esUnoMismo,
        etiqueta: j.esUnoMismo ? `su propio Portal ${idx + 1}` : `el Portal ${idx + 1} de ${j.nombre}`,
        estado,
      });
    });
  });
  vista.neutrales.forEach((estado, idx) => {
    lista.push({ destKey: `n:${idx}`, esPropio: false, etiqueta: `el Portal Neutral ${idx + 1}`, estado });
  });
  return lista;
}

/**
 * Lista de todos los Portales con clave ABSOLUTA "playerIdx:portalIdx" /
 * "n:k" — el mismo formato que usan `stackFrom()`/`portalesConEstado()`
 * (utils.js) para el objetivo de una habilidad, distinto del formato
 * relativo "p:"/"a:"/"n:" que usa `listaPortalesConDestino()` para JUGAR
 * una carta. Necesaria para la dificultad 'dificil' (`decidirHabilidadFaseBDificil`,
 * `js/bot-probabilidad.js`), que cruza esta clave con `memoriaBot.portales`.
 */
function listaPortalesFormatoHabilidad(vista) {
  const lista = [];
  vista.jugadoras.forEach(j => {
    // Los Portales de una rival protegida por su Centinela no son objetivo
    // legal de ninguna habilidad (REGLAMENTO.md, "Centinela").
    if (j.protegidaPorCentinela) return;
    j.portales.forEach((estado, idx) => lista.push({ key: `${j.idx}:${idx}`, esPropio: j.esUnoMismo, estado }));
  });
  vista.neutrales.forEach((estado, idx) => lista.push({ key: `n:${idx}`, esPropio: false, estado }));
  return lista;
}

// ---------- Fase A: jugar una carta (obligatoria) ----------

/**
 * Ajuste adversarial de la heurística 'normal' de Fase A (Bloque 3 de esta
 * tarea): jugar en el Portal de otra jugadora, o duplicar un personaje, es
 * una jugada completamente legal — hoy el nivel 'normal' nunca lo
 * consideraba, solo jugaba "bien para sí mismo". Dos comprobaciones, en
 * este orden, SOLO con la carta conocida y SOLO con información visible
 * ahora mismo (nada de memoria ni probabilidad, eso es cosa de 'dificil'):
 *
 * 1. **Denegación gratuita por duplicado**: si `conocida` es requisito de
 *    la invocación activa y ya está visible en el Portal de OTRA jugadora,
 *    Y el propio bot no la tiene ya visible en un Portal propio (no
 *    depende de ella para su propia recompensa), jugarla en cualquier
 *    Portal crea un duplicado que anula la recompensa de ese personaje
 *    para todo el mundo — sin coste real para el bot, que no tenía nada
 *    que perder.
 * 2. **Tapar un Portal ajeno a punto de beneficiarse**: si algún Portal de
 *    otra jugadora muestra, como ÚNICA copia visible en toda la mesa, un
 *    personaje requisito de la invocación activa, jugar la carta conocida
 *    ahí lo tapa (dejará de estar visible), denegándole esa recompensa.
 *
 * Devuelve `null` si ninguna de las dos aplica (se sigue con la heurística
 * greedy de siempre).
 */
function decidirJugadaAdversarialNormal(vista, need, conocida, portales) {
  if (need.includes(conocida)) {
    const yaVisibleEnAjeno = vista.jugadoras.some(j => !j.esUnoMismo && j.portales.some(p => p?.name === conocida));
    const propioYaLoTiene = vista.jugadoras.some(j => j.esUnoMismo && j.portales.some(p => p?.name === conocida));
    if (yaVisibleEnAjeno && !propioYaLoTiene) {
      const bloqueantes = portales.filter(p => p.estado === null || p.estado?.hidden);
      const propios = bloqueantes.filter(p => p.esPropio);
      const elegido = elegirAlAzar(propios.length ? propios : bloqueantes.length ? bloqueantes : portales);
      return {
        usaConocida: true,
        destKey: elegido.destKey,
        etiqueta: elegido.etiqueta,
        motivo: `denegación gratuita: duplica a ${conocida} (ya visible en Portal ajeno, el bot no dependía de él)`,
      };
    }
  }

  const conteoVisibles = {};
  personajesVisiblesActuales(vista).forEach(n => { conteoVisibles[n] = (conteoVisibles[n] || 0) + 1; });
  const objetivo = portales.find(p =>
    !p.esPropio && p.estado?.name && need.includes(p.estado.name) && conteoVisibles[p.estado.name] === 1
  );
  if (objetivo) {
    return {
      usaConocida: true,
      destKey: objetivo.destKey,
      etiqueta: objetivo.etiqueta,
      motivo: `tapa ${objetivo.etiqueta}, único requisito visible de esa jugadora`,
    };
  }

  return null;
}

/**
 * Heurística 'normal' de Fase A (ver prompt del bot):
 * 1. Si jugar la carta conocida (la propia "visible") en un Portal
 *    bloqueante (vacío u oculto) deja el combo activo completo, es la
 *    jugada prioritaria.
 * 2. Si no, el ajuste adversarial del Bloque 3 (`decidirJugadaAdversarialNormal`,
 *    arriba) — denegar por duplicado o tapar un Portal ajeno cerca de
 *    completarse.
 * 3. Si no, prefiere la carta conocida sobre la oculta propia (para no
 *    arriesgarse a duplicar sin querer un personaje ya necesario), en un
 *    Portal donde razonablemente ayude: uno bloqueante (propio primero) si
 *    existe, o si no, cualquiera que no tape un personaje que sí forme
 *    parte del combo activo.
 * 4. Solo jugaría la oculta propia si no hubiera carta conocida disponible
 *    — en la práctica no ocurre nunca al empezar turno (la mano siempre
 *    tiene una visible y una oculta), se deja por completitud
 *    arquitectónica y como red de seguridad.
 * 5. Empate entre Portales igual de razonables → elección al azar
 *    (aleatoriedad ponderada, para no ser 100% predecible).
 */
export function decidirJugadaFaseA(vista, need) {
  const conocida = vista.propiaCartaConocida?.name ?? null;
  const portales = listaPortalesConDestino(vista);
  const bloqueantes = portales.filter(p => p.estado === null || p.estado?.hidden);

  if (conocida && bloqueantes.length === 1) {
    const resultantes = [...personajesVisiblesActuales(vista), conocida];
    if (need.every(k => resultantes.includes(k))) {
      return { usaConocida: true, destKey: bloqueantes[0].destKey, etiqueta: bloqueantes[0].etiqueta, motivo: 'completa la invocación activa' };
    }
  }

  // Bloque 3 — ajuste adversarial de bajo coste (desempate/afinado sobre la
  // heurística greedy de siempre, no un motor de búsqueda nuevo): solo se
  // considera con la carta CONOCIDA (nunca arriesga la oculta propia en una
  // jugada puramente defensiva) y solo cuando complementa el atajo de
  // arriba (que sigue teniendo prioridad si con una única jugada se cierra
  // la invocación activa).
  if (conocida) {
    const adversarial = decidirJugadaAdversarialNormal(vista, need, conocida, portales);
    if (adversarial) return adversarial;
  }

  const usaConocida = conocida !== null;
  let candidatos = bloqueantes.length
    ? bloqueantes
    : portales.filter(p => !need.includes(p.estado?.name));
  if (!candidatos.length) candidatos = portales;
  const propios = candidatos.filter(p => p.esPropio);
  const elegido = elegirAlAzar(propios.length ? propios : candidatos);

  return {
    usaConocida,
    destKey: elegido.destKey,
    etiqueta: elegido.etiqueta,
    motivo: usaConocida ? 'jugada razonable con la carta conocida' : 'sin carta conocida disponible',
  };
}

/**
 * Comprobación de cierre para la habilidad activa del
 * Maestro (Bloque 4, 4.7): baja `personaje` (la carta pública conocida de
 * la jugadora objetivo) a UNO de sus Portales propios — el índice exacto
 * no se conoce hasta un segundo picker interno de `abilities.js` (si tiene
 * más de un Portal propio), así que se aproxima: basta con que quede COMO
 * MUCHO un Portal del tablero sin ocupar-y-visible (el de destino, que
 * pasará a estarlo) para considerar que "todos los demás ya lo estaban".
 */
export function completariaLaInvocacionConMaestro(vista, need, personaje) {
  if (!personaje) return false;
  const portales = listaPortalesConDestino(vista);
  const sinOcuparYVisible = portales.filter(p => !(p.estado !== null && !p.estado?.hidden));
  if (sinOcuparYVisible.length > 1) return false;
  const nombresFinal = personajesVisiblesActuales(vista).concat(personaje);
  return need.every(k => nombresFinal.includes(k));
}

/**
 * Heurística 'dificil' de Fase A: puntúa TODAS las combinaciones (carta
 * conocida u oculta) × (Portal) con la evaluación estratégica de
 * `js/bot-estrategia.js` — reparto real de Gemas si la jugada cierra la
 * invocación (lo que gana la bot menos lo que gana la mejor rival), riesgo
 * de dejarle el cierre servido a la siguiente jugadora, y valor de los
 * requisitos ya colocados. La carta oculta se evalúa como media sobre sus
 * identidades posibles (conteo de cartas de `estimarProbabilidadesPersonajes()`).
 * Empate → prefiere la carta conocida y, después, al azar.
 *
 * Antes (hasta 1.26.2) se usaba `valorEsperadoDeAccion()`, que premiaba
 * cerrar la invocación aunque solo cobrasen las rivales y no miraba qué
 * quedaba para el turno siguiente. Esa función se mantiene para Fase B.
 */
export function decidirJugadaFaseADificil(vista, memoriaBot, need, invocationSet, lvl) {
  const probabilidades = estimarProbabilidadesPersonajes(vista, memoriaBot, invocationSet);
  const valorGemaNivel = lvl ? valorMedioGemaNivel(invocationSet, lvl) : 0;
  const etiquetas = new Map(listaPortalesConDestino(vista).map(p => [p.destKey, p.etiqueta]));
  const candidatas = evaluarJugadasFaseA(vista, need, valorGemaNivel, probabilidades.probabilidadPorNombre);

  // Margen pequeño para que diferencias de redondeo cuenten como empate.
  const mejorValor = Math.max(...candidatas.map(c => c.valor));
  const mejores = candidatas.filter(c => c.valor >= mejorValor - 1e-9);
  const mejoresConocidas = mejores.filter(c => c.usaConocida);
  const elegido = elegirAlAzar(mejoresConocidas.length ? mejoresConocidas : mejores);

  return {
    usaConocida: elegido.usaConocida,
    destKey: elegido.destKey,
    etiqueta: etiquetas.get(elegido.destKey),
    motivo: elegido.cierra
      ? `cierra la invocación (valor ${elegido.valor.toFixed(2)})`
      : `valor estratégico ${elegido.valor.toFixed(2)}`,
  };
}

// Función de EJECUCIÓN, no de decisión (esa ya se tomó en
// decidirJugadaFaseA(), solo con `vista`): aquí solo se localiza el ÍNDICE
// de la carta ya decidida (conocida/oculta) dentro de la mano real, sin
// leer nunca `.name` de la oculta — igual que una jugadora humana sabe
// distinguir cuál de sus dos cartas es la que ve sin conocer la otra.
function jugarCartaFaseA(players, botIdx, decision) {
  const mano = players[botIdx].hand;
  const idx = decision.usaConocida
    ? mano.findIndex(c => c.vis?.owner === true)
    : mano.findIndex(c => c.vis?.owner !== true);
  // La misma acción que usan clic/arrastrar/panel humanos (actions.js):
  // el motor valida y aplica, la interfaz presenta.
  ejecutarJugada(idx, decision.destKey);
}

// ---------- Fase B: activar habilidad (opcional) ----------

/**
 * Objetivos de habilidad legalmente activables para `botIdx`, con su
 * identidad REAL (no apariencia — necesaria para saber qué habilidad se
 * dispara de verdad, ver DEUDA_TECNICA.md ítem 14). Reutiliza
 * `opcionesActivarHabilidad()` (utils.js), la misma función que ya filtra
 * legalidad/protección de Centinela para el menú humano de Fase B.
 */
function objetivosHabilidadDisponibles(players, neutrals, botIdx) {
  const opciones = opcionesActivarHabilidad(botIdx, players, neutrals);
  return opciones.map(o => {
    const [tipo, idxStr] = o.val.split(':');
    const idx = parseInt(idxStr, 10);
    const stack = tipo === 'own' ? players[botIdx].portals[idx] : neutrals[idx];
    return { val: o.val, tipo, idx, stack, name: stack.at(-1).name };
  });
}

/**
 * Candidatos de Cronomante (Bloque 4): cada Portal (propio, ajeno o
 * central) donde la MEMORIA de este bot (`obtenerMemoriaBot`, historial
 * bruto de nombres vistos en su cima a lo largo de la partida — nunca la
 * pila real completa) ofrece al menos una alternativa distinta de lo que
 * se ve ahora mismo en su cima (jugar la que ya está arriba sería un
 * no-op). Sin memoria de ese Portal, o sin ninguna alternativa real, ese
 * Portal no es candidato — Cronomante NO tiene sentido "a ciegas".
 */
export function candidatosCronomante(vista, memoriaBot) {
  return listaPortalesFormatoHabilidad(vista)
    .map(p => {
      const historial = memoriaBot.portales[p.key] || [];
      const actual = p.estado && !p.estado.hidden ? p.estado.name : null;
      const alternativas = [...new Set(historial)].filter(n => n !== actual);
      return { ...p, alternativas };
    })
    .filter(p => p.alternativas.length > 0);
}

/**
 * Heurística 'normal' de Cronomante (Bloque 4): SOLO beneficio propio, solo
 * con CERTEZA (la memoria ya vio ese nombre pasar por ese Portal) — nunca
 * el matiz adversarial (sustituir un personaje visible de una rival por
 * otro inútil para ella), que el prompt de esta tarea reserva
 * explícitamente a 'dificil' ("solo si el cálculo de valor esperado lo
 * justifica"). Activa sobre el primer Portal PROPIO cuya memoria recuerde
 * un personaje de `need` que todavía no esté cumplido en ningún sitio de
 * la mesa.
 */
export function decidirCronomanteNormal(vista, memoriaBot, need) {
  const visibles = personajesVisiblesActuales(vista);
  for (const p of candidatosCronomante(vista, memoriaBot)) {
    if (!p.esPropio) continue;
    const nombreDeseado = p.alternativas.find(n => need.includes(n) && !visibles.includes(n));
    if (nombreDeseado) return { portalKey: p.key, nombreDeseado };
  }
  return null;
}

/**
 * Heurística 'normal' de Estratega (Bloque 4, 4.2): intercambia Portales
 * COMPLETOS (con su pila) — la propiedad del personaje visible resultante
 * pasa a quien sea dueña de cada posición. SOLO beneficio propio, solo con
 * certeza: el primer Portal ajeno (o central) que muestre un requisito de
 * `need` todavía no cumplido en la mesa, intercambiado por el primero de
 * los propios Portales (nunca el matiz adversarial puro — reasignar
 * protección de Centinela o quitarle crédito a una rival sin beneficio
 * propio — reservado a 'dificil').
 */
export function decidirEstrategaNormal(vista, need) {
  // "No lo tiene ya" se comprueba contra lo que el propio bot YA muestra en
  // sus Portales propios — nunca contra la visibilidad global del tablero,
  // que trivialmente ya incluiría el propio personaje objetivo (está
  // visible en el Portal `otro` que se está evaluando, por definición).
  const propiosVisibles = vista.jugadoras
    .filter(j => j.esUnoMismo)
    .flatMap(j => j.portales)
    .filter(p => p?.name)
    .map(p => p.name);
  const portales = listaPortalesFormatoHabilidad(vista);
  const propios = portales.filter(p => p.esPropio);
  for (const propio of propios) {
    for (const otro of portales) {
      if (otro.key === propio.key) continue;
      if (otro.estado?.name && need.includes(otro.estado.name) && !propiosVisibles.includes(otro.estado.name)) {
        return { portalKeyA: propio.key, portalKeyB: otro.key };
      }
    }
  }
  return null;
}

/**
 * Pares de Portales candidatos para la heurística 'dificil' de Estratega
 * (Bloque 4, 4.2): no hace falta probar todas las combinaciones posibles
 * del tablero (nº de Portales pequeño, ≤10 en la práctica, así que
 * evaluar todos los pares sería igualmente barato) — el criterio de poda
 * real es de RELEVANCIA, no de coste: (a) cualquier par que involucre un
 * Portal PROPIO (beneficio propio, traer o deshacerse de un personaje), y
 * (b) el par (Portal ajeno vulnerable, Portal central) — denegación PURA
 * sin beneficio propio directo, la única combinación ajena-ajena con una
 * señal de valor clara sin más información. Pares ajeno-ajeno que no sean
 * vulnerables se descartan: no hay ninguna señal de valor esperado que los
 * distinga de un intercambio neutro.
 */
function candidatosEstrategaDificil(vista, necesariosUnicosDeRivales) {
  const portales = listaPortalesFormatoHabilidad(vista);
  const propios = portales.filter(p => p.esPropio);
  const centrales = portales.filter(p => p.key.startsWith('n:'));
  const vulnerables = portales.filter(p =>
    !p.esPropio && Object.values(necesariosUnicosDeRivales).includes(`a:${p.key}`)
  );
  const pares = [];
  propios.forEach(a => portales.forEach(b => { if (a.key !== b.key) pares.push([a, b]); }));
  vulnerables.forEach(v => centrales.forEach(c => pares.push([v, c])));
  return pares;
}

/**
 * Valor esperado de que `personaje` acabe visible en la posición `p`
 * (propia, ajena o central) tras un intercambio de Estratega. Usa el
 * mismo mecanismo adversarial `cubreNecesarioUnicoRival` que Fase A/
 * Cronomante, pero DELIBERADAMENTE quita `necesariosUnicosDeRivales` del
 * `contexto` que le pasa a `valorEsperadoDeAccion()`: el "mecanismo 1"
 * (denegación por duplicado) de esa función asume que el personaje se
 * AÑADE en un sitio nuevo mientras sigue existiendo donde estaba — cierto
 * para jugar una carta desde la mano, pero NO para un intercambio de
 * Estratega, donde el personaje se RELOCALIZA (deja de estar en la
 * posición de origen exactamente en la misma acción). Sin esto, evaluar
 * ambas posiciones del intercambio contaría la misma denegación dos veces.
 * Aquí solo debe aplicar el mecanismo 2 (`cubreNecesarioUnicoRival`, ya
 * calculado arriba con la clave de ESTA posición concreta).
 */
function valorPosicion(p, personaje, probabilidades, contexto, necesariosUnicosDeRivales) {
  const esCentral = p.key.startsWith('n:');
  const destKey = esCentral ? p.key : `a:${p.key}`;
  const cubreNecesarioUnicoRival = !p.esPropio && Object.values(necesariosUnicosDeRivales).includes(destKey);
  return valorEsperadoDeAccion(
    { personaje, esPropio: p.esPropio, esCentral, destKey, cubreNecesarioUnicoRival, completaInvocacionSiSeJuega: false },
    probabilidades,
    { ...contexto, necesariosUnicosDeRivales: undefined }
  );
}

/**
 * Heurística 'dificil' de Estratega (Bloque 4, 4.2): evalúa cada par
 * candidato (`candidatosEstrategaDificil`) por el valor esperado RESULTANTE
 * de intercambiar sus contenidos — el personaje que queda en la posición A
 * es el que antes estaba en B (y viceversa), cada uno valorado según quién
 * sea ahora su dueña. Aproximación honesta, no un cálculo perfecto: no
 * resta el valor que la posición ya tenía ANTES del intercambio (mismo
 * tipo de simplificación que el resto del motor, ver
 * `js/bot-probabilidad.js`) — permite, por ejemplo, preferir quitarle a
 * una rival un requisito casi completo por uno central sin beneficio
 * propio, si el término adversarial lo justifica.
 */
export function decidirEstrategaDificil(vista, need, probabilidades, contexto) {
  const necesariosUnicosDeRivales = contexto.necesariosUnicosDeRivales || {};
  let mejor = null;
  candidatosEstrategaDificil(vista, necesariosUnicosDeRivales).forEach(([a, b]) => {
    const personajeA = a.estado?.hidden ? null : a.estado?.name ?? null;
    const personajeB = b.estado?.hidden ? null : b.estado?.name ?? null;
    const ev = valorPosicion(a, personajeB, probabilidades, contexto, necesariosUnicosDeRivales)
      + valorPosicion(b, personajeA, probabilidades, contexto, necesariosUnicosDeRivales);
    if (!mejor || ev > mejor.ev) mejor = { portalKeyA: a.key, portalKeyB: b.key, ev };
  });
  return mejor;
}

/**
 * Heurística 'normal' de Fase B: Ocultista/Cronista (igual que siempre —
 * útiles solo si falta algún personaje del combo activo por revelar Y
 * existe al menos un Portal oculto legal donde intentarlo), y desde el
 * Bloque 4 también Cronomante y Estratega (arriba). Aprendiz, Metamorfo y
 * Maestro se añaden en los siguientes commits de este mismo bloque.
 */
function decidirHabilidadFaseB(vista, players, neutrals, botIdx, need, memoriaBot) {
  const candidatos = objetivosHabilidadDisponibles(players, neutrals, botIdx);

  const ocultistaCronista = candidatos.filter(c => c.name === 'Ocultista' || c.name === 'Cronista');
  if (ocultistaCronista.length) {
    const visibles = personajesVisiblesActuales(vista);
    const faltaAlgo = need.some(k => !visibles.includes(k));
    const hayPortalOculto = listaPortalesConDestino(vista).some(p => p.estado?.hidden);
    if (faltaAlgo && hayPortalOculto) return elegirAlAzar(ocultistaCronista);
  }

  const cronomante = candidatos.find(c => c.name === 'Cronomante');
  if (cronomante) {
    const decision = decidirCronomanteNormal(vista, memoriaBot, need);
    if (decision) return { ...cronomante, objetivoPreferido: [decision.portalKey, decision.nombreDeseado] };
  }

  const estratega = candidatos.find(c => c.name === 'Estratega');
  if (estratega) {
    const decision = decidirEstrategaNormal(vista, need);
    if (decision) return { ...estratega, objetivoPreferido: [decision.portalKeyA, decision.portalKeyB] };
  }

  const ocultista = candidatos.find(c => c.name === 'Ocultista');
  if (ocultista) {
    const portalKey = decidirOcultistaAdversarialNormal(vista, need);
    if (portalKey) return { ...ocultista, objetivoPreferido: portalKey };
  }

  const cronista = candidatos.find(c => c.name === 'Cronista');
  if (cronista) {
    const portalKey = decidirCronistaAdversarialNormal(vista, need);
    if (portalKey) return { ...cronista, objetivoPreferido: portalKey };
  }

  const aprendiz = candidatos.find(c => c.name === 'Aprendiz');
  if (aprendiz) {
    const decision = decidirAprendizNormal(vista, need);
    if (decision) return { ...aprendiz, objetivoPreferido: [decision.idx1, decision.idx2] };
  }

  const metamorfo = candidatos.find(c => c.name === 'Metamorfo');
  if (metamorfo) {
    const nombreDeseado = decidirMetamorfoNormal(vista, need);
    if (nombreDeseado) return { ...metamorfo, objetivoPreferido: nombreDeseado };
  }

  const maestro = candidatos.find(c => c.name === 'Maestro');
  if (maestro) {
    const targetIdx = decidirMaestroNormal(vista, need);
    if (targetIdx !== null) return { ...maestro, objetivoPreferido: targetIdx };
  }

  return null;
}

/**
 * Heurística 'normal' de Maestro (Bloque 4, 4.7 — ya implementado en una
 * ronda anterior el efecto real de la habilidad, ver `abilities.js`; esta
 * es la primera vez que algún nivel de dificultad la USA): SOLO beneficio
 * propio, con CERTEZA (la carta oculta-para-el-resto de una rival ya es
 * una identidad conocida, `cartaOcultaPublica`, sin necesidad de memoria
 * ni probabilidad) — baja a su Portal la carta pública conocida de la
 * primera rival cuya carta lo sea un requisito activo todavía no cumplido
 * en la mesa. Nunca el matiz adversarial (provocar un duplicado a
 * propósito) — reservado a 'dificil'.
 */
export function decidirMaestroNormal(vista, need) {
  const visibles = personajesVisiblesActuales(vista);
  const candidata = vista.jugadoras.find(j =>
    !j.esUnoMismo && !j.protegidaPorCentinela && j.cartaOcultaPublica && need.includes(j.cartaOcultaPublica) && !visibles.includes(j.cartaOcultaPublica)
  );
  return candidata ? candidata.idx : null;
}

/**
 * Clave (formato de habilidad "i:j"/"n:k") del primer Portal ajeno que
 * muestre, como única copia visible en toda la mesa, un requisito de
 * `need` — objetivo de denegación GRATUITA compartido por Cronista
 * (Bloque 4.3, se lo lleva a la mano) y Ocultista (Bloque 4.5, lo oculta
 * en el sitio): ambas habilidades pueden actuar sobre un Portal YA
 * VISIBLE, así que el criterio de "a quién apuntar" es idéntico, solo
 * cambia el efecto real (que decide `abilities.js`, no esta función).
 */
function primerRequisitoUnicoDeRivalComoClaveHabilidad(vista, need) {
  const necesariosUnicosDeRivales = calcularNecesariosUnicosDeRivales(vista, need);
  const protegidas = new Set(vista.jugadoras.filter(j => j.protegidaPorCentinela).map(j => j.idx));
  const clave = Object.values(necesariosUnicosDeRivales)
    .find(k => !protegidas.has(parseInt(k.split(':')[1], 10)));
  return clave ? clave.slice(2) : null; // "a:i:j" -> "i:j" (formato de habilidad)
}

/**
 * Heurística 'normal' ADICIONAL, específica de Cronista (Bloque 4, 4.3):
 * a diferencia de Ocultista, Cronista puede actuar sobre un Portal YA
 * VISIBLE (se lleva su carta superior a la mano, no solo la oculta) —
 * denegación GRATUITA: si el Portal de una rival muestra, como única
 * copia visible en toda la mesa, un requisito de la invocación activa,
 * llevárselo a la mano se lo quita sin coste real para el bot. El
 * beneficio propio especulativo ("recuperar una carta conocida para
 * jugarla mejor en un turno posterior") se deja fuera de 'normal' —
 * depende de predecir jugadas futuras, demasiado incierto para esta
 * heurística de bajo riesgo; sí lo modela 'dificil' vía valor esperado.
 */
export function decidirCronistaAdversarialNormal(vista, need) {
  return primerRequisitoUnicoDeRivalComoClaveHabilidad(vista, need);
}

/**
 * Heurística 'normal' ADICIONAL, específica de Ocultista (Bloque 4, 4.5):
 * a diferencia de la comprobación compartida con Cronista (que solo
 * revela un Portal OCULTO cuando falta algo del combo), Ocultista también
 * puede actuar sobre un Portal YA VISIBLE (excepto una Centinela visible,
 * restricción que ya aplica `abilities.js` — aquí no hace falta
 * duplicarla) — denegación GRATUITA: esconde el único ejemplar visible en
 * toda la mesa de un requisito de `need` que hoy tiene una RIVAL. El
 * beneficio propio de "esconder mi propio personaje visible para evitar
 * un duplicado en mi contra" se deja fuera de 'normal' por lo específico
 * del timing que requeriría predecir (demasiado incierto para esta
 * heurística de bajo riesgo).
 */
export function decidirOcultistaAdversarialNormal(vista, need) {
  return primerRequisitoUnicoDeRivalComoClaveHabilidad(vista, need);
}

/**
 * Heurística 'normal' de Aprendiz (Bloque 4, 4.4): intercambia manos
 * COMPLETAS de dos jugadoras, manteniendo la orientación de cada carta.
 * SOLO beneficio propio, incluyéndose a sí mismo: si su propia carta
 * conocida ya es útil (requisito activo, todavía no cumplido en la mesa),
 * no la cambia a ciegas; si no, busca una rival cuya carta pública
 * conocida (`cartaOcultaPublica`) SÍ lo sea, y se intercambia con ella.
 * Nunca el uso puramente adversarial de intercambiar las manos de DOS
 * rivales sin el bot — razonar sobre el efecto en terceros sin beneficio
 * propio directo queda reservado a 'dificil' (ver prompt original de esta
 * tarea).
 */
export function decidirAprendizNormal(vista, need) {
  const propiaConocida = vista.propiaCartaConocida?.name ?? null;
  const visibles = personajesVisiblesActuales(vista);
  const propiaEsUtil = propiaConocida && need.includes(propiaConocida) && !visibles.includes(propiaConocida);
  if (propiaEsUtil) return null;

  const propia = vista.jugadoras.find(j => j.esUnoMismo);
  const candidata = vista.jugadoras.find(j =>
    !j.esUnoMismo && !j.protegidaPorCentinela && j.cartaOcultaPublica && need.includes(j.cartaOcultaPublica) && !visibles.includes(j.cartaOcultaPublica)
  );
  if (!candidata) return null;
  return { idx1: propia.idx, idx2: candidata.idx };
}

/**
 * Valor (en unidades de "valor de Gema del nivel activo") de tener
 * `nombre` en la propia mano, sin jugarla todavía: mismo descuento "a
 * futuro, no jugada de inmediato" (`* 0.5`) que ya aplica Cronista a la
 * carta que se lleva a la mano — 0 si no es requisito activo o si ya está
 * cumplido en la mesa (no aportaría nada nuevo).
 */
function valorCartaEnManoPropia(nombre, need, cumplidos, valorGemaNivel) {
  if (!nombre || !need.includes(nombre) || cumplidos.includes(nombre)) return 0;
  return valorGemaNivel * 0.5;
}

/**
 * Heurística 'dificil' de Aprendiz, caso "se incluye a sí mismo" (Bloque 4,
 * 4.4): para cada rival, compara el valor de RECIBIR su carta pública
 * conocida frente a CEDER la propia (`valorCartaEnManoPropia`) — elige la
 * rival con mayor ganancia neta. Deliberadamente NO reutiliza
 * `valorEsperadoDeAccion()`: esa función modela cartas que acaban VISIBLES
 * en un Portal, y aquí ninguna carta se juega, solo cambia de mano — usar
 * su mecanismo de "Portal ajeno/central"/adversarial no tendría sentido
 * (ninguna carta se hace públicamente visible por este intercambio).
 */
export function decidirAprendizPropioDificil(vista, need, cumplidos, valorGemaNivel) {
  const propia = vista.jugadoras.find(j => j.esUnoMismo);
  const propiaConocida = vista.propiaCartaConocida?.name ?? null;
  const valorCedido = valorCartaEnManoPropia(propiaConocida, need, cumplidos, valorGemaNivel);

  let mejor = null;
  vista.jugadoras.forEach(j => {
    if (j.esUnoMismo || j.protegidaPorCentinela || !j.cartaOcultaPublica) return;
    const ev = valorCartaEnManoPropia(j.cartaOcultaPublica, need, cumplidos, valorGemaNivel) - valorCedido;
    if (!mejor || ev > mejor.ev) mejor = { idx1: propia.idx, idx2: j.idx, ev };
  });
  return mejor;
}

/**
 * Heurística 'dificil' de Aprendiz, caso "uso adversarial SIN beneficio
 * propio" (Bloque 4, 4.4): intercambia las manos de DOS RIVALES entre sí
 * (el bot no se incluye), para desbaratar a quien vaya mejor posicionada
 * — solo tiene sentido en 'dificil', razonar sobre el efecto en terceros
 * sin ganancia propia inmediata. "Mejor posicionada" se estima con la
 * única señal disponible sin hacer trampa: el RECUENTO total de Gemas por
 * nivel de cada rival (`vista.jugadoras[i].gemasPorNivel`, nunca su valor
 * exacto). Solo tiene sentido si a la líder se le puede quitar con ello
 * algo que de verdad le convenía (su carta pública conocida es un
 * requisito activo todavía no cumplido) — si no, no hay nada que
 * desbaratar. Requiere al menos 2 rivales (con 1 sola rival, "intercambiar
 * sin el bot" no es posible).
 */
export function decidirAprendizAjenoAjenoDificil(vista, need, cumplidos, valorGemaNivel) {
  const rivales = vista.jugadoras.filter(j => !j.esUnoMismo && !j.protegidaPorCentinela);
  if (rivales.length < 2) return null;

  const totalGemas = j => Object.values(j.gemasPorNivel || {}).reduce((a, b) => a + b, 0);
  const lider = rivales.reduce((max, j) => (totalGemas(j) > totalGemas(max) ? j : max), rivales[0]);
  const otra = rivales.find(j => j.idx !== lider.idx);
  if (!otra) return null;

  if (!lider.cartaOcultaPublica || !need.includes(lider.cartaOcultaPublica) || cumplidos.includes(lider.cartaOcultaPublica)) {
    return null;
  }
  return { idx1: lider.idx, idx2: otra.idx, ev: valorGemaNivel * PESO_ADVERSARIAL };
}

// Coste real de la transformación del Metamorfo (1 Gema unitaria, ver
// REGLAMENTO.md) expresado en las mismas unidades que `valorGemaNivel`
// (valor de Gema) — permite restarlo directamente del valor esperado en
// `decidirMetamorfoDificil()`, algo que el resto del motor no necesita
// modelar porque ninguna otra habilidad de este bloque tiene un coste en
// Gemas propio (el coste de activar un Portal CENTRAL si aplica es aparte,
// ya cobrado por `pagarActivacionPortalCentral()` en `activarHabilidadFaseB`).
const COSTE_GEMA_METAMORFO = 1;

/**
 * Heurística 'normal' de Metamorfo (Bloque 4, 4.6): SOLO beneficio propio,
 * pagando su coste — se transforma en el primer personaje de `need` que
 * todavía no esté cumplido en ningún sitio de la mesa, si tiene con qué
 * pagar (`vista.gemasUnitariasPropias > 0`: solo se paga con Gemas de
 * valor 1, no se da cambio) y si esa ficha de transformación no la tiene
 * ya otro Metamorfo (`vista.transformacionesOcupadas`). Nunca el uso adversarial
 * (duplicar a propósito el requisito visible de una rival sin beneficio
 * propio) — reservado a 'dificil', que sí puede justificarlo con valor
 * esperado frente al coste real de la Gema pagada.
 */
export function decidirMetamorfoNormal(vista, need) {
  if (!vista.gemasUnitariasPropias) return null;
  const visibles = personajesVisiblesActuales(vista);
  const ocupadas = vista.transformacionesOcupadas || [];
  return need.find(k => !visibles.includes(k) && !ocupadas.includes(k)) ?? null;
}

/**
 * Heurística 'dificil' de Metamorfo (Bloque 4, 4.6): evalúa CADA personaje
 * de `need` como transformación candidata, restando siempre el coste real
 * de la Gema pagada (`COSTE_GEMA_METAMORFO`, mismas unidades que
 * `valorGemaNivel`). Reutiliza `valorEsperadoDeAccion()` sin necesitar
 * ningún parámetro nuevo: si el personaje todavía no está cumplido en la
 * mesa, el mecanismo normal de "beneficio propio" ya lo valora (crédito
 * completo si `esPropio`); si SÍ está cumplido porque una rival lo tiene
 * como único ejemplar visible (`contexto.necesariosUnicosDeRivales`), el
 * mecanismo de "denegación por duplicado" de esa misma función ya aplica
 * — transformar el Metamorfo en ese personaje crea un segundo ejemplar
 * visible en un Portal DISTINTO al de la rival (nunca se pasa `destKey`
 * aquí, así que nunca coincide con el suyo), exactamente el caso que esa
 * función modela. No hace falta ningún caso especial para el matiz
 * adversarial: sale solo de reusar la misma maquinaria con `need` completo.
 */
export function decidirMetamorfoDificil(vista, need, esPropio, probabilidades, contexto) {
  if (!vista.gemasUnitariasPropias) return null;
  const ocupadas = vista.transformacionesOcupadas || [];
  let mejor = null;
  need.filter(nombre => !ocupadas.includes(nombre)).forEach(nombre => {
    const ev = valorEsperadoDeAccion(
      { personaje: nombre, esPropio, esCentral: false, completaInvocacionSiSeJuega: false },
      probabilidades,
      contexto
    ) - COSTE_GEMA_METAMORFO;
    if (!mejor || ev > mejor.ev) mejor = { nombreDeseado: nombre, ev };
  });
  return mejor;
}

/**
 * Heurística 'dificil' de Fase B (ver `js/bot-probabilidad.js`): a
 * diferencia de 'normal' (que solo comprueba "hay algún hueco Y algún
 * Portal oculto"), estima el valor esperado de cada objetivo concreto:
 * - **Ocultista/Cronista**: para cada Portal oculto legal, si la memoria
 *   de este bot ya recuerda su última identidad conocida, la evaluación es
 *   determinista; si no, usa la distribución de probabilidad completa.
 *   Cronista se pondera a la baja (`* 0.5`): solo reposiciona la carta a
 *   la propia mano, no la deja jugada de inmediato — su valor es a futuro,
 *   un turno más tarde como mínimo. Además (Bloque 4, 4.3/4.5), tanto
 *   Cronista como Ocultista pueden actuar sobre un Portal YA VISIBLE: se
 *   evalúa el uso ADVERSARIAL de retirar/esconder el único ejemplar
 *   visible de un requisito que hoy solo tiene una rival
 *   (`cubreNecesarioUnicoRival`, mismo mecanismo que el resto del bloque) —
 *   Ocultista sin el descuento `* 0.5` de Cronista, porque ocultarlo en el
 *   sitio deniega la recompensa AHORA MISMO, sin esperar a un turno futuro.
 * - **Maestro**: determinista siempre — la carta oculta-para-el-resto de
 *   otra jugadora ya es una identidad CONOCIDA con certeza (mismo campo
 *   `cartaOcultaPublica` que expone la vista saneada). Como la carta baja
 *   al Portal de ESA jugadora (nunca al del propio Maestro, ver
 *   REGLAMENTO.md), su Gema es para ella, no para el bot — se pondera como
 *   destino "ajeno", pero sigue siendo positivo si desatasca un personaje
 *   de `need` que de otro modo se queda inútil en una mano.
 * Solo activa la habilidad si el mejor valor esperado encontrado es
 * estrictamente positivo — si no, prefiere no gastar el turno de
 * habilidad, igual que 'normal'.
 */
function decidirHabilidadFaseBDificil(vista, players, neutrals, botIdx, need, memoriaBot, invocationSet, lvl) {
  const probabilidades = estimarProbabilidadesPersonajes(vista, memoriaBot, invocationSet);
  const valorGemaNivel = valorMedioGemaNivel(invocationSet, lvl);
  const visibles = personajesVisiblesActuales(vista);
  const cumplidos = need.filter(k => visibles.includes(k));
  // Bloque 3/4: mismo término adversarial que ya usa Fase A — qué requisitos
  // de la invocación activa hoy solo tiene visible una rival, para que
  // Cronomante (y el resto de habilidades de este bloque) puedan
  // considerar denegárselos, no solo el beneficio propio.
  const necesariosUnicosDeRivales = calcularNecesariosUnicosDeRivales(vista, need);
  const contexto = { need, cumplidos, valorGemaNivel, necesariosUnicosDeRivales };

  let mejor = null;
  const considerar = candidato => {
    if (!mejor || candidato.ev > mejor.ev) mejor = candidato;
  };

  objetivosHabilidadDisponibles(players, neutrals, botIdx).forEach(c => {
    if (c.name === 'Ocultista' || c.name === 'Cronista') {
      listaPortalesFormatoHabilidad(vista).filter(p => p.estado?.hidden).forEach(p => {
        const memorizado = personajeMemorizadoEnPortal(memoriaBot, p.key);
        const ev = valorEsperadoDeAccion(
          { personaje: memorizado, esPropio: p.esPropio, esCentral: p.key.startsWith('n:'), completaInvocacionSiSeJuega: false },
          probabilidades,
          contexto
        ) * (c.name === 'Cronista' ? 0.5 : 1);
        considerar({ ...c, ev, objetivoPreferido: p.key });
      });
      if (c.name === 'Cronista' || c.name === 'Ocultista') {
        // Bloque 4.3/4.5: uso adversarial sobre un Portal YA VISIBLE (no
        // solo oculto) — el único ejemplar visible de un requisito que hoy
        // tiene una rival. Cronista se pondera a la baja (`* 0.5`, se lleva
        // la carta a la mano, valor a futuro); Ocultista no (esconderla en
        // el sitio deniega la recompensa de inmediato, este mismo turno).
        listaPortalesFormatoHabilidad(vista)
          .filter(p => !p.esPropio && p.estado?.name)
          .forEach(p => {
            const destKeyFaseA = `a:${p.key}`;
            if (!Object.values(necesariosUnicosDeRivales).includes(destKeyFaseA)) return;
            const ev = valorEsperadoDeAccion(
              { personaje: null, esPropio: false, esCentral: false, destKey: destKeyFaseA, cubreNecesarioUnicoRival: true, completaInvocacionSiSeJuega: false },
              probabilidades,
              contexto
            ) * (c.name === 'Cronista' ? 0.5 : 1);
            considerar({ ...c, ev, objetivoPreferido: p.key });
          });
      }
    } else if (c.name === 'Maestro') {
      // Bloque 4.7: además del beneficio propio ya existente (determinista,
      // ver cabecera de esta función) — bonus si esta jugada, con certeza,
      // deja la invocación activa completa AHORA MISMO
      // (`completariaLaInvocacionConMaestro`), lo que también reparte
      // Gemas al bot si tiene requisitos visibles en su propio Portal — y
      // el matiz adversarial (provocar un duplicado a propósito) sale
      // solo de que `contexto.necesariosUnicosDeRivales` ya está presente:
      // si `j.cartaOcultaPublica` coincide con el único ejemplar visible
      // de OTRA rival, el mecanismo de "denegación por duplicado" de
      // `valorEsperadoDeAccion()` ya se aplica sin caso especial (no se le
      // pasa `destKey`, así que nunca coincide con el de esa rival).
      vista.jugadoras.forEach(j => {
        if (j.esUnoMismo || j.protegidaPorCentinela || !j.cartaOcultaPublica) return;
        const ev = valorEsperadoDeAccion(
          {
            personaje: j.cartaOcultaPublica, esPropio: false, esCentral: false,
            completaInvocacionSiSeJuega: completariaLaInvocacionConMaestro(vista, need, j.cartaOcultaPublica),
          },
          probabilidades,
          contexto
        );
        considerar({ ...c, ev, objetivoPreferido: j.idx });
      });
    } else if (c.name === 'Cronomante') {
      // Bloque 4: además del beneficio propio (recuperar a la cima, en un
      // Portal propio, un personaje memorizado que hace falta), evalúa
      // también el matiz adversarial — sustituir en un Portal AJENO el
      // único ejemplar visible de un requisito por otra alternativa
      // memorizada, denegándoselo a esa rival — con el mismo mecanismo
      // `cubreNecesarioUnicoRival` que ya usa Fase A.
      candidatosCronomante(vista, memoriaBot).forEach(p => {
        const destKeyFaseA = p.key.startsWith('n:') ? p.key : `a:${p.key}`;
        const cubreNecesarioUnicoRival = !p.esPropio &&
          Object.values(necesariosUnicosDeRivales).includes(destKeyFaseA);
        p.alternativas.forEach(nombre => {
          const ev = valorEsperadoDeAccion(
            {
              personaje: nombre, esPropio: p.esPropio, esCentral: p.key.startsWith('n:'),
              destKey: destKeyFaseA, cubreNecesarioUnicoRival, completaInvocacionSiSeJuega: false,
            },
            probabilidades,
            contexto
          );
          considerar({ ...c, ev, objetivoPreferido: [p.key, nombre] });
        });
      });
    } else if (c.name === 'Estratega') {
      const decision = decidirEstrategaDificil(vista, need, probabilidades, contexto);
      if (decision) considerar({ ...c, ev: decision.ev, objetivoPreferido: [decision.portalKeyA, decision.portalKeyB] });
    } else if (c.name === 'Aprendiz') {
      const propioResultado = decidirAprendizPropioDificil(vista, need, cumplidos, valorGemaNivel);
      if (propioResultado) considerar({ ...c, ev: propioResultado.ev, objetivoPreferido: [propioResultado.idx1, propioResultado.idx2] });
      const ajenoResultado = decidirAprendizAjenoAjenoDificil(vista, need, cumplidos, valorGemaNivel);
      if (ajenoResultado) considerar({ ...c, ev: ajenoResultado.ev, objetivoPreferido: [ajenoResultado.idx1, ajenoResultado.idx2] });
    } else if (c.name === 'Metamorfo') {
      const decision = decidirMetamorfoDificil(vista, need, c.tipo === 'own', probabilidades, contexto);
      if (decision) considerar({ ...c, ev: decision.ev, objetivoPreferido: decision.nombreDeseado });
    }
  });

  if (!mejor || mejor.ev <= 0) return null;
  return mejor;
}

function estaOcultoSegunVista(vista, val) {
  if (val.startsWith('n:')) return vista.neutrales[parseInt(val.slice(2), 10)]?.hidden === true;
  const [pi, pj] = val.split(':').map(Number);
  return vista.jugadoras[pi]?.portales[pj]?.hidden === true;
}

/**
 * Elige una opción habilitada de una petición del motor (`opciones` con
 * `{ val, lbl, disabled? }`, ver js/motor/habilidades.js) que no se haya
 * elegido ya en un paso anterior. Si `preferido` coincide con el VALOR de
 * alguna (calculado de antemano por la heurística: un Portal concreto para
 * Ocultista/Cronista/Cronomante/Estratega, el índice de una jugadora para
 * Maestro/Aprendiz, ver `objetivoPreferido` de cada decisión), se usa esa.
 * Si no, se prueba por TEXTO de la etiqueta (segundo paso de Cronomante:
 * sus valores son índices dentro de la pila y solo el nombre visible en la
 * etiqueta identifica la carta, igual que en pantalla para una humana).
 * Si nada aplica, criterio de respaldo de 'normal': preferir un Portal
 * oculto, o al azar.
 */
function elegirOpcionPeticion(opciones, vista, yaElegidos, preferido) {
  // Un objetivo preferido que existe se respeta aunque su valor coincida con
  // el de un paso anterior (p. ej. Maestro: jugadora "1" y su Portal "1").
  const exacta = preferido !== undefined && preferido !== null
    ? opciones.find(o => !o.disabled && String(o.val) === String(preferido))
    : null;
  if (exacta) return { value: String(exacta.val), text: exacta.lbl };
  const disponibles = opciones
    .filter(o => !o.disabled)
    .map(o => ({ value: String(o.val), text: o.lbl }))
    .filter(o => !yaElegidos.includes(o.value));
  if (!disponibles.length) return null;
  if (preferido !== undefined && preferido !== null) {
    const porValor = disponibles.find(o => o.value === String(preferido));
    if (porValor) return porValor;
    const porEtiqueta = disponibles.find(o => o.text?.includes(preferido));
    if (porEtiqueta) return porEtiqueta;
  }
  const ocultos = disponibles.filter(o => estaOcultoSegunVista(vista, o.value));
  return elegirAlAzar(ocultos.length ? ocultos : disponibles);
}

/**
 * Interfaz de autómata para el motor de habilidades: contesta cada
 * petición en el acto (las respuestas son síncronas, así que una
 * habilidad de varios pasos se resuelve entera dentro de la llamada a
 * aplicarHabilidad). `preferidosPorPaso` puede ser un único valor (solo el
 * primer paso) o un array alineado por paso (Estratega, Aprendiz). Los
 * valores elegidos se acumulan en `elegidos`, para el resumen del turno.
 * Sin opciones habilitadas, cancela.
 */
export function crearUiAutomata(vista, preferidosPorPaso) {
  const preferidos = Array.isArray(preferidosPorPaso) ? preferidosPorPaso : [preferidosPorPaso];
  const elegidos = [];
  const avisos = [];
  return {
    elegidos,
    avisos,
    pedir(peticion, responder, cancelar) {
      const elegida = elegirOpcionPeticion(peticion.opciones, vista, elegidos, preferidos[elegidos.length]);
      if (!elegida) {
        cancelar?.();
        return;
      }
      elegidos.push(elegida.value);
      responder(elegida.value);
    },
    avisar(evento) {
      avisos.push(evento);
    },
  };
}

/** Etiqueta EN TERCERA PERSONA de un Portal identificado con clave "playerIdx:portalIdx"/"n:k" (formato de habilidad, ver `listaPortalesFormatoHabilidad`) — usada para describir en el resumen del turno sobre qué Portal actuó una habilidad. */
function etiquetaPortalPorClaveHabilidad(key, vista) {
  if (key === undefined || key === null) return 'un Portal';
  if (key.startsWith('n:')) return `el Portal Neutral ${parseInt(key.slice(2), 10) + 1}`;
  const [pi, pj] = key.split(':').map(Number);
  const j = vista.jugadoras.find(x => x.idx === pi);
  if (!j) return `el Portal ${pj + 1}`;
  return j.esUnoMismo ? `su propio Portal ${pj + 1}` : `el Portal ${pj + 1} de ${j.nombre}`;
}

function nombreJugadoraPorIdx(idx, vista) {
  return vista.jugadoras.find(j => j.idx === idx)?.nombre ?? `jugadora ${idx + 1}`;
}

/** Antepone "de"/"del" a una etiqueta de Portal (`etiquetaPortalPorClaveHabilidad`) con la contracción correcta ("del Portal..." si empieza por "el ", "de su propio..." si no). */
function conDe(etiqueta) {
  return etiqueta.startsWith('el ') ? `del ${etiqueta.slice(3)}` : `de ${etiqueta}`;
}

/**
 * Traduce los valores REALMENTE elegidos en el/los picker() de una
 * activación de habilidad (ver `crearUiAutomata`) a una frase EN
 * TERCERA PERSONA para el resumen del turno — identificando siempre de
 * quién es cada Portal/mano afectada (Bloque 1 de esta tarea). Cubre las
 * habilidades a las que la Fase B del autómata ya da uso real, ampliado a
 * la vez que cada una se añade (ver Bloque 4).
 */
export function describirObjetivoHabilidad(name, valores, vista) {
  switch (name) {
    case 'Ocultista':
      return `cambió la visibilidad ${conDe(etiquetaPortalPorClaveHabilidad(valores[0], vista))}`;
    case 'Cronista':
      return `se llevó a la mano la carta superior ${conDe(etiquetaPortalPorClaveHabilidad(valores[0], vista))}`;
    case 'Maestro':
      return `bajó una carta de la mano de ${nombreJugadoraPorIdx(parseInt(valores[0], 10), vista)} a su propio Portal`;
    case 'Cronomante':
      // El 2º valor elegido es un ÍNDICE dentro de la pila real, no un
      // nombre — no hay forma de traducirlo a un personaje sin releer el
      // DOM ya cerrado, así que el resumen se queda con el Portal
      // manipulado, sin precisar qué carta subió al top.
      return `reorganizó ${conDe(etiquetaPortalPorClaveHabilidad(valores[0], vista))}`;
    case 'Estratega':
      return `intercambió ${etiquetaPortalPorClaveHabilidad(valores[0], vista)} con ${etiquetaPortalPorClaveHabilidad(valores[1], vista)}`;
    case 'Aprendiz':
      return `intercambió la mano de ${nombreJugadoraPorIdx(parseInt(valores[0], 10), vista)} con la de ${nombreJugadoraPorIdx(parseInt(valores[1], 10), vista)}`;
    case 'Metamorfo':
      return `se transformó en ${valores[0]}`;
    default:
      return '';
  }
}

function activarHabilidadFaseB(players, neutrals, botIdx, levelIdx, need, decision, vista) {
  const { val, stack, name, objetivoPreferido } = decision;
  // Igual que la Fase B humana (actions.js): cobra el acceso central si
  // aplica y marca la habilidad como usada (completarActivacion, motor), y
  // refresca la UI. usarAsterisco: false → el autómata paga con una Gema de
  // valor 1 si la tiene y solo revela el asterisco si no le queda otra.
  const alAplicar = envolverHabilidad(name, botIdx, stack, () => {
    completarActivacion(estado.partida, { origen: val, personaje: name, usarAsterisco: false });
    render(players, neutrals, levelIdx);
  });
  const ui = crearUiAutomata(vista, objetivoPreferido);
  aplicarHabilidad(estado.partida, { personaje: name, jugadora: botIdx, pila: stack }, ui, alAplicar);
  // Un Cronomante del autómata que se cancelara a medias (no debería: sus
  // opciones vienen de la misma partida) no puede quedar pendiente para la
  // siguiente jugadora.
  estado.partida.cronomantePortalInvestigado = null;
  return describirObjetivoHabilidad(name, ui.elegidos, vista);
}

// ---------- Resumen del turno (comunicación, sin desvelar la carta oculta) ----------

/**
 * Mensaje del autómata SIEMPRE en tercera persona (lo lee quien observa la
 * partida, nunca la propia autómata — bug corregido en esta tarea, ver
 * `listaPortalesConDestino`/`describirObjetivoHabilidad`).
 */
function mostrarResumenTurnoBot(resumen) {
  const cartaTxt = resumen.usoConocida ? resumen.cartaJugada : 'una carta que no conocía';
  let msg = `🤖 ${resumen.jugadora} jugó ${cartaTxt} en ${resumen.etiquetaPortal}.`;
  if (resumen.habilidad) {
    msg += ` Activó su habilidad de ${resumen.habilidad}`;
    msg += resumen.detalleHabilidad ? `: ${resumen.detalleHabilidad}.` : '.';
  }
  alert(msg);
}

// ---------- Orquestación por dificultad ----------

function decidirYJugarTurnoNormal(players, neutrals, botIdx, contexto, ejecutor) {
  const { levelIdx, invocationSet } = contexto;
  const lvl = LEVELS[levelIdx];
  const need = lvl ? INVOCATION_SETS[invocationSet][lvl].need : [];
  // Bloque 4: la memoria ("qué he visto pasar por cada Portal") ya la usa
  // también el nivel 'normal' — la necesita Cronomante para tener un
  // objetivo con sentido, sin que eso implique conteo de cartas/probabilidad
  // (eso sigue siendo exclusivo de 'dificil', ver `obtenerMemoriaBot`).
  const memoriaBot = obtenerMemoriaBot(botIdx);

  const vistaAntes = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  actualizarMemoriaBot(memoriaBot, vistaAntes);
  const decisionA = decidirJugadaFaseA(vistaAntes, need);
  ejecutor.jugar(players, botIdx, decisionA);

  const resumen = {
    jugadora: players[botIdx].name,
    usoConocida: decisionA.usaConocida,
    cartaJugada: vistaAntes.propiaCartaConocida?.name,
    etiquetaPortal: decisionA.etiqueta,
    habilidad: null,
  };

  // La vista se reconstruye tras Fase A: la carta jugada ya no está en la
  // mano y el Portal destino ahora es visible, así que la Fase B debe
  // decidir con el tablero actualizado, no con el de antes de jugar.
  const vistaTrasA = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  actualizarMemoriaBot(memoriaBot, vistaTrasA);
  const decisionB = decidirHabilidadFaseB(vistaTrasA, players, neutrals, botIdx, need, memoriaBot);
  if (decisionB) {
    resumen.detalleHabilidad = ejecutor.activar(players, neutrals, botIdx, levelIdx, need, decisionB, vistaTrasA);
    resumen.habilidad = decisionB.name;
  }

  ejecutor.resumen(resumen);

  // Fase C/D/E (comprobar invocación, repartir Gemas, robar, avanzar
  // turno): la misma acción que el botón de una jugadora humana.
  ejecutor.terminar();
}

/**
 * Heurística 'dificil' (ver `js/bot-probabilidad.js`): mismas Fases A-E que
 * 'normal', pero Fase A y Fase B deciden por valor esperado en Gemas
 * (conteo de cartas + memoria propia de este bot) en vez de la heurística
 * greedy. Actualiza la memoria del bot ANTES de decidir Fase A (con el
 * tablero tal cual está al empezar el turno) y otra vez antes de decidir
 * Fase B (tras la propia jugada de Fase A, que puede haber revelado un
 * Portal nuevo) — así la memoria queda lo más al día posible en cada
 * decisión, sin depender de que este bot mire fuera de sus propios turnos.
 */
function decidirYJugarTurnoDificil(players, neutrals, botIdx, contexto, ejecutor) {
  const { levelIdx, invocationSet } = contexto;
  const lvl = LEVELS[levelIdx];
  const need = lvl ? INVOCATION_SETS[invocationSet][lvl].need : [];
  const memoriaBot = obtenerMemoriaBot(botIdx);

  const vistaAntes = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  actualizarMemoriaBot(memoriaBot, vistaAntes);
  const decisionA = decidirJugadaFaseADificil(vistaAntes, memoriaBot, need, invocationSet, lvl);
  ejecutor.jugar(players, botIdx, decisionA);

  const resumen = {
    jugadora: players[botIdx].name,
    usoConocida: decisionA.usaConocida,
    cartaJugada: vistaAntes.propiaCartaConocida?.name,
    etiquetaPortal: decisionA.etiqueta,
    habilidad: null,
  };

  const vistaTrasA = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  actualizarMemoriaBot(memoriaBot, vistaTrasA);
  const decisionB = decidirHabilidadFaseBDificil(vistaTrasA, players, neutrals, botIdx, need, memoriaBot, invocationSet, lvl);
  if (decisionB) {
    resumen.detalleHabilidad = ejecutor.activar(players, neutrals, botIdx, levelIdx, need, decisionB, vistaTrasA);
    resumen.habilidad = decisionB.name;
  }

  ejecutor.resumen(resumen);
  ejecutor.terminar();
}

// Dos niveles de dificultad implementados: 'normal' (heurística greedy) y
// 'dificil' (conteo de cartas + valor esperado, ver arriba). Para añadir
// más en el futuro: crear una nueva función `decidirYJugarTurno<Nivel>` con
// la misma firma y añadirla aquí — decidirYJugarTurno() ya despacha por
// `players[botIdx].dificultad`.
/**
 * Heurística 'experta' (js/bot-busqueda.js): simula el turno completo
 * (Fase A + Fase B) con el motor real en varios mundos posibles y elige lo
 * que mejor sale de media. Las candidatas de Fase A son las mismas que
 * puntúa 'dificil' (`evaluarJugadasFaseA`), así que nunca propone jugar una
 * carta oculta que no tiene.
 */
function decidirYJugarTurnoExperta(players, neutrals, botIdx, contexto, ejecutor) {
  const { levelIdx, invocationSet } = contexto;
  const lvl = LEVELS[levelIdx];
  const need = lvl ? INVOCATION_SETS[invocationSet][lvl].need : [];
  const memoriaBot = obtenerMemoriaBot(botIdx);

  const vistaAntes = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  actualizarMemoriaBot(memoriaBot, vistaAntes);
  const probabilidades = estimarProbabilidadesPersonajes(vistaAntes, memoriaBot, invocationSet);
  const valorGemaNivel = lvl ? valorMedioGemaNivel(invocationSet, lvl) : 0;
  const candidatas = evaluarJugadasFaseA(vistaAntes, need, valorGemaNivel, probabilidades.probabilidadPorNombre)
    .map(({ usaConocida, destKey }) => ({ usaConocida, destKey }));
  const elegida = elegirFaseAExperta(estado.partida, botIdx, candidatas, construirEstadoVisibleParaBot,
    probabilidades.probabilidadPorNombre);
  const etiquetas = new Map(listaPortalesConDestino(vistaAntes).map(p => [p.destKey, p.etiqueta]));
  const decisionA = { ...elegida, etiqueta: etiquetas.get(elegida.destKey) };
  ejecutor.jugar(players, botIdx, decisionA);

  const resumen = {
    jugadora: players[botIdx].name,
    usoConocida: decisionA.usaConocida,
    cartaJugada: vistaAntes.propiaCartaConocida?.name,
    etiquetaPortal: decisionA.etiqueta,
    habilidad: null,
  };

  const vistaTrasA = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  actualizarMemoriaBot(memoriaBot, vistaTrasA);
  const b = elegirFaseBExperta(estado.partida, botIdx, construirEstadoVisibleParaBot,
    probabilidades.probabilidadPorNombre);
  if (b) {
    const stack = b.origen.startsWith('own:')
      ? players[botIdx].portals[+b.origen.split(':')[1]]
      : neutrals[+b.origen.split(':')[1]];
    const decisionB = { val: b.origen, stack, name: stack.at(-1).name, objetivoPreferido: b.guion };
    resumen.detalleHabilidad = ejecutor.activar(players, neutrals, botIdx, levelIdx, need, decisionB, vistaTrasA);
    resumen.habilidad = decisionB.name;
  }

  ejecutor.resumen(resumen);
  ejecutor.terminar();
}

const HEURISTICAS_POR_DIFICULTAD = {
  normal: decidirYJugarTurnoNormal,
  dificil: decidirYJugarTurnoDificil,
  experta: decidirYJugarTurnoExperta,
};

/**
 * Punto de entrada único: ejecuta el turno completo (Fases A-E) de la bot
 * `botIdx`, según `players[botIdx].dificultad`.
 */
export function decidirYJugarTurno(players, neutrals, botIdx, contexto, ejecutor = EJECUTOR_WEB) {
  const dificultad = players[botIdx].dificultad || 'normal';
  const heuristica = HEURISTICAS_POR_DIFICULTAD[dificultad] || decidirYJugarTurnoNormal;
  heuristica(players, neutrals, botIdx, contexto, ejecutor);
}

// ---------- Ejecutores: quién lleva a cabo lo que la autómata decide ----------

/**
 * Ejecutor de la web: las mismas acciones que una jugadora humana
 * (actions.js), con render, modo espectáculo y resumen del turno en alert().
 */
const EJECUTOR_WEB = {
  jugar: jugarCartaFaseA,
  activar: activarHabilidadFaseB,
  resumen: mostrarResumenTurnoBot,
  terminar: ejecutarFinDeTurno,
};

/**
 * Ejecutor sin interfaz, solo con el motor (`estado.partida`): lo usa el
 * simulador de partidas `tools/arena.mjs` para jugar miles de partidas en
 * Node. No termina el turno (eso lo hace quien orquesta la partida, con
 * `terminarTurno`/`pasarTurno`), ni muestra nada. `alJugar(resumen)` es
 * opcional, para registrar lo que ha hecho cada autómata.
 */
export function crearEjecutorMotor({ alJugar } = {}) {
  return {
    jugar(players, botIdx, decision) {
      const mano = players[botIdx].hand;
      const cartaIdx = decision.usaConocida
        ? mano.findIndex(c => c.vis?.owner === true)
        : mano.findIndex(c => c.vis?.owner !== true);
      jugarCarta(estado.partida, { cartaIdx, destino: decision.destKey });
    },
    activar(players, neutrals, botIdx, levelIdx, need, decision, vista) {
      const { val, stack, name, objetivoPreferido } = decision;
      const ui = crearUiAutomata(vista, objetivoPreferido);
      aplicarHabilidad(estado.partida, { personaje: name, jugadora: botIdx, pila: stack }, ui, () => {
        completarActivacion(estado.partida, { origen: val, personaje: name, usarAsterisco: false });
      });
      estado.partida.cronomantePortalInvestigado = null;
      return describirObjetivoHabilidad(name, ui.elegidos, vista);
    },
    resumen(resumen) { alJugar?.(resumen); },
    terminar() {},
  };
}
