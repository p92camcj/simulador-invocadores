// js/red/voz.js
//
// Chat de voz de las partidas online (js/red/sala.js). Cada dispositivo
// habla directamente con los demás por WebRTC (llamadas de PeerJS), sin
// servidor propio: la mesa solo reparte la lista de quién está
// (fijarParticipantes) y cada uno llama a los demás cuando abre su micro.
//
// Cada llamada va en un solo sentido: quien tiene el micro abierto llama a
// cada participante con su audio, y quien la recibe la contesta sin audio y
// la reproduce. Cerrar el micro solo apaga la pista (track.enabled = false):
// las llamadas siguen hechas y volver a hablar es instantáneo.
//
// Botones (barra de la Mesa y del Escenario): 🎤 micro propio y 🔊 voces
// de las demás. El micro empieza cerrado; las voces, abiertas.

let peer = null;                  // Peer de PeerJS de este dispositivo
let micro = null;                 // MediaStream del micrófono (se pide la primera vez)
let microAbierto = false;
let altavoz = true;
let participantes = [];           // ids de PeerJS de las demás
const salientes = new Map();      // id → llamada con mi micro
const audios = new Map();         // id → <audio> con la voz de esa persona
const oyentes = new Set();

export function escucharVoz(f) { oyentes.add(f); }
function avisar() { oyentes.forEach(f => { try { f(); } catch (e) { console.warn(e); } }); }

/** ¿Hay chat de voz en esta partida? (No con ?red=local ni sin WebRTC.) */
export function vozDisponible() {
  return !!peer && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;
}
export function microActivo() { return microAbierto; }
export function altavozActivo() { return altavoz; }

/**
 * Engancha el chat al Peer de este dispositivo (al abrir la sala o al
 * conectarse a ella; tras reconectar llega un Peer nuevo).
 */
export function configurarVoz(nuevoPeer) {
  if (!nuevoPeer || nuevoPeer === peer) return;
  salientes.forEach(c => { try { c.close(); } catch { /* nada */ } });
  salientes.clear();
  peer = nuevoPeer;
  peer.on('call', llamada => {
    llamada.answer();
    llamada.on('stream', s => reproducir(llamada.peer, s));
    llamada.on('close', () => quitarAudio(llamada.peer));
    llamada.on('error', () => quitarAudio(llamada.peer));
  });
  llamarATodas();
  avisar();
}

/** Lista de quién está en la partida (ids de PeerJS); la manda la mesa. */
export function fijarParticipantes(ids) {
  participantes = (Array.isArray(ids) ? ids : []).filter(id => typeof id === 'string' && id !== peer?.id);
  // Quien se ha ido: fuera su llamada y su audio.
  [...salientes.keys()].forEach(id => {
    if (!participantes.includes(id)) { try { salientes.get(id).close(); } catch { /* nada */ } salientes.delete(id); }
  });
  [...audios.keys()].forEach(id => { if (!participantes.includes(id)) quitarAudio(id); });
  llamarATodas();
}

/** Con el micro preparado, llama a quien aún no tenga una llamada viva. */
function llamarATodas() {
  if (!peer || !micro || peer.destroyed) return;
  participantes.forEach(id => {
    const actual = salientes.get(id);
    if (actual && actual.open !== false && actual.peerConnection?.connectionState !== 'failed') return;
    try {
      const llamada = peer.call(id, micro);
      if (!llamada) return;
      salientes.set(id, llamada);
      const fuera = () => { if (salientes.get(id) === llamada) salientes.delete(id); };
      llamada.on('close', fuera);
      llamada.on('error', fuera);
    } catch (e) {
      console.warn('No se ha podido llamar a', id, e);
    }
  });
}

function reproducir(id, stream) {
  let audio = audios.get(id);
  if (!audio) {
    audio = document.createElement('audio');
    audio.autoplay = true;
    audio.setAttribute('playsinline', '');
    audio.dataset.voz = id;
    audio.style.display = 'none';
    document.body.appendChild(audio);
    audios.set(id, audio);
  }
  audio.srcObject = stream;
  audio.muted = !altavoz;
  audio.play?.().catch(() => { /* el navegador espera a un toque: lo dará el botón 🔊 */ });
}

function quitarAudio(id) {
  const audio = audios.get(id);
  if (!audio) return;
  audio.srcObject = null;
  audio.remove();
  audios.delete(id);
}

/** Botón 🎤: abre o cierra el micro propio. La primera vez pide permiso. */
export async function alternarMicro() {
  if (!vozDisponible()) return;
  if (!micro) {
    try {
      micro = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        video: false,
      });
    } catch {
      alert('No se ha podido usar el micrófono. Revisa el permiso del navegador para esta web.');
      return;
    }
    microAbierto = true;
    llamarATodas();
  } else {
    microAbierto = !microAbierto;
  }
  micro.getAudioTracks().forEach(t => { t.enabled = microAbierto; });
  avisar();
}

/** Botón 🔊: oír o silenciar a las demás. */
export function alternarAltavoz() {
  altavoz = !altavoz;
  audios.forEach(a => {
    a.muted = !altavoz;
    if (altavoz) a.play?.().catch(() => {});
  });
  avisar();
}

/** Fin de la partida online o salida de la sala: se cuelga todo y se suelta el micro. */
export function detenerVoz() {
  salientes.forEach(c => { try { c.close(); } catch { /* nada */ } });
  salientes.clear();
  [...audios.keys()].forEach(quitarAudio);
  micro?.getTracks().forEach(t => t.stop());
  micro = null;
  microAbierto = false;
  participantes = [];
  peer = null;
  avisar();
}

/** Botones del chat de voz durante una partida online: { micro, altavoz } en HTML, o null. */
export function botonesVozHtml() {
  if (!vozDisponible()) return null;
  return { micro: `<button type="button" class="m-btn-icono m-voz ${microAbierto ? 'activo' : 'apagado'}" data-accion="micro"`
    + ` aria-pressed="${microAbierto}" aria-label="${microAbierto ? 'Cerrar mi micro' : 'Abrir mi micro'}" title="${microAbierto ? 'Tu micro está abierto' : 'Tu micro está cerrado'}">🎤</button>`,
    altavoz: `<button type="button" class="m-btn-icono m-voz ${altavoz ? 'activo' : 'apagado'}" data-accion="altavoz"`
    + ` aria-pressed="${altavoz}" aria-label="${altavoz ? 'Silenciar a las demás' : 'Oír a las demás'}" title="${altavoz ? 'Oyes a las demás' : 'Las demás están silenciadas'}">${altavoz ? '🔊' : '🔇'}</button>` };
}
