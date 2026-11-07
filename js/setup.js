// setup.js
import { $, MODOS_JUEGO } from './utils.js';
import { initGame, mostrarTablero, retomarPartida } from './game.js';
import { nombresDisponiblesParaBots } from './bot.js';
import { leerPartidaGuardada, borrarPartidaGuardada, describirPartidaGuardada } from './partida-guardada.js';

/** Aviso "Tienes una partida a medias" del menú de inicio. */
function pintarPanelRetomar() {
  const panel = $('#panelRetomar');
  if (!panel) return;
  const registro = leerPartidaGuardada();
  panel.classList.toggle('hidden', !registro);
  if (!registro) return;
  $('#txtRetomar').textContent = describirPartidaGuardada(registro);
  $('#btnRetomar').onclick = () => {
    if (!retomarPartida()) pintarPanelRetomar();
  };
  $('#btnDescartarPartida').onclick = () => {
    if (!confirm('¿Descartar la partida guardada? No se podrá recuperar.')) return;
    borrarPartidaGuardada();
    pintarPanelRetomar();
  };
}

// ---------- Asientos del menú de inicio ----------
// Cada asiento es una persona (con su nombre) o una autómata (con su nivel).
// Se recuerda la última configuración en este dispositivo.

const CLAVE_MENU = 'invocadores.menuInicio';
const NOMBRES_POR_DEFECTO = ['Javi', 'Isa', 'Julio', 'Adrián', 'Ana'];
export const NIVELES_AUTOMATA = [
  { valor: 'normal', etiqueta: 'Normal · juega directa' },
  { valor: 'dificil', etiqueta: 'Difícil · cuenta cartas' },
  { valor: 'experta', etiqueta: 'Experta · simula partidas' },
];

/** Estado del menú: un objeto por asiento posible (hasta 5). */
let asientos = null;

function leerMenuGuardado() {
  try {
    const datos = JSON.parse(localStorage.getItem(CLAVE_MENU) || 'null');
    return datos && Array.isArray(datos.asientos) ? datos : null;
  } catch { return null; }
}

function guardarMenu() {
  try {
    localStorage.setItem(CLAVE_MENU, JSON.stringify({
      n: parseInt($('#numPlayers').value, 10),
      asientos,
      ...leerModoElegido(),
    }));
  } catch { /* sin almacenamiento: no pasa nada */ }
}

/**
 * Normaliza la lista de asientos: siempre 5, cada uno con tipo, nombre,
 * nivel y nombre de autómata (únicos entre sí).
 */
export function normalizarAsientos(previos = []) {
  const lista = Array.from({ length: 5 }, (_, i) => {
    const p = previos[i] || {};
    return {
      tipo: p.tipo === 'auto' ? 'auto' : 'humano',
      nombre: typeof p.nombre === 'string' ? p.nombre.slice(0, 24) : '',
      dificultad: NIVELES_AUTOMATA.some(n => n.valor === p.dificultad) ? p.dificultad : 'normal',
      nombreBot: typeof p.nombreBot === 'string' ? p.nombreBot : '',
    };
  });
  const usados = new Set();
  lista.forEach(a => {
    if (!a.nombreBot || usados.has(a.nombreBot)) a.nombreBot = '';
    else usados.add(a.nombreBot);
  });
  const libres = nombresDisponiblesParaBots(10).filter(n => !usados.has(n));
  lista.forEach(a => { if (!a.nombreBot) a.nombreBot = libres.shift() || 'Autómata'; });
  return lista;
}

/** Pinta una fila por jugadora con su interruptor persona/autómata. */
function pintarAsientos() {
  const n = parseInt($('#numPlayers').value, 10);
  const lista = $('#listaJugadores');
  if (!lista || Number.isNaN(n)) return;
  lista.textContent = '';
  for (let i = 0; i < n; i++) {
    const a = asientos[i];
    const fila = document.createElement('div');
    fila.className = `fila-jugador fila-${a.tipo}`;

    const cabecera = document.createElement('div');
    cabecera.className = 'fila-cabecera';
    const num = document.createElement('span');
    num.className = 'fila-num';
    num.textContent = String(i + 1);
    const tipo = document.createElement('div');
    tipo.className = 'tipo-jugador';
    tipo.setAttribute('role', 'radiogroup');
    tipo.setAttribute('aria-label', `Jugadora ${i + 1}`);
    [['humano', '👤 Persona'], ['auto', '🤖 Autómata']].forEach(([valor, texto]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = texto;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', String(a.tipo === valor));
      b.classList.toggle('activo', a.tipo === valor);
      b.onclick = () => {
        if (a.tipo === valor) return;
        a.tipo = valor;
        guardarMenu();
        pintarAsientos();
        if (valor === 'humano') lista.querySelectorAll('input')[i]?.focus();
      };
      tipo.appendChild(b);
    });
    cabecera.append(num, tipo);
    fila.appendChild(cabecera);

    if (a.tipo === 'humano') {
      const input = document.createElement('input');
      input.type = 'text';
      input.maxLength = 24;
      input.placeholder = `Nombre de la jugadora ${i + 1}`;
      input.value = a.nombre;
      input.setAttribute('aria-label', `Nombre de la jugadora ${i + 1}`);
      input.addEventListener('input', () => { a.nombre = input.value; guardarMenu(); });
      fila.appendChild(input);
    } else {
      const nombre = document.createElement('div');
      nombre.className = 'nombre-bot';
      nombre.textContent = a.nombreBot;
      const sel = document.createElement('select');
      sel.setAttribute('aria-label', `Nivel de ${a.nombreBot}`);
      NIVELES_AUTOMATA.forEach(({ valor, etiqueta }) => {
        const op = document.createElement('option');
        op.value = valor;
        op.textContent = etiqueta;
        op.selected = valor === a.dificultad;
        sel.appendChild(op);
      });
      sel.addEventListener('change', () => { a.dificultad = sel.value; guardarMenu(); });
      fila.append(nombre, sel);
    }
    lista.appendChild(fila);
  }
  const hayBots = asientos.slice(0, n).some(a => a.tipo === 'auto');
  $('#lblRitmoBots')?.classList.toggle('hidden', !hayBots);
}

// ---------- Modo de juego ----------

/** Lo elegido en el menú: { modo, invocationSet, madain, entusiasta }. */
function leerModoElegido() {
  const modo = $('#selModo')?.value || 'normal';
  const reglas = MODOS_JUEGO[modo] || MODOS_JUEGO.normal;
  return {
    modo,
    invocationSet: $('#selInvocationSet')?.value || 'normal',
    madain: reglas.madain === 'siempre' || (reglas.madain === 'opcional' && !!$('#chkMadain')?.checked),
    entusiasta: !!$('#chkEntusiasta')?.checked,
  };
}

/**
 * Ajusta el menú al modo elegido: solo deja los sets que se pueden
 * completar con su mazo, y muestra Madain como opción (Avanzado), fija
 * (Experto) u oculta (Introductorio y Normal).
 */
function ajustarOpcionesModo() {
  const modo = $('#selModo')?.value || 'normal';
  const reglas = MODOS_JUEGO[modo] || MODOS_JUEGO.normal;
  const selSet = $('#selInvocationSet');
  if (selSet) {
    [...selSet.options].forEach(o => { o.disabled = !reglas.sets.includes(o.value); o.hidden = o.disabled; });
    if (!reglas.sets.includes(selSet.value)) selSet.value = reglas.sets[0];
  }
  const txt = $('#txtModo');
  if (txt) txt.textContent = reglas.descripcion;
  const chk = $('#chkMadain');
  $('#lblMadain')?.classList.toggle('hidden', reglas.madain === 'nunca');
  if (chk) {
    chk.disabled = reglas.madain !== 'opcional';
    if (reglas.madain === 'siempre') chk.checked = true;
    if (reglas.madain === 'nunca') chk.checked = false;
  }
}

/** Restaura en el menú el modo guardado (si sigue siendo válido). */
function restaurarModo(guardado) {
  if (!guardado) return;
  const sel = $('#selModo');
  if (sel && MODOS_JUEGO[guardado.modo]) sel.value = guardado.modo;
  const selSet = $('#selInvocationSet');
  if (selSet && [...selSet.options].some(o => o.value === guardado.invocationSet)) selSet.value = guardado.invocationSet;
  if ($('#chkMadain')) $('#chkMadain').checked = !!guardado.madain;
  if ($('#chkEntusiasta')) $('#chkEntusiasta').checked = !!guardado.entusiasta;
}

/**
 * Jugadoras de la partida a partir de los asientos: nombre, tipo, nivel y
 * las 3 Gemas de valor 1 de la preparación. Nombres repetidos se numeran.
 */
export function crearJugadoras(asientosPartida) {
  const vistos = new Map();
  // Un asiento sin nombre toma uno por defecto que nadie más esté usando.
  const escritos = new Set(asientosPartida.map(a => (a.tipo === 'auto' ? a.nombreBot : a.nombre.trim())).filter(Boolean));
  const porDefecto = NOMBRES_POR_DEFECTO.filter(nm => !escritos.has(nm));
  return asientosPartida.map((a, i) => {
    const esBot = a.tipo === 'auto';
    let nombre = esBot ? a.nombreBot : (a.nombre.trim() || porDefecto.shift() || `Jugadora ${i + 1}`);
    const veces = (vistos.get(nombre) || 0) + 1;
    vistos.set(nombre, veces);
    if (veces > 1) nombre = `${nombre} ${veces}`;
    const gems = Array.from({ length: 3 }, () => ({ valor: 1, nivel: 'unitaria' }));
    const jugador = { name: nombre, tipo: esBot ? 'auto' : 'humano', hand: [], portals: [], gems };
    if (esBot) jugador.dificultad = a.dificultad; // 'normal', 'dificil' o 'experta', ver js/bot.js
    return jugador;
  });
}

/**
 * Inicializa la UI de configuración de la partida: número de jugadoras,
 * una fila por asiento (persona con nombre o autómata con nivel), modo de
 * juego, y el botón de empezar.
 */
export function initSetup() {
  pintarPanelRetomar();
  const guardado = leerMenuGuardado();
  if (!asientos) {
    asientos = normalizarAsientos(guardado?.asientos);
    const n = parseInt(guardado?.n, 10);
    if (n >= 2 && n <= 5) $('#numPlayers').value = String(n);
    restaurarModo(guardado);
  }
  ajustarOpcionesModo();
  const numJug = $('#numPlayers');
  numJug.oninput = () => {
    const n = parseInt(numJug.value, 10);
    const errorEl = $('#numError');
    const valido = !Number.isNaN(n) && n >= 2 && n <= 5;
    errorEl.textContent = 'El número de jugadoras debe estar entre 2 y 5.';
    errorEl.classList.toggle('hidden', valido);
    if (!valido) return;
    guardarMenu();
    pintarAsientos();
  };
  const selModo = $('#selModo');
  if (selModo) selModo.onchange = () => { ajustarOpcionesModo(); guardarMenu(); };
  ['#selInvocationSet', '#chkMadain', '#chkEntusiasta'].forEach(sel => {
    const el = $(sel);
    if (el) el.onchange = guardarMenu;
  });
  pintarAsientos();

  $('#btnStart').onclick = e => {
    e.preventDefault();
    const n = parseInt(numJug.value, 10);
    if (Number.isNaN(n) || n < 2 || n > 5) {
      numJug.oninput();
      return;
    }
    window.players = crearJugadoras(asientos.slice(0, n));
    window.neutrals = [];
    const eleccion = leerModoElegido();
    window.invocationSet = eleccion.invocationSet;
    window.modo = eleccion.modo;
    window.madain = eleccion.madain;
    window.entusiasta = eleccion.entusiasta;

    // Configurar portales según número de jugadoras (docs/reglamento/REGLAMENTO.md, "Preparación"):
    //   2 jugadoras -> 2 portales/jugadora + 1 central
    //   3 jugadoras -> 1 portal/jugadora + 2 centrales
    //   4 jugadoras -> 1 portal/jugadora + 1 central
    //   5 jugadoras -> 1 portal/jugadora + 0 centrales
    const m = window.players.length;
    if (m === 2) {
      window.players.forEach(p => p.portals = [[], []]);
      window.neutrals = [[]];
    } else if (m === 3) {
      window.players.forEach(p => p.portals = [[]]);
      window.neutrals = [[], []];
    } else if (m === 4) {
      window.players.forEach(p => p.portals = [[]]);
      window.neutrals = [[]];
    } else {
      window.players.forEach(p => p.portals = [[]]);
      window.neutrals = [];
    }

    // Ocultar sección de setup y mostrar control de turno
    mostrarTablero();

    // Iniciar la partida
    initGame();
  };
}
