// Efectos de la maqueta: partículas (magia y humo), destellos, anillos
// rúnicos, rayos de hechizo y Gemas. Todo procedural, sin recursos externos.
import { THREE, mundo, tw, siempre, arco, V, suave, sale, lineal } from './mundo.js';

const VS = `
attribute float aTam; attribute float aAlfa; attribute vec3 aColor;
uniform float uEscala; varying vec3 vC; varying float vA;
void main(){ vC=aColor; vA=aAlfa; vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=aTam*uEscala/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const FS = `
precision mediump float; varying vec3 vC; varying float vA; uniform float uHalo; uniform float uNucleo;
void main(){ float d=length(gl_PointCoord-0.5); float h=smoothstep(0.5,0.0,d);
  float a=h*h*uHalo+smoothstep(0.2,0.0,d)*uNucleo; gl_FragColor=vec4(vC,min(1.0,a)*vA); }`;

class Particulas {
  constructor(n, aditivo) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.tam = new Float32Array(n); this.alfa = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.vida = new Float32Array(n); this.max = new Float32Array(n);
    this.t0 = new Float32Array(n); this.grav = new Float32Array(n); this.giro = new Float32Array(n);
    this.crece = new Float32Array(n); this.a0 = new Float32Array(n); this.turb = new Float32Array(n); this.roce = new Float32Array(n); this.sem = new Float32Array(n); this.T = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aTam', new THREE.BufferAttribute(this.tam, 1));
    g.setAttribute('aAlfa', new THREE.BufferAttribute(this.alfa, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: { uEscala: { value: 600 }, uHalo: { value: aditivo ? 0.55 : 1 }, uNucleo: { value: aditivo ? 1 : 0 } },
      transparent: true, depthWrite: false, blending: aditivo ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.malla = new THREE.Points(g, this.mat); this.malla.frustumCulled = false; this.malla.renderOrder = aditivo ? 20 : 15;
    this.geo = g;
  }
  uno(p, v, color, vida, tam, o) {
    const i = this.i; this.i = (i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set([color.r, color.g, color.b], i * 3);
    this.vida[i] = this.max[i] = vida; this.t0[i] = tam; this.grav[i] = o.grav ?? 0;
    this.giro[i] = o.giro ?? 0; this.crece[i] = o.crece ?? 0; this.a0[i] = o.alfa ?? 1; this.turb[i] = o.turb ?? 0; this.roce[i] = o.roce ?? 0; this.sem[i] = Math.random() * 6.283;
  }
  paso(dt) {
    const { pos, vel, vida, max, tam, alfa, t0, grav, giro, crece, a0, turb, roce, sem } = this; const T = (this.T += dt);
    for (let i = 0; i < this.n; i++) {
      if (vida[i] <= 0) { if (tam[i] !== 0) { tam[i] = 0; alfa[i] = 0; } continue; }
      vida[i] -= dt; const j = i * 3; const k = 1 - Math.max(0, vida[i]) / max[i];
      if (giro[i]) { const c = Math.cos(giro[i] * dt), s = Math.sin(giro[i] * dt); const vx = vel[j], vz = vel[j + 2]; vel[j] = vx * c - vz * s; vel[j + 2] = vx * s + vz * c; }
      vel[j + 1] -= grav[i] * dt;
      const tb = turb[i] * dt;   // corrientes suaves: la magia y el humo se arremolinan en vez de ir en línea recta
      if (tb) { const px = pos[j] * 1.9, py = pos[j + 1] * 1.9, pz = pos[j + 2] * 1.9, e = sem[i];
        vel[j] += (Math.sin(py * 1.3 + T * 1.1 + e) + Math.cos(pz + T * 0.7)) * tb; vel[j + 1] += Math.sin(pz * 1.1 + T * 0.9 + e * 1.7) * tb * 0.6; vel[j + 2] += (Math.sin(px * 1.2 + T * 1.3 + e * 0.6) + Math.cos(py + T * 0.8)) * tb; }
      if (roce[i]) { const f = Math.max(0, 1 - roce[i] * dt); vel[j] *= f; vel[j + 1] *= f; vel[j + 2] *= f; }
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      tam[i] = t0[i] * (1 + crece[i] * k);
      alfa[i] = a0[i] * Math.min(1, k * 8) * (1 - k) * (1 - k * 0.3) * (turb[i] ? 0.8 + 0.2 * Math.sin(T * 17 + sem[i] * 9) : 1);
    }
    for (const a of ['position', 'aTam', 'aAlfa', 'aColor']) this.geo.attributes[a].needsUpdate = true;
    const r = mundo.renderer, c = mundo.camara;
    this.mat.uniforms.uEscala.value = r.domElement.height * 0.5 / Math.tan(THREE.MathUtils.degToRad(c.fov / 2));
  }
}

let magia, humoSis, factor = 1;
let texBrillo;
const _c = new THREE.Color(), _c2 = new THREE.Color();
const azar = (a = 1) => (Math.random() - 0.5) * 2 * a;

export function crearEfectos() {
  factor = mundo.calidad === 'alta' ? 1 : 0.5;
  magia = new Particulas(mundo.calidad === 'alta' ? 9000 : 3600, true);
  humoSis = new Particulas(mundo.calidad === 'alta' ? 1400 : 600, false);
  mundo.escena.add(magia.malla, humoSis.malla);
  siempre(dt => { magia.paso(dt); humoSis.paso(dt); });
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); texBrillo = new THREE.CanvasTexture(c);
}
export const texturaBrillo = () => texBrillo;

/**
 * Chispas de magia: polvo fino y abundante que se arremolina y se frena solo.
 * o: { n, color, color2, vel, dir, vida, tam, grav, giro, radio, crece, turb, roce }
 */
export function chispas(p, o = {}) {
  const n = Math.max(1, Math.round((o.n ?? 12) * 3 * factor));
  _c.set(o.color ?? 0xffffff); _c2.set(o.color2 ?? o.color ?? 0xffffff);
  const v = o.vel ?? 1, d = o.dir ?? V(0, 0, 0), r = o.radio ?? 0.05, t = (o.tam ?? 0.16) * 0.5;
  const oo = { ...o, turb: o.turb ?? 0.9 + v * 0.5, roce: o.roce ?? 1.1 };
  for (let i = 0; i < n; i++) {
    const col = Math.random() < 0.5 ? _c : _c2, q = Math.random();
    magia.uno(V(p.x + azar(r), p.y + azar(r), p.z + azar(r)), V(d.x + azar(v), d.y + azar(v), d.z + azar(v)), col,
      (o.vida ?? 0.9) * (0.7 + Math.random() * 1.1), t * (0.3 + q * q * q * 1.5), oo);
  }
}
/** Magia que acude a un punto (al cargar un hechizo): motas que nacen alrededor y caen hacia dentro en espiral. */
export function absorber(p, o = {}) {
  const n = Math.max(1, Math.round((o.n ?? 4) * 2 * factor)); _c.set(o.color ?? 0xffffff); _c2.set(o.color2 ?? o.color ?? 0xffffff);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * 6.283, e = azar(1.2), r = (o.radio ?? 0.55) * (0.6 + Math.random() * 0.6), vida = 0.45 + Math.random() * 0.35;
    const x = Math.cos(a) * Math.cos(e) * r, y = Math.sin(e) * r, z = Math.sin(a) * Math.cos(e) * r;
    magia.uno(V(p.x + x, p.y + y, p.z + z), V(-x / vida, -y / vida, -z / vida), Math.random() < 0.5 ? _c : _c2, vida, (o.tam ?? 0.07) * (0.5 + Math.random()), { giro: 3.5 });
  }
}
/** Humo fino que sube arremolinándose y se evapora. */
export function humo(p, o = {}) {
  const n = Math.max(2, Math.round((o.n ?? 14) * 2.6 * factor));
  _c.set(o.color ?? 0x8f88c8);
  for (let i = 0; i < n; i++) {
    humoSis.uno(V(p.x + azar(o.radio ?? 0.3), p.y + Math.random() * (o.alto ?? 0.15), p.z + azar(o.radio ?? 0.3)),
      V(azar(o.vel ?? 0.3), 0.3 + Math.random() * (o.sube ?? 0.6), azar(o.vel ?? 0.3)), _c,
      (o.vida ?? 1.6) * (0.7 + Math.random() * 0.9), (o.tam ?? 0.5) * (0.3 + Math.random() * 0.55),
      { giro: azar(1.6), crece: 2.0, alfa: (o.alfa ?? 0.55) * 0.6, turb: o.turb ?? 1.1, roce: 0.7 });
  }
}
/** Anillo de polvo de luz que se abre a ras de suelo (onda). */
export function onda(p, color, radio = 1, n = 28, vel = 1.6) {
  _c.set(color); const m = Math.round(n * 5 * factor);
  for (let i = 0; i < m; i++) {
    const a = i / m * Math.PI * 2 + azar(0.02), v = vel * (0.75 + Math.random() * 0.4);
    magia.uno(V(p.x + Math.cos(a) * radio * 0.3, p.y + 0.04 + Math.random() * 0.05, p.z + Math.sin(a) * radio * 0.3), V(Math.cos(a) * v, 0.05 + Math.random() * 0.25, Math.sin(a) * v), _c, 0.7 + Math.random() * 0.7, 0.03 + Math.random() * 0.06, { turb: 0.5, roce: 1.3 });
  }
}

/** Destello: sprite luminoso que crece y se apaga. */
export function destello(p, color, tam = 1.2, dur = 0.6) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.position.copy(p); s.renderOrder = 21; mundo.escena.add(s);
  return tw(dur, k => { s.scale.setScalar(tam * (0.3 + k)); s.material.opacity = 1 - k; }, sale)
    .finally(() => { mundo.escena.remove(s); s.material.dispose(); });
}
/** Luz que acompaña a algo (devuelve el sprite; hay que quitarlo con `quitar`). */
export function luz(color, tam = 0.5) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  s.scale.setScalar(tam); s.renderOrder = 21; mundo.escena.add(s); return s;
}
export function quitar(o) { o?.parent?.remove(o); }

/** Rayo de hechizo: una luz que viaja en arco de `a` a `b` dejando una estela de polvo en espiral. */
export async function rayo(a, b, color, o = {}) {
  const s = luz(color, o.tam ?? 0.45); let antes = a.clone(), fase = Math.random() * 6;
  const lado = new THREE.Vector3(), alto = new THREE.Vector3(), dir = new THREE.Vector3();
  try {
    await tw(o.dur ?? 0.7, k => {
      const p = arco(a, b, k, o.alto ?? 1.2, o.lado ?? 0); s.position.copy(p);
      dir.copy(p).sub(antes); const d = dir.length(); if (d > 1e-4) { dir.multiplyScalar(1 / d); lado.set(-dir.z, 0, dir.x).normalize(); alto.crossVectors(dir, lado); }
      const pasos = Math.max(1, Math.min(8, Math.round(d / 0.05)));
      for (let i = 0; i < pasos; i++) { const q = antes.clone().lerp(p, (i + 1) / pasos); fase += 0.55;
        for (const h of [0, Math.PI]) { const an = fase + h, r = 0.085; chispas(V(q.x + (lado.x * Math.cos(an) + alto.x * Math.sin(an)) * r, q.y + (lado.y * Math.cos(an) + alto.y * Math.sin(an)) * r, q.z + (lado.z * Math.cos(an) + alto.z * Math.sin(an)) * r), { n: 0.34, color, color2: o.color2 ?? 0xffffff, vel: 0.05, vida: 0.75, tam: 0.1, radio: 0.01, turb: 0.5 }); }
        chispas(q, { n: 0.34, color: o.color2 ?? 0xffffff, vel: 0.12, vida: 0.4, tam: 0.07, radio: 0.02 }); }
      antes.copy(p);
    }, o.ease ?? suave);
  } finally { quitar(s); }
}

/** Círculo rúnico plano en el suelo, aditivo. */
export function anilloRunico(tex, p, color, radio = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y += 0.03; m.scale.setScalar(radio); m.renderOrder = 12;
  mundo.escena.add(m); return m;
}

const COLORES_GEMA = { azul: 0x4aa8ff, C: 0xffc94a, B: 0xff4a6e, A: 0x9a6bff, '*': 0xb98cff };
// Gemas de Madain: mitad azul, mitad rosa (como el Metamorfo).
const MITADES_MADAIN = [0x3a7bff, 0xff6ec7];
let geoGema, geoGemaMadain;
/** Gema 3D facetada. tipo: 'azul' (valor 1) | 'C' | 'B' | 'A' | '*' (Madain, bicolor). */
export function gema(tipo = 'azul', tam = 1) {
  geoGema ??= new THREE.OctahedronGeometry(0.13, 0);
  const bicolor = tipo === '*';
  if (bicolor && !geoGemaMadain) {
    // Cada cara se pinta según el lado en que cae su centro: izquierda azul, derecha rosa.
    geoGemaMadain = geoGema.clone(); const p = geoGemaMadain.attributes.position, cols = [];
    const [az, ro] = MITADES_MADAIN.map(c => new THREE.Color(c));
    for (let i = 0; i < p.count; i += 3) { const cx = p.getX(i) + p.getX(i + 1) + p.getX(i + 2), c = cx < 0 ? az : ro; for (let k = 0; k < 3; k++) cols.push(c.r, c.g, c.b); }
    geoGemaMadain.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
  }
  const col = COLORES_GEMA[tipo] ?? tipo;
  const g = new THREE.Group();
  const m = new THREE.Mesh(bicolor ? geoGemaMadain : geoGema, new THREE.MeshLambertMaterial({ color: bicolor ? 0xffffff : col, vertexColors: bicolor, emissive: bicolor ? 0x40306a : col, emissiveIntensity: 0.55, flatShading: true, transparent: true }));
  m.scale.set(1, 1.35, 1); g.add(m);
  const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  b.scale.setScalar(0.55); g.add(b);
  g.scale.setScalar(tam); g.userData = { malla: m, brillo: b, color: col };
  mundo.escena.add(g); return g;
}
