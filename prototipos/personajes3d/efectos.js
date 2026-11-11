// Efectos de la maqueta: partículas (magia y humo), destellos, anillos
// rúnicos, rayos de hechizo y Gemas. Todo procedural, sin recursos externos.
import { THREE, mundo, tw, siempre, arco, V, suave, sale, lineal } from './mundo.js';

const VS = `
attribute float aTam; attribute float aAlfa; attribute vec3 aColor;
uniform float uEscala; varying vec3 vC; varying float vA;
void main(){ vC=aColor; vA=aAlfa; vec4 mv=modelViewMatrix*vec4(position,1.0);
  gl_PointSize=aTam*uEscala/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`;
const FS = `
precision mediump float; varying vec3 vC; varying float vA;
void main(){ float d=length(gl_PointCoord-0.5); float a=smoothstep(0.5,0.0,d);
  gl_FragColor=vec4(vC,a*a*vA); }`;

class Particulas {
  constructor(n, aditivo) {
    this.n = n; this.i = 0;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3);
    this.tam = new Float32Array(n); this.alfa = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.vida = new Float32Array(n); this.max = new Float32Array(n);
    this.t0 = new Float32Array(n); this.grav = new Float32Array(n); this.giro = new Float32Array(n);
    this.crece = new Float32Array(n); this.a0 = new Float32Array(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    g.setAttribute('aTam', new THREE.BufferAttribute(this.tam, 1));
    g.setAttribute('aAlfa', new THREE.BufferAttribute(this.alfa, 1));
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VS, fragmentShader: FS, uniforms: { uEscala: { value: 600 } },
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
    this.giro[i] = o.giro ?? 0; this.crece[i] = o.crece ?? 0; this.a0[i] = o.alfa ?? 1;
  }
  paso(dt) {
    const { pos, vel, vida, max, tam, alfa, t0, grav, giro, crece, a0 } = this;
    for (let i = 0; i < this.n; i++) {
      if (vida[i] <= 0) { if (tam[i] !== 0) { tam[i] = 0; alfa[i] = 0; } continue; }
      vida[i] -= dt; const j = i * 3; const k = 1 - Math.max(0, vida[i]) / max[i];
      if (giro[i]) { const c = Math.cos(giro[i] * dt), s = Math.sin(giro[i] * dt); const vx = vel[j], vz = vel[j + 2]; vel[j] = vx * c - vz * s; vel[j + 2] = vx * s + vz * c; }
      vel[j + 1] -= grav[i] * dt;
      pos[j] += vel[j] * dt; pos[j + 1] += vel[j + 1] * dt; pos[j + 2] += vel[j + 2] * dt;
      tam[i] = t0[i] * (1 + crece[i] * k);
      alfa[i] = a0[i] * Math.min(1, k * 8) * (1 - k) * (1 - k * 0.3);
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
  magia = new Particulas(mundo.calidad === 'alta' ? 1400 : 600, true);
  humoSis = new Particulas(mundo.calidad === 'alta' ? 260 : 120, false);
  mundo.escena.add(magia.malla, humoSis.malla);
  siempre(dt => { magia.paso(dt); humoSis.paso(dt); });
  const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,255,255,.6)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); texBrillo = new THREE.CanvasTexture(c);
}
export const texturaBrillo = () => texBrillo;

/** Chispas de magia. o: { n, color, color2, vel, dir, vida, tam, grav, giro, radio, crece } */
export function chispas(p, o = {}) {
  const n = Math.max(1, Math.round((o.n ?? 12) * factor));
  _c.set(o.color ?? 0xffffff); _c2.set(o.color2 ?? o.color ?? 0xffffff);
  const v = o.vel ?? 1, d = o.dir ?? V(0, 0, 0), r = o.radio ?? 0.05;
  for (let i = 0; i < n; i++) {
    const col = Math.random() < 0.5 ? _c : _c2;
    magia.uno(V(p.x + azar(r), p.y + azar(r), p.z + azar(r)), V(d.x + azar(v), d.y + azar(v), d.z + azar(v)), col,
      (o.vida ?? 0.9) * (0.6 + Math.random() * 0.8), (o.tam ?? 0.16) * (0.6 + Math.random() * 0.8), o);
  }
}
/** Volutas de humo que suben girando. */
export function humo(p, o = {}) {
  const n = Math.max(2, Math.round((o.n ?? 14) * factor));
  _c.set(o.color ?? 0x8f88c8);
  for (let i = 0; i < n; i++) {
    humoSis.uno(V(p.x + azar(o.radio ?? 0.3), p.y + Math.random() * 0.15, p.z + azar(o.radio ?? 0.3)),
      V(azar(o.vel ?? 0.35), 0.35 + Math.random() * (o.sube ?? 0.6), azar(o.vel ?? 0.35)), _c,
      (o.vida ?? 1.6) * (0.7 + Math.random() * 0.6), (o.tam ?? 0.5) * (0.6 + Math.random() * 0.8),
      { giro: azar(2.5), crece: 1.6, alfa: o.alfa ?? 0.55 });
  }
}
/** Anillo de chispas en el suelo (onda). */
export function onda(p, color, radio = 1, n = 28, vel = 1.6) {
  _c.set(color); const m = Math.round(n * factor);
  for (let i = 0; i < m; i++) {
    const a = i / m * Math.PI * 2;
    magia.uno(V(p.x + Math.cos(a) * radio * 0.3, p.y + 0.05, p.z + Math.sin(a) * radio * 0.3), V(Math.cos(a) * vel, 0.1, Math.sin(a) * vel), _c, 0.8, 0.18, {});
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

/** Rayo de hechizo: una luz que viaja en arco de `a` a `b` dejando estela. */
export async function rayo(a, b, color, o = {}) {
  const s = luz(color, o.tam ?? 0.55);
  try {
    await tw(o.dur ?? 0.7, k => {
      const p = arco(a, b, k, o.alto ?? 1.2, o.lado ?? 0); s.position.copy(p);
      chispas(p, { n: 3, color, color2: o.color2 ?? 0xffffff, vel: 0.25, vida: 0.6, tam: 0.13 });
    }, o.ease ?? suave);
  } finally { quitar(s); }
}

/** Círculo rúnico plano en el suelo, aditivo. */
export function anilloRunico(tex, p, color, radio = 1) {
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  m.rotation.x = -Math.PI / 2; m.position.copy(p); m.position.y += 0.03; m.scale.setScalar(radio); m.renderOrder = 12;
  mundo.escena.add(m); return m;
}

const COLORES_GEMA = { azul: 0x4aa8ff, C: 0xffc94a, B: 0xff4a6e, A: 0x9a6bff };
let geoGema;
/** Gema 3D facetada. tipo: 'azul' (valor 1) | 'C' | 'B' | 'A'. */
export function gema(tipo = 'azul', tam = 1) {
  geoGema ??= new THREE.OctahedronGeometry(0.13, 0);
  const col = COLORES_GEMA[tipo] ?? tipo;
  const g = new THREE.Group();
  const m = new THREE.Mesh(geoGema, new THREE.MeshLambertMaterial({ color: col, emissive: col, emissiveIntensity: 0.55, flatShading: true, transparent: true }));
  m.scale.set(1, 1.35, 1); g.add(m);
  const b = new THREE.Sprite(new THREE.SpriteMaterial({ map: texBrillo, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.6 }));
  b.scale.setScalar(0.55); g.add(b);
  g.scale.setScalar(tam); g.userData = { malla: m, brillo: b, color: col };
  mundo.escena.add(g); return g;
}
