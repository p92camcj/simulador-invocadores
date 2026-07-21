// bot.js
// Lógica de decisión de jugadoras autómatas ("bots"). Todo lo que decide un
// bot pasa por construirEstadoVisibleParaBot() — una vista saneada del
// estado real, sin la carta oculta propia ni el contenido del mazo — para
// que quede auditable de un vistazo que el bot nunca hace trampa, aunque
// cambie la heurística en el futuro. Las acciones en sí (jugar carta,
// activar habilidad, terminar turno) reutilizan exactamente las mismas
// funciones/controles que usa una jugadora humana (window.tryPlayOnPortal,
// applyAbility(), el propio botón #btnEndTurn) — el bot nunca duplica
// lógica de reglas, solo decide los parámetros por heurística en vez de
// por clic.
import {
  LEVELS, INVOCATION_SETS, shuffle, contarGemasPorNivel,
  opcionesActivarHabilidad, pagarActivacionPortalCentral,
} from './utils.js';
import { applyAbility } from './abilities.js';
import { render } from './render.js';
import {
  actualizarMemoriaBot, estimarProbabilidadesPersonajes,
  valorMedioGemaNivel, valorEsperadoDeAccion, personajeMemorizadoEnPortal,
} from './bot-probabilidad.js';

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
    gemasPropiasTotalExacto: yo.gems.length ? yo.gems.reduce((a, g) => a + (g.valor || 0), 0) : 0,
    jugadoras: players.map((p, i) => ({
      idx: i,
      nombre: p.name,
      esUnoMismo: i === botIdx,
      portales: p.portals.map(estadoPortalVisible),
      // Carta oculta de cualquier OTRA jugadora: pública por reglamento
      // ("Carta oculta": el resto de jugadores sí puede verla).
      cartaOcultaPublica: i === botIdx ? null : (p.hand.find(c => c.vis?.others === true)?.name ?? null),
      gemasPorNivel: contarGemasPorNivel(p.gems),
    })),
    neutrales: neutrals.map(estadoPortalVisible),
  };
}

/**
 * Memoria propia de la bot `botIdx` (conteo de cartas de la dificultad
 * 'dificil', ver `js/bot-probabilidad.js`): qué personaje ha visto pasar
 * por cada Portal a lo largo de la partida, aunque ahora esté tapado.
 * Vive en `window.memoriaBots[botIdx]`, inicializada/reseteada junto al
 * resto del estado de partida en `initGame()`/`resetJuego()` (`game.js`) —
 * solo en memoria JS de esta partida, nunca se persiste ni sale de la
 * sesión de juego actual. La dificultad 'normal' no la usa.
 */
function obtenerMemoriaBot(botIdx) {
  if (!window.memoriaBots) window.memoriaBots = [];
  if (!window.memoriaBots[botIdx]) window.memoriaBots[botIdx] = { portales: {} };
  return window.memoriaBots[botIdx];
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
    j.portales.forEach((estado, idx) => lista.push({ key: `${j.idx}:${idx}`, esPropio: j.esUnoMismo, estado }));
  });
  vista.neutrales.forEach((estado, idx) => lista.push({ key: `n:${idx}`, esPropio: false, estado }));
  return lista;
}

// ---------- Fase A: jugar una carta (obligatoria) ----------

/**
 * Heurística 'normal' de Fase A (ver prompt del bot):
 * 1. Si jugar la carta conocida (la propia "visible") en un Portal
 *    bloqueante (vacío u oculto) deja el combo activo completo, es la
 *    jugada prioritaria.
 * 2. Si no, prefiere la carta conocida sobre la oculta propia (para no
 *    arriesgarse a duplicar sin querer un personaje ya necesario), en un
 *    Portal donde razonablemente ayude: uno bloqueante (propio primero) si
 *    existe, o si no, cualquiera que no tape un personaje que sí forme
 *    parte del combo activo.
 * 3. Solo jugaría la oculta propia si no hubiera carta conocida disponible
 *    — en la práctica no ocurre nunca al empezar turno (la mano siempre
 *    tiene una visible y una oculta), se deja por completitud
 *    arquitectónica y como red de seguridad.
 * 5. Empate entre Portales igual de razonables → elección al azar
 *    (aleatoriedad ponderada, para no ser 100% predecible).
 */
function decidirJugadaFaseA(vista, need) {
  const conocida = vista.propiaCartaConocida?.name ?? null;
  const portales = listaPortalesConDestino(vista);
  const bloqueantes = portales.filter(p => p.estado === null || p.estado?.hidden);

  if (conocida && bloqueantes.length === 1) {
    const resultantes = [...personajesVisiblesActuales(vista), conocida];
    if (need.every(k => resultantes.includes(k))) {
      return { usaConocida: true, destKey: bloqueantes[0].destKey, etiqueta: bloqueantes[0].etiqueta, motivo: 'completa la invocación activa' };
    }
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
 * ¿Jugar `personaje` (identidad CIERTA) en `destKeyDestino` deja la
 * invocación activa completa AHORA MISMO? Generaliza el atajo de
 * `decidirJugadaFaseA` (que solo lo comprobaba para el caso "un único
 * Portal bloqueante") a CUALQUIER Portal candidato — necesario para que la
 * dificultad 'dificil' pueda comparar por valor esperado en vez de solo
 * por ese atajo. Requiere que TODOS los Portales del tablero acaben
 * ocupados y visibles (el destino lo estará tras esta jugada; el resto ya
 * deben estarlo) y que los 3 personajes de `need` queden presentes.
 */
function completariaLaInvocacion(vista, need, personaje, destKeyDestino) {
  if (!personaje) return false;
  const portales = listaPortalesConDestino(vista);
  const todosOcupados = portales.every(p =>
    p.destKey === destKeyDestino || (p.estado !== null && !p.estado?.hidden)
  );
  if (!todosOcupados) return false;
  const nombresFinal = personajesVisiblesActuales(vista).concat(personaje);
  return need.every(k => nombresFinal.includes(k));
}

/**
 * Heurística 'dificil' de Fase A (ver `js/bot-probabilidad.js` y el prompt
 * original de esta tarea): en vez del atajo greedy de `decidirJugadaFaseA`,
 * evalúa TODAS las combinaciones (carta conocida u oculta) × (Portal
 * candidato) por valor esperado en Gemas (`valorEsperadoDeAccion()`) y
 * elige la de mayor valor. Empate → prefiere la carta conocida (menos
 * arriesgado que la oculta, cuya identidad ni el propio bot conoce) y,
 * como último desempate, al azar (no 100% predecible, mismo criterio que
 * 'normal').
 */
function decidirJugadaFaseADificil(vista, memoriaBot, need, invocationSet, lvl) {
  const conocida = vista.propiaCartaConocida?.name ?? null;
  const probabilidades = estimarProbabilidadesPersonajes(vista, memoriaBot, invocationSet);
  const valorGemaNivel = valorMedioGemaNivel(invocationSet, lvl);
  const visibles = personajesVisiblesActuales(vista);
  const cumplidos = need.filter(k => visibles.includes(k));
  const contexto = { need, cumplidos, valorGemaNivel };

  const candidatas = [];
  listaPortalesConDestino(vista).forEach(p => {
    const esCentral = p.destKey.startsWith('n:');
    if (conocida) {
      candidatas.push({
        usaConocida: true,
        destKey: p.destKey,
        etiqueta: p.etiqueta,
        ev: valorEsperadoDeAccion(
          { personaje: conocida, esPropio: p.esPropio, esCentral, completaInvocacionSiSeJuega: completariaLaInvocacion(vista, need, conocida, p.destKey) },
          probabilidades,
          contexto
        ),
      });
    }
    // Carta oculta propia: identidad desconocida ni siquiera para el
    // propio bot — se evalúa con la distribución de probabilidad completa,
    // nunca con certeza de que complete la invocación.
    candidatas.push({
      usaConocida: false,
      destKey: p.destKey,
      etiqueta: p.etiqueta,
      ev: valorEsperadoDeAccion(
        { personaje: null, esPropio: p.esPropio, esCentral, completaInvocacionSiSeJuega: false },
        probabilidades,
        contexto
      ),
    });
  });

  // Desempate final: al azar entre las de mayor valor esperado (tras
  // preferir la conocida). El prompt original de esta tarea permite además
  // desempatar con la estimación de Gemas de rivales (`contarGemasPorNivel`,
  // ya expuesta en `vista.jugadoras[i].gemasPorNivel`) "para no facilitar
  // en exceso a quien va ganando" — deliberadamente NO implementado en esta
  // ronda: el propio prompt lo marca como opcional ("puede seguir usando"),
  // y la señal es débil (solo un recuento por nivel, no el valor exacto de
  // Gema de cada rival) frente a la complejidad de comparar candidatas de
  // "ajena A" vs. "ajena B". Queda anotado como posible mejora futura, no
  // como un olvido.
  const mejorEV = Math.max(...candidatas.map(c => c.ev));
  const mejores = candidatas.filter(c => c.ev === mejorEV);
  const mejoresConocidas = mejores.filter(c => c.usaConocida);
  const elegido = elegirAlAzar(mejoresConocidas.length ? mejoresConocidas : mejores);

  return {
    usaConocida: elegido.usaConocida,
    destKey: elegido.destKey,
    etiqueta: elegido.etiqueta,
    motivo: `valor esperado ${elegido.ev.toFixed(2)} Gemas`,
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
  // Mismo estado y misma función interna que usan clic/drag&drop/panel
  // humanos (ver actions.js, jugarCartaSeleccionadaEn) — se invoca a
  // través del punto de entrada global window.tryPlayOnPortal, no se
  // duplica ninguna validación.
  window.selectedCardIdx = idx;
  window.tryPlayOnPortal(decision.destKey);
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
 * Heurística 'normal' de Fase B (ver prompt del bot): del MVP solo se
 * consideran Ocultista y Cronista — Estratega, Cronomante, Aprendiz,
 * Metamorfo y Maestro quedan fuera a propósito (definir un objetivo
 * "razonable" para ellos es bastante más complejo; Maestro en concreto
 * necesita estimar qué carta ajena conviene mover, que es precisamente el
 * motor de valor esperado del nivel 'dificil' — ver más abajo en este
 * archivo). Ocultista/Cronista se consideran "útiles" solo si falta algún
 * personaje del combo activo por revelar Y existe al menos un Portal
 * oculto legal donde intentarlo — activar sin ningún hueco que llenar
 * gastaría el turno sin ganancia esperable.
 */
function decidirHabilidadFaseB(vista, players, neutrals, botIdx, need) {
  const candidatos = objetivosHabilidadDisponibles(players, neutrals, botIdx)
    .filter(c => c.name === 'Ocultista' || c.name === 'Cronista');
  if (!candidatos.length) return null;

  const visibles = personajesVisiblesActuales(vista);
  const faltaAlgo = need.some(k => !visibles.includes(k));
  const hayPortalOculto = listaPortalesConDestino(vista).some(p => p.estado?.hidden);
  if (!faltaAlgo || !hayPortalOculto) return null;

  return elegirAlAzar(candidatos);
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
 *   un turno más tarde como mínimo.
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
  const contexto = { need, cumplidos, valorGemaNivel };

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
    } else if (c.name === 'Maestro') {
      vista.jugadoras.forEach(j => {
        if (j.esUnoMismo || !j.cartaOcultaPublica) return;
        const ev = valorEsperadoDeAccion(
          { personaje: j.cartaOcultaPublica, esPropio: false, esCentral: false, completaInvocacionSiSeJuega: false },
          probabilidades,
          contexto
        );
        considerar({ ...c, ev, objetivoPreferido: j.idx });
      });
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
 * Elige una opción no descartada del `<select>` del picker() actualmente
 * abierto. Si `preferido` coincide con alguna opción disponible (calculado
 * de antemano por la heurística 'dificil' — un Portal concreto para
 * Ocultista/Cronista, o el índice de una jugadora concreta para Maestro,
 * ver `objetivoPreferido` en `decidirHabilidadFaseBDificil`), se usa ese.
 * Si no, cae al criterio de 'normal': preferir un Portal oculto (Ocultista
 * porque revelar uno es lo único con sentido en su MVP; Cronista porque
 * llevarse a la mano una carta desconocida no arriesga quitar del tablero
 * un personaje visible que sí interesara dejar), o al azar si ninguna
 * opción es oculta.
 */
function elegirOpcionPicker(opcionesDom, vista, yaElegidos, preferido) {
  const disponibles = opcionesDom.filter(o => !yaElegidos.includes(o.value));
  if (preferido !== undefined && preferido !== null) {
    const match = disponibles.find(o => o.value === String(preferido));
    if (match) return match;
  }
  const ocultos = disponibles.filter(o => estaOcultoSegunVista(vista, o.value));
  return elegirAlAzar(ocultos.length ? ocultos : disponibles);
}

/**
 * Resuelve, por JS, el/los picker() modales que applyAbility() acaba de
 * abrir — la mayoría de habilidades solo necesitan un paso, pero el bucle
 * admite varios (p. ej. Maestro: jugadora y, si tiene más de un Portal
 * propio, también el Portal; Estratega: dos Portales; Aprendiz: dos
 * jugadoras). Mismo mecanismo que usaría un clic humano en el modal
 * (#pickerSelect + #pickerOk), no se reimplementa ninguna regla de
 * legalidad — las opciones ya vienen filtradas por la propia habilidad en
 * abilities.js. `preferidosPorPaso` puede ser un único valor (se aplica
 * solo al PRIMER picker, compatibilidad con el uso original de esta
 * función) o un array alineado por índice de paso (necesario para
 * habilidades de varios pasos donde la heurística 'dificil' ya sabe de
 * antemano los dos objetivos, p. ej. las dos claves de Estratega o los dos
 * índices de Aprendiz) — los pasos sin preferencia (`undefined`) usan el
 * criterio de respaldo, ver `elegirOpcionPicker`. Devuelve el array de
 * valores REALMENTE elegidos, en orden — lo necesita quien llama para
 * construir un resumen de turno legible (ver `describirObjetivoHabilidad`).
 */
function resolverPickersAbiertos(vista, preferidosPorPaso) {
  const preferidos = Array.isArray(preferidosPorPaso) ? preferidosPorPaso : [preferidosPorPaso];
  const MAX_PASOS = 4;
  const yaElegidos = [];
  for (let paso = 0; paso < MAX_PASOS; paso++) {
    const pickerEl = document.querySelector('#picker');
    if (!pickerEl || pickerEl.classList.contains('hidden')) break;
    const selectEl = document.querySelector('#pickerSelect');
    const opciones = [...selectEl.options].filter(o => !o.disabled);
    if (!opciones.length) {
      document.querySelector('#pickerCancel')?.click();
      break;
    }
    const elegida = elegirOpcionPicker(opciones, vista, yaElegidos, preferidos[paso]);
    yaElegidos.push(elegida.value);
    selectEl.value = elegida.value;
    document.querySelector('#pickerOk').click();
  }
  return yaElegidos;
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
 * activación de habilidad (ver `resolverPickersAbiertos`) a una frase EN
 * TERCERA PERSONA para el resumen del turno — identificando siempre de
 * quién es cada Portal/mano afectada (Bloque 1 de esta tarea). Solo cubre,
 * de momento, las habilidades que la Fase B del autómata ya sabe usar
 * (Ocultista, Cronista, Maestro) — el resto de casos se añade a la vez que
 * se les da uso real (ver Bloque 4).
 */
export function describirObjetivoHabilidad(name, valores, vista) {
  switch (name) {
    case 'Ocultista':
      return `cambió la visibilidad ${conDe(etiquetaPortalPorClaveHabilidad(valores[0], vista))}`;
    case 'Cronista':
      return `se llevó a la mano la carta superior ${conDe(etiquetaPortalPorClaveHabilidad(valores[0], vista))}`;
    case 'Maestro':
      return `bajó una carta de la mano de ${nombreJugadoraPorIdx(parseInt(valores[0], 10), vista)} a su propio Portal`;
    default:
      return '';
  }
}

function activarHabilidadFaseB(players, neutrals, botIdx, levelIdx, need, decision, vista) {
  const { tipo, stack, name, objetivoPreferido } = decision;
  // Mismo onComplete que construye #btnAbility.onclick en actions.js: cobra
  // el coste de Portal central si aplica, marca la habilidad como usada,
  // refresca la UI.
  const onComplete = () => {
    if (tipo === 'central') pagarActivacionPortalCentral(players[botIdx]);
    window.habilidadUsadaEsteTurno = true;
    render(players, neutrals, levelIdx);
  };
  applyAbility(name, botIdx, stack, players, neutrals, levelIdx, need, onComplete);
  const yaElegidos = resolverPickersAbiertos(vista, objetivoPreferido);
  return describirObjetivoHabilidad(name, yaElegidos, vista);
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

function decidirYJugarTurnoNormal(players, neutrals, botIdx, contexto) {
  const { levelIdx, invocationSet } = contexto;
  const lvl = LEVELS[levelIdx];
  const need = lvl ? INVOCATION_SETS[invocationSet][lvl].need : [];

  const vistaAntes = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  const decisionA = decidirJugadaFaseA(vistaAntes, need);
  jugarCartaFaseA(players, botIdx, decisionA);

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
  const decisionB = decidirHabilidadFaseB(vistaTrasA, players, neutrals, botIdx, need);
  if (decisionB) {
    resumen.detalleHabilidad = activarHabilidadFaseB(players, neutrals, botIdx, levelIdx, need, decisionB, vistaTrasA);
    resumen.habilidad = decisionB.name;
  }

  mostrarResumenTurnoBot(resumen);

  // Fase C/D/E (comprobar invocación, repartir Gemas, robar, avanzar
  // turno): se reutiliza el MISMO botón que usa una jugadora humana — el
  // bot no duplica ninguna lógica de reglas, solo simula el clic.
  document.querySelector('#btnEndTurn').click();
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
function decidirYJugarTurnoDificil(players, neutrals, botIdx, contexto) {
  const { levelIdx, invocationSet } = contexto;
  const lvl = LEVELS[levelIdx];
  const need = lvl ? INVOCATION_SETS[invocationSet][lvl].need : [];
  const memoriaBot = obtenerMemoriaBot(botIdx);

  const vistaAntes = construirEstadoVisibleParaBot(players, neutrals, botIdx);
  actualizarMemoriaBot(memoriaBot, vistaAntes);
  const decisionA = decidirJugadaFaseADificil(vistaAntes, memoriaBot, need, invocationSet, lvl);
  jugarCartaFaseA(players, botIdx, decisionA);

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
    resumen.detalleHabilidad = activarHabilidadFaseB(players, neutrals, botIdx, levelIdx, need, decisionB, vistaTrasA);
    resumen.habilidad = decisionB.name;
  }

  mostrarResumenTurnoBot(resumen);
  document.querySelector('#btnEndTurn').click();
}

// Dos niveles de dificultad implementados: 'normal' (heurística greedy) y
// 'dificil' (conteo de cartas + valor esperado, ver arriba). Para añadir
// más en el futuro: crear una nueva función `decidirYJugarTurno<Nivel>` con
// la misma firma y añadirla aquí — decidirYJugarTurno() ya despacha por
// `players[botIdx].dificultad`.
const HEURISTICAS_POR_DIFICULTAD = {
  normal: decidirYJugarTurnoNormal,
  dificil: decidirYJugarTurnoDificil,
};

/**
 * Punto de entrada único: ejecuta el turno completo (Fases A-E) de la bot
 * `botIdx`, según `players[botIdx].dificultad`.
 */
export function decidirYJugarTurno(players, neutrals, botIdx, contexto) {
  const dificultad = players[botIdx].dificultad || 'normal';
  const heuristica = HEURISTICAS_POR_DIFICULTAD[dificultad] || decidirYJugarTurnoNormal;
  heuristica(players, neutrals, botIdx, contexto);
}
