// Sonido de la maqueta: todo se sintetiza en el momento con Web Audio
// (osciladores, ruido filtrado y una reverberación generada). No hay ningún
// archivo de audio ni recurso de terceros: la licencia es la del proyecto.
let ctx = null, maestro, rev, bufRuido, activo = true;

export function iniciarAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  ctx = new AC();
  maestro = ctx.createGain(); maestro.gain.value = activo ? 0.85 : 0;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
  maestro.connect(comp); comp.connect(ctx.destination);
  // Reverberación: ruido que decae (sala de piedra).
  const n = ctx.sampleRate * 2.6, ir = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) { const d = ir.getChannelData(c); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 2.6); }
  rev = ctx.createConvolver(); rev.buffer = ir; const g = ctx.createGain(); g.gain.value = 0.5; rev.connect(g); g.connect(maestro);
  bufRuido = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = bufRuido.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
}
export function ponerSonido(si) { activo = si; if (maestro) maestro.gain.value = si ? 0.85 : 0; }
export const sonidoActivo = () => activo;

function salida(eco = 0.3, pan = 0) {
  const g = ctx.createGain(); let fin = g;
  if (pan && ctx.createStereoPanner) { const p = ctx.createStereoPanner(); p.pan.value = pan; g.connect(p); fin = p; }
  fin.connect(maestro); if (eco) { const e = ctx.createGain(); e.gain.value = eco; fin.connect(e); e.connect(rev); }
  return g;
}
function env(g, t, vol, atk, dur) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + atk); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); }
/** Tono: { f, f2 (desliza), dur, tipo, vol, atk, t (retardo), eco, pan, vib } */
function tono(o) {
  if (!ctx || !activo) return;
  const t = ctx.currentTime + (o.t ?? 0), dur = o.dur ?? 0.4, osc = ctx.createOscillator(), g = salida(o.eco ?? 0.3, o.pan);
  osc.type = o.tipo ?? 'sine'; osc.frequency.setValueAtTime(o.f, t);
  if (o.f2) osc.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  if (o.vib) { const l = ctx.createOscillator(), lg = ctx.createGain(); l.frequency.value = o.vib; lg.gain.value = o.f * (o.vibProf ?? 0.03); l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur); }
  env(g, t, o.vol ?? 0.2, o.atk ?? 0.01, dur); osc.connect(g); osc.start(t); osc.stop(t + dur + 0.05);
}
/** Ruido filtrado: { dur, vol, filtro, f, f2, q, atk, t, eco, pan } */
function ruido(o) {
  if (!ctx || !activo) return;
  const t = ctx.currentTime + (o.t ?? 0), dur = o.dur ?? 0.3, s = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = salida(o.eco ?? 0.2, o.pan);
  s.buffer = bufRuido; s.loop = true; fl.type = o.filtro ?? 'lowpass'; fl.Q.value = o.q ?? 1;
  fl.frequency.setValueAtTime(o.f ?? 800, t); if (o.f2) fl.frequency.exponentialRampToValueAtTime(o.f2, t + dur);
  env(g, t, o.vol ?? 0.2, o.atk ?? 0.01, dur); s.connect(fl); fl.connect(g); s.start(t, Math.random()); s.stop(t + dur + 0.05);
}
/** Campana/cristal: parciales inarmónicos. */
function campana(f, dur = 1.2, vol = 0.15, t = 0, pan = 0) { [[1, 1], [2.76, 0.45], [5.4, 0.22], [8.9, 0.1]].forEach(([m, v]) => tono({ f: f * m, dur: dur / Math.sqrt(m), vol: vol * v, t, eco: 0.5, pan })); }
const ESCALA = [261.6, 311.1, 349.2, 392, 466.2, 523.3, 622.3, 698.5, 784, 932.3];   // do menor pentatónica
const nota = i => ESCALA[((i % ESCALA.length) + ESCALA.length) % ESCALA.length];

const SON = {
  // --- comunes ---
  paso() { ruido({ dur: 0.09, vol: 0.2, f: 190, eco: 0.12 }); tono({ f: 78, f2: 50, dur: 0.08, vol: 0.14, eco: 0.1 }); },
  manto() { ruido({ dur: 0.55, vol: 0.2, filtro: 'bandpass', f: 1500, f2: 260, q: 0.8, atk: 0.06 }); },
  mantoCae() { ruido({ dur: 0.25, vol: 0.18, f: 420, f2: 120 }); },
  humo() { ruido({ dur: 1.3, vol: 0.09, filtro: 'highpass', f: 2600, f2: 6000, atk: 0.3, eco: 0.6 }); campana(1568, 0.9, 0.03); },
  runa(i = 0) { campana(nota(i) * 2, 1.5, 0.1); tono({ f: nota(i) / 2, dur: 1.0, vol: 0.07, tipo: 'triangle' }); },
  aparece() { tono({ f: 300, f2: 1200, dur: 0.5, vol: 0.08, tipo: 'triangle', eco: 0.6 }); campana(1046, 0.8, 0.05, 0.3); },
  llegada() { campana(523, 1.4, 0.12); tono({ f: 130, dur: 0.7, vol: 0.14, tipo: 'triangle' }); ruido({ dur: 0.5, vol: 0.06, filtro: 'bandpass', f: 3000, q: 4, eco: 0.6 }); },
  seVa() { tono({ f: 700, f2: 180, dur: 0.9, vol: 0.08, tipo: 'triangle', eco: 0.7 }); ruido({ dur: 0.9, vol: 0.05, filtro: 'bandpass', f: 2400, f2: 500, q: 2, eco: 0.7 }); },
  cargar(f = 220, dur = 1.0) { tono({ f, f2: f * 2, dur, vol: 0.09, tipo: 'sawtooth', atk: dur * 0.8, eco: 0.5 }); ruido({ dur, vol: 0.07, filtro: 'bandpass', f: 500, f2: 4000, q: 3, atk: dur * 0.8 }); },
  lanzar(f = 600) { ruido({ dur: 0.5, vol: 0.2, filtro: 'bandpass', f: 3200, f2: 500, q: 1.5 }); tono({ f, f2: f / 3, dur: 0.45, vol: 0.12, tipo: 'triangle' }); },
  impacto(f = 392) { campana(f, 1.6, 0.16); tono({ f: 90, f2: 45, dur: 0.5, vol: 0.2 }); ruido({ dur: 0.35, vol: 0.12, f: 1800, f2: 200 }); },
  gema(i = 0) { campana(nota(i + 5) * 2, 1.3, 0.13); campana(nota(i + 7) * 2, 1.0, 0.07, 0.09); },
  gemaVuela() { tono({ f: 900, f2: 1800, dur: 0.8, vol: 0.05, eco: 0.6, vib: 9 }); },
  cristalRoto() { for (let i = 0; i < 7; i++) campana(1800 + Math.random() * 2600, 0.5, 0.06, i * 0.035, Math.random() * 2 - 1); ruido({ dur: 0.25, vol: 0.12, filtro: 'highpass', f: 5000 }); },
  // --- por personaje ---
  cronomante() { for (let i = 0; i < 14; i++) { const t = 1.6 * (1 - Math.pow(1 - i / 14, 1.8)); tono({ f: i % 2 ? 1900 : 1500, dur: 0.035, vol: 0.12, tipo: 'square', t, eco: 0.35 }); } tono({ f: 880, f2: 220, dur: 1.8, vol: 0.07, tipo: 'triangle', atk: 1.5, eco: 0.7 }); ruido({ dur: 1.8, vol: 0.08, filtro: 'bandpass', f: 4000, f2: 300, q: 4, atk: 1.6 }); },
  ecos() { [0, 1, 2].forEach(i => campana(nota(6 - i * 2), 1.6, 0.07, i * 0.22)); },
  estratega() { ruido({ dur: 1.1, vol: 0.16, filtro: 'bandpass', f: 300, f2: 2400, q: 1.2, atk: 0.5, pan: -0.8 }); ruido({ dur: 1.1, vol: 0.16, filtro: 'bandpass', f: 2400, f2: 300, q: 1.2, atk: 0.5, pan: 0.8 }); [0, 2, 4].forEach((n, i) => tono({ f: nota(n), dur: 1.2, vol: 0.07, tipo: 'triangle', t: i * 0.05 })); },
  piedra() { ruido({ dur: 0.8, vol: 0.25, f: 240, f2: 90, atk: 0.15 }); tono({ f: 55, f2: 40, dur: 0.8, vol: 0.2 }); },
  golpeSuelo() { tono({ f: 110, f2: 38, dur: 0.45, vol: 0.4 }); ruido({ dur: 0.3, vol: 0.25, f: 600, f2: 100 }); },
  cronista() { for (let i = 0; i < 9; i++) ruido({ dur: 0.07, vol: 0.12, filtro: 'bandpass', f: 2500 + Math.random() * 2500, q: 2, t: i * 0.085, eco: 0.3 }); for (let i = 0; i < 5; i++) tono({ f: 1200 + Math.random() * 900, f2: 800, dur: 0.09, vol: 0.03, tipo: 'sawtooth', t: 0.9 + i * 0.11 }); },
  aprendiz() { tono({ f: 300, f2: 760, dur: 0.5, vol: 0.1, tipo: 'triangle', vib: 13, vibProf: 0.08 }); tono({ f: 760, f2: 240, dur: 0.5, vol: 0.1, tipo: 'triangle', vib: 17, vibProf: 0.1, t: 0.5 }); for (let i = 0; i < 12; i++) ruido({ dur: 0.06, vol: 0.09, filtro: 'bandpass', f: 3000 + Math.random() * 2000, q: 2, t: i * 0.1 }); },
  ups() { tono({ f: 520, f2: 260, dur: 0.22, vol: 0.12, tipo: 'square' }); tono({ f: 300, f2: 620, dur: 0.2, vol: 0.1, tipo: 'square', t: 0.25 }); },
  picaro() { campana(2093, 0.5, 0.1); campana(2637, 0.5, 0.1, 0.09); campana(3136, 0.7, 0.1, 0.18); },
  puf() { ruido({ dur: 0.5, vol: 0.3, f: 1400, f2: 150, atk: 0.005 }); tono({ f: 180, f2: 60, dur: 0.3, vol: 0.2 }); },
  reena() { [0, 0.16].forEach(t => { tono({ f: 520, f2: 760, dur: 0.07, vol: 0.14, tipo: 'sawtooth', t, eco: 0.2 }); ruido({ dur: 0.08, vol: 0.12, filtro: 'bandpass', f: 1300, q: 3, t }); }); },
  sora() { tono({ f: 392, dur: 0.28, vol: 0.14, vib: 6 }); tono({ f: 330, dur: 0.5, vol: 0.14, t: 0.34, vib: 6 }); },
  aleteo() { for (let i = 0; i < 4; i++) ruido({ dur: 0.12, vol: 0.1, f: 700, f2: 200, t: i * 0.16 }); },
  lumo() { [7, 9, 8, 11].forEach((n, i) => campana(nota(n), 0.6, 0.07, i * 0.13)); },
  tierno() { [4, 6, 8].forEach((n, i) => tono({ f: nota(n) * 2, dur: 0.5, vol: 0.06, t: i * 0.1, eco: 0.6 })); },
  maestro() { tono({ f: 82, f2: 164, dur: 1.4, vol: 0.2, tipo: 'sawtooth', atk: 1.0 }); [0, 2, 4, 7].forEach((n, i) => tono({ f: nota(n), dur: 1.4, vol: 0.05, tipo: 'triangle', t: i * 0.12 })); },
  levita() { tono({ f: 220, f2: 440, dur: 1.5, vol: 0.08, vib: 5, vibProf: 0.02, eco: 0.6 }); ruido({ dur: 1.5, vol: 0.05, filtro: 'bandpass', f: 900, f2: 2600, q: 5, atk: 0.4 }); },
  clarividente() { [0, 2, 4, 5, 7, 9].forEach((n, i) => campana(nota(n) * 2, 1.8, 0.06, i * 0.11)); ruido({ dur: 2, vol: 0.05, filtro: 'highpass', f: 5000, atk: 0.8, eco: 0.8 }); },
  velo() { ruido({ dur: 1.6, vol: 0.1, filtro: 'bandpass', f: 600, f2: 1800, q: 0.7, atk: 0.7, eco: 0.7 }); },
  ocultista() { tono({ f: 220, f2: 55, dur: 1.4, vol: 0.18, tipo: 'sawtooth' }); tono({ f: 233, f2: 58, dur: 1.4, vol: 0.12, tipo: 'sawtooth' }); ruido({ dur: 1.2, vol: 0.1, filtro: 'bandpass', f: 5000, f2: 300, q: 3 }); },
  revelar() { tono({ f: 55, f2: 220, dur: 1.2, vol: 0.14, tipo: 'sawtooth', atk: 0.8 }); campana(880, 1.4, 0.1, 1.0); },
  clang() { [[1, 0.3], [1.48, 0.22], [2.13, 0.2], [2.9, 0.16], [4.3, 0.1]].forEach(([m, v]) => tono({ f: 520 * m, dur: 0.9 / m + 0.25, vol: v, tipo: 'square', eco: 0.4 })); ruido({ dur: 0.07, vol: 0.3, filtro: 'highpass', f: 3000 }); },
  zas() { ruido({ dur: 0.22, vol: 0.2, filtro: 'bandpass', f: 600, f2: 4500, q: 1.5 }); },
  metamorfo() { for (let i = 0; i < 12; i++) tono({ f: 280 + Math.random() * 500, f2: 500 + Math.random() * 900, dur: 0.14, vol: 0.07, t: i * 0.1, eco: 0.5 }); tono({ f: 196, f2: 392, dur: 1.3, vol: 0.08, tipo: 'triangle', vib: 7, vibProf: 0.06 }); },
  pagar() { campana(1760, 0.5, 0.1); tono({ f: 1200, f2: 300, dur: 0.4, vol: 0.06, t: 0.12 }); },
  entusiasta() { for (let i = 0; i < 6; i++) campana(2400 + (i % 3) * 420, 0.25, 0.06, i * 0.09); },
  boing() { tono({ f: 150, f2: 480, dur: 0.22, vol: 0.16, tipo: 'triangle' }); },
  // --- invocación ---
  invInicio(dur = 4) {
    if (!ctx || !activo) return;
    [55, 82.4, 110, 164.8].forEach((f, i) => tono({ f, f2: f * 1.5, dur, vol: 0.09, tipo: 'sawtooth', atk: dur * 0.9, eco: 0.5, pan: i % 2 ? 0.4 : -0.4 }));
    ruido({ dur, vol: 0.16, filtro: 'bandpass', f: 200, f2: 6000, q: 2.5, atk: dur * 0.95, eco: 0.6 });
    for (let i = 0; i < 9; i++) { const t = dur * (1 - Math.pow(1 - i / 9, 1.6)); tono({ f: 62, f2: 42, dur: 0.25, vol: 0.3, t }); }
  },
  invBoom() {
    tono({ f: 140, f2: 26, dur: 1.8, vol: 0.6 }); ruido({ dur: 1.6, vol: 0.4, f: 5000, f2: 80, atk: 0.005, eco: 0.8 });
    for (let i = 0; i < 8; i++) campana(nota(i) * 2, 2.5, 0.06, 0.05 + i * 0.05, Math.random() * 2 - 1);
  },
  invCoro(dur = 6) {   // acorde tipo coro: sierras desafinadas a través de formantes vocales
    if (!ctx || !activo) return;
    const t = ctx.currentTime, g = salida(0.7);
    env(g, t, 0.22, 1.0, dur);
    [[700, 9], [1150, 7], [2700, 5]].forEach(([f, q]) => { const fl = ctx.createBiquadFilter(); fl.type = 'bandpass'; fl.frequency.value = f; fl.Q.value = q; fl.connect(g);
      [130.8, 196, 261.6, 311.1, 392].forEach(n => [-7, 6].forEach(d => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = n; o.detune.value = d; o.connect(fl); o.start(t); o.stop(t + dur + 0.1); })); });
  },
  duda() { [[466, 0], [440, 0.3], [466, 0.6], [494, 0.9]].forEach(([f, t]) => tono({ f, dur: 0.3, vol: 0.09, tipo: 'triangle', t, vib: 8, vibProf: 0.02 })); },
  perdida() { [7, 5, 3, 1].forEach((n, i) => tono({ f: nota(n), dur: 0.5, vol: 0.09, tipo: 'triangle', t: i * 0.2, eco: 0.6 })); ruido({ dur: 0.9, vol: 0.08, filtro: 'highpass', f: 4000, t: 0.6 }); },
  seMarcha() { tono({ f: 400, f2: 1600, dur: 2.2, vol: 0.07, eco: 0.8, atk: 0.4 }); ruido({ dur: 2.2, vol: 0.1, filtro: 'bandpass', f: 800, f2: 5000, q: 2, atk: 0.5, eco: 0.8 }); },
};
/** S.nombre(...) reproduce un efecto; si el audio no está iniciado o está apagado, no hace nada. */
export const S = new Proxy(SON, { get: (o, k) => (...a) => { if (ctx && activo && o[k]) try { o[k](...a); } catch (e) { console.warn(e); } } });
