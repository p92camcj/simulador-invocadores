// Actores de la maqueta: dan vida a los modelos 3D de modelos.js (caminar,
// respirar, gestos de conjuro, capas que ondean) y gestionan la túnica con
// capucha de las cartas de la mano. Regla de oro que heredará la fase 2: un
// encapuchado OPACO no lleva ningún modelo dentro (el nombre del personaje
// ni siquiera llega aquí); el modelo solo se crea cuando la carta se revela.
import { THREE, mundo, tw, cadaFrame, siempre, V, suave, sale, entra, lineal, mezcla } from './mundo.js';
import { construirModelo } from './modelos.js';
import { humo, chispas, absorber } from './efectos.js';
import { S } from './sonido.js';

// Color de la magia de cada personaje, manos de las que sale y pose de reposo
// (tomada de su ilustración).
export const INFO = {
  'Aprendiz':     { color: 0xffc27a, color2: 0xfff3d6, manos: ['D', 'I'], pose: 'aprendiz' },
  'Centinela':    { color: 0xff7a4a, color2: 0xffd9a0, manos: ['D'], pose: 'guardia' },
  'Clarividente': { color: 0x5fe8ff, color2: 0xc8fbff, manos: ['D'], pose: 'orbe', aura: 0.5 },
  'Cronista':     { color: 0x6ff0d0, color2: 0xe6fff6, manos: ['D'], pose: 'libro', aura: 0.6 },
  'Cronomante':   { color: 0x58d8ff, color2: 0xb9a0ff, manos: ['D', 'I'], pose: 'abierto', aura: 0.5 },
  'Entusiasta':   { color: 0xff5fb0, color2: 0xffe36a, manos: ['I'], pose: 'senalar' },
  'Estratega':    { color: 0xffa25f, color2: 0xfff0a8, manos: ['D', 'I'], pose: 'ofrenda' },
  'Lumo':         { color: 0xfff0a0, color2: 0xa8ffb0, manos: [] },
  'Maestro':      { color: 0xffb84a, color2: 0xff6a5a, manos: ['D', 'I'], pose: 'ofrenda' },
  'Metamorfo':    { color: 0xff9ad8, color2: 0xd9b0ff, manos: ['D', 'I'], pose: 'ofrenda', aura: 0.8 },
  'Ocultista':    { color: 0x4a9cff, color2: 0x9ad8ff, manos: ['D', 'I'], pose: 'juntas', aura: 0.6, vuela: 0.2 },
  'Pícaro':       { color: 0x6fb8ff, color2: 0xffffff, manos: ['D'], pose: 'orbe' },
  'Reena':        { color: 0xffa8c8, color2: 0xfff0f6, manos: [] },
  'Sora':         { color: 0xffb060, color2: 0xfff0b0, manos: [], vuela: 0.4 },
  'Cirelia':      { color: 0xffc94a, color2: 0xfff3c0, manos: ['D', 'I'], pose: 'ofrenda', gema: 'C' },
  'Baelorith':    { color: 0xff4a6e, color2: 0xffb0c0, manos: ['D', 'I'], pose: 'ofrenda', gema: 'B' },
  'Aelgorth':     { color: 0x9a6bff, color2: 0xc8b8ff, manos: ['D', 'I'], pose: 'ofrenda', gema: 'A' },
};

// Poses: ángulos de hombro (x adelante/atrás, z apertura), codo, cabeza y torso.
const pose = (I, D = [I[0], -I[1], I[2]], extra = {}) => ({ bIx: I[0], bIz: I[1], cI: I[2], bDx: D[0], bDz: D[1], cD: D[2], cabx: 0, caby: 0, torx: 0, tory: 0, firme: 0, ...extra });
export const POSES = {
  reposo:   pose([0, 0.12, -0.15]),
  recogido: pose([0.05, 0.04, -0.1], undefined, { firme: 1 }),
  ofrenda:  pose([-0.35, 0.55, -1.25], undefined, { firme: 0.7 }),
  abierto:  pose([-0.9, 0.7, -0.9], undefined, { firme: 0.8 }),
  alzar:    pose([-2.6, 0.5, -0.3], undefined, { cabx: -0.3, torx: -0.1, firme: 1 }),
  lanzar:   pose([-1.5, -0.12, -0.1], undefined, { torx: 0.18, firme: 1 }),
  lanzarD:  pose([0.5, 0.3, -0.3], [-1.55, 0.1, 0], { torx: 0.12, tory: 0.35, firme: 1 }),
  libro:    pose([-0.6, 0.1, -1.2], [-0.9, -0.5, -1.1], { firme: 1 }),
  leer:     pose([-0.9, 0.0, -1.3], [-1.9, -0.5, -0.5], { cabx: 0.2, firme: 1 }),
  orbe:     pose([0, 0.3, -0.3], [-0.5, -0.35, -1.3], { firme: 0.8 }),
  orbeAlto: pose([-0.4, 0.8, -0.5], [-2.7, -0.2, -0.2], { cabx: -0.35, firme: 1 }),
  juntas:   pose([-0.7, -0.35, -1.3], undefined, { cabx: 0.12, firme: 1 }),
  guardia:  pose([-0.3, 0.35, -1.1], [-0.35, -0.3, -1.0], { firme: 1 }),
  bloqueo:  pose([-1.35, -0.3, -0.7], [-0.2, -0.5, -0.8], { torx: 0.12, tory: -0.3, firme: 1 }),
  lanzaAlta: pose([-0.3, 0.5, -1.0], [-2.3, -0.35, -0.5], { torx: -0.1, firme: 1 }),
  lanzaGolpe: pose([-0.5, 0.45, -1.2], [-0.9, -0.2, -0.2], { torx: 0.25, firme: 1 }),
  senalar:  pose([-1.9, 0.5, -0.1], [0.4, -0.5, -0.4], { firme: 0.9 }),
  aprendiz: pose([-0.8, 0.2, -1.0], [-2.5, -0.5, -0.4], { firme: 0.9 }),
  celebrar: pose([-2.8, 0.75, -0.2], undefined, { cabx: -0.2, firme: 1 }),
  apuro:    pose([-1.2, 0.9, -1.6], undefined, { cabx: 0.2, firme: 1 }),
  dudaI:    pose([-0.35, 0.55, -1.25], undefined, { caby: 0.7, tory: 0.25, firme: 1 }),
  dudaD:    pose([-0.35, 0.55, -1.25], undefined, { caby: -0.7, tory: -0.25, firme: 1 }),
  sigilo:   pose([-1.0, 0.1, -1.8], undefined, { torx: 0.42, cabx: -0.25, firme: 1 }),
  reverencia: pose([0.1, 0.5, -0.3], [-0.6, -0.2, -1.6], { torx: 0.55, cabx: 0.25, firme: 1 }),
};

// ---- Manto con capucha de las cartas de la mano ----
// Un sudario oscuro y raído, de los que flotan más que cuelgan: paño con
// pliegues, bajo hecho jirones, mangas caídas y tiras que ondean detrás.
// La textura lleva en su canal alfa el borde roto y un "mapa de evaporación":
// al subir el umbral de corte, el paño se deshace de abajo arriba.
const PERFIL_MANTO = [[0.66, 0], [0.63, 0.12], [0.57, 0.38], [0.5, 0.72], [0.44, 1.02], [0.39, 1.26], [0.33, 1.42], [0.22, 1.52]];
const PERFIL_CAPUCHA = [[0.24, 0], [0.33, 0.1], [0.36, 0.26], [0.31, 0.42], [0.2, 0.55], [0.08, 0.64], [0, 0.68]];
let geoHueco, texSombra, texManto;
function texturaManto() {
  if (texManto) return texManto;
  const W = 256, c = document.createElement('canvas'); c.width = c.height = W; const x = c.getContext('2d');
  // Ruido suave (manchas difuminadas) para que la evaporación avance con un frente irregular.
  x.fillStyle = '#000'; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 90; i++) { const px = Math.random() * W, py = Math.random() * W, r = 14 + Math.random() * 34; for (const dx of [0, -W, W]) { const g = x.createRadialGradient(px + dx, py, 0, px + dx, py, r); g.addColorStop(0, 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = g; x.fillRect(px + dx - r, py - r, r * 2, r * 2); } }
  const ruido = x.getImageData(0, 0, W, W).data;
  // Paño: gris oscuro con pliegues verticales, hilos y desgaste.
  x.fillStyle = '#b9b6c6'; x.fillRect(0, 0, W, W);
  for (let i = 0; i < 26; i++) { const px = Math.random() * W, an = 4 + Math.random() * 12; for (const dx of [0, -W, W]) { const g = x.createLinearGradient(px + dx - an, 0, px + dx + an, 0); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(0.5, i % 3 ? 'rgba(0,0,10,.5)' : 'rgba(255,255,255,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px + dx - an, 0, an * 2, W); } }
  for (let y = 0; y < W; y += 2) { x.fillStyle = 'rgba(0,0,10,.16)'; x.fillRect(0, y, W, 1); }
  for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.3})`; x.fillRect(Math.random() * W, Math.random() * W, 1, 3 + Math.random() * 14); }
  const sombra = x.createLinearGradient(0, 0, 0, W); sombra.addColorStop(0, 'rgba(0,0,0,0)'); sombra.addColorStop(1, 'rgba(0,0,0,.45)'); x.fillStyle = sombra; x.fillRect(0, 0, W, W);
  // Bajo hecho jirones: altura del roto por columna (dientes largos, rasgones estrechos y algún agujero).
  const roto = new Float32Array(W); let h = 0.1;
  for (let i = 0; i < W; i++) { if (i % 9 === 0) h = 0.03 + Math.random() * 0.2; roto[i] = h * (0.35 + 0.65 * Math.abs(Math.sin(i * 0.35))) + (Math.random() < 0.04 ? 0.16 : 0); }
  for (let k = 0; k < 9; k++) { const i0 = Math.floor(Math.random() * W), alto = 0.22 + Math.random() * 0.22; for (let d = -2; d <= 2; d++) roto[(i0 + d + W) % W] = Math.max(roto[(i0 + d + W) % W], alto * (1 - Math.abs(d) / 3)); }
  const im = x.getImageData(0, 0, W, W), d = im.data;
  for (let y = 0; y < W; y++) for (let i = 0; i < W; i++) { const v = 1 - y / W, j = (y * W + i) * 4;
    d[j + 3] = v < roto[i] ? 0 : Math.round(255 * Math.min(1, 0.16 + 0.84 * Math.min(1, v * 0.72 + ruido[j] / 255 * 0.5))); }
  x.putImageData(im, 0, 0);
  texManto = new THREE.CanvasTexture(c); texManto.colorSpace = THREE.SRGBColorSpace; texManto.wrapS = THREE.RepeatWrapping; return texManto;
}
function crearCapa(translucida) {
  geoHueco ??= new THREE.CircleGeometry(0.2, 14);
  const mat = new THREE.MeshLambertMaterial({ map: texturaManto(), side: THREE.DoubleSide, ...(translucida
    ? { color: 0x9a90f0, emissive: 0x2a2470, transparent: true, opacity: 0.3, depthWrite: false }
    : { color: 0x2b2740, emissive: 0x08070f, transparent: false, opacity: 1, alphaTest: 0.1 }) });
  const capa = new THREE.Group();
  // Manto: superficie de revolución con pliegues; se guarda su forma para hacerla ondear.
  const filas = 12, pts = []; for (let i = 0; i <= filas; i++) { const q = i / filas * (PERFIL_MANTO.length - 1), n = Math.min(PERFIL_MANTO.length - 2, Math.floor(q)), f = q - n, A = PERFIL_MANTO[n], B = PERFIL_MANTO[n + 1]; pts.push(new THREE.Vector2(A[0] + (B[0] - A[0]) * f, A[1] + (B[1] - A[1]) * f)); }
  const geo = new THREE.LatheGeometry(pts, 30), p = geo.attributes.position, fase = Math.random() * 6;
  for (let i = 0; i < p.count; i++) { const y = p.getY(i), an = Math.atan2(p.getX(i), p.getZ(i)), k = 1 - y / 1.52, o = 1 + (Math.sin(an * 7 + fase) * 0.07 + Math.sin(an * 13 + y * 3) * 0.035) * k; p.setX(i, p.getX(i) * o); p.setZ(i, p.getZ(i) * o * 0.92); }
  geo.computeVertexNormals(); const base = p.array.slice();
  const manto = new THREE.Mesh(geo, mat); manto.renderOrder = 7;
  const pivote = new THREE.Group(); pivote.position.set(0, 1.44, -0.12);   // la capucha cae hacia atrás desde la nuca
  const gc = new THREE.LatheGeometry(PERFIL_CAPUCHA.map(q => new THREE.Vector2(q[0], q[1])), 18), pc = gc.attributes.position;
  for (let i = 0; i < pc.count; i++) { const y = pc.getY(i); if (y > 0.3) { pc.setZ(i, pc.getZ(i) - (y - 0.3) * (y - 0.3) * 1.5); pc.setY(i, y - (y - 0.3) * 0.18); } if (pc.getZ(i) > 0.12 && y < 0.4) pc.setZ(i, pc.getZ(i) + 0.05); }   // pico caído hacia atrás y visera sobre el rostro
  gc.computeVertexNormals(); const capucha = new THREE.Mesh(gc, mat); capucha.position.set(0, 0, 0.12); capucha.renderOrder = 7; pivote.add(capucha);
  capa.add(manto, pivote);
  // Mangas caídas y tiras sueltas que ondean.
  const cuelgan = [];
  for (const s of [1, -1]) { const g = new THREE.Group(); g.position.set(s * 0.33, 1.3, 0.05); const m = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.24, 0.95, 12, 3, true), mat); m.position.y = -0.44; m.renderOrder = 7; g.add(m); g.userData = { rz: s * 0.2, rx: -0.3, f: Math.random() * 6, amp: 0.05 }; capa.add(g); cuelgan.push(g); }
  for (let i = 0; i < 7; i++) { const an = Math.PI + (i / 6 - 0.5) * 2.6, g = new THREE.Group(), r = 0.5, largo = 0.7 + Math.random() * 0.5;
    g.position.set(Math.sin(an) * r, 0.62 + Math.random() * 0.3, Math.cos(an) * r * 0.92); g.rotation.y = an;
    const geoT = new THREE.PlaneGeometry(0.2, largo, 1, 4); geoT.translate(0, -largo / 2, 0); const m = new THREE.Mesh(geoT, mat); m.renderOrder = 7; g.add(m);
    g.userData = { tira: m, rx: 0.2, f: Math.random() * 6, amp: 0.16 }; capa.add(g); cuelgan.push(g); }
  if (!translucida) {
    const hueco = new THREE.Mesh(geoHueco, new THREE.MeshBasicMaterial({ color: 0x030208, transparent: true }));
    hueco.scale.set(0.95, 1.3, 1); hueco.position.set(0, 0.26, 0.37); hueco.rotation.x = -0.12; hueco.renderOrder = 8; pivote.add(hueco);
    capa.userData.hueco = hueco;
  }
  /** El paño respira: el bajo ondea, y al andar se queda atrás como si flotara. */
  const ondear = (t, w = 0) => {
    for (let i = 0; i < p.count; i++) { const j = i * 3, y = base[j + 1], k = Math.max(0, 1 - y / 1.1), an = Math.atan2(base[j], base[j + 2]);
      const o = Math.sin(t * 1.5 + an * 3 + y * 4 + fase) * 0.05 * k * k + Math.sin(t * 2.3 + an * 5) * 0.02 * k;
      p.setXYZ(i, base[j] * (1 + o), y, base[j + 2] * (1 + o) - w * 0.2 * k * k); }
    p.needsUpdate = true; geo.computeVertexNormals();
    for (const g of cuelgan) { const d = g.userData; if (d.tira) d.tira.rotation.x = d.rx + Math.sin(t * 1.7 + d.f) * d.amp + w * 0.5; else g.rotation.set(d.rx + Math.sin(t * 1.3 + d.f) * d.amp - w * 0.15, 0, d.rz + Math.sin(t * 1.1 + d.f) * 0.03); }
  };
  ondear(0);
  Object.assign(capa.userData, { manto, pivote, mat, translucida, ondear });
  return capa;
}
function sombra(radio) {
  if (!texSombra) {
    const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(0,0,10,.6)'); g.addColorStop(1, 'rgba(0,0,10,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); texSombra = new THREE.CanvasTexture(c);
  }
  const m = new THREE.Mesh(new THREE.PlaneGeometry(radio * 2, radio * 2), new THREE.MeshBasicMaterial({ map: texSombra, transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = 0.025; m.renderOrder = 2; return m;
}

/**
 * Actor en escena. capa: null (a cara descubierta) | 'opaca' (carta que el
 * espectador no puede ver: sin modelo dentro) | 'translucida' (carta que sí
 * puede ver: se ve al personaje a través de la túnica).
 */
export function crearActor(nombre, pos, o = {}) {
  const { capa = null, rumbo = 0 } = o;
  const a = new THREE.Group(); a.position.copy(pos); a.rotation.y = rumbo;
  const cuerpo = new THREE.Group(); a.add(cuerpo);
  const som = sombra(nombre && INFO[nombre]?.gema ? 1.6 : 0.6); a.add(som);
  a.userData = { nombre: null, cuerpo, modelo: null, capa: null, sombra: som, f0: Math.random() * 6, fase: 0, andando: 0, andandoObj: 0, cadencia: 7,
    rumbo, pose: 'reposo', P: { ...POSES.reposo }, rapidez: 7, eleva: 0, elevaObj: 0, vuelo: 0, libre: false };
  if (capa !== 'opaca') ponerModelo(a, nombre, !!capa);
  if (capa) { const c = crearCapa(capa === 'translucida'); cuerpo.add(c); a.userData.capa = c; }
  (o.padre ?? mundo.escena).add(a);
  // En el Escenario de la partida los actores viven mucho: `fijo` los anima
  // siempre (no se borran al cambiar de escena) y quitarActor() los da de baja.
  const fn = (dt, t) => animar(a, dt, t);
  a.userData.parar = o.fijo ? siempre(fn) : cadaFrame(fn);
  return a;
}
function ponerModelo(a, nombre, bajoCapa) {
  const u = a.userData, m = construirModelo(nombre);
  if (bajoCapa) m.raiz.scale.multiplyScalar(0.9);
  u.cuerpo.add(m.raiz); u.modelo = m; u.nombre = nombre = m.nombre;
  u.pose = bajoCapa ? 'recogido' : (INFO[nombre]?.pose ?? 'reposo'); Object.assign(u.P, POSES[u.pose]);
  u.vuelo = bajoCapa ? 0 : (INFO[nombre]?.vuela ?? 0);
  return m;
}
export function quitarActor(a) { a?.userData?.parar?.(); a?.parent?.remove(a); }
export const poseBase = a => INFO[a.userData.nombre]?.pose ?? 'reposo';
/** Cambia la pose (los ángulos se alcanzan suavemente). */
export function posar(a, nombre, rapidez = 7) { a.userData.pose = nombre ?? poseBase(a); a.userData.rapidez = rapidez; }
export function mirar(a, punto) { a.userData.rumbo = Math.atan2(punto.x - a.position.x, punto.z - a.position.z); }

const _v = new THREE.Vector3(), _w = new THREE.Vector3();
function animar(a, dt, t) {
  const u = a.userData, m = u.modelo;
  // Giro suave hacia el rumbo.
  let d = u.rumbo - a.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); a.rotation.y += d * Math.min(1, dt * 7);
  u.andando += (u.andandoObj - u.andando) * Math.min(1, dt * 8);
  u.eleva += (u.elevaObj - u.eleva) * Math.min(1, dt * 5);
  const w = u.andando, antes = Math.sin(u.fase);
  if (w > 0.02) u.fase += dt * u.cadencia;
  const sw = Math.sin(u.fase), cw = Math.cos(u.fase), resp = Math.sin(t * 1.7 + u.f0);
  if (w > 0.5 && !u.mudo && !u.vuelo && antes * sw < 0) S.paso();
  if (!u.libre) u.cuerpo.position.y = u.vuelo + u.eleva + (u.vuelo ? Math.sin(t * 2.4 + u.f0) * 0.06 : 0);
  if (u.capa) { u.capa.rotation.z = sw * 0.02 * w; u.capa.scale.y = 1 + resp * 0.008; u.capa.userData.ondear(t + u.f0, w); if (!u.modelo && !u.libre) u.cuerpo.position.y += 0.03 + Math.sin(t * 1.2 + u.f0) * 0.03; }
  if (!m) return;
  const A = m.art, P = u.P, T = POSES[u.pose] ?? POSES.reposo, k = Math.min(1, dt * u.rapidez);
  for (const c in T) P[c] += (T[c] - P[c]) * k;
  if (m.tipo === 'lamina') {   // ilustración recortada: de frente a la cámara; solo se balancea, se estira y brilla
    const c = mundo.camara.position; m.raiz.rotation.y = Math.atan2(c.x - a.position.x, c.z - a.position.z) - a.rotation.y;
    u.gesto = (u.gesto ?? 0) + ((u.pose !== poseBase(a) ? 1 : 0) - (u.gesto ?? 0)) * Math.min(1, dt * 6);
    m.raiz.position.y = Math.abs(sw) * 0.05 * w; m.raiz.rotation.z = sw * 0.035 * w + resp * 0.006;
    m.raiz.scale.set(1 - 0.04 * u.gesto, 1 + 0.06 * u.gesto + resp * 0.008, 1);
  } else if (m.tipo === 'humano' || m.tipo === 'criatura') {
    const bal = sw * 0.34 * w * (1 - P.firme), lento = Math.sin(t * 0.9 + u.f0 * 2);
    // Hombro, codo y muñeca: el codo acompaña el braceo y la muñeca nunca queda rígida.
    A.brazoI.rotation.set(P.bIx - bal, 0, P.bIz + resp * 0.025); A.codoI.rotation.x = P.cI - (0.22 + Math.max(0, -sw) * 0.5) * w * (1 - P.firme) + resp * 0.03;
    A.brazoD.rotation.set(P.bDx + bal, 0, P.bDz - resp * 0.025); A.codoD.rotation.x = P.cD - (0.22 + Math.max(0, sw) * 0.5) * w * (1 - P.firme) - resp * 0.03;
    if (A.munecaI) { A.munecaI.rotation.set(-0.12 + lento * 0.09 + P.cI * 0.12, 0, 0.1 + resp * 0.05); A.munecaD.rotation.set(-0.12 - lento * 0.09 + P.cD * 0.12, 0, -0.1 - resp * 0.05);
      A.dedosI.rotation.x = -0.35 + Math.sin(t * 1.3 + u.f0) * 0.14; A.dedosD.rotation.x = -0.35 + Math.sin(t * 1.1 + u.f0 + 2) * 0.14; }
    A.cabeza.rotation.set(P.cabx + resp * 0.014, P.caby + lento * 0.035 * (1 - w), lento * 0.012);
    A.torso.rotation.set(P.torx + resp * 0.01 + 0.03 * w, P.tory + sw * 0.07 * w, m.tipo === 'criatura' ? Math.sin(t * 0.8) * 0.04 : -sw * 0.012 * w);
    if (m.tipo === 'humano') {
      A.cadera.position.y = 0.88 + Math.abs(cw) * 0.03 * w + resp * 0.004 - 0.012 * (1 - w);
      A.cadera.rotation.set(0, -sw * 0.06 * w, lento * 0.012 * (1 - w));
      if (A.piernaI) {   // cadera, rodilla y tobillo: zancada con flexión y apoyo de talón
        const quieto = (1 - w) * 0.05;
        A.piernaI.rotation.x = -sw * 0.52 * w - quieto; A.piernaD.rotation.x = sw * 0.52 * w - quieto;
        A.rodillaI.rotation.x = (Math.max(0, cw) * 0.95 + 0.08) * w + quieto * 2; A.rodillaD.rotation.x = (Math.max(0, -cw) * 0.95 + 0.08) * w + quieto * 2;
        A.tobilloI.rotation.x = -(A.piernaI.rotation.x + A.rodillaI.rotation.x) * 0.75 + Math.max(0, cw) * 0.35 * w;
        A.tobilloD.rotation.x = -(A.piernaD.rotation.x + A.rodillaD.rotation.x) * 0.75 + Math.max(0, -cw) * 0.35 * w;
      }
      if (A.falda) { A.falda.rotation.x = sw * 0.05 * w + (u.vuelo ? Math.sin(t * 1.3 + u.f0) * 0.05 : 0); A.falda.rotation.z = cw * 0.03 * w + (u.vuelo ? Math.sin(t * 1.7) * 0.03 : 0); }
      if (A.lanza && !u.lanzaLibre) A.lanza.rotation.x = -(A.brazoD.rotation.x + A.codoD.rotation.x);
      if (A.libro) A.libro.rotation.x = -(A.brazoI.rotation.x + A.codoI.rotation.x) + 0.25;
    } else if (A.halo) A.halo.rotation.z = t * 0.3;
  } else if (m.tipo === 'cuadrupedo') {
    A.patas.forEach((p, i) => { const f = u.fase + (i === 0 || i === 3 ? 0 : Math.PI); p.rotation.x = Math.sin(f) * 0.55 * w; if (A.rodillas) A.rodillas[i].rotation.x = (i < 2 ? -1 : 1) * (Math.max(0, Math.cos(f)) * 0.9 * w + 0.06); });
    A.torso.position.y += 0; A.torso.rotation.x = Math.sin(u.fase * 2) * 0.03 * w + (u.inclina ?? 0);
    A.cola.rotation.z = Math.sin(t * (u.alegre ? 16 : 5) + u.f0) * (u.alegre ? 0.7 : 0.25);
    A.cabeza.rotation.set(resp * 0.04 + (u.cabx ?? 0), Math.sin(t * 0.7 + u.f0) * 0.15, Math.sin(t * 1.1 + u.f0) * 0.06);
    A.orejas?.forEach((o, i) => { o.rotation.x = Math.sin(t * 3 + i) * 0.08; });
  } else if (m.tipo === 'ave') {
    const bat = u.vuelo || w > 0.1 ? 1 : 0.15;
    A.alas.forEach((al, i) => { al.rotation.z = (i ? -1 : 1) * (0.15 + Math.sin(t * (bat === 1 ? 11 : 2)) * 0.55 * bat); });
    A.cabeza.rotation.y = Math.sin(t * 0.9 + u.f0) * 0.35; A.cabeza.rotation.z = Math.sin(t * 0.5) * 0.1;
  }
  // Telas que ondean (capas, cintas).
  for (const tl of A.telas) {
    const d = tl.userData.tela, p = tl.geometry.attributes.position, b = d.base;
    for (let i = 0; i < p.count; i++) {
      const v = -b[i * 3 + 1] / d.largo, o = Math.sin(t * d.vel + v * 4 + d.fase + b[i * 3] * 3);
      p.setXYZ(i, b[i * 3] + Math.cos(t * d.vel * 0.7 + v * 3 + d.fase) * d.amp * 0.4 * v, b[i * 3 + 1], b[i * 3 + 2] + o * d.amp * v - v * v * d.empuje * w);
    }
    p.needsUpdate = true; if (m.tipo !== 'criatura') tl.geometry.computeVertexNormals();
  }
  // Objetos que flotan junto a las manos (orbes, llama, pergaminos…).
  if (A.flotantes.length) {
    m.raiz.updateWorldMatrix(true, true);
    for (const f of A.flotantes) {
      const an = t * f.vel + f.fase;
      if (f.ancla === 'arco') { A.cabeza.getWorldPosition(_v); m.raiz.worldToLocal(_v); const th = ((f.fase + t * f.vel * 0.3) % 1) * Math.PI; f.obj.position.set(_v.x + Math.cos(th) * 0.5, _v.y + 0.12 + Math.sin(th) * 0.42, _v.z); continue; }
      if (f.ancla === 'manos') { A.manoI.getWorldPosition(_v); A.manoD.getWorldPosition(_w); _v.lerp(_w, 0.5); }
      else (A[f.ancla] ?? A.torso).getWorldPosition(_v);
      m.raiz.worldToLocal(_v);
      f.obj.position.set(_v.x + Math.cos(an) * f.radio, _v.y + f.y + Math.sin(an * 1.3) * f.sube, _v.z + Math.sin(an) * f.radio);
      if (f.obj.userData.gira) f.obj.rotation.set(an * f.obj.userData.gira, an, an * 0.5);
    }
  }
  // Aura mágica propia (humo del Metamorfo, llama del Cronista…).
  const inf = INFO[u.nombre];
  if (inf?.aura && !u.capa && Math.random() < inf.aura * dt * 14) chispas(mano(a, Math.random() < 0.5 ? 0 : 1), { n: 1, color: inf.color, color2: inf.color2, vel: 0.08, dir: V(0, 0.35, 0), vida: 1.3, tam: 0.1, giro: 3, turb: 1.4 });
}

/** Posición en el mundo de la mano i del personaje (de donde sale su magia). */
export function mano(a, i = 0) {
  const u = a.userData, m = u.modelo, inf = INFO[u.nombre];
  if (!m) return a.position.clone().add(V(0, 1.2, 0));
  if (m.tipo === 'lamina') { const c = mundo.camara.position, an = Math.atan2(c.x - a.position.x, c.z - a.position.z), dx = (m.manoUV[0] - 0.5) * m.ancho;
    return V(a.position.x + Math.cos(an) * dx, a.position.y + u.cuerpo.position.y + m.manoUV[1] * m.alto, a.position.z - Math.sin(an) * dx); }
  const lados = inf?.manos ?? []; const A = m.art;
  const obj = lados.length ? A['mano' + lados[i % lados.length]] : A.cabeza;
  const p = new THREE.Vector3(); obj.getWorldPosition(p); if (lados.length) p.y -= 0.02; return p;
}
export const altura = a => (a.userData.modelo?.alto ?? 1.9);
export const cabeza = a => a.position.clone().add(V(0, altura(a) + 0.3 + a.userData.cuerpo.position.y, 0));
export const pecho = a => a.position.clone().add(V(0, altura(a) * 0.62 + a.userData.cuerpo.position.y, 0));

export function materialesDe(a) { const s = new Set(); a.traverse(o => { if (o.material && o !== a.userData.sombra) s.add(o.material); }); return [...s].map(m => [m, m.opacity, m.transparent, m.depthWrite]); }
/** Opacidad global de un actor (0..1), para aparecer, desvanecerse o ser un eco del pasado. */
export function opacidad(a, k, mats = materialesDe(a)) {
  for (const [m, op, tr, dw] of mats) { m.opacity = op * k; m.transparent = k < 1 ? true : tr; m.depthWrite = k < 0.6 ? false : dw; }
  a.userData.sombra.material.opacity = k;
}
export function aparecer(a, dur = 0.6) { const ms = materialesDe(a); opacidad(a, 0, ms); return tw(dur, k => opacidad(a, k, ms), sale); }
export function desvanecer(a, dur = 0.6) { const ms = materialesDe(a); return tw(dur, k => opacidad(a, 1 - k, ms)).then(() => quitarActor(a)); }

/**
 * Caminar con porte majestuoso: avance lento y continuo, zancada larga,
 * espalda recta y la capa ondeando detrás. `enMarcha(k)` permite encadenar
 * cosas por el camino (quitarse el manto, por ejemplo).
 */
export async function caminar(a, destino, o = {}) {
  const u = a.userData, de = a.position.clone();
  const dist = de.distanceTo(destino), vel = o.vel ?? 1.05, dur = o.dur ?? Math.max(0.9, dist / vel);
  u.rumbo = Math.atan2(destino.x - de.x, destino.z - de.z);
  u.andandoObj = 1; u.cadencia = o.cadencia ?? 5.6 * (dist / dur) / 1.05 + 1.2; u.mudo = !!o.mudo;
  let avisado = false;
  await tw(dur, (k, kl) => { a.position.lerpVectors(de, destino, k); if (!avisado && kl > 0.86) { avisado = true; u.andandoObj = 0; } o.enMarcha?.(kl); }, o.ease ?? (k => k < 0.12 ? k * k / 0.24 : k > 0.88 ? 1 - (1 - k) * (1 - k) / 0.24 : (k - 0.06) / 0.88));
  u.andandoObj = 0; u.rumbo = o.alFinal ?? 0;
}

/**
 * Quitarse capucha y manto (se puede lanzar mientras camina): la capucha cae
 * hacia atrás, el manto resbala hasta el suelo y se deshace en volutas de humo.
 * Si la capa era opaca, `nombre` es el personaje que queda al descubierto.
 */
export async function quitarCapa(a, nombre) {
  const u = a.userData, capa = u.capa; if (!capa) return;
  const { pivote, mat } = capa.userData; let ms = null;
  if (!u.modelo) { ponerModelo(a, nombre, true); ms = materialesDe(a).filter(x => x[0] !== mat && x[0] !== capa.userData.hueco?.material); for (const x of ms) { x[0].opacity = 0; x[0].transparent = true; } }
  const raiz = u.modelo.raiz, e0 = raiz.scale.x;
  u.capa = null; S.manto();
  const t0 = mundo.tiempo, vivo = cadaFrame((dt, t) => capa.userData.ondear(t + u.f0, u.andando));
  await tw(0.55, k => { pivote.rotation.x = -2.1 * k; pivote.scale.setScalar(1 - 0.3 * k); if (ms) for (const [m, op] of ms) m.opacity = op * k; if (capa.userData.hueco) capa.userData.hueco.material.opacity = 1 - k; });
  if (ms) for (const [m, op, tr] of ms) { m.opacity = op; m.transparent = tr; }
  u.pose = poseBase(a); u.rapidez = 4; u.vuelo = INFO[u.nombre]?.vuela ?? 0;
  // El manto se evapora de abajo arriba: el paño se deshace en humo fino que sube arremolinándose.
  S.humo(); const tras = capa.userData.translucida, p = new THREE.Vector3(), color = tras ? 0x8a80d8 : 0x4a4468;
  const radio = y => { const q = Math.min(0.999, y / 1.52) * (PERFIL_MANTO.length - 1), n = Math.floor(q); return PERFIL_MANTO[n][0] + (PERFIL_MANTO[n + 1][0] - PERFIL_MANTO[n][0]) * (q - n); };
  return tw(1.7, (k, kl) => {
    if (tras) mat.opacity = 0.3 * (1 - kl); else mat.alphaTest = 0.1 + 0.92 * kl;
    raiz.scale.setScalar(mezcla(e0, e0 / 0.9, Math.min(1, kl * 2)));
    capa.getWorldPosition(p); const y = Math.min(1.5, kl * 1.75), r = radio(y);
    for (let i = 0; i < 5; i++) { const an = Math.random() * 6.283; humo(V(p.x + Math.sin(an) * r, p.y + y + Math.random() * 0.12, p.z + Math.cos(an) * r), { n: 0.4, color, radio: 0.04, tam: 0.3, vida: 1.5, sube: 0.5, vel: 0.12, alfa: 0.55, turb: 1.5 }); }
    if (Math.random() < 0.7) { const an = Math.random() * 6.283; chispas(V(p.x + Math.sin(an) * r, p.y + y, p.z + Math.cos(an) * r), { n: 0.34, color: 0xb0a8ff, color2: 0x6a60c0, vel: 0.1, dir: V(0, 0.5, 0), vida: 1.4, tam: 0.07, turb: 1.6 }); }
  }, lineal).finally(() => { vivo(); capa.parent?.remove(capa); });
}

/** La túnica opaca se vuelve translúcida: ahora el espectador ve quién hay dentro. */
export async function aclararCapa(a, nombre) {
  const u = a.userData, capa = u.capa; if (!capa || capa.userData.translucida) return;
  const mat = capa.userData.mat;
  ponerModelo(a, nombre, true);
  const ms = materialesDe(a).filter(x => x[0] !== mat && x[0] !== capa.userData.hueco.material);
  mat.depthWrite = false; mat.transparent = true; mat.alphaTest = 0; mat.needsUpdate = true;
  const c0 = mat.color.clone(), c1 = new THREE.Color(0x9a90f0);
  await tw(1.0, k => { mat.opacity = mezcla(1, 0.3, k); mat.color.lerpColors(c0, c1, k); mat.emissive.setHex(0x2a2470); for (const [m, op, tr] of ms) { m.opacity = op * k; m.transparent = k < 1 ? true : tr; } capa.userData.hueco.material.opacity = 1 - k; });
  capa.userData.translucida = true;
}
/** Al revés: la túnica se cierra y deja de verse quién hay dentro (se retira el modelo). */
export async function opacarCapa(a) {
  const u = a.userData, capa = u.capa; if (!capa || !capa.userData.translucida) return;
  const mat = capa.userData.mat, c0 = mat.color.clone(), c1 = new THREE.Color(0x2b2740);
  const ms = materialesDe(a).filter(x => x[0] !== mat);
  await tw(0.9, k => { mat.opacity = mezcla(0.3, 1, k); mat.color.lerpColors(c0, c1, k); for (const [m, op] of ms) { m.opacity = op * (1 - k); m.transparent = true; } });
  mat.emissive.setHex(0x08070f); mat.depthWrite = true; mat.transparent = false; mat.alphaTest = 0.1; mat.needsUpdate = true;
  u.cuerpo.remove(u.modelo.raiz); u.modelo = null; u.nombre = null; capa.userData.translucida = false;
}

/**
 * Gesto de conjuro: alza los brazos reuniendo magia en las manos, se eleva
 * un palmo y lanza. Devuelve el punto desde el que sale el hechizo.
 */
export async function conjurar(a, o = {}) {
  const u = a.userData, inf = INFO[u.nombre] ?? {};
  posar(a, o.pose ?? 'alzar', 5); u.elevaObj = o.eleva ?? 0.14;
  await tw(o.dur ?? 1.0, () => {
    for (let i = 0; i < Math.max(1, inf.manos?.length ?? 1); i++) { const pm = mano(a, i); absorber(pm, { n: 3, color: o.color ?? inf.color, color2: inf.color2 }); if (Math.random() < 0.5) chispas(pm, { n: 1, color: o.color ?? inf.color, color2: inf.color2, vel: 0.15, dir: V(0, 0.3, 0), vida: 0.7, tam: 0.1, giro: 4 }); }
  });
  posar(a, o.lanza ?? 'lanzar', 16); u.elevaObj = 0;
  await tw(0.18, null);
  const p = mano(a, 0);
  tw(0.9, null).then(() => posar(a, null, 5), () => {});
  return p;
}

/** Saltito (alegría, sorpresa…), con voltereta opcional. */
export async function saltar(a, alto = 0.3, dur = 0.45, giro = 0) {
  const u = a.userData, c = u.cuerpo; u.libre = true; const y0 = u.vuelo;
  await tw(dur, (k, kl) => { c.position.y = y0 + Math.sin(kl * Math.PI) * alto; c.rotation.z = giro * kl; }, lineal);
  c.position.y = y0; c.rotation.z = 0; u.libre = false;
}

/** Transformación del Metamorfo: funde su modelo con el del personaje imitado. */
export async function transformar(a, nombre, alMedio, alCrear) {
  const u = a.userData, viejo = u.modelo, cuerpo = u.cuerpo;
  const msV = []; viejo.raiz.traverse(o => { if (o.material) msV.push(o.material); });
  const nuevo = construirModelo(nombre); alCrear?.(nuevo); cuerpo.add(nuevo.raiz);
  const msN = []; nuevo.raiz.traverse(o => { if (o.material && !msN.includes(o.material)) msN.push(o.material); });
  const ops = msN.map(m => [m, m.opacity, m.transparent]);
  for (const m of msN) { m.transparent = true; m.opacity = 0; }
  // Remolino: gira cada vez más rápido, se estiliza como una peonza y frena ya con el aspecto nuevo.
  await tw(2.1, (k, kl) => {
    const giro = kl < 0.5 ? 2 * kl * kl : 1 - 2 * (1 - kl) * (1 - kl), f = Math.sin(kl * Math.PI);
    cuerpo.rotation.y = giro * Math.PI * 2 * 5; cuerpo.scale.set(1 - 0.3 * f, 1 + 0.12 * f, 1 - 0.3 * f);
    for (const m of msV) { m.transparent = true; m.opacity = Math.max(0, Math.min(1, 1.9 - kl * 3.2)); }
    for (const [m, op] of ops) m.opacity = op * Math.min(1, Math.max(0, kl * 3.2 - 1.3));
    alMedio?.(kl);
  }, lineal);
  cuerpo.rotation.y = 0;
  cuerpo.remove(viejo.raiz); cuerpo.scale.set(1, 1, 1);
  for (const [m, op, tr] of ops) { m.opacity = op; m.transparent = tr; }
  u.modelo = nuevo; u.pose = INFO[nombre]?.pose ?? 'reposo';   // u.nombre sigue siendo quien es de verdad
  return nuevo;
}
