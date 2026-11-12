// Piezas de magia que comparten la maqueta (escenas.js) y el Escenario de la
// partida (tablero.js): círculo rúnico, ojo y haz de luz de la Clarividente,
// reloj de arena del Cronomante y orbes de la Estratega. Solo presentación.
import { THREE, mundo, tw, cadaFrame, V, entra, rebote, CANCELADO } from './mundo.js';
import { texturaDisco } from './portales.js';
import { chispas, destello, anilloRunico, quitar, luz } from './efectos.js';

const sin = p => p.catch(e => { if (e !== CANCELADO) console.error(e); });
const vivos = new Set();
function temp(o) { vivos.add(o); return o; }
function fuera(o) { vivos.delete(o); quitar(o); }
/** Retira toda la magia que quedara a medias (cambio de escena, partida nueva…). */
export function limpiarMagia() { for (const o of vivos) quitar(o); vivos.clear(); }

/** Círculo rúnico que aparece girando bajo alguien o sobre un Portal. */
export function runa(p, color, radio = 1, giro = 0.8, puntas = 8) {
  const m = temp(anilloRunico(texturaDisco(puntas), p, color, radio));
  sin(tw(0.5, k => { m.material.opacity = 0.9 * k; }));
  m.userData.giro = giro;   // se puede cambiar en marcha (la runa de la invocación frena)
  const fin = cadaFrame(dt => { m.rotation.z += m.userData.giro * dt; });
  m.userData.apagar = (dur = 0.6) => sin(tw(dur, k => { m.material.opacity = 0.9 * (1 - k); }).then(() => { fin(); fuera(m); }));
  return m;
}

function lienzoTex(t, pintar) { const c = document.createElement('canvas'); c.width = c.height = t; const x = c.getContext('2d'); x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = 'round'; x.shadowColor = '#fff'; x.shadowBlur = t / 50; pintar(x, t); return new THREE.CanvasTexture(c); }
let texOjo, texHaz;

/** Ojo de luz que se abre (Clarividente). */
export function ojoDeLuz(p, color) {
  texOjo ??= lienzoTex(256, (x, t) => { const c = t / 2; x.lineWidth = 5; x.beginPath(); x.moveTo(8, c); x.quadraticCurveTo(c, c - 110, t - 8, c); x.quadraticCurveTo(c, c + 110, 8, c); x.stroke();
    x.lineWidth = 4; x.beginPath(); x.arc(c, c, 44, 0, 7); x.stroke(); x.beginPath(); x.arc(c, c, 16, 0, 7); x.fill();
    x.lineWidth = 2; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; x.beginPath(); x.moveTo(c + Math.cos(a) * 22, c + Math.sin(a) * 22); x.lineTo(c + Math.cos(a) * 40, c + Math.sin(a) * 40); x.stroke(); } });
  const s = temp(new THREE.Sprite(new THREE.SpriteMaterial({ map: texOjo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  s.position.copy(p); s.scale.set(1.7, 0.01, 1); s.renderOrder = 22; mundo.escena.add(s);
  return { s, abrir: () => { sin(destello(p, color, 2.4, 0.7)); return tw(0.7, k => { s.scale.y = 0.01 + 1.69 * k; }, rebote); }, cerrar: () => sin(tw(0.5, k => { s.scale.y = 1.7 * (1 - k) + 0.01; s.material.opacity = 1 - k; }).then(() => fuera(s))) };
}

/** Haz cónico de luz entre dos puntos. */
export function hazDeLuz(a, b, color) {
  texHaz ??= (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,.12)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64); return new THREE.CanvasTexture(c); })();
  const d = b.clone().sub(a), l = d.length();
  const m = temp(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.7, l, 14, 1, true), new THREE.MeshBasicMaterial({ map: texHaz, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize().negate()); m.renderOrder = 14; mundo.escena.add(m);
  let k0 = 0; sin(tw(0.5, k => { k0 = k; })); const fin = cadaFrame((dt, t) => { m.material.opacity = k0 * (0.3 + Math.sin(t * 9) * 0.07); m.rotateY(dt); });
  return { apagar: () => sin(tw(0.6, k => { k0 = 1 - k; }).then(() => { fin(); fuera(m); })) };
}

/** Reloj de arena de luz: la arena sube, contra la gravedad (Cronomante). `tam` escala el reloj. */
export function relojArena(p, color, color2, tam = 0.9) {
  const g = temp(new THREE.Group()); g.position.copy(p); mundo.escena.add(g);
  const vidrio = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const oro = new THREE.MeshBasicMaterial({ color: 0xe8c880, transparent: true }), arena = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true });
  const pz = (geo, mat, y, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.x = rx; g.add(m); return m; };
  pz(new THREE.ConeGeometry(0.5, 0.78, 16, 1, true), vidrio, 0.39, Math.PI); pz(new THREE.ConeGeometry(0.5, 0.78, 16, 1, true), vidrio, -0.39);
  for (const y of [0.82, -0.82]) pz(new THREE.CylinderGeometry(0.58, 0.58, 0.07, 16), oro, y);
  for (let i = 0; i < 3; i++) { const m = pz(new THREE.CylinderGeometry(0.028, 0.028, 1.6, 6), oro, 0); m.position.x = Math.cos(i * 2.094) * 0.53; m.position.z = Math.sin(i * 2.094) * 0.53; }
  const abajo = pz(new THREE.ConeGeometry(0.44, 0.62, 14), arena, -0.46), arriba = pz(new THREE.ConeGeometry(0.44, 0.62, 14), arena, 0.46, Math.PI);
  g.scale.setScalar(0.01); let k = 0, vivo = true;
  sin(tw(0.8, q => { g.scale.setScalar(tam * q); g.rotation.z = (1 - q) * Math.PI; }, rebote));
  const fin = cadaFrame(dt => { g.rotation.y += dt * 0.5; if (!vivo) return; k = Math.min(1, k + dt / 5.5);
    abajo.scale.set(1 - 0.75 * k, 1 - 0.85 * k, 1 - 0.75 * k); abajo.position.y = -0.77 + 0.31 * (1 - 0.85 * k);
    arriba.scale.set(0.2 + 0.8 * k, 0.15 + 0.85 * k, 0.2 + 0.8 * k); arriba.position.y = 0.08 + 0.31 * (0.15 + 0.85 * k) + (1 - k) * 0.45;
    const o = g.position, s = g.scale.x; chispas(V(o.x, o.y + (-0.55 + Math.random() * 1.1) * s, o.z), { n: 2, color: 0xffe2a0, color2, vel: 0.04, dir: V(0, 1.5, 0), vida: 0.45, tam: 0.07, radio: 0.03 });
    if (Math.random() < 0.5) chispas(V(o.x, o.y - 1.2 * s, o.z), { n: 1, color, color2, vel: 0.5, dir: V(0, 1.2, 0), vida: 0.9, tam: 0.1, radio: 0.5 * s, giro: -4 }); });
  return { g, parar() { vivo = false; }, apagar() { const s0 = g.scale.x; sin(tw(0.8, q => { g.scale.setScalar(s0 * 1.3 * (1 - q) + 0.01); }, entra).then(() => { fin(); fuera(g); })); } };
}

/** Orbes de colores de la Estratega. */
export const COLORES_ORBES = [0x5fd0a0, 0xe8a040, 0xe04a6a, 0x5ab8e8, 0xf0e070, 0xb07ae8];
export function orbe(color) { return temp(luz(color, 0.5)); }
export function quitarOrbe(o) { fuera(o); }

/** Cuatro escudos en corro (Centinela). Grupo suelto: quien lo usa lo coloca, lo gira y lo retira. */
export function crearEscudos() {
  const grupo = new THREE.Group();
  const rojo = new THREE.MeshLambertMaterial({ color: 0xc23a2e, flatShading: true }), oro = new THREE.MeshLambertMaterial({ color: 0xe0aa48, emissive: 0x4a3008, flatShading: true });
  for (let n = 0; n < 4; n++) { const e = new THREE.Group(), an = n / 4 * Math.PI * 2; e.position.set(Math.sin(an) * 1.35, 1.0, Math.cos(an) * 1.35); e.rotation.y = an; e.scale.setScalar(0.8);
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 6), rojo); cuerpo.rotation.x = Math.PI / 2; cuerpo.scale.set(1, 1, 1.3);
    const borde = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 5, 6), oro); borde.scale.y = 1.3; borde.rotation.z = Math.PI / 6;
    const tachon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), oro); tachon.position.z = 0.05; e.add(cuerpo, borde, tachon); grupo.add(e); }
  return grupo;
}
