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

// Punto de extensión para dificultades futuras más agresivas: memoria de lo
// visto públicamente en turnos anteriores (qué personaje pasó por un
// Portal antes de quedar tapado, cómo han fluctuado las manos ajenas...).
// Es información lícita ("jugador muy inteligente" — ver prompt del bot),
// pero el nivel único 'normal' de este MVP no la necesita.
// const memoriaPorBot = new Map(); // botIdx -> { portalesVistos: [...], ... }

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

/** Lista de todos los Portales como destinos jugables, con su estado y una etiqueta legible. */
function listaPortalesConDestino(vista) {
  const lista = [];
  vista.jugadoras.forEach(j => {
    j.portales.forEach((estado, idx) => {
      lista.push({
        destKey: j.esUnoMismo ? `p:${idx}` : `a:${j.idx}:${idx}`,
        esPropio: j.esUnoMismo,
        etiqueta: `${j.esUnoMismo ? 'tu' : j.nombre} Portal ${idx + 1}`,
        estado,
      });
    });
  });
  vista.neutrales.forEach((estado, idx) => {
    lista.push({ destKey: `n:${idx}`, esPropio: false, etiqueta: `Neutral ${idx + 1}`, estado });
  });
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

function estaOcultoSegunVista(vista, val) {
  if (val.startsWith('n:')) return vista.neutrales[parseInt(val.slice(2), 10)]?.hidden === true;
  const [pi, pj] = val.split(':').map(Number);
  return vista.jugadoras[pi]?.portales[pj]?.hidden === true;
}

/**
 * Elige una opción no descartada del `<select>` del picker() actualmente
 * abierto. Para Ocultista/Cronista, prefiere un Portal oculto: Ocultista
 * porque revelar uno es lo único con sentido en este MVP; Cronista porque
 * llevarse a la mano una carta desconocida no arriesga quitar del tablero
 * un personaje visible que sí interesara dejar. Si no hay ninguno oculto
 * entre las opciones legales, elige al azar.
 */
function elegirOpcionPicker(nombreHabilidad, opcionesDom, vista, yaElegidos) {
  const disponibles = opcionesDom.filter(o => !yaElegidos.includes(o.value));
  const ocultos = disponibles.filter(o => estaOcultoSegunVista(vista, o.value));
  return elegirAlAzar(ocultos.length ? ocultos : disponibles);
}

/**
 * Resuelve, por JS, el/los picker() modales que applyAbility() acaba de
 * abrir — Ocultista y Cronista necesitan solo un paso, pero el bucle
 * admite varios por si en el futuro se extiende la heurística a
 * habilidades con más de un picker (p. ej. Estratega). Mismo mecanismo que
 * usaría un clic humano en el modal (#pickerSelect + #pickerOk), no se
 * reimplementa ninguna regla de legalidad — las opciones ya vienen
 * filtradas por la propia habilidad en abilities.js.
 */
function resolverPickersAbiertos(nombreHabilidad, vista) {
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
    const elegida = elegirOpcionPicker(nombreHabilidad, opciones, vista, yaElegidos);
    yaElegidos.push(elegida.value);
    selectEl.value = elegida.value;
    document.querySelector('#pickerOk').click();
  }
}

function activarHabilidadFaseB(players, neutrals, botIdx, levelIdx, need, decision, vista) {
  const { tipo, stack, name } = decision;
  // Mismo onComplete que construye #btnAbility.onclick en actions.js: cobra
  // el coste de Portal central si aplica, marca la habilidad como usada,
  // refresca la UI.
  const onComplete = () => {
    if (tipo === 'central') pagarActivacionPortalCentral(players[botIdx]);
    window.habilidadUsadaEsteTurno = true;
    render(players, neutrals, levelIdx);
  };
  applyAbility(name, botIdx, stack, players, neutrals, levelIdx, need, onComplete);
  resolverPickersAbiertos(name, vista);
}

// ---------- Resumen del turno (comunicación, sin desvelar la carta oculta) ----------

function mostrarResumenTurnoBot(resumen) {
  const cartaTxt = resumen.usoConocida ? resumen.cartaJugada : 'una carta que no conocía';
  let msg = `🤖 ${resumen.jugadora} jugó ${cartaTxt} en ${resumen.etiquetaPortal}.`;
  if (resumen.habilidad) msg += ` Activó su habilidad: ${resumen.habilidad}.`;
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
    activarHabilidadFaseB(players, neutrals, botIdx, levelIdx, need, decisionB, vistaTrasA);
    resumen.habilidad = decisionB.name;
  }

  mostrarResumenTurnoBot(resumen);

  // Fase C/D/E (comprobar invocación, repartir Gemas, robar, avanzar
  // turno): se reutiliza el MISMO botón que usa una jugadora humana — el
  // bot no duplica ninguna lógica de reglas, solo simula el clic.
  document.querySelector('#btnEndTurn').click();
}

// Único nivel de dificultad implementado en este MVP. Para añadir más en el
// futuro: crear una nueva función `decidirYJugarTurno<Nivel>` con la misma
// firma y añadirla aquí — decidirYJugarTurno() ya despacha por
// `players[botIdx].dificultad`.
const HEURISTICAS_POR_DIFICULTAD = {
  normal: decidirYJugarTurnoNormal,
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
