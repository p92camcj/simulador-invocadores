// js/red/sala.js
//
// Juego online: varias personas, cada una en su casa y con su dispositivo,
// juegan la misma partida a la vez.
//
// Quien crea la sala es la "mesa" (anfitriona): su navegador tiene la
// partida entera, ejecuta el motor y las autómatas, y a cada invitada le
// manda solo lo que su asiento puede ver (sanearPartidaParaAsiento). Las
// invitadas pintan la Mesa o el Escenario con esa copia y, en su turno,
// mandan lo que quieren hacer (jugar, activar habilidad, terminar turno);
// la anfitriona lo ejecuta con las mismas funciones que un toque en la
// pantalla (actions.js). Si una habilidad pide elegir algo, la pregunta
// (picker) viaja al dispositivo de quien debe elegir y vuelve su respuesta.
//
// Mensajes de la invitada a la mesa: unirse, jugar, activar, terminar,
// respuesta. De la mesa a la invitada: bienvenida, rechazo, lobby, estado,
// peticion, aviso, fin, mesaEnMenu.

import { estado } from '../motor/estado.js';
import { sanearPartidaParaAsiento } from './sanear.js';
import { abrirSala, unirseASala } from './transporte.js';
import { configurarVoz, fijarParticipantes, detenerVoz } from './voz.js';
import { jugarCarta } from '../motor/acciones.js';
import { ejecutarJugada, activarHabilidad, ejecutarFinDeTurno } from '../actions.js';
import { render, picker, pickerPortal } from '../render.js';
import { mostrarTablero, resetJuego } from '../game.js';
import { preguntarMesa, mostrarAviso, mostrarFinMesa, anunciarTurnoMesa } from '../mesa3d.js';

const CLAVE_CODIGO = 'invocadores.salaAnfitriona';
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_INVITADAS = 4;
const CLAVE_SALA_INVITADA = 'invocadores.salaInvitada';

const LATIDO_MS = 4000;          // cada cuánto se saludan mesa e invitadas
const SILENCIO_MAX_MS = 15000;   // sin noticias en este tiempo, la conexión se da por caída
const VIGENCIA_SALA_MS = 6 * 3600 * 1000;

/**
 * Dónde recuerda la invitada quién es y en qué sala estaba. En el móvil,
 * localStorage: así, si cambia de app y el navegador cierra la pestaña, o
 * vuelve a abrir el enlace desde WhatsApp en otra pestaña, sigue siendo la
 * misma y recupera su asiento. Con ?red=local (pruebas con varias pestañas
 * del mismo navegador) cada pestaña es una persona distinta: sessionStorage.
 */
function almacenInvitada() {
  try {
    return new URLSearchParams(location.search).get('red') === 'local' ? sessionStorage : localStorage;
  } catch { return null; }
}

/** Sala en la que estaba esta persona hace poco ({ codigo, nombre }), si la hay. */
export function salaAnteriorDeEstaPestana() {
  try {
    const d = JSON.parse(almacenInvitada()?.getItem(CLAVE_SALA_INVITADA) || 'null');
    return d && Date.now() - (d.hora || 0) < VIGENCIA_SALA_MS ? d : null;
  } catch { return null; }
}

function olvidarSalaAnterior() {
  try { almacenInvitada()?.removeItem(CLAVE_SALA_INVITADA); } catch { /* nada */ }
}

let rol = null;                 // 'anfitriona' | 'invitada' | null
let codigo = null;
const oyentes = new Set();      // la pantalla de inicio se repinta al cambiar la sala

// Anfitriona
let sala = null;
const invitadas = new Map();    // idRed → { idRed, nombre, conexion }
let ordenLlegada = [];
const pendientes = new Map();   // id → { asiento, clase, titulo, opciones, cb, onCancel }
let siguienteId = 1;
let decisorForzado = null;
let respuestaAuto = null;
const ultimoEnviado = new Map();
let difusionProgramada = false;

// Invitada
let conexion = null;
let miAsiento = null;
let miNombre = '';
let enTablero = false;
let saliendo = false;
let reintentos = 0;
let nombresSala = [];
let errorUltimo = '';
let ultimoMensajeMesa = 0;

// ---------- Consultas ----------

export function rolRed() { return rol; }
export function codigoSala() { return codigo; }
export function esInvitada() { return rol === 'invitada'; }
export function esAnfitriona() { return rol === 'anfitriona'; }
export function ultimoError() { return errorUltimo; }

/** ¿La partida en curso se juega online (con alguien en otro dispositivo)? */
export function partidaEnLinea() {
  if (rol === 'invitada') return true;
  return rol === 'anfitriona' && estado.partida.players.some(p => p.idRed);
}

/** Asiento de este dispositivo en una partida online (null si no lo es). */
export function asientoLocal() {
  if (rol === 'invitada') return miAsiento;
  if (!partidaEnLinea()) return null;
  const i = estado.partida.players.findIndex(p => p.tipo !== 'auto' && !p.idRed);
  return i >= 0 ? i : null;
}

/** Personas en la sala (para la pantalla de inicio). */
export function personasEnSala() {
  if (rol === 'invitada') return nombresSala;
  return ordenLlegada.map(id => invitadas.get(id)).filter(i => i?.conexion).map(i => i.nombre);
}

export function escucharSala(f) { oyentes.add(f); return () => oyentes.delete(f); }
function avisarOyentes() { oyentes.forEach(f => { try { f(); } catch (e) { console.warn(e); } }); }

async function leerVersion() {
  try {
    const r = await fetch('version.json', { cache: 'no-store' });
    return (await r.json()).version || '';
  } catch { return ''; }
}
const sinW = v => String(v || '').split('.').slice(0, 3).join('.');

function nuevoCodigo() {
  let c = '';
  for (let i = 0; i < 5; i++) c += LETRAS[Math.floor(Math.random() * LETRAS.length)];
  return c;
}

/** Normaliza un código escrito a mano (minúsculas, espacios, guiones...). */
export function limpiarCodigo(txt) {
  return String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
}

/** Enlace para invitar: la misma web con ?sala=CÓDIGO. */
export function enlaceSala() {
  const url = new URL(location.href);
  url.search = '';
  url.hash = '';
  url.searchParams.set('sala', codigo);
  ['red', 'servidorRed'].forEach(k => {
    const v = new URLSearchParams(location.search).get(k);
    if (v) url.searchParams.set(k, v);
  });
  return url.toString();
}

// ---------- Anfitriona: abrir y cerrar la sala ----------

/** Abre la sala (reutiliza el código de la última vez si está libre). */
export async function crearSala() {
  if (rol) return;
  errorUltimo = '';
  let guardado = null;
  try { guardado = localStorage.getItem(CLAVE_CODIGO); } catch { /* nada */ }
  const candidatos = [guardado && /^[A-Z0-9]{5}$/.test(guardado) ? guardado : null, nuevoCodigo(), nuevoCodigo()].filter(Boolean);
  for (const c of candidatos) {
    try {
      sala = await abrirSala(c, { alConectar: alConectarInvitada, alAviso: t => mostrarAviso(t) });
      codigo = c;
      rol = 'anfitriona';
      configurarVoz(sala.peer);
      try { localStorage.setItem(CLAVE_CODIGO, c); } catch { /* nada */ }
      avisarOyentes();
      return;
    } catch (e) {
      if (!e.codigoOcupado) { errorUltimo = e.message; avisarOyentes(); return; }
    }
  }
  errorUltimo = 'No se ha podido abrir la sala. Inténtalo de nuevo.';
  avisarOyentes();
}

/** Cierra la sala y desconecta a todas. */
export function cerrarSala() {
  if (rol !== 'anfitriona') return;
  invitadas.forEach(inv => inv.conexion?.cerrar());
  invitadas.clear();
  ordenLlegada = [];
  pendientes.clear();
  ultimoEnviado.clear();
  detenerVoz();
  sala?.cerrar();
  sala = null;
  rol = null;
  codigo = null;
  avisarOyentes();
}

/** Al retomar una partida online guardada, se vuelve a abrir la sala. */
export function reabrirSalaSiHaceFalta() {
  if (rol || !estado.partida.players.some(p => p.idRed)) return;
  crearSala().then(() => {
    if (rol === 'anfitriona') mostrarAviso(`Sala ${codigo} abierta: tus amigas pueden volver a entrar con ese código.`, { duracion: 8000 });
    else mostrarAviso(errorUltimo || 'No se ha podido abrir la sala.');
  });
}

function asientoDeId(id) {
  return estado.partida.players.findIndex(p => p.idRed === id);
}

function esRemoto(asiento) {
  return rol === 'anfitriona' && !!estado.partida.players[asiento]?.idRed;
}

function enviarA(asiento, msg) {
  const id = estado.partida.players[asiento]?.idRed;
  invitadas.get(id)?.conexion?.enviar(msg);
}

function enviarLobby() {
  const nombres = personasEnSala();
  invitadas.forEach(inv => inv.conexion?.enviar({ tipo: 'lobby', nombres }));
  // Chat de voz: quién está conectada ahora (ids de PeerJS, mesa incluida).
  const ids = [sala?.peer?.id, ...[...invitadas.values()].map(i => i.conexion?.idRemoto)].filter(Boolean);
  invitadas.forEach(inv => inv.conexion?.enviar({ tipo: 'voz', ids }));
  fijarParticipantes(ids);
}

function alConectarInvitada(con) {
  let id = null;
  con.alRecibir(async msg => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.tipo === 'unirse') {
      const rechazar = motivo => { con.enviar({ tipo: 'rechazo', motivo }); setTimeout(() => con.cerrar(), 500); };
      const version = await leerVersion();
      if (sinW(msg.version) !== sinW(version)) {
        rechazar(`La mesa tiene la versión ${sinW(version)} y tú la ${sinW(msg.version)}. Recargad la app para tener la misma.`);
        return;
      }
      const idRed = String(msg.idRed || '').slice(0, 40);
      if (!idRed) return;
      const enPartida = estado.partida.players.length > 0 && !estado.partida.juegoTerminado;
      const nombre = String(msg.nombre || '').trim().slice(0, 24);
      // Vuelve con otro identificador (otro navegador, datos borrados...):
      // se le devuelve su sitio por el nombre, o el único asiento libre.
      if (!invitadas.has(idRed)) reclamarPorNombre(idRed, nombre, enPartida);
      const asiento = asientoDeId(idRed);
      let inv = invitadas.get(idRed);
      if (!inv) {
        if (enPartida && asiento < 0) { rechazar('La partida ya ha empezado. Espera a la siguiente.'); return; }
        if (ordenLlegada.filter(k => invitadas.get(k)?.conexion).length >= MAX_INVITADAS) { rechazar('La sala está llena.'); return; }
        inv = { idRed, nombre: '', conexion: null };
        invitadas.set(idRed, inv);
        ordenLlegada.push(idRed);
      } else if (inv.conexion && inv.conexion !== con) {
        inv.conexion.cerrar();
      }
      id = idRed;
      inv.conexion = con;
      inv.ultimoContacto = Date.now();
      if (asiento < 0) inv.nombre = nombre || `Amiga ${ordenLlegada.indexOf(idRed) + 1}`;
      con.enviar({ tipo: 'bienvenida', codigo });
      enviarLobby();
      avisarOyentes();
      if (asiento >= 0) {
        // Vuelve a una partida empezada: su vista y lo que tenía pendiente.
        ultimoEnviado.delete(idRed);
        difundir();
        pendientes.forEach((p, k) => {
          if (p.asiento === asiento) con.enviar({ tipo: 'peticion', id: k, clase: p.clase, titulo: p.titulo, opciones: p.opciones });
        });
        if (document.body.classList.contains('mesa-en-partida')) mostrarAviso(`${estado.partida.players[asiento].name} ha vuelto a la partida`);
      }
      return;
    }
    if (!id) return;
    const inv = invitadas.get(id);
    if (inv?.conexion === con) inv.ultimoContacto = Date.now();
    if (msg.tipo === 'latido') return;
    procesar(id, msg);
  });
  con.alCerrar(() => {
    const inv = id ? invitadas.get(id) : null;
    if (!inv || inv.conexion !== con) return;
    inv.conexion = null;
    ultimoEnviado.delete(id);
    const asiento = asientoDeId(id);
    if (asiento >= 0 && estado.partida.players.length) {
      mostrarAviso(`${estado.partida.players[asiento].name} se ha desconectado. Puede volver a entrar con el código ${codigo}.`, { duracion: 8000 });
    } else {
      invitadas.delete(id);
      ordenLlegada = ordenLlegada.filter(k => k !== id);
    }
    enviarLobby();
    avisarOyentes();
  });
}

const normalizar = t => String(t || '').trim().toLowerCase();

/** ¿Sigue viva la conexión de esta invitada? */
function conectada(inv) {
  return !!inv?.conexion && Date.now() - (inv.ultimoContacto || 0) < SILENCIO_MAX_MS;
}

/**
 * Una persona entra con un identificador nuevo. Si en la sala había otra
 * con su mismo nombre que ya no responde (o, en plena partida, un único
 * asiento de persona sin conexión), es ella que vuelve: se le pasa ese
 * sitio. Así no sale repetida en la lista ni se queda fuera de su partida.
 */
function reclamarPorNombre(idNuevo, nombre, enPartida) {
  const n = normalizar(nombre);
  let idViejo = null;
  if (enPartida) {
    // Mismo nombre: es ella aunque su conexión vieja aún parezca viva.
    const mismaPersona = estado.partida.players.find(p => p.idRed
      && (normalizar(p.name) === n || normalizar(invitadas.get(p.idRed)?.nombre) === n));
    const libres = estado.partida.players.filter(p => p.idRed && !conectada(invitadas.get(p.idRed)));
    idViejo = (mismaPersona || (libres.length === 1 ? libres[0] : null))?.idRed || null;
  } else {
    idViejo = ordenLlegada.find(k => normalizar(invitadas.get(k)?.nombre) === n) || null;
  }
  if (!idViejo) return;
  const vieja = invitadas.get(idViejo);
  if (vieja?.conexion) { const c = vieja.conexion; vieja.conexion = null; c.cerrar(); }
  invitadas.delete(idViejo);
  invitadas.set(idNuevo, { idRed: idNuevo, nombre: vieja?.nombre || nombre, conexion: null });
  ordenLlegada = ordenLlegada.map(k => (k === idViejo ? idNuevo : k));
  if (!ordenLlegada.includes(idNuevo)) ordenLlegada.push(idNuevo);
  estado.partida.players.forEach(p => { if (p.idRed === idViejo) p.idRed = idNuevo; });
  ultimoEnviado.delete(idViejo);
}

// Latidos: la mesa saluda a cada invitada y cierra las que llevan un rato
// calladas (un móvil que se fue a otra app sin despedirse). Al cerrarlas,
// su asiento queda libre para que vuelvan.
setInterval(() => {
  if (rol !== 'anfitriona') return;
  invitadas.forEach(inv => {
    if (!inv.conexion) return;
    if (Date.now() - (inv.ultimoContacto || 0) > SILENCIO_MAX_MS) inv.conexion.cerrar();
    else inv.conexion.enviar({ tipo: 'latido' });
  });
}, LATIDO_MS);

/** Ejecuta en la mesa lo que pide la invitada del asiento de `id`. */
function procesar(id, msg) {
  const asiento = asientoDeId(id);
  if (asiento < 0) return;
  const partida = estado.partida;
  const suTurno = partida.turn === asiento && !partida.juegoTerminado;
  switch (msg.tipo) {
    case 'jugar':
      if (!suTurno) return;
      conDecisor(asiento, () => {
        estado.ui.selectedCardIdx = null;
        if (!ejecutarJugada(Number(msg.cartaIdx), String(msg.destino))) alert('No puedes jugar esa carta ahí');
      });
      return;
    case 'activar':
      if (!suTurno) return;
      conDecisor(asiento, () => {
        respuestaAuto = msg.origen ?? null;
        try { activarHabilidad(); } finally { respuestaAuto = null; }
      });
      return;
    case 'terminar':
      if (!suTurno) return;
      conDecisor(asiento, () => ejecutarFinDeTurno());
      return;
    case 'respuesta': {
      const p = pendientes.get(msg.id);
      if (!p || p.asiento !== asiento) return;
      pendientes.delete(msg.id);
      conDecisor(asiento, () => (msg.cancelar ? p.onCancel?.() : p.cb(msg.valor)));
      return;
    }
    default:
  }
}

/**
 * Ejecuta `fn` como si la decisión fuera del asiento `asiento`: sus
 * preguntas (picker) y avisos (alert) van a su dispositivo.
 */
export function conDecisor(asiento, fn) {
  const previo = decisorForzado;
  const alertPrevio = window.alert;
  decisorForzado = asiento;
  if (esRemoto(asiento)) window.alert = m => enviarA(asiento, { tipo: 'aviso', texto: String(m) });
  try { return fn(); } finally {
    decisorForzado = previo;
    window.alert = alertPrevio;
  }
}

/** Asiento remoto que debe contestar la próxima pregunta, o null si es en este dispositivo. */
export function decisorRemoto() {
  if (rol !== 'anfitriona') return null;
  const a = decisorForzado ?? estado.partida.turn;
  return esRemoto(a) ? a : null;
}

/**
 * Manda una pregunta al dispositivo del asiento `asiento`; su respuesta
 * llega a `cb` (o a `onCancel`). `clase`: 'picker', 'portal' o 'pregunta'.
 */
export function pedirRemoto(asiento, clase, titulo, opciones, cb, onCancel) {
  const limpias = opciones.map(o => ({ val: o.val, lbl: o.lbl, ...(o.disabled ? { disabled: true } : {}) }));
  // "Toca dos veces el Portal": la habilidad de ese Portal ya está elegida.
  if (respuestaAuto !== null && clase === 'picker' && limpias.some(o => o.val === respuestaAuto && !o.disabled)) {
    const v = respuestaAuto;
    respuestaAuto = null;
    cb(v);
    return;
  }
  respuestaAuto = null;
  const id = siguienteId++;
  pendientes.set(id, { asiento, clase, titulo, opciones: limpias, cb, onCancel });
  enviarA(asiento, { tipo: 'peticion', id, clase, titulo, opciones: limpias });
}

/** Pregunta sin "Cancelar" a la jugadora `idx`, esté en este dispositivo o en otro. */
export function preguntarJugadora(idx, titulo, opciones, responder) {
  if (esRemoto(idx)) {
    conDecisor(idx, () => pedirRemoto(idx, 'pregunta', titulo, opciones, responder));
    return;
  }
  preguntarMesa(titulo, opciones, responder);
}

/** Tras cada repintado de la mesa: manda a cada invitada su vista si ha cambiado. */
export function trasRepintar() {
  if (rol !== 'anfitriona' || difusionProgramada) return;
  difusionProgramada = true;
  queueMicrotask(() => {
    difusionProgramada = false;
    difundir();
  });
}

function difundir() {
  if (rol !== 'anfitriona') return;
  const partida = estado.partida;
  if (!partida.players.length) return;
  partida.players.forEach((p, idx) => {
    if (!p.idRed) return;
    const inv = invitadas.get(p.idRed);
    if (!inv?.conexion) return;
    const json = JSON.stringify(sanearPartidaParaAsiento(partida, idx));
    if (ultimoEnviado.get(p.idRed) === json) return;
    ultimoEnviado.set(p.idRed, json);
    inv.conexion.enviar({ tipo: 'estado', asiento: idx, partida: json });
  });
}

/** Marcador final: también a las invitadas. */
export function difundirFin(datos) {
  if (rol !== 'anfitriona' || !partidaEnLinea()) return;
  difundir();
  let copia;
  try { copia = JSON.parse(JSON.stringify(datos)); } catch { return; }
  estado.partida.players.forEach((p, idx) => { if (p.idRed) enviarA(idx, { tipo: 'fin', datos: copia }); });
}

/**
 * Al empezar una partida con la sala abierta: el primer asiento de persona
 * es la anfitriona; los demás, las invitadas conectadas por orden de
 * llegada (con su nombre). Devuelve un texto de error si no cuadra.
 */
export function asignarAsientos(players) {
  if (rol !== 'anfitriona') return null;
  const conectadas = ordenLlegada.map(id => invitadas.get(id)).filter(i => i?.conexion);
  if (!conectadas.length) return null;
  const humanas = players.map((p, i) => (p.tipo !== 'auto' ? i : -1)).filter(i => i >= 0);
  const personas = conectadas.length + 1;
  if (humanas.length !== personas) {
    return `En la sala sois ${personas} personas (tú y ${conectadas.length === 1 ? '1 amiga' : `${conectadas.length} amigas`}), `
      + `pero hay ${humanas.length} ${humanas.length === 1 ? 'asiento' : 'asientos'} de 👤 Persona. Pon uno por persona; el primero es el tuyo.`;
  }
  humanas.slice(1).forEach((idx, k) => {
    players[idx].name = conectadas[k].nombre;
    players[idx].idRed = conectadas[k].idRed;
  });
  // Nombres únicos (dos amigas con el mismo nombre, o igual que la mesa).
  const vistos = new Map();
  players.forEach(p => {
    const veces = (vistos.get(p.name) || 0) + 1;
    vistos.set(p.name, veces);
    if (veces > 1) p.name = `${p.name} ${veces}`;
  });
  pendientes.clear();
  ultimoEnviado.clear();
  return null;
}

/** Se sale al menú: la mesa avisa a las invitadas; la invitada deja la sala. */
export function alSalirAlMenu() {
  if (rol === 'anfitriona') {
    pendientes.clear();
    ultimoEnviado.clear();
    // Con la partida terminada, cada invitada sale del marcador cuando quiere.
    if (!estado.partida.juegoTerminado) invitadas.forEach(inv => inv.conexion?.enviar({ tipo: 'mesaEnMenu' }));
    // Las que se fueron durante la partida ya no tienen asiento.
    [...invitadas.keys()].forEach(id => {
      if (!invitadas.get(id).conexion) { invitadas.delete(id); ordenLlegada = ordenLlegada.filter(k => k !== id); }
    });
  } else if (rol === 'invitada') {
    enTablero = false;   // quien llama ya vuelve al menú
    salirDeSala();
  }
}

// ---------- Invitada ----------

function miIdRed() {
  const clave = 'invocadores.idRed';
  try {
    const almacen = almacenInvitada();
    let id = almacen.getItem(clave);
    if (!id) {
      id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
      almacen.setItem(clave, id);
    }
    return id;
  } catch {
    miIdRed.respaldo ||= `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
    return miIdRed.respaldo;
  }
}

/** Entra en la sala `cod` con el nombre `nombre`. */
export async function unirse(cod, nombre) {
  if (rol === 'anfitriona') return;
  errorUltimo = '';
  saliendo = false;
  codigo = limpiarCodigo(cod);
  miNombre = String(nombre || '').trim().slice(0, 24);
  try {
    await conectarInvitada();
    reintentos = 0;
  } catch (e) {
    errorUltimo = e.message;
    if (!enTablero) { rol = null; codigo = null; }
    avisarOyentes();
    throw e;
  }
}

async function conectarInvitada() {
  const con = await unirseASala(codigo);
  conexion = con;
  ultimoMensajeMesa = Date.now();
  configurarVoz(con.peerLocal);
  con.alRecibir(msg => alRecibir(con, msg));
  con.alCerrar(() => { if (conexion === con) alPerderMesa(); });
  con.enviar({ tipo: 'unirse', idRed: miIdRed(), nombre: miNombre, version: await leerVersion() });
}

function alRecibir(con, msg) {
  if (con !== conexion || !msg) return;
  ultimoMensajeMesa = Date.now();
  if (msg.tipo === 'latido') { con.enviar({ tipo: 'latido' }); return; }
  switch (msg.tipo) {
    case 'bienvenida':
      rol = 'invitada';
      // Si se recarga la página, se vuelve a entrar sola (ver panel-online.js).
      try { almacenInvitada()?.setItem(CLAVE_SALA_INVITADA, JSON.stringify({ codigo, nombre: miNombre, hora: Date.now() })); } catch { /* nada */ }
      quitarBandaConexion();
      avisarOyentes();
      return;
    case 'rechazo':
      olvidarSalaAnterior();
      errorUltimo = msg.motivo;
      saliendo = true;
      conexion = null;
      con.cerrar();
      rol = null;
      if (enTablero) volverAEspera();
      avisarOyentes();
      return;
    case 'voz':
      fijarParticipantes(msg.ids);
      return;
    case 'lobby':
      nombresSala = Array.isArray(msg.nombres) ? msg.nombres.map(String) : [];
      avisarOyentes();
      return;
    case 'estado':
      aplicarEstado(msg);
      return;
    case 'peticion':
      abrirPeticion(msg);
      return;
    case 'aviso':
      mostrarAviso(String(msg.texto));
      return;
    case 'fin':
      mostrarFinMesa(msg.datos, () => volverAEspera());
      return;
    case 'mesaEnMenu':
      if (enTablero) {
        volverAEspera();
        mostrarAviso('La mesa ha salido al menú. La partida queda guardada en su dispositivo.');
      }
      return;
    default:
  }
}

function aplicarEstado(msg) {
  let partida;
  try { partida = JSON.parse(msg.partida); } catch { return; }
  const turnoAntes = enTablero ? estado.partida.turn : null;
  const jugadaAntes = enTablero ? estado.partida.played : null;
  miAsiento = msg.asiento;
  estado.partida = partida;
  // Empieza otra partida mientras esta invitada miraba el marcador final.
  if (!partida.juegoTerminado) document.querySelector('.m-fin')?.remove();
  if (turnoAntes !== partida.turn || (partida.played && !jugadaAntes)) estado.ui.selectedCardIdx = null;
  if (!enTablero) {
    enTablero = true;
    mostrarTablero();
  }
  render(partida.players, partida.neutrals, partida.levelIdx);
  if (turnoAntes !== partida.turn && !partida.juegoTerminado) {
    const actual = partida.players[partida.turn];
    if (actual) anunciarTurnoMesa(actual, actual.tipo === 'auto');
    if (partida.turn === miAsiento) navigator.vibrate?.(150);
  }
}

function abrirPeticion({ id, clase, titulo, opciones }) {
  if (!Array.isArray(opciones)) return;
  const responder = valor => conexion?.enviar({ tipo: 'respuesta', id, valor });
  const cancelar = () => conexion?.enviar({ tipo: 'respuesta', id, cancelar: true });
  if (clase === 'pregunta') preguntarMesa(titulo, opciones, responder);
  else if (clase === 'portal') pickerPortal(titulo, opciones, responder, cancelar);
  else picker(titulo, opciones, responder, cancelar);
}

/**
 * Jugada de la invitada: se comprueba en su copia (para avisar al momento
 * si no vale) y se manda a la mesa, que es quien la ejecuta de verdad.
 */
export function enviarJugada(cartaIdx, destino) {
  const prueba = JSON.parse(JSON.stringify(estado.partida));
  const valida = jugarCarta(prueba, { cartaIdx, destino }).some(e => e.tipo === 'cartaJugada');
  if (!valida || !conexion) return false;
  conexion.enviar({ tipo: 'jugar', cartaIdx, destino });
  return true;
}

export function enviarActivar(origen = null) {
  conexion?.enviar({ tipo: 'activar', origen });
}

export function enviarFinTurno() {
  conexion?.enviar({ tipo: 'terminar' });
}

/** Sale de la sala (botón "Salir" de la invitada). */
export function salirDeSala() {
  if (rol !== 'invitada' && !conexion) return;
  saliendo = true;
  detenerVoz();
  olvidarSalaAnterior();
  const c = conexion;
  conexion = null;
  c?.cerrar();
  rol = null;
  codigo = null;
  miAsiento = null;
  nombresSala = [];
  quitarBandaConexion();
  if (enTablero) {
    enTablero = false;
    resetJuego();
  }
  avisarOyentes();
}

/** De la partida a la pantalla de espera de la sala (sin desconectarse). */
function volverAEspera() {
  enTablero = false;
  miAsiento = null;
  resetJuego();
}

/** Se ha cortado la conexión con la mesa: se reintenta un rato. */
function alPerderMesa() {
  conexion = null;
  if (saliendo) return;
  if (!enTablero && rol !== 'invitada') {
    rol = null;
    errorUltimo = 'Se ha perdido la conexión con la mesa.';
    codigo = null;
    avisarOyentes();
    return;
  }
  if (enTablero) mostrarBandaConexion('Se ha perdido la conexión con la mesa. Reconectando…');
  reintentar();
}

function reintentar() {
  if (saliendo || conexion) return;
  reintentos++;
  if (reintentos > 40) {
    mostrarBandaConexion('No se puede contactar con la mesa. ¿Sigue con la app abierta?', true);
    return;
  }
  setTimeout(() => {
    if (saliendo || conexion) return;
    conectarInvitada().then(() => { reintentos = 0; }).catch(() => reintentar());
  }, Math.min(2000 + reintentos * 500, 6000));
}

/** La conexión con la mesa lleva callada `ms`: se cierra para volver a conectar. */
function comprobarSilencio(ms) {
  if (rol !== 'invitada' || saliendo) return;
  if (conexion && Date.now() - ultimoMensajeMesa > ms) {
    const c = conexion;
    c.cerrar();   // alPerderMesa() reconecta
  }
}

if (typeof document !== 'undefined') {
  setInterval(() => comprobarSilencio(SILENCIO_MAX_MS), LATIDO_MS);
  // Al volver a la app (otra app, móvil bloqueado) se comprueba enseguida:
  // si la mesa no ha dicho nada en unos segundos, la conexión se rehace.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || rol !== 'invitada' || saliendo) return;
    if (conexion) { comprobarSilencio(LATIDO_MS * 1.5); return; }
    reintentos = 0;
    conectarInvitada().catch(() => reintentar());
  });
}

function mostrarBandaConexion(texto, conBotones = false) {
  let banda = document.querySelector('.m-red-banda');
  if (!banda) {
    banda = document.createElement('div');
    banda.className = 'm-red-banda';
    banda.setAttribute('role', 'alert');
    document.body.appendChild(banda);
  }
  banda.innerHTML = '';
  const p = document.createElement('span');
  p.textContent = texto;
  banda.appendChild(p);
  if (conBotones) {
    const otra = document.createElement('button');
    otra.type = 'button';
    otra.className = 'm-mini-btn';
    otra.textContent = 'Reintentar';
    otra.onclick = () => { reintentos = 0; mostrarBandaConexion('Reconectando…'); reintentar(); };
    const salir = document.createElement('button');
    salir.type = 'button';
    salir.className = 'm-mini-btn';
    salir.textContent = 'Salir';
    salir.onclick = () => salirDeSala();
    banda.append(otra, salir);
  }
}

function quitarBandaConexion() {
  document.querySelector('.m-red-banda')?.remove();
}
