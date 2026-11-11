// Actores de la maqueta: dan vida a los modelos 3D de modelos.js (caminar,
// respirar, gestos de conjuro, capas que ondean) y gestionan la túnica con
// capucha de las cartas de la mano. Regla de oro que heredará la fase 2: un
// encapuchado OPACO no lleva ningún modelo dentro (el nombre del personaje
// ni siquiera llega aquí); el modelo solo se crea cuando la carta se revela.
import { THREE, mundo, tw, cadaFrame, V, suave, sale, entra, lineal, mezcla } from './mundo.js';
import { construirModelo } from './modelos.js';
import { humo, chispas } from './efectos.js';
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
  'Ocultista':    { color: 0x4a9cff, color2: 0x9ad8ff, manos: ['D', 'I'], pose: 'juntas', aura: 0.6 },
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
  reverencia: pose([0.1, 0.5, -0.3], [-0.6, -0.2, -1.6], { torx: 0.55, cabx: 0.25, firme: 1 }),
};

// ---- Túnica con capucha (volumen 3D de revolución, pocos polígonos) ----
const PERFIL_MANTO = [[0.62, 0], [0.58, 0.25], [0.49, 0.8], [0.42, 1.2], [0.35, 1.4], [0.24, 1.5]];
const PERFIL_CAPUCHA = [[0.25, 0], [0.33, 0.12], [0.34, 0.3], [0.27, 0.46], [0.12, 0.56], [0, 0.58]];
let geoManto, geoCapucha, geoHueco, texSombra;
function crearCapa(translucida) {
  geoManto ??= new THREE.LatheGeometry(PERFIL_MANTO.map(p => new THREE.Vector2(p[0], p[1])), 11);
  geoCapucha ??= new THREE.LatheGeometry(PERFIL_CAPUCHA.map(p => new THREE.Vector2(p[0], p[1])), 11);
  geoHueco ??= new THREE.CircleGeometry(0.2, 12);
  const mat = new THREE.MeshLambertMaterial(translucida
    ? { color: 0x9a90f0, emissive: 0x2a2470, transparent: true, opacity: 0.3, depthWrite: false, flatShading: true, side: THREE.DoubleSide }
    : { color: 0x2c2556, emissive: 0x0d0a22, transparent: true, opacity: 1, flatShading: true });
  const capa = new THREE.Group();
  const manto = new THREE.Mesh(geoManto, mat); manto.renderOrder = 7;
  const pivote = new THREE.Group(); pivote.position.set(0, 1.44, -0.12);   // la capucha cae hacia atrás desde la nuca
  const capucha = new THREE.Mesh(geoCapucha, mat); capucha.position.set(0, 0, 0.12); capucha.renderOrder = 7; pivote.add(capucha);
  capa.add(manto, pivote);
  if (!translucida) {
    const hueco = new THREE.Mesh(geoHueco, new THREE.MeshBasicMaterial({ color: 0x05040c, transparent: true }));
    hueco.scale.set(0.95, 1.25, 1); hueco.position.set(0, 0.3, 0.385); hueco.rotation.x = -0.12; hueco.renderOrder = 8; pivote.add(hueco);
    capa.userData.hueco = hueco;
  }
  Object.assign(capa.userData, { manto, pivote, mat, translucida });
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
export function crearActor(nombre, pos, { capa = null, rumbo = 0 } = {}) {
  const a = new THREE.Group(); a.position.copy(pos); a.rotation.y = rumbo;
  const cuerpo = new THREE.Group(); a.add(cuerpo);
  const som = sombra(nombre && INFO[nombre]?.gema ? 1.6 : 0.6); a.add(som);
  a.userData = { nombre: null, cuerpo, modelo: null, capa: null, sombra: som, f0: Math.random() * 6, fase: 0, andando: 0, andandoObj: 0, cadencia: 7,
    rumbo, pose: 'reposo', P: { ...POSES.reposo }, rapidez: 7, eleva: 0, elevaObj: 0, vuelo: 0, libre: false };
  if (capa !== 'opaca') ponerModelo(a, nombre, !!capa);
  if (capa) { const c = crearCapa(capa === 'translucida'); cuerpo.add(c); a.userData.capa = c; }
  mundo.escena.add(a);
  cadaFrame((dt, t) => animar(a, dt, t));
  return a;
}
function ponerModelo(a, nombre, bajoCapa) {
  const u = a.userData, m = construirModelo(nombre);
  if (bajoCapa) m.raiz.scale.multiplyScalar(0.9);
  u.cuerpo.add(m.raiz); u.modelo = m; u.nombre = nombre;
  u.pose = bajoCapa ? 'recogido' : (INFO[nombre]?.pose ?? 'reposo'); Object.assign(u.P, POSES[u.pose]);
  u.vuelo = bajoCapa ? 0 : (INFO[nombre]?.vuela ?? 0);
  return m;
}
export function quitarActor(a) { a?.parent?.remove(a); }
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
  if (u.capa) { u.capa.rotation.z = sw * 0.035 * w; u.capa.scale.y = 1 + resp * 0.006 + Math.abs(sw) * 0.012 * w; }
  if (!m) return;
  const A = m.art, P = u.P, T = POSES[u.pose] ?? POSES.reposo, k = Math.min(1, dt * u.rapidez);
  for (const c in T) P[c] += (T[c] - P[c]) * k;
  if (m.tipo === 'humano' || m.tipo === 'criatura') {
    const bal = sw * 0.28 * w * (1 - P.firme);
    A.brazoI.rotation.set(P.bIx - bal, 0, P.bIz + resp * 0.02); A.codoI.rotation.x = P.cI;
    A.brazoD.rotation.set(P.bDx + bal, 0, P.bDz - resp * 0.02); A.codoD.rotation.x = P.cD;
    A.cabeza.rotation.set(P.cabx + resp * 0.012, P.caby, 0);
    A.torso.rotation.set(P.torx + resp * 0.008, P.tory + sw * 0.05 * w, m.tipo === 'criatura' ? Math.sin(t * 0.8) * 0.04 : 0);
    if (m.tipo === 'humano') {
      A.piernaI.rotation.x = -sw * 0.5 * w; A.piernaD.rotation.x = sw * 0.5 * w;
      A.rodillaI.rotation.x = Math.max(0, cw) * 0.8 * w; A.rodillaD.rotation.x = Math.max(0, -cw) * 0.8 * w;
      A.cadera.position.y = 0.88 + Math.abs(cw) * 0.025 * w + resp * 0.004;
      if (A.falda) { A.falda.rotation.x = sw * 0.05 * w; A.falda.rotation.z = cw * 0.03 * w; }
      if (A.lanza && !u.lanzaLibre) A.lanza.rotation.x = -(A.brazoD.rotation.x + A.codoD.rotation.x);
      if (A.libro) A.libro.rotation.x = -(A.brazoI.rotation.x + A.codoI.rotation.x) + 0.25;
    } else if (A.halo) A.halo.rotation.z = t * 0.3;
  } else if (m.tipo === 'cuadrupedo') {
    A.patas.forEach((p, i) => { p.rotation.x = Math.sin(u.fase + (i === 0 || i === 3 ? 0 : Math.PI)) * 0.55 * w; });
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
  if (inf?.aura && !u.capa && Math.random() < inf.aura * dt * 14) chispas(mano(a, Math.random() < 0.5 ? 0 : 1), { n: 1, color: inf.color, color2: inf.color2, vel: 0.12, dir: V(0, 0.45, 0), vida: 0.9, tam: 0.13, giro: 3 });
}

/** Posición en el mundo de la mano i del personaje (de donde sale su magia). */
export function mano(a, i = 0) {
  const u = a.userData, m = u.modelo, inf = INFO[u.nombre];
  if (!m) return a.position.clone().add(V(0, 1.2, 0));
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
  await tw(0.55, k => { pivote.rotation.x = -2.1 * k; pivote.scale.setScalar(1 - 0.3 * k); if (ms) for (const [m, op] of ms) m.opacity = op * k; if (capa.userData.hueco) capa.userData.hueco.material.opacity = 1 - k; });
  if (ms) for (const [m, op, tr] of ms) { m.opacity = op; m.transparent = tr; }
  // El manto se queda atrás: pasa a la escena en el punto donde cae.
  const p = new THREE.Vector3(); capa.getWorldPosition(p);
  mundo.escena.add(capa); capa.position.copy(p); capa.position.y = a.position.y; capa.rotation.set(0, a.rotation.y, 0);
  u.pose = poseBase(a); u.rapidez = 4; u.vuelo = INFO[u.nombre]?.vuela ?? 0;
  return tw(0.6, k => { capa.scale.set(1 + 0.35 * k, 1 - 0.93 * k, 1 + 0.35 * k); raiz.scale.setScalar(mezcla(e0, e0 / 0.9, k)); }, entra)
    .then(() => { S.humo(); humo(capa.position, { n: 22, color: 0x8a80d8, radio: 0.45 }); chispas(capa.position, { n: 10, color: 0xb0a8ff, vel: 0.5, dir: V(0, 0.8, 0), vida: 1.2 }); mat.transparent = true; mat.depthWrite = false;
      return tw(1.1, k => { mat.opacity = (capa.userData.translucida ? 0.3 : 1) * (1 - k); capa.scale.x = capa.scale.z = 1.35 + 0.25 * k; }); })
    .then(() => capa.parent?.remove(capa));
}

/** La túnica opaca se vuelve translúcida: ahora el espectador ve quién hay dentro. */
export async function aclararCapa(a, nombre) {
  const u = a.userData, capa = u.capa; if (!capa || capa.userData.translucida) return;
  const mat = capa.userData.mat;
  ponerModelo(a, nombre, true);
  const ms = materialesDe(a).filter(x => x[0] !== mat && x[0] !== capa.userData.hueco.material);
  mat.depthWrite = false; mat.side = THREE.DoubleSide;
  const c0 = mat.color.clone(), c1 = new THREE.Color(0x9a90f0);
  await tw(1.0, k => { mat.opacity = mezcla(1, 0.3, k); mat.color.lerpColors(c0, c1, k); mat.emissive.setHex(0x2a2470); for (const [m, op, tr] of ms) { m.opacity = op * k; m.transparent = k < 1 ? true : tr; } capa.userData.hueco.material.opacity = 1 - k; });
  capa.userData.translucida = true;
}
/** Al revés: la túnica se cierra y deja de verse quién hay dentro (se retira el modelo). */
export async function opacarCapa(a) {
  const u = a.userData, capa = u.capa; if (!capa || !capa.userData.translucida) return;
  const mat = capa.userData.mat, c0 = mat.color.clone(), c1 = new THREE.Color(0x2c2556);
  const ms = materialesDe(a).filter(x => x[0] !== mat);
  await tw(0.9, k => { mat.opacity = mezcla(0.3, 1, k); mat.color.lerpColors(c0, c1, k); for (const [m, op] of ms) { m.opacity = op * (1 - k); m.transparent = true; } });
  mat.emissive.setHex(0x0d0a22); mat.depthWrite = true; mat.side = THREE.FrontSide;
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
    for (let i = 0; i < Math.max(1, inf.manos?.length ?? 1); i++) if (Math.random() < 0.8) chispas(mano(a, i), { n: 2, color: o.color ?? inf.color, color2: inf.color2, vel: 0.3, dir: V(0, 0.5, 0), vida: 0.7, tam: 0.13, giro: 4 });
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
  await tw(1.3, (k, kl) => {
    const j = 1 + Math.sin(kl * Math.PI * 5) * 0.12 * (1 - kl); cuerpo.scale.set(j, 2 - j, j);
    for (const m of msV) { m.transparent = true; m.opacity = Math.max(0, 1 - k * 1.6); }
    for (const [m, op] of ops) m.opacity = op * Math.min(1, Math.max(0, k * 1.6 - 0.6));
    alMedio?.(kl);
  });
  cuerpo.remove(viejo.raiz); cuerpo.scale.set(1, 1, 1);
  for (const [m, op, tr] of ops) { m.opacity = op; m.transparent = tr; }
  u.modelo = nuevo; u.pose = INFO[nombre]?.pose ?? 'reposo';   // u.nombre sigue siendo quien es de verdad
  return nuevo;
}
