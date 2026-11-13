// Modelos 3D de los personajes, construidos por código (sin archivos de
// modelo): figuras articuladas de pocos polígonos con sombreado de dibujo
// animado, que recrean la ropa, el pelo, los colores y los objetos de las
// ilustraciones originales (assets/personajes). Cada modelo devuelve sus
// articulaciones (`art`) para que personajes.js las anime. Mira hacia +Z;
// su izquierda (I) es +X y su derecha (D) es -X. Origen en los pies.
import { THREE } from './mundo.js';

const grad = new THREE.DataTexture(new Uint8Array([96, 96, 96, 255, 150, 150, 150, 255, 208, 208, 208, 255, 255, 255, 255, 255]), 4, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

const ESF = new THREE.SphereGeometry(1, 16, 12);
const ESF_BAJA = new THREE.SphereGeometry(1, 10, 8);
const CIL = (rt, rb, h, n = 12, abierto = false) => new THREE.CylinderGeometry(rt, rb, h, n, 1, abierto);
const CONO = (r, h, n = 7) => new THREE.ConeGeometry(r, h, n);

function materiales() {
  const cache = new Map();
  return (color, o = {}) => {
    const k = color + JSON.stringify({ ...o, mapa: o.mapa?.uuid });
    if (!cache.has(k)) cache.set(k, o.luz
      ? new THREE.MeshBasicMaterial({ color, transparent: !!o.alfa, opacity: o.alfa ?? 1, side: o.doble ? THREE.DoubleSide : THREE.FrontSide, blending: o.aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.aditivo })
      : new THREE.MeshToonMaterial({ color: o.mapa && !o.tinte ? 0xffffff : color, map: o.mapa ?? null, bumpMap: o.mapa && o.relieve !== 0 ? o.mapa : null, bumpScale: o.relieve ?? 1.6, gradientMap: grad, side: o.doble ? THREE.DoubleSide : THREE.FrontSide, emissive: o.emisivo ?? 0x000000, emissiveIntensity: o.emisivo ? (o.brillo ?? 0.6) : 1, flatShading: !!o.plano }));
    return cache.get(k);
  };
}
const hex = c => '#' + new THREE.Color(c).getHexString();
const tono = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();

// ------------------------------------------------------------ telas pintadas
// Cada tejido se pinta en un lienzo: color base, pliegues, trama de hilos y
// grano. La misma imagen sirve de color y de relieve, así la luz "lee" el hilo.
let semilla = 11;
const rnd = () => (semilla = (semilla * 16807 + 7) % 2147483647) / 2147483647;
const cacheTex = new Map();
function lienzo(w, h) { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; return [cv, cv.getContext('2d')]; }
function aTextura(cv, rx = 1, ry = 1) { const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t; }
/** Pliegues, trama y grano sobre lo que ya haya pintado. tipo: lino | sarga | terciopelo | seda | cuero | lana. */
function tejer(x, w, h, tipo = 'lino', fuerza = 1) {
  const pl = tipo === 'cuero' ? 3 : tipo === 'seda' ? 9 : 6;
  for (let i = 0; i < pl; i++) { const px = rnd() * w, an = w * (0.03 + rnd() * 0.07); for (const d of [0, -w, w]) { const g = x.createLinearGradient(px + d - an, 0, px + d + an, 0);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, i % 2 ? `rgba(0,0,30,${0.2 * fuerza})` : `rgba(255,255,255,${(tipo === 'seda' ? 0.2 : 0.11) * fuerza})`); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px + d - an, 0, an * 2, h); } }
  x.lineWidth = 1;
  if (tipo === 'lino' || tipo === 'lana') { const paso = tipo === 'lana' ? 5 : 3;
    for (let y = 0; y < h; y += paso) { x.fillStyle = `rgba(0,0,20,${0.13 * fuerza})`; x.fillRect(0, y, w, 1); x.fillStyle = `rgba(255,255,255,${0.07 * fuerza})`; x.fillRect(0, y + 1, w, 1); }
    for (let px = 0; px < w; px += paso) { x.fillStyle = `rgba(0,0,20,${0.1 * fuerza})`; x.fillRect(px, 0, 1, h); }
    if (tipo === 'lana') for (let i = 0; i < w * h / 60; i++) { x.fillStyle = `rgba(255,255,255,${0.1 * rnd()})`; x.fillRect(rnd() * w, rnd() * h, 2, 1); } }
  else if (tipo === 'sarga' || tipo === 'seda') { const paso = tipo === 'seda' ? 3 : 4; x.strokeStyle = `rgba(0,0,25,${(tipo === 'seda' ? 0.07 : 0.15) * fuerza})`;
    for (let d = -h; d < w; d += paso) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + h, h); x.stroke(); }
    x.strokeStyle = `rgba(255,255,255,${0.06 * fuerza})`; for (let d = -h + 1; d < w; d += paso) { x.beginPath(); x.moveTo(d, 0); x.lineTo(d + h, h); x.stroke(); } }
  else if (tipo === 'terciopelo') { for (let i = 0; i < w * h / 9; i++) { x.fillStyle = rnd() < 0.5 ? `rgba(0,0,20,${0.16 * fuerza})` : `rgba(255,255,255,${0.09 * fuerza})`; x.fillRect(rnd() * w, rnd() * h, 1, 1 + rnd() * 2); } }
  else if (tipo === 'cuero') { for (let i = 0; i < 26; i++) { x.fillStyle = `rgba(0,0,0,${0.05 + rnd() * 0.07})`; x.beginPath(); x.ellipse(rnd() * w, rnd() * h, 6 + rnd() * 16, 4 + rnd() * 10, rnd() * 3, 0, 7); x.fill(); }
    x.strokeStyle = 'rgba(0,0,0,.22)'; for (let i = 0; i < 30; i++) { let px = rnd() * w, py = rnd() * h; x.beginPath(); x.moveTo(px, py); for (let j = 0; j < 4; j++) { px += (rnd() - 0.5) * 16; py += (rnd() - 0.5) * 16; x.lineTo(px, py); } x.stroke(); }
    for (let i = 0; i < w * h / 30; i++) { x.fillStyle = `rgba(255,255,255,${0.06 * rnd()})`; x.fillRect(rnd() * w, rnd() * h, 1, 1); } }
  const im = x.getImageData(0, 0, w, h), d = im.data;   // grano fino
  for (let i = 0; i < d.length; i += 4) { const r = (rnd() - 0.5) * 16 * fuerza; d[i] += r; d[i + 1] += r; d[i + 2] += r; }
  x.putImageData(im, 0, 0);
}
function motivos(x, w, y0, y1, c2, motivo, n = 22) {
  if (!motivo) return; x.save(); x.fillStyle = x.strokeStyle = hex(c2); x.globalAlpha = 0.6; x.lineWidth = 1.4;
  for (let i = 0; i < n; i++) { const px = rnd() * w, py = y0 + rnd() * (y1 - y0), r = 2.5 + rnd() * 3; x.beginPath();
    if (motivo === 'estrellas') { for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, rr = j % 2 ? r * 0.4 : r * 1.5; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill(); }
    else if (motivo === 'relojes') { x.arc(px, py, r * 1.3, 0, 7); x.stroke(); x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - r); x.moveTo(px, py); x.lineTo(px + r * 0.7, py); x.stroke(); }
    else if (motivo === 'lunas') { x.arc(px, py, r * 1.3, 0.6, 5.2); x.arc(px + r * 0.6, py - r * 0.2, r * 1.0, 4.6, 1.2, true); x.fill(); }
    else if (motivo === 'espirales') { for (let a = 0; a < 9; a += 0.4) x.lineTo(px + Math.cos(a) * a * r * 0.22, py + Math.sin(a) * a * r * 0.22); x.stroke(); }
    else if (motivo === 'flores') { for (let j = 0; j < 4; j++) { x.beginPath(); x.ellipse(px + Math.cos(j * 1.571) * r * 0.8, py + Math.sin(j * 1.571) * r * 0.8, r * 0.75, r * 0.4, j * 1.571, 0, 7); x.fill(); } }
    else if (motivo === 'hojas') { x.ellipse(px, py, r * 1.5, r * 0.6, rnd() * 3, 0, 7); x.fill(); }
    else if (motivo === 'puntadas') { x.moveTo(px - r, py); x.lineTo(px + r, py); x.moveTo(px, py - r); x.lineTo(px, py + r); x.stroke(); } }
  x.restore();
}
function arlequin(x, w, h, c, c2, lado = 32) {   // rombos a dos colores (Entusiasta)
  x.fillStyle = hex(c); x.fillRect(0, 0, w, h); x.fillStyle = hex(c2);
  for (let j = -1; j <= h / lado; j++) for (let i = 0; i <= w / lado; i++) { const px = i * lado + (j % 2 ? lado / 2 : 0), py = j * lado; x.beginPath(); x.moveTo(px, py); x.lineTo(px + lado / 2, py + lado / 2); x.lineTo(px, py + lado); x.lineTo(px - lado / 2, py + lado / 2); x.fill(); }
}
/** Paño liso (mangas, calzas, capuchas, botas): solo tejido, para repetirlo. */
function texturaLisa(c, tipo = 'lino', c2 = null) {
  const k = 'L' + c + tipo + c2; if (cacheTex.has(k)) return cacheTex.get(k);
  const [cv, x] = lienzo(128, 128); if (c2 != null) arlequin(x, 128, 128, c, c2, 32); else { x.fillStyle = hex(c); x.fillRect(0, 0, 128, 128); }
  tejer(x, 128, 128, tipo); const t = aTextura(cv, 2, 2); cacheTex.set(k, t); return t;
}
/** Tela pintada: degradado, pliegues, trama, bordado en el bajo y motivos. `bajo`: 'arriba' (túnicas) o 'abajo' (capas). */
function texturaTela(c, c2, bajo = 'arriba', motivo = null, tipo = 'lino', rombos = null, panel = null, W = 256, o = {}) {
  const [cv, x] = lienzo(W, 256);
  if (rombos != null) arlequin(x, W, 256, c, rombos, 32);
  else { const g = x.createLinearGradient(0, bajo === 'arriba' ? 256 : 0, 0, bajo === 'arriba' ? 0 : 256); g.addColorStop(0, tono(c, 1.1)); g.addColorStop(0.6, hex(c)); g.addColorStop(1, tono(c, 0.7)); x.fillStyle = g; x.fillRect(0, 0, W, 256); }
  if (o.rayas) { const n = o.rayas.length * 2, an = W / n; for (let i = 0; i < n; i++) { const g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, tono(o.rayas[i % o.rayas.length], 1.05)); g.addColorStop(1, tono(o.rayas[i % o.rayas.length], 0.8)); x.fillStyle = g; x.fillRect(Math.round((i + 0.5) * an), 0, Math.ceil(an) + 1, 256); x.fillStyle = 'rgba(255,255,255,.25)'; x.fillRect(Math.round((i + 0.5) * an), 0, 2, 256); } }
  motivos(x, W, 40, 216, o.cMotivo ?? c2, motivo, W / 10);
  const y0 = bajo === 'arriba' ? 0 : 226;
  x.fillStyle = hex(c2); x.fillRect(0, y0, W, 30); x.fillStyle = tono(c2, 0.55); x.fillRect(0, bajo === 'arriba' ? 30 : 222, W, 4);
  x.fillStyle = tono(c, 0.8); for (let i = 0; i < W / 16; i++) { const px = i * 16 + 8, py = y0 + 15; x.beginPath(); x.moveTo(px, py - 9); x.lineTo(px + 6, py); x.lineTo(px, py + 9); x.lineTo(px - 6, py); x.fill(); }
  x.strokeStyle = tono(c2, 0.5); x.setLineDash([4, 3]); x.lineWidth = 1.5; x.beginPath(); const yp = bajo === 'arriba' ? 40 : 216; x.moveTo(0, yp); x.lineTo(W, yp); x.stroke(); x.setLineDash([]);
  if (panel != null) for (const px of [0, W]) {   // paño central del frente (u = 0), con ribete y rombos
    x.fillStyle = hex(panel); x.fillRect(px - 34, 0, 68, 256); x.fillStyle = hex(c2); x.fillRect(px - 38, 0, 5, 256); x.fillRect(px + 33, 0, 5, 256);
    for (let i = 0; i < 5; i++) { const py = 60 + i * 44, cj = o.gemas?.[i % o.gemas.length]; if (cj != null) { x.fillStyle = tono(c2, 0.95); x.beginPath(); x.moveTo(px, py - 16); x.lineTo(px + 11, py); x.lineTo(px, py + 16); x.lineTo(px - 11, py); x.fill(); }
      x.fillStyle = cj != null ? hex(cj) : tono(c2, 0.9); x.beginPath(); x.moveTo(px, py - 12); x.lineTo(px + 8, py); x.lineTo(px, py + 12); x.lineTo(px - 8, py); x.fill(); if (cj != null) { x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.moveTo(px, py - 9); x.lineTo(px + 3, py - 3); x.lineTo(px - 3, py - 3); x.fill(); } } }
  tejer(x, W, 256, tipo);
  const t = aTextura(cv); t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
/** Torso pintado: banda central bordada (el frente cae en u = 0), cuello, costuras, joyas, botones o cordones. */
function texturaTorso(c, c2, joyas = [], tipo = 'lino', cierre = 'bordado', rombos = null, banda = null) {
  const [cv, x] = lienzo(256, 128);
  if (rombos != null) arlequin(x, 256, 128, c, rombos, 32);
  else { const g = x.createLinearGradient(0, 0, 0, 128); g.addColorStop(0, tono(c, 1.1)); g.addColorStop(1, tono(c, 0.76)); x.fillStyle = g; x.fillRect(0, 0, 256, 128); }
  if (cierre === 'escamas') { x.strokeStyle = 'rgba(0,0,0,.3)'; x.fillStyle = 'rgba(255,255,255,.1)'; for (let j = 0; j < 9; j++) for (let i = 0; i < 17; i++) { const px = i * 16 + (j % 2 ? 8 : 0), py = 10 + j * 12; x.beginPath(); x.arc(px, py, 8, 0, Math.PI); x.stroke(); x.beginPath(); x.arc(px - 2, py + 2, 3, 0, 7); x.fill(); } }
  if (cierre === 'filigrana') { x.strokeStyle = hex(c2); x.lineWidth = 1.6; x.globalAlpha = 0.8; for (let j = 0; j < 4; j++) for (let i = 0; i < 8; i++) { const px = 16 + i * 32 + (j % 2 ? 16 : 0), py = 20 + j * 26; x.beginPath(); for (let a = 0; a < 8; a += 0.4) x.lineTo(px + Math.cos(a + i) * a * 1.4, py + Math.sin(a + i) * a * 1.4); x.stroke(); } x.globalAlpha = 1; }
  x.fillStyle = hex(banda ?? c2); for (const px of [0, 236]) x.fillRect(px, 0, 20, 128);
  if (banda != null) { x.fillStyle = hex(c2); for (const px of [17, 236]) x.fillRect(px, 0, 3, 128); }
  x.fillStyle = tono(c2, 0.6); for (const px of [20, 233]) x.fillRect(px, 0, 3, 128);
  x.fillRect(0, 108, 256, 5); x.fillStyle = hex(c2); x.fillRect(0, 113, 256, 15); x.fillRect(0, 0, 256, 9);
  x.strokeStyle = tono(c2, 0.6); x.lineWidth = 2;
  if (cierre === 'cordones') { x.strokeStyle = tono(c, 0.45); for (let i = 0; i < 6; i++) for (const px of [0, 256]) { x.beginPath(); x.moveTo(px - 12, 18 + i * 15); x.lineTo(px + 12, 30 + i * 15); x.moveTo(px + 12, 18 + i * 15); x.lineTo(px - 12, 30 + i * 15); x.stroke(); } }
  else if (cierre === 'botones' || cierre === 'filigrana') { for (let i = 0; i < 5; i++) for (const px of [0, 256]) { x.fillStyle = tono(c2, 1.25); x.beginPath(); x.arc(px, 22 + i * 19, 4.5, 0, 7); x.fill(); x.fillStyle = tono(c2, 0.5); x.beginPath(); x.arc(px, 22 + i * 19, 1.6, 0, 7); x.fill(); } }
  else for (let i = 0; i < 9; i++) for (const px of [10, 246]) { x.beginPath(); x.moveTo(px - 6, 14 + i * 12); x.lineTo(px, 20 + i * 12); x.lineTo(px + 6, 14 + i * 12); x.stroke(); }
  x.strokeStyle = 'rgba(0,0,20,.28)'; x.setLineDash([3, 3]); x.lineWidth = 1; for (const px of [64, 128, 192]) { x.beginPath(); x.moveTo(px, 10); x.lineTo(px, 108); x.stroke(); } x.setLineDash([]);
  joyas.forEach((j, i) => { for (const px of [0, 256]) { x.fillStyle = hex(j); x.beginPath(); x.moveTo(px, 22 + i * 30); x.lineTo(px + 8, 32 + i * 30); x.lineTo(px, 42 + i * 30); x.lineTo(px - 8, 32 + i * 30); x.fill(); } });
  tejer(x, 256, 128, tipo);
  const t = aTextura(cv); t.wrapT = THREE.ClampToEdgeWrapping; return t;
}
/** Mechones: imagen en grises que tiñe el color del pelo (así el Metamorfo puede conservar su melena). */
let texPelo;
function texturaPelo() {
  if (texPelo) return texPelo; const [cv, x] = lienzo(128, 128); x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 150; i++) { x.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.25 + rnd() * 0.5})` : `rgba(40,40,60,${0.15 + rnd() * 0.35})`; x.lineWidth = 0.6 + rnd() * 1.6; let px = rnd() * 128; x.beginPath(); x.moveTo(px, 0); for (let y = 16; y <= 128; y += 16) { px += (rnd() - 0.5) * 5; x.lineTo(px, y); } x.stroke(); }
  return (texPelo = aTextura(cv, 2, 1));
}
/** Pelaje o plumas en grises (animales). */
function texturaPelaje(plumas = false) {
  const k = 'P' + plumas; if (cacheTex.has(k)) return cacheTex.get(k);
  const [cv, x] = lienzo(128, 128); x.fillStyle = '#e2e2e2'; x.fillRect(0, 0, 128, 128);
  if (plumas) { for (let j = 0; j < 9; j++) for (let i = 0; i < 9; i++) { const px = i * 16 + (j % 2 ? 8 : 0), py = j * 15; x.strokeStyle = 'rgba(40,20,10,.45)'; x.fillStyle = 'rgba(255,255,255,.35)'; x.beginPath(); x.ellipse(px, py, 8, 12, 0, 0, Math.PI); x.fill(); x.stroke(); x.beginPath(); x.moveTo(px, py); x.lineTo(px, py + 11); x.stroke(); } }
  else for (let i = 0; i < 700; i++) { const px = rnd() * 128, py = rnd() * 128, l = 3 + rnd() * 6; x.strokeStyle = rnd() < 0.5 ? `rgba(255,255,255,${0.3 + rnd() * 0.5})` : `rgba(60,50,40,${0.12 + rnd() * 0.25})`; x.lineWidth = 1; x.beginPath(); x.moveTo(px, py); x.lineTo(px + (rnd() - 0.5) * 3, py + l); x.stroke(); }
  const t = aTextura(cv, 3, 3); cacheTex.set(k, t); return t;
}
/** Cara pintada sobre la esfera de la cabeza (el frente cae en u = 0,25). `r` son los rasgos propios de cada
 *  personaje: cejas ('serias' | 'arqueadas' | 'una'), boca ('seria' | 'abierta' | 'risa' | 'picara' | 'labios' |
 *  'amplia'), ojoT (tamaño), entornados, pestanas, pecas, mofletes, sombra (color del párpado), ojeras, marca
 *  (joya en la frente), barbaSombra y labios (color). */
function texturaCara(piel, pelo, ojos, iris = 0x3a6a9a, r = {}) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
  x.fillStyle = hex(piel); x.fillRect(0, 0, 512, 256);
  const cx = 128, cy = 128, T = r.ojoT ?? 1, tinta = '#2a1c24'; x.lineCap = 'round'; x.lineJoin = 'round';
  const som = x.createRadialGradient(cx, cy + 6, 30, cx, cy + 6, 120); som.addColorStop(0, 'rgba(255,255,255,.07)'); som.addColorStop(1, 'rgba(90,40,30,.16)'); x.fillStyle = som; x.fillRect(0, 0, 256, 256);
  if (r.barbaSombra) { const g = x.createRadialGradient(cx, cy + 50, 8, cx, cy + 50, 62); g.addColorStop(0, 'rgba(60,40,40,.34)'); g.addColorStop(1, 'rgba(60,40,40,0)'); x.fillStyle = g; x.fillRect(cx - 70, cy + 14, 140, 100); }
  for (const s of [1, -1]) {
    const ex = cx + s * 30, mf = r.mofletes ? 1.55 : 1;
    x.fillStyle = `rgba(240,110,110,${r.mofletes ? 0.42 : 0.28})`; x.beginPath(); x.ellipse(cx + s * 44, cy + 26, 15 * mf, 9 * mf, 0, 0, 7); x.fill();
    if (r.sombra != null) { x.save(); x.globalAlpha = 0.5; x.fillStyle = hex(r.sombra); x.beginPath(); x.ellipse(ex, cy - 9, 16, 9, 0, 0, 7); x.fill(); x.restore(); }
    x.strokeStyle = tono(pelo, 0.7); x.lineWidth = r.cejas === 'serias' ? 6 : 4; x.beginPath();
    const una = r.cejas === 'una' ? (s > 0 ? 'arqueadas' : 'serias') : r.cejas;
    if (una === 'serias') { x.moveTo(ex - s * 15, cy - 17 * T); x.lineTo(ex + s * 15, cy - 27 * T); }
    else if (una === 'arqueadas') { x.moveTo(ex - 14, cy - 28 * T); x.quadraticCurveTo(ex, cy - 41 * T, ex + 14, cy - 28 * T); }
    else { x.moveTo(ex - 14, cy - 24); x.quadraticCurveTo(ex, cy - 31, ex + 14, cy - 24); }
    x.stroke();
    if (ojos === 'cerrados') { x.strokeStyle = tinta; x.lineWidth = 4; x.beginPath(); x.moveTo(ex - 13, cy - 4); x.quadraticCurveTo(ex, cy + 8, ex + 13, cy - 4); x.stroke();
      x.lineWidth = 2; for (const d of [-9, 0, 9]) { x.beginPath(); x.moveTo(ex + d, cy + (d ? 0 : 3)); x.lineTo(ex + d * 1.25, cy + (d ? 6 : 9)); x.stroke(); } }
    else { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ex, cy, 13 * T, 12 * T, 0, 0, 7); x.fill(); x.fillStyle = hex(iris); x.beginPath(); x.arc(ex, cy + 1, 9 * T, 0, 7); x.fill();
      x.fillStyle = '#14101a'; x.beginPath(); x.arc(ex, cy + 1, 4.5 * T, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(ex + 3, cy - 3 + (r.entornados ? 4 : 0), 2.6 * T, 0, 7); x.fill();
      x.strokeStyle = tinta; x.lineWidth = 3.5;
      if (r.entornados) { x.fillStyle = hex(piel); x.fillRect(ex - 16, cy - 15, 32, 11); x.beginPath(); x.moveTo(ex - 14, cy - 3); x.quadraticCurveTo(ex, cy - 7, ex + 14, cy - 3); x.stroke(); }
      else { x.beginPath(); x.moveTo(ex - 14 * T, cy - 5 * T); x.quadraticCurveTo(ex, cy - 16 * T, ex + 14 * T, cy - 5 * T); x.stroke(); }
      if (r.pestanas) { x.lineWidth = 2.4; for (const d of [0, 1]) { x.beginPath(); x.moveTo(ex + s * (12 + d * 2) * T, cy - (7 - d * 3) * T); x.lineTo(ex + s * (19 + d) * T, cy - (12 - d * 5) * T); x.stroke(); } } }
    if (r.ojeras) { x.strokeStyle = 'rgba(90,50,80,.4)'; x.lineWidth = 2.5; x.beginPath(); x.moveTo(ex - 11, cy + 15); x.quadraticCurveTo(ex, cy + 20, ex + 11, cy + 15); x.stroke(); }
    if (r.pecas) { x.fillStyle = 'rgba(150,80,50,.55)'; for (const [dx, dy] of [[36, 16], [44, 21], [52, 15], [40, 27], [49, 28], [8, 14]]) { x.beginPath(); x.arc(cx + s * dx, cy + dy, 1.7, 0, 7); x.fill(); } }
  }
  if (r.marca != null) { const my = cy - 44; x.fillStyle = hex(r.marca); x.beginPath(); x.moveTo(cx, my - 9); x.lineTo(cx + 6, my); x.lineTo(cx, my + 9); x.lineTo(cx - 6, my); x.fill(); x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(cx - 1.5, my - 3, 1.8, 0, 7); x.fill(); }
  const by = cy + 45, lab = r.labios != null ? hex(r.labios) : 'rgba(120,50,50,.8)';
  x.strokeStyle = 'rgba(120,50,50,.8)'; x.lineWidth = 3; x.beginPath();
  if (r.boca === 'seria') { x.moveTo(cx - 9, by + 1); x.quadraticCurveTo(cx, by - 2, cx + 9, by + 1); x.stroke(); }
  else if (r.boca === 'abierta') { x.fillStyle = '#6a2028'; x.ellipse(cx, by + 2, 7, 9, 0, 0, 7); x.fill(); x.fillStyle = '#e07a80'; x.beginPath(); x.ellipse(cx, by + 7, 4, 3, 0, 0, 7); x.fill(); }
  else if (r.boca === 'risa') { x.fillStyle = '#6a2028'; x.moveTo(cx - 15, by - 5); x.quadraticCurveTo(cx, by + 22, cx + 15, by - 5); x.closePath(); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.moveTo(cx - 12, by - 5); x.lineTo(cx + 12, by - 5); x.quadraticCurveTo(cx, by + 2, cx - 12, by - 5); x.fill(); x.beginPath(); x.moveTo(cx - 17, by - 7); x.lineTo(cx - 13, by - 3); x.moveTo(cx + 17, by - 7); x.lineTo(cx + 13, by - 3); x.stroke(); }
  else if (r.boca === 'picara') { x.moveTo(cx - 10, by + 1); x.quadraticCurveTo(cx + 3, by + 6, cx + 13, by - 6); x.stroke(); }
  else if (r.boca === 'amplia') { x.moveTo(cx - 14, by - 3); x.quadraticCurveTo(cx, by + 11, cx + 14, by - 3); x.stroke(); }
  else if (r.boca === 'labios') { x.fillStyle = lab; x.ellipse(cx, by, 8, 3.6, 0, 0, 7); x.fill(); x.strokeStyle = 'rgba(90,30,40,.7)'; x.lineWidth = 1.6; x.beginPath(); x.moveTo(cx - 9, by - 1); x.quadraticCurveTo(cx, by + 3, cx + 9, by - 1); x.stroke(); }
  else { x.moveTo(cx - 9, by - 1); x.quadraticCurveTo(cx, by + 5, cx + 9, by - 1); x.stroke(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function pieza(padre, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); padre.add(m); return m;
}
function pivote(padre, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); padre.add(g); return g; }
const perfil = pts => pts.map(q => new THREE.Vector2(q[0], q[1]));

/** Tela (capa, cinta) que ondea: plano con el borde superior fijo. */
function tela(padre, mat, ancho, largo, o = {}) {
  const geo = new THREE.PlaneGeometry(ancho, largo, o.sx ?? 5, o.sy ?? 8); geo.translate(0, -largo / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (ancho / 2), v = -p.getY(i) / largo;
    p.setZ(i, (o.curva ?? 0) * u * u * (1 - v * 0.5) - v * (o.caida ?? 0));
    if (o.abre) p.setX(i, p.getX(i) * (1 + v * o.abre));
  }
  const m = new THREE.Mesh(geo, mat); padre.add(m);
  m.userData.tela = { base: p.array.slice(), largo, amp: o.amp ?? 0.03, vel: o.vel ?? 2.2, fase: Math.random() * 6, empuje: o.empuje ?? 0.3 };
  return m;
}

// ------------------------------------------------------------------ humano
// Cuerpo articulado: hombro, codo y muñeca en cada brazo; cadera, rodilla y
// tobillo en cada pierna; cuello y cintura. personajes.js mueve cada pivote.
function humano(p) {
  const M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [] };
  const a = p.ancho ?? 1, piel = M(p.piel), tj = p.tejido ?? 'lino', fz = 0.68 * (0.6 + 0.4 * a) + (p.barriga ?? 0) * 0.3;
  const pano = (c, tipo = tj, o = {}) => M(c, { mapa: texturaLisa(c, tipo, o.rombos ?? null), ...o, rombos: undefined });
  const cadera = art.cadera = pivote(g, 0, 0.88, 0);
  const torso = art.torso = pivote(cadera, 0, 0.02, 0);
  const cBajo = p.piernas?.c ?? p.tunica?.c ?? p.torso.c;
  pieza(cadera, ESF, pano(cBajo), 0, 0, 0, 0.17 * a, 0.12, 0.125 * a);
  // Tronco con cintura, pecho y hombros (perfil de revolución).
  const mTorso = M(p.torso.c, { mapa: texturaTorso(p.torso.c, p.torso.c2 ?? p.torso.c, p.joyas, tj, p.cierre, p.rombos, p.torso.banda ?? null) });
  const tm = pieza(torso, new THREE.LatheGeometry(perfil(p.barriga ? [[0.17, 0.0], [0.19, 0.08], [0.196, 0.2], [0.2, 0.34], [0.204, 0.43], [0.17, 0.49], [0.075, 0.535]] : [[0.148, 0.0], [0.15, 0.07], [0.168, 0.2], [0.196, 0.34], [0.204, 0.43], [0.17, 0.49], [0.075, 0.535]]), 18), mTorso); tm.scale.set(a, 1, fz);
  if (p.cinturon) { const c = pieza(torso, new THREE.TorusGeometry((p.barriga ? 0.178 : 0.157) * a, 0.024, 6, 16), pano(p.cinturon, 'cuero'), 0, 0.04, 0); c.rotation.x = Math.PI / 2; c.scale.set(1, fz, 1);
    const zc = (p.barriga ? 0.178 : 0.157) * a * fz; pieza(torso, new THREE.BoxGeometry(0.06, 0.055, 0.02), M(0xe8c060, { emisivo: 0x6a4a10 }), 0, 0.04, zc + 0.012); pieza(torso, ESF_BAJA, M(p.joya ?? 0xf0c84a, { emisivo: p.joya ?? 0xf0c84a }), 0, 0.04, zc + 0.024, 0.018); }
  for (const [i, c] of (p.joyas ?? []).entries()) pieza(torso, new THREE.OctahedronGeometry(0.024, 0), M(c, { emisivo: c }), 0, 0.42 - i * 0.1, 0.2 * fz + 0.006 - i * 0.008);
  const cuello = pieza(torso, CIL(0.05, 0.058, 0.1, 10), piel, 0, 0.56, 0);
  if (!p.capucha) { const col = pieza(torso, new THREE.TorusGeometry(0.066, 0.02, 5, 12), pano(p.torso.c2 ?? p.torso.c), 0, 0.525, 0); col.rotation.x = Math.PI / 2; }

  // Cabeza
  const cabeza = art.cabeza = pivote(torso, 0, 0.6, 0);
  const pc = p.pelo?.c ?? 0x3a2a20, ca = p.caraAncha ?? 1;
  pieza(cabeza, ESF, p.ojos === 'ninguno' ? piel : M(p.piel, { mapa: texturaCara(p.piel, pc, p.ojos ?? 'abiertos', p.iris, p.rasgos), relieve: 0 }), 0, 0.12, 0, 0.145 * ca, 0.16, 0.15 * (1 + (ca - 1) * 0.5));
  if (p.papada) pieza(cabeza, ESF, piel, 0, 0.0, 0.035, 0.105, 0.05, 0.095);
  if (p.ojos !== 'ninguno') { pieza(cabeza, ESF_BAJA, piel, 0, 0.098, 0.148, 0.016, 0.02, 0.018); for (const s of [1, -1]) pieza(cabeza, ESF_BAJA, piel, s * 0.143, 0.115, 0.0, 0.016, 0.034, 0.024); }
  if (p.pelo) {
    const mp = M(p.pelo.c, { mapa: texturaPelo(), tinte: true, relieve: 2.2 }), L = p.pelo.largo ?? 0, v = p.pelo.volumen ?? 1; art.pelo.push(mp);
    const casco = pieza(cabeza, new THREE.SphereGeometry(1, 16, 9, 0, Math.PI * 2, 0, Math.PI * 0.56), mp, 0, 0.135, -0.012 - (v - 1) * 0.12, 0.158 * v, 0.168, 0.165 * v); casco.rotation.x = -0.35 - (v - 1) * 1.2;
    pieza(cabeza, ESF, mp, 0, 0.1, -0.06, 0.15 * v, 0.15, 0.12);
    if (L > 0) { pieza(cabeza, ESF, mp, 0, 0.02 - L * 0.22, -0.1, 0.15 * v, 0.14 + L * 0.3, 0.07);
      if (L > 0.1) for (const s of [1, -1]) { pieza(cabeza, ESF, mp, s * 0.13 * v, 0.03 - L * 0.12, -0.02, 0.045 * v, 0.1 + L * 0.2, 0.06); if (L > 0.5) pieza(cabeza, ESF, mp, s * 0.1 * v, -0.06 - L * 0.2, 0.05, 0.035, 0.08 + L * 0.14, 0.035); } }
    if (p.pelo.rizos) for (let i = 0; i < 12; i++) { const an = i / 12 * 6.28; pieza(cabeza, ESF_BAJA, mp, Math.cos(an) * 0.14, 0.16 + Math.sin(i * 2.3) * 0.05, Math.sin(an) * 0.13 - 0.02, 0.06); }
    if (p.pelo.despeinado) for (let i = 0; i < 9; i++) { const an = i / 9 * 6.28, m2 = pieza(cabeza, CONO(0.05, 0.13, 5), mp, Math.cos(an) * 0.075, 0.27 + (i % 2) * 0.012, Math.sin(an) * 0.075 - 0.01); m2.rotation.set(Math.sin(an) * 0.75, 0, -Math.cos(an) * 0.75); }
    if (p.pelo.tupe) { const t2 = pieza(cabeza, ESF, mp, 0.035, 0.255, 0.075, 0.115, 0.06, 0.085); t2.rotation.z = -0.35; pieza(cabeza, ESF, mp, -0.085, 0.225, 0.07, 0.06, 0.05, 0.07); }
    if (p.pelo.raya) for (const s of [1, -1]) { const m2 = pieza(cabeza, ESF, mp, s * 0.085, 0.2, 0.085, 0.075, 0.075, 0.06); m2.rotation.z = s * 0.6; }
    if (p.pelo.flequillo) { pieza(cabeza, ESF, mp, 0.02, 0.23, 0.09, 0.12, 0.05, 0.07); pieza(cabeza, ESF, mp, -0.06, 0.215, 0.105, 0.06, 0.04, 0.05); }
  }
  if (p.barba) { const mb = M(p.barba, { mapa: texturaPelo(), tinte: true, relieve: 2.2 }); pieza(cabeza, ESF, mb, 0, 0.012, 0.085, 0.085, 0.05, 0.065); for (const s of [1, -1]) pieza(cabeza, ESF, mb, s * 0.115, 0.06, 0.05, 0.03, 0.065, 0.05); }
  if (p.gafas) { for (const s of [1, -1]) { const t = pieza(cabeza, new THREE.TorusGeometry(0.036, 0.007, 4, 12), M(0x3a3030), s * 0.056, 0.115, 0.146); t.scale.z = 0.5; } pieza(cabeza, new THREE.BoxGeometry(0.04, 0.007, 0.007), M(0x3a3030), 0, 0.118, 0.15); }
  if (p.capucha) {
    const mc = pano(p.capucha, tj, { doble: true });
    const h = pieza(cabeza, new THREE.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.72), mc, 0, 0.13, -0.03, 0.19, 0.2, 0.2); h.rotation.x = -1.05;
    pieza(cabeza, CONO(0.1, 0.2, 9), mc, 0, 0.24, -0.19).rotation.x = -2.0;
    pieza(torso, ESF, pano(p.capucha), 0, 0.5, -0.02, 0.24 * a, 0.09, 0.16);
  }

  // Brazos: hombro → codo → muñeca → mano con pulgar y dedos.
  const brazo = lado => {
    const s = lado === 'I' ? 1 : -1, mg = p.mangas ?? {}, cManga = mg['c' + lado] ?? mg.c ?? p.torso.c, cm = pano(cManga, tj, { rombos: mg.rombos });
    const metal = p.brazoMecanico === lado, acero = M(0x8a909c), acero2 = M(0x5a606c), laton = M(0xc8a040, { emisivo: 0x4a3008 });
    const b = art['brazo' + lado] = pivote(torso, s * 0.218 * a, 0.45, 0);
    pieza(b, ESF, metal ? acero2 : cm, 0, 0, 0, 0.066);                                    // hombro
    if (p.hombreras) { pieza(b, ESF, pano(p.hombreras, 'cuero'), s * 0.02, 0.035, 0, 0.105, 0.075, 0.105); const r = pieza(b, new THREE.TorusGeometry(0.1, 0.012, 4, 14), laton, s * 0.02, 0.012, 0); r.rotation.x = Math.PI / 2; }
    if (mg.abombadas) pieza(b, ESF, cm, 0, -0.12, 0, 0.085, 0.15, 0.085); else pieza(b, CIL(0.057, 0.048, 0.25), metal ? acero : cm, 0, -0.14, 0);
    const c = art['codo' + lado] = pivote(b, 0, -0.28, 0);
    pieza(c, ESF, metal ? acero2 : cm, 0, 0, 0, 0.05);                                      // codo
    if (metal) { pieza(c, CIL(0.045, 0.038, 0.24, 8), acero, 0, -0.13, 0); for (const y of [-0.05, -0.13, -0.21]) { const r = pieza(c, new THREE.TorusGeometry(0.043, 0.008, 4, 10), laton, 0, y, 0); r.rotation.x = Math.PI / 2; } const eje = pieza(c, CIL(0.016, 0.016, 0.115, 6), laton); eje.rotation.z = Math.PI / 2; }
    else if (mg.anchas) pieza(c, CIL(0.05, 0.115, 0.27, 14, true), M(cManga, { mapa: texturaLisa(cManga, tj), doble: true }), 0, -0.135, 0);
    else pieza(c, CIL(0.046, 0.038, 0.25), mg.desnudo ? piel : cm, 0, -0.13, 0);
    if (!metal && mg.brazal != null) { pieza(c, CIL(0.053, 0.046, 0.17, 10), pano(mg.brazal, 'cuero'), 0, -0.16, 0); for (const y of [-0.09, -0.23]) { const r2 = pieza(c, new THREE.TorusGeometry(0.052, 0.008, 4, 10), laton, 0, y, 0); r2.rotation.x = Math.PI / 2; } }
    if (mg.anchas) pieza(c, CIL(0.03, 0.028, 0.24, 8), mg.desnudo ? piel : M(p.manos ?? p.piel), 0, -0.14, 0);
    if (!metal && !p.sinPunos) { const pu = pieza(c, new THREE.TorusGeometry(mg.anchas ? 0.113 : 0.043, mg.anchas ? 0.007 : 0.013, 5, 16), M(p.tunica?.c2 ?? p.torso.c2 ?? 0xc8a040), 0, mg.anchas ? -0.265 : -0.245, 0); pu.rotation.x = Math.PI / 2; }
    const mu = art['muneca' + lado] = pivote(c, 0, -0.27, 0);                               // muñeca
    const cMano = metal ? M(0x7a808c) : M(p.manos ?? p.piel);
    pieza(mu, ESF_BAJA, cMano, 0, 0, 0, 0.03);
    art['mano' + lado] = pieza(mu, ESF, cMano, 0, -0.045, 0, 0.022, 0.045, 0.04);           // palma
    const dedos = pivote(mu, 0, -0.085, 0); dedos.rotation.x = -0.35; art['dedos' + lado] = dedos;
    for (let i = 0; i < 4; i++) pieza(dedos, ESF_BAJA, cMano, 0, -0.026, -0.027 + i * 0.018, 0.011, 0.032, 0.0095);
    const pul = pieza(mu, ESF_BAJA, cMano, s * -0.012, -0.045, 0.042, 0.012, 0.028, 0.012); pul.rotation.x = 0.7;
  };
  brazo('I'); brazo('D');

  // Piernas: cadera → rodilla → tobillo → pie. Bajo una túnica larga solo asoman los pies.
  const larga = (p.tunica?.largo ?? 0) >= 0.9;
  for (const lado of p.sinPiernas ? [] : ['I', 'D']) {
    const s = lado === 'I' ? 1 : -1, pr = p.piernas ?? {};
    const pi = art['pierna' + lado] = pivote(cadera, s * 0.09 * a, -0.02, 0);
    const ro = art['rodilla' + lado] = pivote(pi, 0, -0.42, 0);
    const cBota = pr.botas ?? p.tunica?.c2 ?? 0x4a3828, bota = p.descalzo ? piel : pano(cBota, 'cuero');
    if (!larga) {
      const cp = pano(pr['c' + lado] ?? pr.c ?? 0x3a3030, pr.rombos != null ? tj : 'sarga', { rombos: pr.rombos });
      pieza(pi, CIL(0.08, 0.062, 0.42), cp, 0, -0.21, 0); pieza(ro, ESF, cp, 0, 0, 0, 0.063);            // muslo y rodilla
      pieza(ro, ESF_BAJA, cp, 0, -0.005, 0.03, 0.045, 0.05, 0.04);                                       // rótula
      pieza(ro, CIL(0.056, 0.047, 0.2), cp, 0, -0.1, 0);
      pieza(ro, CIL(0.056, 0.05, 0.2), p.descalzo ? cp : pr.vendas ? pano(pr.vendas, 'lana') : bota, 0, -0.27, 0);   // caña de la bota (o vendas)
      if (!p.descalzo) { const vu = pieza(ro, new THREE.TorusGeometry(0.058, 0.014, 5, 12), bota, 0, -0.175, 0); vu.rotation.x = Math.PI / 2; }
      if (p.armadura) { pieza(ro, ESF, pano(p.armadura, 'cuero'), 0, -0.02, 0.035, 0.055, 0.075, 0.04); pieza(pi, CIL(0.086, 0.07, 0.2, 10), pano(p.armadura, 'cuero'), 0, -0.14, 0.006); }
    }
    const to = art['tobillo' + lado] = pivote(ro, 0, -0.37, 0);
    pieza(to, ESF_BAJA, bota, 0, 0, 0, 0.05);
    pieza(to, ESF, bota, 0, -0.03, 0.05, 0.06, 0.048, 0.115); if (!p.descalzo) pieza(to, new THREE.BoxGeometry(0.105, 0.02, 0.2), M(tono(cBota, 0.55)), 0, -0.07, 0.045);
  }
  if (p.tunica) {
    const t = p.tunica, L = t.largo * 0.84, vu = t.vuelo ?? 0.34;
    const pts = perfil([[0.15 * a, 0.1], [0.19 * a, -0.03], [(0.2 * a + vu) / 2 - 0.01, -L * 0.5], [vu * 0.94, -L * 0.86], [vu, -L]]);
    const ab = t.abierta ?? 0, f = art.falda = pivote(cadera, 0, 0, 0), geo = new THREE.LatheGeometry(pts, 28, ab, Math.PI * 2 - ab * 2), q = geo.attributes.position;
    for (let i = 0; i < q.count; i++) { const y = q.getY(i), k = Math.max(0, -y / L), an = Math.atan2(q.getX(i), q.getZ(i)), o = 1 + Math.sin(an * 9) * 0.045 * k; q.setX(i, q.getX(i) * o); q.setZ(i, q.getZ(i) * o); if (t.jirones && k > 0.99) q.setY(i, y - (Math.sin(an * 7) * 0.5 + Math.sin(an * 13 + 1) * 0.5 + 0.6) * t.jirones); }   // pliegues que se abren hacia el bajo
    geo.computeVertexNormals();
    const fm = pieza(f, geo, M(t.c, { doble: true, mapa: texturaTela(t.c, t.c2 ?? tono(t.c, 0.7), 'arriba', p.motivo, tj, t.rombos, t.panel ? (t.panelC ?? t.c2) : null, 512, { rayas: t.rayas, gemas: t.gemas, cMotivo: t.cMotivo }) })); fm.scale.z = p.barriga ? 0.86 + p.barriga * 0.3 : 0.86;
  }
  if (p.capa) {
    const c = p.capa, m = tela(torso, M(c.c, { doble: true, mapa: texturaTela(c.c, c.c2 ?? p.tunica?.c2 ?? 0xc8a040, 'abajo', p.motivoCapa ?? p.motivo, p.tejidoCapa ?? 'terciopelo') }), (c.ancho ?? 0.52) * a, c.largo * 1.25, { curva: 0.13, caida: 0.1, abre: c.abre ?? 0.35, amp: 0.035 });
    m.position.set(0, 0.5, -0.125); art.telas.push(m);
    if (c.jirones) { const b = m.userData.tela.base, q = m.geometry.attributes.position, L2 = c.largo * 1.25; for (let i = 0; i < q.count; i++) if (-b[i * 3 + 1] / L2 > 0.99) { b[i * 3 + 1] += (i % 2 ? 0 : c.jirones); q.setY(i, b[i * 3 + 1]); } }
    for (const s of [1, -1]) pieza(torso, ESF_BAJA, M(0xe8c060, { emisivo: 0x6a4a10 }), s * 0.13 * a, 0.5, 0.09, 0.024);   // broches
  }
  if (p.cuelloAlto) { const ca2 = p.cuelloAlto, mc = M(ca2.c, { doble: true, mapa: texturaLisa(ca2.c, p.tejidoCapa ?? 'terciopelo') });   // cuello alto y abierto por delante
    pieza(torso, new THREE.CylinderGeometry(0.155, 0.095, 0.15, 14, 1, true, 0.85, Math.PI * 2 - 1.7), mc, 0, 0.585, -0.02);
    const rb = pieza(torso, new THREE.TorusGeometry(0.155, 0.009, 5, 18, Math.PI * 2 - 1.7), M(ca2.c2 ?? 0xe0aa48, { emisivo: 0x6a4a10 }), 0, 0.66, -0.02); rb.rotation.set(Math.PI / 2, 0, Math.PI / 2 + 0.85); }
  if (p.capelina) { const cp = p.capelina, L = cp.largo ?? 0.3;   // esclavina sobre los hombros
    const geo = new THREE.LatheGeometry(perfil([[0.07, 0.565], [0.17 * a, 0.52], [0.285 * a, 0.48 - L * 0.25], [(0.3 + L * 0.25) * a, 0.5 - L]]), 20), q = geo.attributes.position;
    for (let i = 0; i < q.count; i++) { const k = Math.max(0, (0.5 - q.getY(i)) / L), an = Math.atan2(q.getX(i), q.getZ(i)), o2 = 1 + Math.sin(an * 8) * 0.05 * k; q.setX(i, q.getX(i) * o2); q.setZ(i, q.getZ(i) * o2); if (cp.picos && k > 0.99) q.setY(i, q.getY(i) - Math.abs(Math.sin(an)) * cp.picos); }
    geo.computeVertexNormals(); const cm = pieza(torso, geo, M(cp.c, { doble: true, mapa: texturaTela(cp.c, cp.c2 ?? 0xc8a040, 'arriba', cp.motivo ?? null, p.tejidoCapa ?? tj) })); cm.scale.z = 0.74;
    if (cp.broche != null) pieza(torso, new THREE.OctahedronGeometry(0.032, 0), M(cp.broche, { emisivo: cp.broche }), 0, 0.5, 0.13 * a); }
  if (p.cogulla) pieza(torso, ESF, pano(p.cogulla, p.tejidoCapa ?? tj), 0, 0.5, -0.07, 0.2 * a, 0.085, 0.15);   // capucha recogida a la espalda
  if (p.bolsas) for (const s of [1, -1]) { pieza(torso, new THREE.BoxGeometry(0.085, 0.1, 0.05), pano(p.bolsas, 'cuero'), s * 0.13 * a, -0.03, 0.1 * fz + 0.03); pieza(torso, new THREE.BoxGeometry(0.09, 0.035, 0.055), pano(p.bolsas, 'cuero'), s * 0.13 * a, 0.01, 0.1 * fz + 0.032); }
  if (p.armadura) { const pe = pieza(torso, ESF, pano(p.armadura, 'cuero'), 0, 0.33, 0.03, 0.19 * a, 0.16, 0.13); pieza(torso, new THREE.OctahedronGeometry(0.035, 0), M(0xe0aa48, { emisivo: 0x6a4a10 }), 0, 0.36, 0.165); }
  g.scale.setScalar((p.alto ?? 1.7) / 1.72);
  return { raiz: g, art, tipo: 'humano', M, alto: p.alto ?? 1.7 };
}

/** Objeto que flota y gira junto a una mano o sobre la cabeza. */
function flotante(m, obj, ancla, o = {}) { m.art.flotantes.push({ obj, ancla, radio: o.radio ?? 0, y: o.y ?? 0.12, vel: o.vel ?? 1, fase: o.fase ?? 0, sube: o.sube ?? 0.02 }); return obj; }
function orbe(m, color, r = 0.05) { const o = new THREE.Mesh(ESF_BAJA, m.M(color, { emisivo: color })); o.scale.setScalar(r); m.raiz.add(o); o.userData.color = color; return o; }

const HUMANOS = {
  'Aprendiz': { tejido: 'lino', motivo: 'puntadas', cierre: 'botones', alto: 1.56, ancho: 0.96, piel: 0xf2c9a8, iris: 0x7a5ab0, rasgos: { boca: 'abierta', cejas: 'arqueadas', pecas: true, ojoT: 1.16 },
    pelo: { c: 0x8a5ab8, largo: 0.15, flequillo: true, volumen: 1.08 }, gafas: true, torso: { c: 0xf0dca8, c2: 0x3f8f6a }, cinturon: 0x7a5230, joya: 0x3fb890, joyas: [0x3fb890], bolsas: 0x8a5a30,
    mangas: { c: 0xf0dca8 }, tunica: { c: 0xe8cf98, c2: 0x3f8f6a, largo: 0.36, vuelo: 0.27 }, piernas: { c: 0x6b4a2a, botas: 0x8a5a30, vendas: 0xf4e8c8 }, capa: { c: 0xe8843a, c2: 0xf8c070, largo: 0.5 }, motivoCapa: 'espirales', tejidoCapa: 'lana', cogulla: 0xe8843a },
  'Centinela': { tejido: 'cuero', cierre: 'escamas', alto: 1.76, ancho: 1.04, piel: 0xa8693f, iris: 0x4a2a14, rasgos: { cejas: 'serias', boca: 'seria', pestanas: true, entornados: true },
    pelo: { c: 0x5a3520, largo: 0.3, raya: true }, torso: { c: 0xb8322a, c2: 0xd8a040 }, hombreras: 0xc8442f, cinturon: 0x7a5230, joya: 0xd8a040, armadura: 0xc23a2e,
    mangas: { c: 0x3a2a2a, brazal: 0xb8322a }, tunica: { c: 0xe8d4a0, c2: 0x2f8f7a, largo: 0.42, vuelo: 0.25 }, piernas: { c: 0x3a2a24, botas: 0xb8322a }, capa: { c: 0xa82820, c2: 0xd8a040, largo: 0.92 } },
  'Clarividente': { tejido: 'seda', motivo: 'estrellas', alto: 1.7, ancho: 0.94, piel: 0xf0cfb0, rasgos: { boca: 'labios', labios: 0xc8607a, sombra: 0x2fa89c }, pelo: { c: 0x1c1c2c, largo: 0.8 }, ojos: 'cerrados', capucha: 0x1f8a80, torso: { c: 0xe8d49a, c2: 0x1f8a80 }, cinturon: 0xc8a040, joya: 0x5fe8ff, joyas: [0x5fe8ff],
    mangas: { c: 0x23988c, anchas: true }, tunica: { c: 0xf0dca0, c2: 0xc8a040, largo: 1, vuelo: 0.42, panel: true, panelC: 0x1f8a80, gemas: [0x5fe8ff, 0xf0c84a] }, capa: { c: 0x1f8a80, largo: 1, ancho: 0.6 } },
  'Cronista': { tejido: 'terciopelo', motivo: 'hojas', alto: 1.55, ancho: 1.52, barriga: 0.55, caraAncha: 1.13, papada: true, piel: 0xf6ccb0, iris: 0x4a8a5a, rasgos: { boca: 'amplia', mofletes: true, cejas: 'arqueadas', ojoT: 0.9, pestanas: true },
    pelo: { c: 0xd8401c, largo: 0.3, rizos: true, volumen: 1.2 }, torso: { c: 0x2f8f7a, c2: 0xf0c84a, banda: 0x7a4aa0 }, cinturon: 0xc8a040, joya: 0x3fd8e0, joyas: [0x3fd8e0, 0xe04a4a],
    mangas: { c: 0x2f8f7a, anchas: true }, tunica: { c: 0x2f8f7a, c2: 0xf0c84a, largo: 1, vuelo: 0.56, panel: true, panelC: 0xf4e0a8, gemas: [0xe04a4a, 0x3fd8e0], cMotivo: 0x8fd8b8 }, capa: { c: 0x8a5ab0, c2: 0xf0c84a, largo: 0.95, ancho: 0.6 }, },
  'Cronomante': { tejido: 'lino', motivo: 'relojes', cierre: 'botones', iris: 0x3a7ab0, alto: 1.8, ancho: 1.06, piel: 0xd8a888, rasgos: { cejas: 'serias', boca: 'seria', ojeras: true, barbaSombra: true, ojoT: 0.92 },
    pelo: { c: 0x3a2418, largo: 0.02, despeinado: true, volumen: 1.04 }, barba: 0x3a2418, torso: { c: 0xd8ccb0, c2: 0x8a7a58, banda: 0x4a3a66 }, cinturon: 0x6a4428, joya: 0xe04a6a, joyas: [0xe04a6a],
    mangas: { c: 0xd8ccb0, brazal: 0x6a4428 }, brazoMecanico: 'D', tunica: { c: 0xd8ccb0, c2: 0x8a7a58, largo: 0.82, vuelo: 0.31, abierta: 0.5, jirones: 0.07 }, piernas: { c: 0x3a2e28, botas: 0x6a4428 },
    capa: { c: 0x6a4aa0, c2: 0xc8a040, largo: 0.98, ancho: 0.6 }, cuelloAlto: { c: 0x6a4aa0, c2: 0xc8a040 } },
  'Entusiasta': { tejido: 'seda', rombos: 0x3a6ad8, alto: 1.52, ancho: 0.92, piel: 0xf4c8a0, iris: 0x4a6ab8, rasgos: { boca: 'risa', cejas: 'arqueadas', pecas: true, ojoT: 1.1 }, pelo: { c: 0xc85a2a, largo: 0 }, torso: { c: 0xe8408a, c2: 0xf0c84a }, cinturon: 0x3a8ae0,
    mangas: { cI: 0x3a6ad8, cD: 0xe8408a, rombos: 0xf070a8 }, manos: 0x8a3ab8, piernas: { cI: 0x7a3ab8, cD: 0xe8408a, botas: 0xe8408a, rombos: 0xb040a0 }, tunica: { c: 0xe8408a, c2: 0x3a8ae0, largo: 0.2, vuelo: 0.24 } },
  'Estratega': { tejido: 'seda', motivo: 'flores', alto: 1.66, ancho: 0.95, piel: 0xf8d8c0, rasgos: { boca: 'labios', labios: 0xe07a70, mofletes: true }, pelo: { c: 0xf08a4a, largo: 1, volumen: 1.14, raya: true }, ojos: 'cerrados', torso: { c: 0xf8b078, c2: 0xf8e0b8 }, cinturon: 0xe07a3a, joya: 0x3fb870, joyas: [0x3fb870],
    mangas: { c: 0xf8c090, abombadas: true }, tunica: { c: 0xf09a5a, c2: 0xf8d0a0, largo: 1, vuelo: 0.48, panel: true, panelC: 0xf8e4c0, gemas: [0x3fb870, 0xe04a6a, 0x5ab8e8] } },
  'Maestro': { tejido: 'sarga', motivo: 'espirales', cierre: 'filigrana', alto: 1.78, ancho: 1.02, piel: 0xf0c8a0, iris: 0x3a8ac8, rasgos: { entornados: true, boca: 'picara', cejas: 'serias' },
    pelo: { c: 0xf0d060, largo: 0.02, tupe: true }, torso: { c: 0xf4e6b8, c2: 0xd8a83a }, cinturon: 0xc89a3a, joya: 0xe04a4a, joyas: [0x3fd8b0, 0xe04a4a, 0x3fd8b0], bolsas: 0x9a6a38,
    mangas: { c: 0xf4e6b8, brazal: 0xd8a83a }, tunica: { c: 0xf4e6b8, c2: 0xd8a83a, largo: 0.56, vuelo: 0.29, abierta: 0.42, cMotivo: 0xd8a83a }, piernas: { c: 0x3a3a24, botas: 0xf0e0b0 },
    capa: { c: 0xb03a28, c2: 0xe0aa48, largo: 1.04, ancho: 0.7, abre: 0.6 }, motivoCapa: 'espirales', cuelloAlto: { c: 0xb03a28, c2: 0xe0aa48 } },
  'Metamorfo': { tejido: 'seda', motivo: 'espirales', alto: 1.72, ancho: 0.88, piel: 0xfbe4dc, rasgos: { boca: 'labios', labios: 0xe890b0, sombra: 0xf0a0d0, marca: 0x5ad8e8 }, pelo: { c: 0xf0b8d8, largo: 1 }, ojos: 'cerrados', torso: { c: 0x8ac8ec, c2: 0xf8e4c0, banda: 0xf4b0c8 }, cinturon: 0xb07a50, joya: 0xe04a6a, joyas: [0x5ad8e8],
    mangas: { c: 0xf4b0c8, anchas: true }, tunica: { c: 0xf4b0c8, c2: 0xf8e4c0, largo: 1, vuelo: 0.46, panel: true, panelC: 0xf8e4c0, rayas: [0xf4b0c8, 0x8ac8ec, 0xf8e4c0, 0x8ac8ec], gemas: [0x5ad8e8, 0xe04a6a] },
    capelina: { c: 0xf4a8c4, c2: 0xf8e4c0, largo: 0.3, picos: 0.1, broche: 0x5ad8e8 } },
  'Ocultista': { tejido: 'terciopelo', motivo: 'lunas', sinPiernas: true, sinPunos: true, alto: 1.72, piel: 0x07070f, ojos: 'ninguno', capucha: 0x2a4ab0, torso: { c: 0x2f55c0, c2: 0x8ad0f0 }, cinturon: 0x1a2a6a, joya: 0x4a9cff, joyas: [0x4a9cff, 0xe04a6a], manos: 0x1a2a6a,
    mangas: { c: 0x2f55c0, anchas: true }, tunica: { c: 0x2848a8, c2: 0x8ad0f0, largo: 1, vuelo: 0.4, panel: true, jirones: 0.16, gemas: [0x4a9cff, 0xe04a6a] }, capa: { c: 0x2a4ab0, c2: 0x8ad0f0, largo: 0.55, ancho: 0.6 } },
  'Pícaro': { tejido: 'sarga', cierre: 'cordones', descalzo: true, alto: 1.68, ancho: 0.94, piel: 0xf0c8a0, iris: 0x4a8ab8, rasgos: { cejas: 'una', boca: 'picara', barbaSombra: true }, pelo: { c: 0xe0c070, largo: 0.05, flequillo: true }, torso: { c: 0x2a5a9a, c2: 0xc8a040 }, cinturon: 0x5a4028, cogulla: 0x2a5a9a,
    mangas: { c: 0x2a5a9a, brazal: 0x5a4028 }, tunica: { c: 0x2a5a9a, c2: 0xc8a040, largo: 0.3, vuelo: 0.25 }, piernas: { c: 0x202028, botas: 0xf0c8a0 }, capa: { c: 0x3a4a44, c2: 0x2a3a34, largo: 0.5, ancho: 0.4, jirones: 0.12 }, tejidoCapa: 'lana', motivoCapa: null },
};

const EXTRAS = {
  'Aprendiz'(m) { // hojas de pergamino revoloteando
    for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.15), m.M(0xfff3d6, { doble: true })); m.raiz.add(h); flotante(m, h, 'torso', { radio: 0.5 + (i % 3) * 0.12, y: -0.5 + i * 0.22, vel: 0.9 + i * 0.13, fase: i * 1.1, sube: 0.08 }); h.userData.gira = 1 + i * 0.3; }
  },
  'Centinela'(m) { // lanza en la mano derecha y escudo en el antebrazo izquierdo
    const l = art => { const g = new THREE.Group(); pieza(g, CIL(0.016, 0.016, 2.0, 6), m.M(0x7a5230)); pieza(g, CONO(0.045, 0.24, 4), m.M(0xd8dce8), 0, 1.12, 0); pieza(g, CIL(0.03, 0.03, 0.05, 6), m.M(0xd8a040), 0, 0.98, 0); return g; };
    const lanza = m.art.lanza = l(); lanza.position.set(0, 0.25, 0.02); lanza.rotation.x = Math.PI / 2 - 0.12; m.art.codoD.add(lanza); lanza.position.y = -0.3;
    const e = m.art.escudo = new THREE.Group(); const disco = pieza(e, CIL(0.2, 0.2, 0.035, 6), m.M(0xb8322a)); disco.rotation.x = Math.PI / 2; const b = pieza(e, CIL(0.09, 0.11, 0.05, 6), m.M(0xd8a040)); b.rotation.x = Math.PI / 2; b.position.z = 0.012;
    e.position.set(0.06, -0.16, 0.02); e.rotation.y = Math.PI / 2; m.art.codoI.add(e);
  },
  'Clarividente'(m) { flotante(m, orbe(m, 0x5fe8ff, 0.085), 'manoD', { y: 0.15 });
    // las grandes volutas turquesa que la envuelven en su ilustración
    for (let i = 0; i < 6; i++) { const an = -Math.PI / 2 + (i / 5 - 0.5) * 3.2, t = tela(m.art.torso, m.M(i % 2 ? 0x3fe0d8 : 0x1fa8c0, { luz: true, alfa: 0.42, doble: true }), 0.22, 1.25 + (i % 3) * 0.2, { sx: 1, sy: 8, amp: 0.16, vel: 1.5, abre: -0.6, empuje: 0.5 });
      t.position.set(Math.cos(an) * 0.3, 0.75, Math.sin(an) * 0.22 - 0.05); t.rotation.set(0, -an + Math.PI / 2, 0); t.rotation.z = 0; t.rotateX(-0.55 - (i % 2) * 0.25); t.renderOrder = 6; m.art.telas.push(t); }
    const r = pieza(m.art.cabeza, new THREE.TorusGeometry(0.165, 0.012, 5, 16, Math.PI * 1.3), m.M(0xc8a040), 0, 0.15, 0.085); r.rotation.z = -Math.PI * 0.15; },
  'Cronomante'(m) { // volutas azules del tiempo en las manos y colgante
    for (const l of ['I', 'D']) { const t = tela(m.art['codo' + l], m.M(l === 'I' ? 0x58d8ff : 0xb9a0ff, { luz: true, alfa: 0.5, doble: true }), 0.12, 0.75, { sx: 1, sy: 6, amp: 0.1, vel: 2.4, abre: -0.7, empuje: 0 }); t.position.set(0, -0.32, 0); t.rotation.z = Math.PI; m.art.telas.push(t); }
    pieza(m.art.torso, new THREE.OctahedronGeometry(0.04, 0), m.M(0x58d8ff, { emisivo: 0x58d8ff }), 0, 0.33, 0.15); },
  'Cronista'(m) { // libro abierto en la mano izquierda; llama en la derecha
    const l = new THREE.Group(); for (const s of [1, -1]) { const t = pieza(l, new THREE.BoxGeometry(0.15, 0.02, 0.2), m.M(0x7a4a2a), s * 0.075, 0, 0); t.rotation.z = s * 0.25; const h = pieza(l, new THREE.BoxGeometry(0.135, 0.02, 0.18), m.M(0xfff3d6), s * 0.072, 0.014, 0); h.rotation.z = s * 0.25; }
    l.position.set(0, -0.33, 0.06); l.rotation.x = Math.PI / 2 - 0.3; m.art.codoI.add(l); m.art.libro = l;
    flotante(m, orbe(m, 0x6ff0d0, 0.06), 'manoD', { y: 0.14 });
  },
  'Entusiasta'(m) { // gorro de bufón con cascabeles, gola y pelota
    const c = m.art.cabeza, cols = [0xe8408a, 0x7a3ab8, 0x3a6ad8];
    [-1, 0, 1].forEach((s, i) => { const p = pivote(c, s * 0.09, 0.24, -0.02); p.rotation.z = -s * 0.95; p.rotation.x = s === 0 ? -0.5 : 0; pieza(p, CONO(0.085, 0.3, 6), m.M(cols[i]), 0, 0.12, 0); pieza(p, ESF_BAJA, m.M(0xf0c84a, { emisivo: 0xf0c84a }), 0, 0.28, 0, 0.03); });
    for (let i = 0; i < 7; i++) { const an = i / 7 * 6.28; const p = pieza(m.art.torso, CONO(0.06, 0.16, 4), m.M(i % 2 ? 0xf0c84a : 0xe8408a), Math.cos(an) * 0.15, 0.5, Math.sin(an) * 0.11); p.rotation.set(Math.sin(an) * 1.9, 0, -Math.cos(an) * 1.9); }
    flotante(m, orbe(m, 0x5ab8ff, 0.07), 'manoI', { y: 0.2, sube: 0.06 });
  },
  'Estratega'(m) { // arco de esferas de colores sobre la cabeza (malabares)
    const cols = [0x5fd0a0, 0xe8a040, 0xe04a6a, 0x5ab8e8, 0xf0e070, 0xb07ae8, 0xf08a4a];
    cols.forEach((c, i) => flotante(m, orbe(m, c, 0.04), 'arco', { fase: i / (cols.length - 1), vel: 0.35 }));
  },
  'Maestro'(m) { [0xe04a4a, 0x5ab8e8, 0x5fd0a0, 0xb07ae8, 0xf0c84a].forEach((c, i) => flotante(m, orbe(m, c, 0.045), i % 2 ? 'manoI' : 'manoD', { radio: 0.16, y: 0.16 + (i % 3) * 0.07, vel: 1.4 + i * 0.2, fase: i * 1.3 })); },
  'Metamorfo'(m) { // volutas rosas y lilas que le suben de las manos, como en su carta
    for (const l of ['I', 'D']) { const t = tela(m.art['codo' + l], m.M(l === 'I' ? 0xf7a8d8 : 0xc8a0f0, { luz: true, alfa: 0.5, doble: true }), 0.13, 0.8, { sx: 1, sy: 6, amp: 0.11, vel: 2.0, abre: -0.7, empuje: 0 }); t.position.set(0, -0.32, 0); t.rotation.z = Math.PI; m.art.telas.push(t); } },
  'Ocultista'(m) { flotante(m, orbe(m, 0x6ab8ff, 0.07), 'manos', { y: 0.1 }); pieza(m.art.torso, ESF, m.M(0x2a4ab0), 0, 0.47, 0, 0.27, 0.1, 0.17); },
  'Pícaro'(m) { flotante(m, orbe(m, 0xbfe6ff, 0.06), 'manoD', { y: 0.16 }); },
};

// ---------------------------------------------------------------- animales
function cuadrupedo(p) {
  const M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [], patas: [] };
  const F = col => M(col, { mapa: texturaPelaje(), tinte: true, relieve: 2.4 }), c = F(p.c), L = p.largo, alt = p.altura; art.rodillas = [];
  const cuerpo = art.torso = pivote(g, 0, alt, 0);
  pieza(cuerpo, ESF, c, 0, 0, 0, p.grosor, p.grosor * 0.95, L / 2);
  if (p.panza) pieza(cuerpo, ESF, F(p.panza), 0, -0.03, 0.02, p.grosor * 0.9, p.grosor * 0.85, L / 2 * 0.9);
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([s, f]) => {
    const pa = pivote(cuerpo, s * p.grosor * 0.55, -p.grosor * 0.4, f * L * 0.34);
    const lp = alt - p.grosor * 0.4;
    const cP = F(p.cPata ?? p.c); pieza(pa, ESF_BAJA, cP, 0, 0, 0, p.pata * 1.9, p.pata * 2.2, p.pata * 2.2);
    pieza(pa, CIL(p.pata * 1.5, p.pata * 1.05, lp * 0.5, 8), cP, 0, -lp * 0.25, 0);
    const ro = pivote(pa, 0, -lp * 0.5, 0); pieza(ro, ESF_BAJA, cP, 0, 0, 0, p.pata * 1.15);
    pieza(ro, CIL(p.pata * 1.0, p.pata * 0.8, lp * 0.47, 8), cP, 0, -lp * 0.235, 0); pieza(ro, ESF_BAJA, M(p.pezuna), 0, -lp * 0.5 + 0.025, 0.012, p.pata * 1.35, 0.03, p.pata * 1.6);
    art.rodillas.push(ro);
    art.patas.push(pa);
  });
  for (const [x, y, z, r] of p.manchas ?? []) pieza(cuerpo, ESF, F(p.cMancha), x, y, z, r, r * 0.8, r * 1.2);
  const cuello = art.cuello = pivote(cuerpo, 0, p.grosor * 0.5, L * 0.38); cuello.rotation.x = p.cuelloInc;
  pieza(cuello, CIL(p.grosor * 0.5, p.grosor * 0.68, p.cuello, 10), c, 0, p.cuello / 2, 0);
  const cab = art.cabeza = pivote(cuello, 0, p.cuello + p.cabeza * 0.5, 0); cab.rotation.x = -p.cuelloInc;
  pieza(cab, ESF, F(p.cCabeza ?? p.c), 0, 0, 0, p.cabeza, p.cabeza * 0.95, p.cabeza * 1.05);
  pieza(cab, ESF, F(p.cHocico ?? p.c), 0, -p.cabeza * 0.25, p.cabeza * 0.85, p.cabeza * 0.5, p.cabeza * 0.42, p.cabeza * 0.6);
  pieza(cab, ESF_BAJA, M(0x2a2020), 0, -p.cabeza * 0.16, p.cabeza * 1.42, p.cabeza * 0.14);
  for (const s of [1, -1]) {
    pieza(cab, ESF_BAJA, M(p.ojo ?? 0x1a1420), s * p.cabeza * 0.5, p.cabeza * 0.15, p.cabeza * 0.78, p.cabeza * 0.17, p.cabeza * 0.2, p.cabeza * 0.1);
    pieza(cab, ESF_BAJA, M(0x0a0a10), s * p.cabeza * 0.52, p.cabeza * 0.15, p.cabeza * 0.86, p.cabeza * 0.08); pieza(cab, ESF_BAJA, M(0xffffff, { luz: true }), s * p.cabeza * 0.56, p.cabeza * 0.2, p.cabeza * 0.92, p.cabeza * 0.03);
    const o = pivote(cab, s * p.cabeza * 0.62, p.cabeza * 0.6, -p.cabeza * 0.1); o.rotation.z = -s * (p.orejaCaida ? 2.6 : 0.55); if (p.orejaCaida) o.position.y = p.cabeza * 0.75;
    pieza(o, ESF, F(p.cOreja ?? p.c), 0, p.oreja * 0.5, 0, p.oreja * 0.38, p.oreja * 0.62, p.oreja * 0.14); pieza(o, ESF, M(p.cOrejaDentro ?? 0xf0b8a8), 0, p.oreja * 0.48, p.oreja * 0.06, p.oreja * 0.24, p.oreja * 0.46, p.oreja * 0.1); (art.orejas ??= []).push(o);
  }
  const cola = art.cola = pivote(cuerpo, 0, p.grosor * 0.3, -L / 2 + 0.02); cola.rotation.x = p.colaInc ?? 0.6;
  pieza(cola, ESF, F(p.cCola ?? p.c), 0, p.cola * 0.5, 0, p.cola * 0.32, p.cola * 0.6, p.cola * 0.32);
  if (p.capa) {
    const mc = M(p.capa, { doble: true, mapa: texturaLisa(p.capa, 'lana') });
    const lomo = pieza(cuerpo, new THREE.CylinderGeometry(p.grosor * 1.12, p.grosor * 1.3, L * 0.8, 10, 1, true, -Math.PI * 0.62, Math.PI * 1.24), mc, 0, 0.0, -L * 0.05); lomo.rotation.x = Math.PI / 2; lomo.rotation.y = Math.PI;
    const t = tela(cuerpo, mc, p.grosor * 2.2, alt * 0.75, { curva: -0.1, caida: 0.12, amp: 0.03, sy: 4 }); t.position.set(0, p.grosor * 0.6, -L * 0.42); art.telas.push(t);
    pieza(cuello, new THREE.TorusGeometry(p.grosor * 0.68, 0.03, 5, 10), M(p.broche ?? 0xc8a040), 0, 0.03, 0).rotation.x = Math.PI / 2;
    pieza(cuello, ESF_BAJA, M(p.joya, { emisivo: p.joya }), 0, 0.03, p.grosor * 0.7, 0.045);
    if (p.capuchaCaida) pieza(cuello, ESF, mc, 0, 0.1, -p.grosor * 0.6, p.grosor * 0.6, p.grosor * 0.4, p.grosor * 0.5);
  }
  for (const [x, y, z] of p.gemas ?? []) pieza(cuerpo, new THREE.OctahedronGeometry(0.035, 0), M(p.joya, { emisivo: p.joya }), x, y, z);
  if (p.gemaFrente) pieza(cab, new THREE.OctahedronGeometry(0.035, 0), M(p.joya, { emisivo: p.joya }), 0, p.cabeza * 0.55, p.cabeza * 0.82);
  return { raiz: g, art, tipo: 'cuadrupedo', M, alto: p.altoTotal };
}
const CUADRUPEDOS = {
  'Lumo': { c: 0xf4e0a0, panza: 0xfbf0c8, largo: 0.62, altura: 0.62, grosor: 0.16, pata: 0.03, pezuna: 0x6a4a2a, cuello: 0.26, cuelloInc: 0.5, cabeza: 0.13, oreja: 0.26, cola: 0.2, cCola: 0xfbf0c8, colaInc: -0.9,
    ojo: 0x3fb870, capa: 0x3f7a3a, joya: 0xf09a3a, gemas: [[0.15, 0.03, 0.1], [0.16, -0.02, -0.12], [-0.15, 0.03, 0.05]], gemaFrente: true, altoTotal: 1.2 },
  'Reena': { c: 0xf4f0e8, largo: 0.6, altura: 0.44, grosor: 0.17, pata: 0.04, pezuna: 0xf4f0e8, cuello: 0.14, cuelloInc: 0.7, cabeza: 0.15, cCabeza: 0x1c1c22, cHocico: 0xf4f0e8, cOreja: 0x1c1c22, oreja: 0.2, orejaCaida: true,
    cola: 0.26, colaInc: -0.5, cMancha: 0x1c1c22, manchas: [[0.1, 0.09, -0.12, 0.09]], capa: 0x2a55b8, broche: 0x7a5ab0, joya: 0x4aa8ff, capuchaCaida: true, altoTotal: 0.95 },
};
function buho() {
  const M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [], alas: [] };
  const F = col => M(col, { mapa: texturaPelaje(true), tinte: true, relieve: 2.6 }), c = F(0xf08a3a), cuerpo = art.torso = pivote(g, 0, 0.42, 0);
  pieza(cuerpo, ESF, c, 0, 0, 0, 0.2, 0.26, 0.18); pieza(cuerpo, ESF, F(0xfbe0b0), 0, -0.03, 0.06, 0.15, 0.2, 0.14);
  const cab = art.cabeza = pivote(cuerpo, 0, 0.3, 0.01);
  pieza(cab, ESF, c, 0, 0, 0, 0.19, 0.16, 0.17);
  for (const s of [1, -1]) {
    pieza(cab, ESF, M(0xfbe0b0), s * 0.075, 0.0, 0.12, 0.075, 0.075, 0.05); pieza(cab, ESF_BAJA, M(0x4ac860, { emisivo: 0x2a8a40 }), s * 0.075, 0.0, 0.15, 0.048, 0.048, 0.03); pieza(cab, ESF_BAJA, M(0x0a0a10), s * 0.075, 0.0, 0.172, 0.024);
    pieza(cab, CONO(0.045, 0.13, 4), c, s * 0.13, 0.15, 0).rotation.z = -s * 0.5;
    const ala = pivote(cuerpo, s * 0.17, 0.12, 0);
    pieza(ala, ESF, F(0xe07828), s * 0.24, 0, 0, 0.26, 0.035, 0.15);
    for (let i = 0; i < 7; i++) pieza(ala, ESF_BAJA, F(i % 2 ? 0xf8a850 : 0xe07828), s * (0.1 + i * 0.062), -0.012, -0.11 - (i > 3 ? 0.03 : 0), 0.04, 0.016, 0.13 + i * 0.012).rotation.y = s * 0.13 * i;
    art.alas.push(ala);
    pieza(cuerpo, ESF_BAJA, M(0xd8a040), s * 0.07, -0.27, 0.05, 0.035, 0.02, 0.06);
  }
  pieza(cab, CONO(0.03, 0.07, 4), M(0xf0c84a), 0, -0.04, 0.17).rotation.x = Math.PI / 2 + 0.5;
  pieza(cuerpo, ESF, M(0xe07828), 0, -0.16, -0.16, 0.1, 0.03, 0.14);
  for (const [x, y] of [[0, 0.02], [-0.07, -0.08], [0.07, -0.08]]) pieza(cuerpo, new THREE.OctahedronGeometry(0.03, 0), M(0xf8d070, { emisivo: 0xf8b050 }), x, y, 0.19);
  g.scale.setScalar(1.5);
  return { raiz: g, art, tipo: 'ave', M, alto: 1.15 };
}

// ---------------------------------------------------------------- criaturas
// Las criaturas de las invocaciones, como en sus cartas: figuras esbeltas,
// sin rostro y hechas de luz, cada una con su rasgo (corona de llamas,
// cristal y mantos, humo de estrellas, flores, arcoíris). Flotan: no andan.
const CRIATURAS_3D = {
  'Cirelia':   { c: 0xffc94a, c2: 0xfff3c0, osc: 0xe08a20 },
  'Baelorith': { c: 0xd8284a, c2: 0xffb0c0, osc: 0x8a1030, plano: true },
  'Aelgorth':  { c: 0x6a4ae0, c2: 0xc8b8ff, osc: 0x2a1a80 },
  'Caisis':    { c: 0xffd23a, c2: 0xfff2a0, osc: 0xe0a010 },
  'Brose':     { c: 0xe0283a, c2: 0xff9aa8, osc: 0x9a1020, plano: true, sinCabeza: true },
  'Aures':     { c: 0x8a6ae8, c2: 0xd8c8ff, osc: 0x4a30b0, plano: true },
  'Madain':    { c: 0xfff6ff, c2: 0xffffff, osc: 0xd8c8ff },
};
const ARCOIRIS = [0xff3a4a, 0xff9a2a, 0xffe03a, 0x4ad86a, 0x3a9aff, 0x8a5aff];
let texArcoiris = null;
function texturaArcoiris() {
  if (texArcoiris) return texArcoiris;
  const [cv, x] = lienzo(8, 256), g = x.createLinearGradient(0, 256, 0, 0);
  ARCOIRIS.forEach((c, i) => g.addColorStop(i / (ARCOIRIS.length - 1), hex(c)));
  x.fillStyle = g; x.fillRect(0, 0, 8, 256);
  texArcoiris = new THREE.CanvasTexture(cv); texArcoiris.colorSpace = THREE.SRGBColorSpace; return texArcoiris;
}
/** Pétalo o hoja: elipsoide aplanado y apuntado (largo en Y desde su base). */
const PETALO = (() => { const g = new THREE.SphereGeometry(1, 10, 8); const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), k = 1 - Math.max(0, y) * 0.75; p.setXYZ(i, p.getX(i) * k, (y + 1) / 2, p.getZ(i) * k); } g.computeVertexNormals(); return g; })();
const CRISTAL = new THREE.OctahedronGeometry(1, 0);

function criatura(nombre) {
  const p = CRIATURAS_3D[nombre], M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [] }, m = { raiz: g, art, M };
  const arco = nombre === 'Madain';
  const cuerpoM = arco ? M(0xffffff, { mapa: texturaArcoiris(), relieve: 0, emisivo: 0x6a6a7a, brillo: 0.9 }) : M(p.c, { emisivo: p.c, plano: p.plano, brillo: 0.5 });
  const claroM = M(p.c2, { emisivo: p.c2, plano: p.plano, brillo: 0.8 });
  const oscM = M(p.osc, { emisivo: p.osc, plano: p.plano, brillo: 0.4 });
  const seg = p.plano ? 6 : 12;
  const tronco = art.torso = pivote(g, 0, 2.3, 0);
  // Tronco: caderas, cintura de avispa, pecho y hombros.
  pieza(tronco, new THREE.LatheGeometry(perfil([[0.0, -0.62], [0.2, -0.56], [0.25, -0.38], [0.16, 0.02], [0.22, 0.38], [0.31, 0.72], [0.28, 0.86], [0.08, 0.98]]), seg), cuerpoM).scale.z = 0.72;
  pieza(tronco, CIL(0.06, 0.07, 0.18, seg), cuerpoM, 0, 1.02, 0);
  // Piernas largas y finas que acaban en punta (flotan).
  for (const s of [1, -1]) {
    const pi = pivote(tronco, s * 0.12, -0.5, 0); pi.rotation.z = s * 0.04;
    pieza(pi, CIL(0.1, 0.06, 0.95, seg), cuerpoM, 0, -0.47, 0); pieza(pi, CIL(0.06, 0.012, 0.9, seg), cuerpoM, 0, -1.37, 0.02);
  }
  // Cabeza sin rostro.
  const cab = art.cabeza = pivote(tronco, 0, 1.12, 0);
  const cabM = arco ? M(0xffffff, { luz: true }) : claroM;
  if (!p.sinCabeza) pieza(cab, ESF, cabM, 0, 0.16, 0, 0.13, nombre === 'Aelgorth' ? 0.24 : 0.19, 0.14);
  // Brazos abiertos con manos de dedos largos.
  for (const lado of ['I', 'D']) {
    const s = lado === 'I' ? 1 : -1; const b = art['brazo' + lado] = pivote(tronco, s * 0.33, 0.8, 0);
    pieza(b, ESF_BAJA, cuerpoM, 0, 0, 0, 0.09); pieza(b, CIL(0.065, 0.045, 0.66, seg), cuerpoM, 0, -0.33, 0);
    const c = art['codo' + lado] = pivote(b, 0, -0.66, 0);
    pieza(c, CIL(0.045, 0.03, 0.62, seg), cuerpoM, 0, -0.31, 0);
    const mn = art['mano' + lado] = pivote(c, 0, -0.66, 0);
    pieza(mn, ESF_BAJA, claroM, 0, 0, 0, 0.05, 0.07, 0.035);
    for (let i = 0; i < 4; i++) pieza(mn, CONO(0.014, 0.16, 4), claroM, (i - 1.5) * 0.026 * s, -0.1, 0.01).rotation.z = (i - 1.5) * 0.18 * s;
  }
  ADORNOS_CRIATURA[nombre]?.(m, p, { tronco, cab, cuerpoM, claroM, oscM });
  g.scale.setScalar(1.25);
  return { raiz: g, art, tipo: 'criatura', M, alto: 4.6, color: p.c, color2: p.c2 };
}
/** Velos que caen y ondean (llamas, mantos, humo). */
function velos(m, padre, colores, o) {
  const { M, art } = m;
  for (let i = 0; i < o.n; i++) {
    const k = o.n > 1 ? i / (o.n - 1) : 0.5, an = o.de + (o.a - o.de) * k;
    const t = tela(padre, M(colores[i % colores.length], { luz: true, alfa: o.alfa ?? 0.7, doble: true, aditivo: o.aditivo }), o.ancho, o.largo * (o.var ? 0.75 + 0.5 * ((i * 7) % 5) / 4 : 1), { sx: 2, sy: 10, amp: o.amp ?? 0.22, vel: o.vel ?? 1.6, abre: o.abre ?? 0.6, curva: o.curva ?? 0.1, empuje: 0 });
    t.position.set(Math.sin(an) * o.r + (o.x ?? 0), o.y, Math.cos(an) * o.r * 0.7 + (o.z ?? 0));
    t.rotation.set(o.rx ?? -0.1, an, (o.inclina ?? 0) * Math.sin(an));
    t.renderOrder = 9; art.telas.push(t);
  }
}
function chispasFlotantes(m, colores, n, o = {}) {
  for (let i = 0; i < n; i++) {
    const c = pieza(m.raiz, CRISTAL, m.M(colores[i % colores.length], { luz: true }), 0, 0, 0, o.tam ?? 0.05, (o.tam ?? 0.05) * 1.8, o.tam ?? 0.05);
    c.userData.gira = 0.5; flotante(m, c, 'torso', { radio: (o.radio ?? 0.9) + (i % 4) * 0.22, y: (o.y0 ?? -1.4) + i * ((o.alto ?? 3.6) / n), vel: 0.25 + (i % 5) * 0.07, fase: i * 1.7, sube: 0.12 });
  }
}
const ADORNOS_CRIATURA = {
  // Dorada, como una llama: corona de fuego, halo de sol y vestido de llamas.
  'Cirelia'(m, p, { tronco, cab, claroM, cuerpoM }) {
    const fuego = m.M(0xffd86a, { luz: true, alfa: 0.9 });
    for (let i = 0; i < 9; i++) { const an = (i / 8 - 0.5) * 2.4, h = 0.75 - Math.abs(an) * 0.22;
      const k = pieza(cab, PETALO, i % 2 ? fuego : claroM, Math.sin(an) * 0.11, 0.3 + Math.cos(an) * 0.05, -0.02, 0.06, h, 0.03); k.rotation.z = -an * 0.75; }
    const h = pieza(tronco, new THREE.TorusGeometry(0.75, 0.018, 5, 36), m.M(p.c2, { luz: true, alfa: 0.8 }), 0, 1.3, -0.25); m.art.halo = h;
    for (let i = 0; i < 16; i++) { const an = i / 16 * 6.283; const r = pieza(h, CONO(0.025, i % 2 ? 0.16 : 0.3, 4), m.M(p.c2, { luz: true, alfa: 0.8 }), Math.cos(an) * 0.85, Math.sin(an) * 0.85, 0); r.rotation.z = an - Math.PI / 2; }
    velos(m, tronco, [0xffb428, 0xffdc6a, 0xff8a1e, 0xfff0b0], { n: 11, de: -2.6, a: 2.6, r: 0.2, y: -0.25, ancho: 0.42, largo: 2.2, abre: 0.9, var: true, inclina: 0.35, alfa: 0.72 });
    chispasFlotantes(m, [0xffe9a0, 0xffc94a], 8, { tam: 0.045 });
  },
  // Cristal carmesí: corona de púas, hombreras afiladas, espada y un gran manto.
  'Baelorith'(m, p, { tronco, cab, claroM, cuerpoM, oscM }) {
    pieza(cab, CONO(0.07, 0.9, 4), cuerpoM, 0, 0.62, -0.02);
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) { const k = pieza(cab, CONO(0.045, 0.55 - i * 0.12, 4), i ? oscM : cuerpoM, s * (0.07 + i * 0.05), 0.42 - i * 0.05, -0.02); k.rotation.z = -s * (0.35 + i * 0.32); }
    for (const s of [1, -1]) { for (let i = 0; i < 3; i++) { const k = pieza(tronco, CONO(0.06, 0.5 - i * 0.1, 4), cuerpoM, s * (0.3 + i * 0.07), 0.9 - i * 0.04, -0.03); k.rotation.z = -s * (0.25 + i * 0.35); }
      pieza(tronco, CRISTAL, claroM, s * 0.1, 0.55, 0.15, 0.06, 0.14, 0.04); }
    pieza(tronco, CRISTAL, claroM, 0, 0.3, 0.17, 0.05, 0.16, 0.04);
    // Espada clavada delante, entre las manos.
    const esp = pivote(m.raiz, 0, 0.35, 0.42);
    pieza(esp, CONO(0.05, 0.35, 4), oscM, 0, -0.12, 0).rotation.x = Math.PI;
    pieza(esp, new THREE.BoxGeometry(0.07, 1.5, 0.025), m.M(0xffc0cc, { emisivo: 0xd8284a, plano: true }), 0, 0.8, 0);
    pieza(esp, new THREE.BoxGeometry(0.42, 0.05, 0.06), oscM, 0, 1.57, 0); pieza(esp, CIL(0.025, 0.025, 0.3, 5), oscM, 0, 1.75, 0); pieza(esp, CRISTAL, claroM, 0, 1.94, 0, 0.05);
    // Manto: dos grandes alas de tela que caen de los hombros hasta el suelo.
    for (const s of [1, -1]) velos(m, tronco, [0xd8284a, 0xff6a8a, 0xffd0dc, 0xa81838], { n: 5, de: s * 1.2, a: s * 2.4, r: 0.32, y: 0.85, ancho: 0.55, largo: 3.0, abre: 1.4, curva: 0.2, inclina: 0.5, alfa: 0.78, amp: 0.28, vel: 1.2 });
    velos(m, tronco, [0xa81838, 0xd8284a], { n: 4, de: -0.9, a: 0.9, r: 0.18, y: -0.4, ancho: 0.3, largo: 1.5, abre: 0.5, var: true, inclina: 0.2 });
    chispasFlotantes(m, [0xff3a5a, 0xffb0c0, 0xd8284a], 16, { tam: 0.05, radio: 1.0 });
  },
  // Violeta, sin rostro, casi una sombra: núcleo de luz y humo de estrellas.
  'Aelgorth'(m, p, { tronco }) {
    const nucleo = pieza(tronco, ESF, m.M(0xf0e8ff, { luz: true }), 0, 0.55, 0.14, 0.07); nucleo.userData.brillo = true;
    pieza(tronco, ESF, m.M(0xb8a0ff, { luz: true, alfa: 0.35, aditivo: true }), 0, 0.55, 0.12, 0.2);
    for (const s of [1, -1]) {
      velos(m, tronco, [0x5a3ae8, 0x8a6aff, 0x3a2ab0, 0xb8a0ff], { n: 4, de: s * 1.6, a: s * 2.8, r: 0.3, y: 0.85, ancho: 0.4, largo: 3.2, abre: 1.6, curva: 0.35, inclina: 0.9, alfa: 0.6, amp: 0.45, vel: 0.9, var: true, aditivo: true });
    }
    chispasFlotantes(m, [0xffffff, 0xd8c8ff, 0x9a6bff], 18, { tam: 0.04, radio: 0.9 });
    const orbe = pieza(m.raiz, ESF_BAJA, m.M(0x1a1040, { emisivo: 0x4a30b0 }), 0, 0, 0, 0.09); flotante(m, orbe, 'cabeza', { radio: 0.9, y: 0.4, vel: 0.4, sube: 0.15 });
  },
  // Girasol: cabeza de pétalos, hojas en los hombros y falda de pétalos.
  'Caisis'(m, p, { tronco, cab, claroM, cuerpoM, oscM }) {
    for (const [n, r, l, cM] of [[14, 0.15, 0.24, oscM], [12, 0.13, 0.2, cuerpoM]]) for (let i = 0; i < n; i++) {
      const an = i / n * 6.283 + (cM === cuerpoM ? 0.2 : 0); const k = pieza(cab, PETALO, cM, Math.sin(an) * r, 0.16 + Math.cos(an) * r * 1.15, -0.05 - (cM === oscM ? 0.03 : 0), 0.075, l, 0.025); k.rotation.z = -an; }
    pieza(cab, ESF, claroM, 0, 0.16, 0.02, 0.13, 0.16, 0.12);
    const hoja = m.M(0xf0d040, { emisivo: 0xc8a020, brillo: 0.4, doble: true });
    for (const s of [1, -1]) for (let i = 0; i < 2; i++) { const k = pieza(tronco, PETALO, hoja, s * (0.3 + i * 0.04), 0.8 - i * 0.14, -0.06, 0.1, 0.45 - i * 0.1, 0.03); k.rotation.set(-0.2, 0, -s * (0.9 + i * 0.6)); }
    for (let i = 0; i < 10; i++) { const an = i / 10 * 6.283; const k = pieza(tronco, PETALO, i % 2 ? cuerpoM : oscM, Math.sin(an) * 0.2, -0.3, Math.cos(an) * 0.14, 0.13, 0.7, 0.04); k.rotation.set(Math.PI + Math.cos(an) * 0.45, 0, -Math.sin(an) * 0.45); }
    velos(m, tronco, [0xffd23a, 0xffe880], { n: 6, de: -2.6, a: 2.6, r: 0.18, y: -0.5, ancho: 0.3, largo: 1.1, abre: 0.6, alfa: 0.55, var: true });
    chispasFlotantes(m, [0xfff2a0, 0xffd23a], 8, { tam: 0.04 });
  },
  // Rosa roja: cabeza de pétalos enrollados y un cuerpo de pétalos facetados.
  'Brose'(m, p, { tronco, cab, claroM, cuerpoM, oscM }) {
    const petM = m.M(p.c, { emisivo: p.c, plano: true, doble: true, brillo: 0.5 }), petO = m.M(p.osc, { emisivo: p.osc, plano: true, doble: true, brillo: 0.4 });
    // Capullo: anillos de pétalos cada vez más abiertos alrededor de un centro enrollado.
    const rosa = pivote(cab, 0, 0.02, 0); rosa.scale.setScalar(1.3);
    pieza(rosa, ESF, oscM, 0, 0.2, 0, 0.07, 0.1, 0.07);
    for (let anillo = 0; anillo < 4; anillo++) { const n = 4 + anillo, r = 0.02 + anillo * 0.035, abre = -0.15 + anillo * 0.22;
      for (let i = 0; i < n; i++) { const an = i / n * 6.283 + anillo * 0.7; const k = pieza(rosa, PETALO, anillo < 2 ? (anillo ? petM : petO) : (i % 2 ? petM : petO), Math.sin(an) * r, 0.02 + anillo * 0.01, Math.cos(an) * r, 0.09 + anillo * 0.025, 0.3 + anillo * 0.03, 0.035);
        k.rotation.set(Math.cos(an) * abre, 0, -Math.sin(an) * abre); } }
    for (let i = 0; i < 16; i++) { const an = i / 16 * 6.283, f = i % 2;
      const k = pieza(tronco, CRISTAL, f ? cuerpoM : oscM, Math.sin(an) * 0.22, -0.25 - f * 0.3, Math.cos(an) * 0.15, 0.13, 0.55, 0.03); k.rotation.set(Math.cos(an) * 0.35, an, -Math.sin(an) * 0.35); }
    for (const s of [1, -1]) for (let i = 0; i < 3; i++) { const k = pieza(tronco, CRISTAL, i % 2 ? oscM : cuerpoM, s * (0.3 + i * 0.05), 0.8 - i * 0.08, 0, 0.08, 0.22, 0.025); k.rotation.z = -s * (0.6 + i * 0.4); }
    pieza(tronco, CRISTAL, claroM, 0, 0.5, 0.16, 0.08, 0.2, 0.03);
    chispasFlotantes(m, [0xff3a4a, 0xff9aa8, 0xc81828], 16, { tam: 0.05, radio: 1.0 });
  },
  // Lirio violeta: corona de grandes pétalos y cuerpo facetado de pétalos.
  'Aures'(m, p, { tronco, cab, claroM, cuerpoM, oscM }) {
    const petM = m.M(p.c, { emisivo: p.c, plano: true, doble: true, brillo: 0.55 });
    for (let i = 0; i < 7; i++) { const an = (i / 6 - 0.5) * 2.8; const k = pieza(cab, PETALO, i % 2 ? oscM : petM, Math.sin(an) * 0.08, 0.26, -0.03, 0.11, i === 3 ? 0.62 : 0.5, 0.035); k.rotation.z = -an * 0.8; }
    for (const s of [1, -1]) { const k = pieza(cab, PETALO, petM, s * 0.12, 0.14, 0.02, 0.09, 0.4, 0.03); k.rotation.set(0.3, 0, -s * 2.2); }
    for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283, f = i % 2;
      const k = pieza(tronco, PETALO, f ? cuerpoM : oscM, Math.sin(an) * 0.2, -0.15 - f * 0.2, Math.cos(an) * 0.14, 0.13, 0.85, 0.035); k.rotation.set(Math.PI + Math.cos(an) * 0.3, 0, -Math.sin(an) * 0.3); }
    for (const s of [1, -1]) for (let i = 0; i < 2; i++) { const k = pieza(tronco, PETALO, petM, s * 0.32, 0.82 - i * 0.1, 0, 0.08, 0.32, 0.025); k.rotation.z = -s * (0.4 + i * 0.7); }
    pieza(tronco, CRISTAL, claroM, 0, 0.45, 0.16, 0.06, 0.16, 0.03);
    chispasFlotantes(m, [0xd8c8ff, 0x8a6ae8], 12, { tam: 0.045 });
  },
  // Madain: cabeza de luz blanca, cuerpo y alas de arcoíris y gemas en arco.
  'Madain'(m, p, { tronco, cab }) {
    pieza(cab, ESF, m.M(0xffffff, { luz: true, alfa: 0.3, aditivo: true }), 0, 0.16, 0, 0.2, 0.26, 0.2);
    pieza(cab, ESF, m.M(0xfff0ff, { luz: true, alfa: 0.18, aditivo: true }), 0, 0.16, 0, 0.32, 0.38, 0.3);
    pieza(tronco, CRISTAL, m.M(0xffffff, { luz: true }), 0, 0.5, 0.17, 0.08, 0.18, 0.03);
    pieza(tronco, CRISTAL, m.M(0xffe03a, { emisivo: 0xff9a2a, brillo: 0.8, plano: true }), 0, 0.5, 0.15, 0.11, 0.24, 0.04);
    // Alas: bandas de arcoíris que caen desde los hombros abriéndose hasta el suelo.
    // Cada banda cuelga del hombro de cara al frente y se abre hacia fuera: de cerca violeta, por fuera roja.
    for (const s of [1, -1]) [...ARCOIRIS].reverse().forEach((c, i) => {
      const t = tela(tronco, m.M(c, { luz: true, alfa: 0.88, doble: true }), 0.22, 3.0 - i * 0.08, { sx: 2, sy: 12, amp: 0.12, vel: 1.1, abre: 0.5, curva: 0.06, empuje: 0 });
      t.position.set(s * (0.24 + i * 0.07), 0.98 + i * 0.02, -0.12 - i * 0.03); t.rotation.set(-0.12, 0, s * (0.12 + i * 0.13)); t.renderOrder = 9; m.art.telas.push(t);
    });
    ARCOIRIS.concat([0xffffff]).forEach((c, i) => { const an = (i / 6 - 0.5) * 2.4;
      pieza(cab, CRISTAL, m.M(c, { luz: true }), Math.sin(an) * 0.62, 0.3 + Math.cos(an) * 0.55, -0.05, 0.05, 0.1, 0.03); });
    chispasFlotantes(m, ARCOIRIS, 12, { tam: 0.04 });
  },
};

// --------------------------------------------------- ilustración recortada
const LAMINAS = { 'Clarividente': { archivo: 'clarividente', alto: 1.7, razon: 475 / 747, mano: [0.33, 0.55] } };
/** Alternativa a comparar: la ilustración original recortada, de pie y siempre de frente a la cámara. */
function lamina(nombre) {
  const d = LAMINAS[nombre], tex = new THREE.TextureLoader().load(new URL('../../assets/figuras/' + d.archivo + '.webp', import.meta.url).href); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(), geo = new THREE.PlaneGeometry(d.alto * d.razon, d.alto); geo.translate(0, d.alto / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide })); m.renderOrder = 5; g.add(m);
  return { raiz: g, art: { telas: [], flotantes: [], pelo: [] }, tipo: 'lamina', alto: d.alto, ancho: d.alto * d.razon, manoUV: d.mano };
}

/** Construye el modelo 3D de un personaje o criatura por su nombre. */
export function construirModelo(nombre) {
  let m;
  if (nombre.startsWith('lamina:')) { m = lamina(nombre.slice(7)); m.nombre = nombre.slice(7); return m; }
  if (HUMANOS[nombre]) { m = humano(HUMANOS[nombre]); EXTRAS[nombre]?.(m); }
  else if (CUADRUPEDOS[nombre]) m = cuadrupedo(CUADRUPEDOS[nombre]);
  else if (nombre === 'Sora') m = buho();
  else if (CRIATURAS_3D[nombre]) m = criatura(nombre);
  else throw new Error('Sin modelo: ' + nombre);
  m.nombre = nombre; return m;
}
export const NOMBRES_PERSONAJES = [...Object.keys(HUMANOS), ...Object.keys(CUADRUPEDOS), 'Sora'];
export const NOMBRES_CRIATURAS = Object.keys(CRIATURAS_3D);
