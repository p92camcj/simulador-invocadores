// js/red/transporte.js
//
// Juego online: el "cable" entre dispositivos. Da igual qué hay debajo; el
// resto del código solo ve conexiones con enviar() / alRecibir() / alCerrar().
//
// - PeerJS (por defecto): WebRTC directo entre navegadores. El servidor
//   gratuito de PeerJS solo los presenta; después los datos van de un
//   dispositivo a otro. Si una red no deja la conexión directa (algunas
//   redes móviles), PeerJS usa sus repetidores TURN gratuitos. Se carga de
//   vendor/peerjs/ solo al abrir o unirse a una sala.
// - BroadcastChannel (con ?red=local en la URL): pestañas del mismo
//   navegador, sin internet. Sirve para probar el juego online en un solo
//   ordenador (y en los tests con Playwright).
// - Con ?servidorRed=host:puerto, PeerJS usa ese servidor de salas en vez
//   del gratuito (para probar con un servidor PeerJS propio en local).

const PREFIJO = 'invocadores-sim-';

function transporteLocal() {
  return typeof location !== 'undefined' && new URLSearchParams(location.search).get('red') === 'local';
}

/** Opciones de PeerJS: el servidor de salas gratuito, salvo ?servidorRed=host:puerto. */
function opcionesPeer() {
  const srv = typeof location !== 'undefined' && new URLSearchParams(location.search).get('servidorRed');
  if (!srv) return {};
  const [host, puerto] = srv.split(':');
  return { host, port: Number(puerto) || 9000, path: '/', secure: false };
}

let cargaPeerJs = null;
function cargarPeerJs() {
  if (window.Peer) return Promise.resolve(window.Peer);
  if (!cargaPeerJs) {
    cargaPeerJs = new Promise((ok, mal) => {
      const s = document.createElement('script');
      s.src = 'vendor/peerjs/peerjs.min.js';
      s.onload = () => (window.Peer ? ok(window.Peer) : mal(new Error('PeerJS no disponible')));
      s.onerror = () => { cargaPeerJs = null; mal(new Error('No se ha podido cargar la conexión online. ¿Hay internet?')); };
      document.head.appendChild(s);
    });
  }
  return cargaPeerJs;
}

/** Envuelve una conexión de PeerJS. */
function envolverPeer(conn) {
  const recibir = [];
  const cerrar = [];
  let cerrada = false;
  const alCerrarse = () => {
    if (cerrada) return;
    cerrada = true;
    cerrar.forEach(f => f());
  };
  conn.on('data', d => {
    let datos = d;
    if (typeof d === 'string') { try { datos = JSON.parse(d); } catch { return; } }
    recibir.forEach(f => f(datos));
  });
  conn.on('close', alCerrarse);
  conn.on('error', alCerrarse);
  // Si la conexión WebRTC se cae (el móvil se bloquea, cambia de red...),
  // PeerJS no siempre avisa con 'close': se vigila el estado ICE.
  const pc = conn.peerConnection;
  if (pc) {
    pc.addEventListener('iceconnectionstatechange', () => {
      if (['failed', 'closed'].includes(pc.iceConnectionState)) alCerrarse();
    });
  }
  return {
    /** Id de PeerJS del otro extremo (para el chat de voz, js/red/voz.js). */
    idRemoto: conn.peer,
    enviar(obj) { if (!cerrada && conn.open) conn.send(JSON.stringify(obj)); },
    alRecibir(f) { recibir.push(f); },
    alCerrar(f) { cerrar.push(f); },
    cerrar() { try { conn.close(); } catch { /* nada */ } alCerrarse(); },
    get abierta() { return !cerrada; },
  };
}

function textoErrorPeer(err, codigo) {
  switch (err?.type) {
    case 'peer-unavailable': return `No hay ninguna sala abierta con el código ${codigo}.`;
    case 'network': case 'server-error': case 'socket-error': case 'socket-closed':
      return 'No se ha podido conectar con el servidor de salas. Revisa la conexión a internet.';
    case 'browser-incompatible': return 'Este navegador no permite jugar online.';
    default: return `Error de conexión (${err?.type || err?.message || 'desconocido'}).`;
  }
}

// ---------- Anfitriona ----------

/**
 * Abre la sala `codigo`. `alConectar(conexion)` se llama por cada invitada
 * que entra. Devuelve { cerrar() }. Si el código ya está en uso, falla con
 * error.codigoOcupado = true.
 */
export async function abrirSala(codigo, { alConectar, alAviso }) {
  if (transporteLocal()) return abrirSalaLocal(codigo, alConectar);
  const Peer = await cargarPeerJs();
  return new Promise((ok, mal) => {
    const peer = new Peer(PREFIJO + codigo, opcionesPeer());
    let abierta = false;
    peer.on('open', () => {
      abierta = true;
      ok({ cerrar: () => peer.destroy(), peer });
    });
    peer.on('connection', conn => {
      conn.on('open', () => alConectar(envolverPeer(conn)));
    });
    // El móvil en segundo plano pierde el contacto con el servidor de
    // salas: se recupera solo (las partidas en curso no se cortan).
    peer.on('disconnected', () => {
      if (!peer.destroyed) setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 1500);
    });
    peer.on('error', err => {
      if (!abierta) {
        const e = new Error(textoErrorPeer(err, codigo));
        e.codigoOcupado = err?.type === 'unavailable-id';
        peer.destroy();
        mal(e);
      } else if (err?.type !== 'peer-unavailable') {
        alAviso?.(textoErrorPeer(err, codigo));
      }
    });
  });
}

// ---------- Invitada ----------

/** Se conecta a la sala `codigo`. Devuelve la conexión con la anfitriona. */
export async function unirseASala(codigo) {
  if (transporteLocal()) return unirseASalaLocal(codigo);
  const Peer = await cargarPeerJs();
  return new Promise((ok, mal) => {
    const peer = new Peer(opcionesPeer());
    let resuelta = false;
    const fallar = msg => {
      if (resuelta) return;
      resuelta = true;
      peer.destroy();
      mal(new Error(msg));
    };
    const espera = setTimeout(() => fallar(`No se ha podido entrar en la sala ${codigo}. Comprueba el código y que la mesa tenga la app abierta.`), 20000);
    peer.on('open', () => {
      const conn = peer.connect(PREFIJO + codigo, { reliable: true, serialization: 'raw' });
      conn.on('open', () => {
        if (resuelta) return;
        resuelta = true;
        clearTimeout(espera);
        const c = envolverPeer(conn);
        c.peerLocal = peer;   // el chat de voz llama y recibe llamadas con él
        c.alCerrar(() => setTimeout(() => peer.destroy(), 0));
        ok(c);
      });
    });
    peer.on('error', err => { clearTimeout(espera); fallar(textoErrorPeer(err, codigo)); });
    // Sin contacto con el servidor de salas no llegarían las llamadas de voz.
    peer.on('disconnected', () => {
      if (resuelta && !peer.destroyed) setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 1500);
    });
  });
}

// ---------- Pruebas en un solo navegador (BroadcastChannel) ----------

function abrirSalaLocal(codigo, alConectar) {
  const canal = new BroadcastChannel(PREFIJO + codigo);
  const conexiones = new Map();
  canal.onmessage = ({ data }) => {
    if (!data || data.para !== 'mesa') return;
    if (data.tipo === 'hola' && !conexiones.has(data.de)) {
      const c = conexionLocal(canal, 'mesa', data.de, () => conexiones.delete(data.de));
      conexiones.set(data.de, c);
      canal.postMessage({ de: 'mesa', para: data.de, tipo: 'bienvenida' });
      alConectar(c);
    } else if (conexiones.has(data.de)) {
      conexiones.get(data.de)._entrada(data);
    }
  };
  window.addEventListener('pagehide', () => conexiones.forEach(c => c.cerrar()));
  return Promise.resolve({ cerrar: () => { conexiones.forEach(c => c.cerrar()); canal.close(); } });
}

function unirseASalaLocal(codigo) {
  const canal = new BroadcastChannel(PREFIJO + codigo);
  const yo = `inv-${Math.random().toString(36).slice(2, 10)}`;
  return new Promise((ok, mal) => {
    const espera = setTimeout(() => { canal.close(); mal(new Error(`No hay ninguna sala abierta con el código ${codigo}.`)); }, 3000);
    let conexion = null;
    canal.onmessage = ({ data }) => {
      if (!data || data.para !== yo) return;
      if (data.tipo === 'bienvenida' && !conexion) {
        clearTimeout(espera);
        conexion = conexionLocal(canal, yo, 'mesa', () => canal.close());
        ok(conexion);
      } else if (conexion) {
        conexion._entrada(data);
      }
    };
    canal.postMessage({ de: yo, para: 'mesa', tipo: 'hola' });
  });
}

function conexionLocal(canal, yo, otro, alTerminar) {
  const recibir = [];
  const cerrar = [];
  let cerrada = false;
  const fin = () => {
    if (cerrada) return;
    cerrada = true;
    alTerminar();
    cerrar.forEach(f => f());
  };
  if (yo !== 'mesa') window.addEventListener('pagehide', () => { try { canal.postMessage({ de: yo, para: otro, tipo: 'adios' }); } catch { /* nada */ } });
  return {
    _entrada(data) {
      if (data.tipo === 'adios') fin();
      else if (data.tipo === 'datos') recibir.forEach(f => f(data.datos));
    },
    enviar(obj) { if (!cerrada) canal.postMessage({ de: yo, para: otro, tipo: 'datos', datos: JSON.parse(JSON.stringify(obj)) }); },
    alRecibir(f) { recibir.push(f); },
    alCerrar(f) { cerrar.push(f); },
    cerrar() {
      if (!cerrada) { try { canal.postMessage({ de: yo, para: otro, tipo: 'adios' }); } catch { /* nada */ } }
      fin();
    },
    get abierta() { return !cerrada; },
  };
}
