// Portales 3D: umbrales de piedra a medio derruir con runas brillantes,
// siguiendo la ilustración de la carta de Portal (tarima circular con una
// estrella rúnica, dos pilares altos unidos por un arco con una aguja, dos
// pilares bajos, piedras con ojos rúnicos y escalinata). Cada variante
// cambia qué está roto, la estrella y el tono, pero son la misma familia.
import { THREE, mundo, siempre } from './mundo.js';
import { texturaBrillo } from './efectos.js';

export const ALTURA_TARIMA = 0.32;

function lienzo(t, pintar) {
  const c = document.createElement('canvas'); c.width = c.height = t;
  const x = c.getContext('2d'); x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = 'round';
  x.shadowColor = '#fff'; x.shadowBlur = t / 40;
  pintar(x, t); return new THREE.CanvasTexture(c);
}
function glifo(x, cx, cy, r, sem) {
  // Runa inventada: unos pocos trazos dentro de un círculo.
  let s = sem; const rnd = () => (s = (s * 16807 + 11) % 2147483647) / 2147483647;
  x.beginPath(); x.arc(cx, cy, r, 0, 7); x.stroke();
  x.beginPath();
  for (let i = 0; i < 3; i++) {
    const a = rnd() * 6.28, b = a + 1.6 + rnd() * 2.6;
    x.moveTo(cx + Math.cos(a) * r * 0.6, cy + Math.sin(a) * r * 0.6); x.lineTo(cx + Math.cos(b) * r * 0.6, cy + Math.sin(b) * r * 0.6);
  }
  x.stroke();
}
const cacheDisco = new Map();
/** Estrella rúnica de la tarima (n puntas). */
export function texturaDisco(n = 8) {
  if (!cacheDisco.has(n)) cacheDisco.set(n, lienzo(256, (x, t) => {
    const c = t / 2;
    x.lineWidth = 3; for (const r of [118, 84]) { x.beginPath(); x.arc(c, c, r, 0, 7); x.stroke(); }
    x.lineWidth = 2; x.beginPath(); x.arc(c, c, 30, 0, 7); x.stroke();
    const salto = n % 2 ? (n - 1) / 2 : n / 2 - 1;
    x.beginPath();
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + i * salto / n * Math.PI * 2; x.lineTo(c + Math.cos(a) * 84, c + Math.sin(a) * 84); }
    x.stroke();
    for (let i = 0; i < n; i++) { const a = -Math.PI / 2 + i / n * Math.PI * 2; glifo(x, c + Math.cos(a) * 101, c + Math.sin(a) * 101, 9, 7 + i * 31 + n); }
    x.beginPath(); x.arc(c, c, 10, 0, 7); x.fill();
  }));
  return cacheDisco.get(n);
}
let texOjos, texTira, texLuz;
function texturasComunes() {
  texOjos ??= lienzo(256, (x, t) => {
    const c = t / 2; x.lineWidth = 3;
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.35; const px = c + Math.cos(a) * 108, py = c + Math.sin(a) * 108; x.beginPath(); x.arc(px, py, 14, 0, 7); x.stroke(); x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); }
  });
  texTira ??= (() => {
    const c = document.createElement('canvas'); c.width = 32; c.height = 256; const x = c.getContext('2d');
    x.strokeStyle = '#fff'; x.lineWidth = 2.5; x.lineCap = 'round'; x.shadowColor = '#fff'; x.shadowBlur = 5;
    let s = 5; const rnd = () => (s = (s * 16807 + 3) % 2147483647) / 2147483647;
    for (let i = 0; i < 6; i++) { const y = 24 + i * 40; x.beginPath(); x.moveTo(8 + rnd() * 16, y - 12); x.lineTo(8 + rnd() * 16, y); x.lineTo(8 + rnd() * 16, y + 12); x.moveTo(8, y); x.lineTo(24, y + (rnd() - 0.5) * 14); x.stroke(); }
    return new THREE.CanvasTexture(c);
  })();
  texLuz ??= (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 128, 0, 0); g.addColorStop(0, 'rgba(255,255,255,.95)'); g.addColorStop(0.5, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 128);
    const h = x.createLinearGradient(0, 0, 64, 0); h.addColorStop(0, 'rgba(0,0,0,1)'); h.addColorStop(0.3, 'rgba(0,0,0,0)'); h.addColorStop(0.7, 'rgba(0,0,0,0)'); h.addColorStop(1, 'rgba(0,0,0,1)');
    x.globalCompositeOperation = 'destination-out'; x.fillStyle = h; x.fillRect(0, 0, 64, 128);
    return new THREE.CanvasTexture(c);
  })();
}

export const VARIANTES = [
  { puntas: 8, tono: 0xbfe6ff, arco: 'entero', aguja: true },
  { puntas: 7, tono: 0xcdc6ff, arco: 'derecha', roto: { altoIzq: true }, cascotes: 3 },
  { puntas: 6, tono: 0xaef2e4, arco: 'entero', roto: { bajoDer: true }, inclinado: 0.09, cascotes: 2 },
  { puntas: 5, tono: 0xffe9c0, arco: 'munones', aguja: false, cascotes: 3 },
  { puntas: 9, tono: 0xffcbe4, arco: 'izquierda', roto: { altoDer: true, bajoIzq: true }, cascotes: 4 },
  { puntas: 10, tono: 0xd8ffd0, arco: 'entero', aguja: true, roto: { bajoIzq: true }, cascotes: 1 },
];

const mPiedra = new THREE.MeshLambertMaterial({ color: 0xb7ab9f, flatShading: true });
const mTarima = new THREE.MeshLambertMaterial({ color: 0x7e879c, flatShading: true });
const mBase = new THREE.MeshLambertMaterial({ color: 0x343b60, flatShading: true });

export function crearPortal(v, semilla = 1) {
  texturasComunes();
  let s = semilla * 7919; const rnd = () => (s = (s * 16807 + 13) % 2147483647) / 2147483647;
  const g = new THREE.Group();
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
  const aditivo = (map, opacity = 0.9) => new THREE.MeshBasicMaterial({ map, color: v.tono, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });

  add(new THREE.CylinderGeometry(1.28, 1.36, 0.2, 14), mBase, 0, 0.1, 0);
  add(new THREE.CylinderGeometry(1.06, 1.1, ALTURA_TARIMA - 0.2, 14), mTarima, 0, 0.2 + (ALTURA_TARIMA - 0.2) / 2, 0);
  // Escalinata hacia delante.
  for (let i = 0; i < 3; i++) add(new THREE.BoxGeometry(0.7, 0.09, 0.2), mTarima, 0, 0.05 + i * 0.08, 1.5 - i * 0.17);
  // Piedras bajas con ojos rúnicos alrededor.
  const piedras = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.17, 0.16, 7), mBase, 9);
  const mm = new THREE.Matrix4();
  for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283 + 0.35; piedras.setMatrixAt(i, mm.makeTranslation(Math.cos(a) * 1.5, 0.08, Math.sin(a) * 1.5)); }
  g.add(piedras);

  const runas = [];
  const disco = add(new THREE.PlaneGeometry(2.05, 2.05), aditivo(texturaDisco(v.puntas)), 0, ALTURA_TARIMA + 0.012, 0); disco.rotation.x = -Math.PI / 2; runas.push(disco);
  const ojos = add(new THREE.PlaneGeometry(3.56, 3.56), aditivo(texOjos, 0.8), 0, 0.172, 0); ojos.rotation.x = -Math.PI / 2; runas.push(ojos);

  const pilar = (x, z, alto, roto, inclina = 0) => {
    const h = roto ? alto * (0.38 + rnd() * 0.2) : alto;
    const grupo = new THREE.Group(); grupo.position.set(x, 0, z); grupo.rotation.z = inclina; g.add(grupo);
    const basa = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.26, 0.4), mPiedra); basa.position.y = 0.13; grupo.add(basa);
    const fuste = new THREE.Mesh(new THREE.CylinderGeometry(roto ? 0.19 : 0.16, 0.21, h, 4), mPiedra); fuste.position.y = 0.26 + h / 2; fuste.rotation.y = Math.PI / 4; grupo.add(fuste);
    if (roto) { fuste.rotation.z = 0.05; const pico = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.3, 4), mPiedra); pico.position.set(0.05, 0.26 + h + 0.1, 0); pico.rotation.set(0.2, Math.PI / 4, 0.5); grupo.add(pico); }
    const tira = new THREE.Mesh(new THREE.PlaneGeometry(0.15, Math.min(h * 0.8, 1.5)), aditivo(texTira, 0.85)); tira.position.set(0, 0.3 + h * 0.5, 0.158); grupo.add(tira); runas.push(tira);
    return h;
  };
  const r = v.roto ?? {};
  pilar(-0.66, -0.78, 2.5, r.altoIzq, 0); pilar(0.66, -0.78, 2.5, r.altoDer, -(v.inclinado ?? 0));
  pilar(-1.2, -0.2, 1.15, r.bajoIzq); pilar(1.2, -0.2, 1.15, r.bajoDer);

  // Arco entre los pilares altos (entero, medio o solo muñones).
  const tramo = (desde, hasta) => { const t = add(new THREE.TorusGeometry(0.66, 0.065, 5, 12, hasta - desde), mPiedra, 0, 1.95, -0.78); t.rotation.z = desde; };
  if (v.arco === 'entero') tramo(0, Math.PI);
  else if (v.arco === 'derecha') tramo(0, Math.PI * 0.58);
  else if (v.arco === 'izquierda') tramo(Math.PI * 0.4, Math.PI);
  else { tramo(0, Math.PI * 0.3); tramo(Math.PI * 0.72, Math.PI); }
  if (v.aguja) add(new THREE.ConeGeometry(0.06, 0.5, 4), mPiedra, 0, 2.85, -0.78);
  for (let i = 0; i < (v.cascotes ?? 0); i++) {
    const c = add(new THREE.BoxGeometry(0.18 + rnd() * 0.22, 0.14 + rnd() * 0.1, 0.2 + rnd() * 0.15), mPiedra, (rnd() - 0.5) * 3, 0.08, -1.25 - rnd() * 0.5);
    c.rotation.set(rnd(), rnd() * 3, rnd());
  }
  // Resplandor del umbral y orbes flotantes.
  const umbral = add(new THREE.PlaneGeometry(1.2, 2.3), aditivo(texLuz, 0.35), 0, ALTURA_TARIMA + 1.15, -0.8);
  const orbes = [];
  const nOrbes = mundo.calidad === 'alta' ? 4 : 2;
  for (let i = 0; i < nOrbes; i++) {
    const o = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaBrillo(), color: v.tono, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.8 }));
    o.scale.setScalar(0.28); o.userData = { a: rnd() * 6.28, r: 1.0 + rnd() * 0.5, y: 1.3 + rnd() * 1.4, v: 0.25 + rnd() * 0.3 }; g.add(o); orbes.push(o);
  }
  siempre((dt, t) => {
    for (const o of orbes) { const u = o.userData; o.position.set(Math.cos(u.a + t * u.v) * u.r, u.y + Math.sin(t * 0.9 + u.a) * 0.12, -0.5 + Math.sin(u.a + t * u.v) * 0.45); }
    const d = g.userData; d.brilloAhora += (d.brillo - d.brilloAhora) * Math.min(1, dt * 5);
    const pulso = 0.85 + Math.sin(t * 2.2 + semilla) * 0.15;
    for (const m of runas) m.material.opacity = Math.min(1, d.brilloAhora * pulso);
    umbral.material.opacity = Math.min(1, 0.18 + d.brilloAhora * 0.35 * pulso);
  });
  fundirPiedra(g);
  g.userData = { brillo: 0.6, brilloAhora: 0.6, tono: v.tono, variante: v };
  return g;
}
/** Une todas las piezas de piedra de un Portal en una malla por material (menos llamadas de dibujo en móvil). */
function fundirPiedra(g) {
  g.updateMatrixWorld(true);
  for (const mat of [mPiedra, mTarima, mBase]) {
    const piezas = []; g.traverse(o => { if (o.isMesh && !o.isInstancedMesh && o.material === mat) piezas.push(o); });
    const pos = [], nor = [];
    for (const m of piezas) { const ge = m.geometry.clone().applyMatrix4(m.matrixWorld).toNonIndexed(); pos.push(...ge.attributes.position.array); nor.push(...ge.attributes.normal.array); m.parent.remove(m); m.geometry.dispose(); ge.dispose(); }
    const u = new THREE.BufferGeometry(); u.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); u.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
    g.add(new THREE.Mesh(u, mat));
  }
}
/** Intensidad de las runas de un Portal (0 apagadas, 0.6 reposo, 1.6 al máximo). */
export function encender(portal, k) { portal.userData.brillo = k; }
