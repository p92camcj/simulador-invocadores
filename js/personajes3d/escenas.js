// Escenas de la maqueta: secuencias cortas y predefinidas (rutas y gestos
// fijos) que en la fase 2 lanzará el juego con sus datos: quién, desde
// dónde y hacia qué Portal. Aquí no hay reglas: cada escena solo escenifica
// un resultado que el motor ya habría calculado.
import { THREE, mundo, tw, espera, cadaFrame, cancelarTodo, plano, temblar, reiniciarVistaUsuario, arco, V, suave, sale, entra, lineal, mezcla, rebote, CANCELADO, siempre } from './mundo.js';
import { crearPortal, encender, VARIANTES, ALTURA_TARIMA, texturaDisco } from './portales.js';
import { crearActor, quitarActor, INFO, posar, mirar, mano, cabeza, pecho, altura, aparecer, desvanecer, opacidad, materialesDe, caminar, quitarCapa, aclararCapa, opacarCapa, conjurar, saltar, transformar } from './personajes.js';
import { chispas, humo, onda, destello, rayo, anilloRunico, gema, quitar, luz } from './efectos.js';
import { S } from './sonido.js';

// Portales de los jugadores al triple de distancia entre sí que los centrales (equidistantes y juntos).
// Se pueden recolocar arrastrando (modo «Colocar Portales»); la colocación se guarda en el dispositivo.
const POS_INICIAL = [[0, 6.6], [-5.2, -2.6], [5.2, -2.6], [-1.7, 1.2], [1.7, 1.2], [0, -1.75]];
const POS = POS_INICIAL.map(([x, z]) => V(x, 0, z));
try { const g = JSON.parse(localStorage.getItem('inv3d.portales') ?? 'null'); if (Array.isArray(g) && g.length === 6) g.forEach(([x, z], i) => POS[i].set(x, 0, z)); } catch { /* sin almacenamiento */ }
const centro = () => POS[3].clone().lerp(POS[4], 0.5);
const portales = [];
let temporales = [], ui = { di() {}, flash() {} };
export function configurar(o) { ui = o; }

export function montarEscenario() {
  VARIANTES.forEach((v, i) => { const p = crearPortal(v, i + 1); p.position.copy(POS[i]); mundo.escena.add(p); portales.push(p); });
  portales[5].visible = false; orientar(); prepararColocacion();
}
/** Los Portales de los rivales se giran un poco hacia el centro de la mesa. */
function orientar() { const c = centro(); for (const i of [1, 2]) portales[i].rotation.y = Math.atan2(c.x - POS[i].x, c.z - POS[i].z) * 0.55; }
function limpiar() {
  cancelarTodo();
  for (const o of temporales) o.parent?.remove(o);
  temporales = [];
  portales.forEach((p, i) => { p.position.copy(POS[i]); p.visible = i < 5; encender(p, 0.6); });
  reiniciarVistaUsuario(); mundo.cam.temblor = 0;
}

// ---- utilidades de puesta en escena ----
const sobre = i => portales[i].position.clone().add(V(0, ALTURA_TARIMA, 0));
// Las cartas de la mano esperan pegadas a su Portal, una a cada lado de la escalinata.
const local = (i, x, z) => { const r = portales[i].rotation.y; return V(POS[i].x + x * Math.cos(r) + z * Math.sin(r), 0, POS[i].z - x * Math.sin(r) + z * Math.cos(r)); };
const hueco = (jug, lado) => local(jug, lado * 1.9, 0.55);
const pie = i => local(i, 0, 2.05);   // pie de la escalinata
const m0 = (y, dz = 0.1) => V(POS[0].x, y, POS[0].z + dz);
const umbral = i => sobre(i).add(V(0, 0, -0.85));
function actor(nombre, pos, o) { const a = crearActor(nombre, pos, o); temporales.push(a); return a; }
function temp(o) { temporales.push(o); return o; }
const di = t => ui.di(t);
const col = n => INFO[n].color, col2 = n => INFO[n].color2;
const sin = p => p.catch(e => { if (e !== CANCELADO) console.error(e); });
const T = {
  general: () => { const xs = POS.slice(0, 5).map(p => p.x), zs = POS.slice(0, 5).map(p => p.z), x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
    return { objetivo: V((x0 + x1) / 2, 0.8, (z0 + z1) / 2 + 0.4), ancho: x1 - x0 + 5, alto: (z1 - z0) * 0.6 + 6.5, polar: 0.98 }; },
  mio: () => ({ objetivo: m0(0.95), ancho: 5.8, alto: 3.6, polar: 1.25 }),
  rival: i => ({ objetivo: V(POS[i].x, 0.9, POS[i].z + 0.6), ancho: 5.8, alto: 3.8, polar: 1.2, azimut: Math.max(-0.35, Math.min(0.35, POS[i].x * 0.06)) }),
};
/** Plano que encuadra dos puntos (lanzador y objetivo). */
function dos(a, b, margen = 3.2, o = {}) {
  const m = a.clone().lerp(b, 0.5); m.y = 1.0; const d = b.clone().sub(a);
  return { objetivo: m, ancho: Math.abs(d.x) + margen, alto: Math.abs(d.z) * 0.55 + 3.4, polar: 1.08, azimut: Math.sign(d.x || 1) * -0.25, ...o };
}
/** Círculo rúnico que aparece girando bajo alguien o sobre un Portal. */
function runa(p, color, radio = 1, giro = 0.8, puntas = 8) {
  const m = temp(anilloRunico(texturaDisco(puntas), p, color, radio));
  sin(tw(0.5, k => { m.material.opacity = 0.9 * k; }));
  cadaFrame(dt => { m.rotation.z += giro * dt; });
  m.userData.apagar = (dur = 0.6) => sin(tw(dur, k => { m.material.opacity = 0.9 * (1 - k); }).then(() => quitar(m)));
  return m;
}
/** Gesto + rayo + impacto: el hechizo genérico dirigido a un punto. */
async function hechizo(a, destino, o = {}) {
  const n = a.userData.nombre, c = o.color ?? col(n);
  mirar(a, destino); const r = runa(a.position, c, 0.95);
  S.cargar(o.f ?? 220, o.dur ?? 1.0);
  const desde = await conjurar(a, o);
  S.lanzar(o.f2 ?? 600);
  await rayo(desde, destino, c, { color2: col2(n), alto: o.alto ?? 1.3, dur: o.vuelo ?? 0.7, lado: o.lado ?? 0 });
  S.impacto(o.nota ?? 392); sin(destello(destino, c, 2.2, 0.7)); onda(destino, c, 1, 26);
  r.userData.apagar(); a.userData.rumbo = 0;
}
function llegada(i, color = portales[i].userData.tono) { encender(portales[i], 1.6); S.llegada(); onda(sobre(i), color, 1, 30, 1.9); chispas(sobre(i), { n: 26, color, vel: 0.7, dir: V(0, 1.6, 0), vida: 1.3, radio: 0.7 }); sin(espera(1.4).then(() => encender(portales[i], 0.8))); }
/**
 * Subir a la tarima de un Portal: siempre de frente, por la escalinata. Si
 * el personaje llega por un lado o por detrás, rodea el Portal por fuera
 * (sin cruzar pilares) hasta el pie de la escalera.
 */
async function subir(a, i, o = {}) {
  const c = sobre(i), rot = portales[i].rotation.y;
  const punto = (an, r) => V(c.x + Math.sin(an + rot) * r, 0, c.z + Math.cos(an + rot) * r);
  let an = Math.atan2(a.position.x - c.x, a.position.z - c.z) - rot; an = Math.atan2(Math.sin(an), Math.cos(an));
  const lado = Math.sign(an) || 1, tramos = [];
  if (Math.abs(an) > 2.0) tramos.push(punto(lado * 2.0, 2.9));
  if (Math.abs(an) > 1.45) tramos.push(punto(lado * 1.3, 2.8));
  if (Math.abs(an) > 0.5) tramos.push(punto(lado * 0.5, 2.45));
  tramos.push(pie(i));
  const total = tramos.length; let hecho = 0;
  for (const t of tramos) { if (a.position.distanceTo(t) > 0.25) await caminar(a, t, { vel: o.vel ?? 0.95, alFinal: Math.atan2(c.x - t.x, c.z - t.z), enMarcha: k => o.enMarcha?.((hecho + k) / total) }); hecho++; }
  await caminar(a, c, { vel: 0.8 });
}
/** El personaje que estaba en el Portal se marcha por el umbral y se desvanece en su luz. */
async function marcharse(a, i) {
  posar(a, 'reverencia', 6); await espera(0.55); posar(a, null, 6);
  S.seVa(); const ms = materialesDe(a);
  await caminar(a, umbral(i).add(V(0, 0, -0.5)), { vel: 0.9, mudo: true, alFinal: Math.PI, enMarcha: k => { if (k > 0.45) opacidad(a, 1 - (k - 0.45) / 0.55, ms); if (Math.random() < 0.4) chispas(pecho(a), { n: 1, color: portales[i].userData.tono, vel: 0.3, vida: 0.8 }); } });
  quitarActor(a);
}
/** Quien estaba debajo vuelve a asomar por el umbral. */
async function regresar(nombre, i, o) {
  const a = actor(nombre, umbral(i).add(V(0, 0, -0.4)), o); const ms = materialesDe(a); opacidad(a, 0, ms); S.aparece();
  await caminar(a, sobre(i), { vel: 0.9, mudo: true, enMarcha: k => opacidad(a, Math.min(1, k * 1.8), ms) });
  return a;
}
function misGemas(n = 3) {
  return Array.from({ length: n }, (_, i) => { const g = temp(gema('azul', 0.9)); g.position.copy(local(0, -0.95 - i * 0.32, 1.9)).y = 0.22; cadaFrame((dt, t) => { g.rotation.y += dt * 1.5; }); return g; });
}
async function volar(o, hasta, dur = 0.9, alto = 1.2, lado = 0, ease = suave) { const de = o.position.clone(); await tw(dur, k => o.position.copy(arco(de, hasta, k, alto, lado)), ease); }
function romperGema(g) { S.cristalRoto(); chispas(g.position, { n: 30, color: g.userData.color, color2: 0xffffff, vel: 1.6, grav: 4, vida: 0.9 }); quitar(g); }
async function destelloInvocacion(color = 0xffe9a0) { S.invBoom(); ui.flash(0.5); temblar(0.3); sin(destello(V(0, 3, 1.5), color, 7, 1.2)); chispas(V(0, 3, 1.5), { n: 60, color, vel: 2.2, vida: 1.4, grav: 0.6 }); await espera(0.7); }

function lienzoTex(t, pintar) { const c = document.createElement('canvas'); c.width = c.height = t; const x = c.getContext('2d'); x.strokeStyle = x.fillStyle = '#fff'; x.lineCap = 'round'; x.shadowColor = '#fff'; x.shadowBlur = t / 50; pintar(x, t); return new THREE.CanvasTexture(c); }
const planoLuz = (tex, color, w, h) => new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
let texEsfera, texAguja, texOjo, texHaz;
/** Ojo de luz que se abre sobre la Clarividente. */
function ojoDeLuz(p, color) {
  texOjo ??= lienzoTex(256, (x, t) => { const c = t / 2; x.lineWidth = 5; x.beginPath(); x.moveTo(8, c); x.quadraticCurveTo(c, c - 110, t - 8, c); x.quadraticCurveTo(c, c + 110, 8, c); x.stroke();
    x.lineWidth = 4; x.beginPath(); x.arc(c, c, 44, 0, 7); x.stroke(); x.beginPath(); x.arc(c, c, 16, 0, 7); x.fill();
    x.lineWidth = 2; for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283; x.beginPath(); x.moveTo(c + Math.cos(a) * 22, c + Math.sin(a) * 22); x.lineTo(c + Math.cos(a) * 40, c + Math.sin(a) * 40); x.stroke(); } });
  const s = temp(new THREE.Sprite(new THREE.SpriteMaterial({ map: texOjo, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })));
  s.position.copy(p); s.scale.set(1.7, 0.01, 1); s.renderOrder = 22; mundo.escena.add(s);
  return { s, abrir: () => { sin(destello(p, color, 2.4, 0.7)); return tw(0.7, k => { s.scale.y = 0.01 + 1.69 * k; }, rebote); }, cerrar: () => sin(tw(0.5, k => { s.scale.y = 1.7 * (1 - k) + 0.01; s.material.opacity = 1 - k; }).then(() => quitar(s))) };
}
/** Haz cónico de luz entre dos puntos. */
function hazDeLuz(a, b, color) {
  texHaz ??= (() => { const c = document.createElement('canvas'); c.width = 8; c.height = 64; const x = c.getContext('2d'); const g = x.createLinearGradient(0, 0, 0, 64); g.addColorStop(0, 'rgba(255,255,255,.9)'); g.addColorStop(1, 'rgba(255,255,255,.12)'); x.fillStyle = g; x.fillRect(0, 0, 8, 64); return new THREE.CanvasTexture(c); })();
  const d = b.clone().sub(a), l = d.length();
  const m = temp(new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.7, l, 14, 1, true), new THREE.MeshBasicMaterial({ map: texHaz, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })));
  m.position.copy(a).lerp(b, 0.5); m.quaternion.setFromUnitVectors(V(0, 1, 0), d.clone().normalize().negate()); m.renderOrder = 14; mundo.escena.add(m);
  let k0 = 0; sin(tw(0.5, k => { k0 = k; })); const fin = cadaFrame((dt, t) => { m.material.opacity = k0 * (0.3 + Math.sin(t * 9) * 0.07); m.rotateY(dt); });
  return { apagar: () => sin(tw(0.6, k => { k0 = 1 - k; }).then(() => { fin(); quitar(m); })) };
}

/** Reloj de arena de luz: la arena sube, contra la gravedad (Cronomante). */
function relojArena(p, color, color2) {
  const g = temp(new THREE.Group()); g.position.copy(p); mundo.escena.add(g);
  const vidrio = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
  const oro = new THREE.MeshBasicMaterial({ color: 0xe8c880, transparent: true }), arena = new THREE.MeshBasicMaterial({ color: 0xffe2a0, transparent: true });
  const pz = (geo, mat, y, rx = 0) => { const m = new THREE.Mesh(geo, mat); m.position.y = y; m.rotation.x = rx; g.add(m); return m; };
  pz(new THREE.ConeGeometry(0.5, 0.78, 16, 1, true), vidrio, 0.39, Math.PI); pz(new THREE.ConeGeometry(0.5, 0.78, 16, 1, true), vidrio, -0.39);
  for (const y of [0.82, -0.82]) pz(new THREE.CylinderGeometry(0.58, 0.58, 0.07, 16), oro, y);
  for (let i = 0; i < 3; i++) { const m = pz(new THREE.CylinderGeometry(0.028, 0.028, 1.6, 6), oro, 0); m.position.x = Math.cos(i * 2.094) * 0.53; m.position.z = Math.sin(i * 2.094) * 0.53; }
  const abajo = pz(new THREE.ConeGeometry(0.44, 0.62, 14), arena, -0.46), arriba = pz(new THREE.ConeGeometry(0.44, 0.62, 14), arena, 0.46, Math.PI);
  g.scale.setScalar(0.01); let k = 0, vivo = true;
  sin(tw(0.8, q => { g.scale.setScalar(0.9 * q); g.rotation.z = (1 - q) * Math.PI; }, rebote));
  cadaFrame(dt => { g.rotation.y += dt * 0.5; if (!vivo) return; k = Math.min(1, k + dt / 5.5);
    abajo.scale.set(1 - 0.75 * k, 1 - 0.85 * k, 1 - 0.75 * k); abajo.position.y = -0.77 + 0.31 * (1 - 0.85 * k);
    arriba.scale.set(0.2 + 0.8 * k, 0.15 + 0.85 * k, 0.2 + 0.8 * k); arriba.position.y = 0.08 + 0.31 * (0.15 + 0.85 * k) + (1 - k) * 0.45;
    const o = g.position; chispas(V(o.x, o.y - 0.55 + Math.random() * 1.1, o.z), { n: 2, color: 0xffe2a0, color2, vel: 0.04, dir: V(0, 1.5, 0), vida: 0.45, tam: 0.07, radio: 0.03 });
    if (Math.random() < 0.5) chispas(V(o.x, o.y - 1.2, o.z), { n: 1, color, color2, vel: 0.5, dir: V(0, 1.2, 0), vida: 0.9, tam: 0.1, radio: 0.5, giro: -4 }); });
  return { g, parar() { vivo = false; }, apagar() { sin(tw(0.8, q => { g.scale.setScalar(1.25 * (1 - q) + 0.01); }, entra).then(() => quitar(g))); } };
}
/** Escudos que giran alrededor del Portal de la Centinela: señal de que está protegido. */
function escudos(i) {
  const grupo = temp(new THREE.Group()); grupo.position.copy(sobre(i)); mundo.escena.add(grupo);
  const rojo = new THREE.MeshLambertMaterial({ color: 0xc23a2e, flatShading: true }), oro = new THREE.MeshLambertMaterial({ color: 0xe0aa48, emissive: 0x4a3008, flatShading: true });
  for (let n = 0; n < 4; n++) { const e = new THREE.Group(), an = n / 4 * Math.PI * 2; e.position.set(Math.sin(an) * 1.2, 1.0, Math.cos(an) * 1.2); e.rotation.y = an; e.scale.setScalar(0.8);
    const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.36, 0.06, 6), rojo); cuerpo.rotation.x = Math.PI / 2; cuerpo.scale.set(1, 1, 1.3);
    const borde = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 5, 6), oro); borde.scale.y = 1.3; borde.rotation.z = Math.PI / 6;
    const tachon = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), oro); tachon.position.z = 0.05; e.add(cuerpo, borde, tachon); grupo.add(e); }
  grupo.scale.setScalar(0.01); S.clang(); sin(tw(0.6, k => grupo.scale.setScalar(k), rebote));
  cadaFrame((dt, t) => { grupo.rotation.y += dt * 0.7; grupo.position.y = sobre(i).y + Math.sin(t * 1.6) * 0.06; });
  return grupo;
}

// ============================================================== escenas
const ESCENAS = [];
const escena = (id, grupo, titulo, run) => ESCENAS.push({ id, grupo, titulo, run });

escena('0', 'Galería', 'Todos los personajes, de cerca', async () => {
  const nombres = ['Aprendiz', 'Centinela', 'Clarividente', 'Cronista', 'Cronomante', 'Entusiasta', 'Estratega', 'Maestro', 'Metamorfo', 'Ocultista', 'Pícaro', 'Lumo', 'Reena', 'Sora'];
  portales.forEach(p => { p.visible = false; });
  const xs = i => (i - (nombres.length - 1) / 2) * 1.35, as = nombres.map((n, i) => actor(n, V(xs(i), 0, 9.5)));
  const ver = (i0, i1) => ({ objetivo: V((xs(i0) + xs(i1)) / 2, 0.95, 9.5), ancho: xs(i1) - xs(i0) + 1.5, alto: 2.5, polar: 1.42 });
  sin(plano(ver(0, 3), 0)); di('Los personajes, de cerca: telas con trama, bordados y pliegues; brazos y piernas articulados.');
  await espera(4.5);
  for (const [i0, i1] of [[3, 6], [7, 10], [10, 13]]) { await plano(ver(i0, i1), 2.2); await espera(3.6); }
  di('Y en movimiento.'); await plano({ objetivo: V(0, 1, 10.5), ancho: 15, alto: 4.2, polar: 1.3 }, 2.2);
  await Promise.all(as.map((a, i) => caminar(a, V(xs(i) * 0.9, 0, 12.2), { vel: 0.9 })));
  as.forEach((a, i) => { if (INFO[a.userData.nombre].manos.length) posar(a, i % 2 ? 'alzar' : 'celebrar', 4); }); await espera(2.5); as.forEach(a => posar(a, null, 4)); await espera(2);
});

escena('1', 'Manos', 'Mi mano', async () => {
  sin(plano(T.mio(), 0));
  const v = actor('Estratega', hueco(0, -1)), o = actor(null, hueco(0, 1), { capa: 'opaca' });
  di('Junto a mi Portal: a la izquierda, la carta que yo veo; a la derecha, mi carta oculta, una figura encapuchada idéntica sea quien sea.');
  S.aparece(); await Promise.all([aparecer(v, 0.8), aparecer(o, 0.8)]);
  sin(plano({ ...T.mio(), azimut: 0.45 }, 5));
  await espera(1); posar(v, 'alzar', 4); chispas(cabeza(v), { n: 20, color: col('Estratega'), vel: 0.6, vida: 1.2 }); S.runa(3);
  await espera(1.2); posar(v, null, 4);
  await espera(0.8); chispas(o.position.clone().add(V(0, 1.75, 0.3)), { n: 6, color: 0x8a80d8, vel: 0.2, vida: 1.2 });
  await espera(2);
});

escena('2', 'Manos', 'Manos rivales', async () => {
  sin(plano(T.rival(1), 0));
  actor('Cronista', sobre(1));
  actor('Maestro', hueco(1, -1), { capa: 'translucida' }); actor(null, hueco(1, 1), { capa: 'opaca' });
  const lumo = actor('Lumo', hueco(2, -1), { capa: 'translucida' }); actor(null, hueco(2, 1), { capa: 'opaca' });
  di('Mano de un rival: la carta que yo puedo ver es un encapuchado translúcido (se ve al Maestro dentro); la que no veo, totalmente opaca.');
  await espera(3.6);
  await plano(T.rival(2), 1.6);
  di('Otro rival: veo que guarda a Lumo; su otra carta sigue siendo un misterio.');
  await espera(2.6);
  di('Si ese rival pone a la Clarividente en su Portal, su mano entera se vuelve opaca para mí.');
  const c = actor('Clarividente', sobre(2)); S.aparece(); await aparecer(c, 0.7); llegada(2, col('Clarividente'));
  posar(c, 'orbeAlto', 5); S.velo(); S.clarividente();
  sin(tw(1.6, () => { humo(lumo.position.clone().add(V(0, 0.6, 0)), { n: 1, color: 0x7fd8e8, radio: 0.6, alfa: 0.3 }); }));
  await opacarCapa(lumo); posar(c, null, 4);
  await espera(2);
});

escena('3a', 'Jugar una carta', 'Jugar mi carta visible', async () => {
  sin(plano({ ...T.mio(), ancho: 5.8 }, 0));
  const c = actor('Maestro', hueco(0, -1)); actor(null, hueco(0, 1), { capa: 'opaca' });
  di('Juego la carta que veo: el Maestro camina con porte majestuoso hasta mi Portal.');
  await espera(0.8); posar(c, 'reposo', 4);
  sin(plano({ ...T.mio(), azimut: -0.35, ancho: 5.8 }, 3));
  await subir(c, 0);
  llegada(0, col('Maestro')); posar(c, 'celebrar', 6); await espera(0.9); posar(c, null, 4);
  await espera(1.8);
});

escena('3b', 'Jugar una carta', 'Jugar mi carta oculta', async () => {
  sin(plano({ ...T.mio(), ancho: 5.8 }, 0));
  actor('Maestro', hueco(0, -1)); const o = actor(null, hueco(0, 1), { capa: 'opaca' });
  di('Juego mi carta oculta sin saber quién es. El encapuchado echa a andar y, por el camino, se quita capucha y manto…');
  await espera(1.2);
  sin(plano({ ...T.mio(), azimut: 0.4, ancho: 5.8 }, 3.5));
  let hecho = false;
  await subir(o, 0, { vel: 0.7, enMarcha: k => { if (!hecho && k > 0.25) { hecho = true; di('…el manto cae al suelo y se deshace en volutas de humo. ¡Era el Pícaro!'); sin(quitarCapa(o, 'Pícaro')); } } });
  llegada(0, col('Pícaro')); posar(o, 'orbeAlto', 6); await espera(0.9); posar(o, null, 4);
  await espera(1.8);
});

escena('3c', 'Jugar una carta', 'Un rival juega la carta que yo veía', async () => {
  sin(plano(dos(hueco(1, 1), POS[3], 3.4), 0));
  actor('Aprendiz', sobre(1)); const o = actor('Estratega', hueco(1, 1), { capa: 'translucida' }); actor(null, hueco(1, -1), { capa: 'opaca' });
  di('Un rival juega en un Portal central la carta que él no veía (y yo sí): la túnica translúcida cae igual, camino del Portal.');
  await espera(1.4);
  let hecho = false;
  await subir(o, 3, { vel: 0.85, enMarcha: k => { if (!hecho && k > 0.2) { hecho = true; sin(quitarCapa(o)); } } });
  llegada(3, col('Estratega')); await espera(2);
});

escena('4', 'Tapar una carta', 'Tapar una carta', async () => {
  sin(plano({ ...T.mio(), ancho: 5.8, objetivo: m0(1.1, -0.3) }, 0));
  const viejo = actor('Cronista', sobre(0)), nuevo = actor('Centinela', hueco(0, -1)); actor(null, hueco(0, 1), { capa: 'opaca' });
  di('La Centinela va a ocupar mi Portal, donde estaba el Cronista…');
  await espera(1);
  await caminar(nuevo, local(0, -0.9, 2.3), { vel: 0.95, alFinal: Math.PI });
  di('…que le cede el sitio con una reverencia y se marcha por el umbral, de vuelta al pasado del Portal.');
  sin(plano({ ...T.mio(), azimut: -0.5, ancho: 5.6, objetivo: m0(1.2, -0.4) }, 2.5));
  await marcharse(viejo, 0);
  await subir(nuevo, 0);
  llegada(0, col('Centinela')); await espera(0.6); escudos(0); di('Ya en su sitio, sus escudos rodean el Portal: señal de que ninguna habilidad puede afectarlo.'); await espera(3);
});

escena('5', 'Portales', 'Los Portales', async () => {
  sin(plano(T.general(), 0)); portales[5].visible = true;
  di('Umbrales de piedra a medio derruir, con runas vivas. Todos de la misma familia y cada uno distinto.');
  portales.forEach(p => encender(p, 0.25));
  await espera(1.2);
  for (let i = 0; i < 6; i++) {
    const p = POS[i];
    await plano({ objetivo: V(p.x, 1.25, p.z), ancho: 4.8, alto: 4.0, polar: 1.25, azimut: (i % 2 ? 1 : -1) * 0.5 }, i ? 1.3 : 1.0);
    encender(portales[i], 1.6); S.runa(i); onda(sobre(i), portales[i].userData.tono, 1, 30, 1.6); chispas(sobre(i), { n: 18, color: portales[i].userData.tono, vel: 0.5, dir: V(0, 1.4, 0), vida: 1.4, radio: 0.7 });
    await espera(1.3);
  }
  await plano({ ...T.general(), azimut: 0.5 }, 2); await espera(1.5);
});

// ---------------------------------------------------------- habilidades
escena('6.1', 'Habilidades', 'Cronomante', async () => {
  sin(plano(dos(POS[0], POS[3], 3.4), 0));
  const c = actor('Cronomante', sobre(0)), top = actor('Lumo', sobre(3));
  di('Cronomante: sobre el Portal aparece un reloj cuya arena sube, contra la gravedad. El tiempo retrocede y quienes pasaron por él se alzan como ecos (los ocultos, sin revelarse)…');
  await espera(1.2); mirar(c, POS[3]);
  const reloj = runa(sobre(3), col('Cronomante'), 1.25, -2.2, 6); const r2 = runa(c.position, col('Cronomante'), 0.95, -1.2);
  const rj = relojArena(sobre(3).add(V(0, 2.2, -0.3)), col('Cronomante'), col2('Cronomante'));
  S.cronomante(); const desde = await conjurar(c, { dur: 1.5, lanza: 'abierto' });
  await rayo(desde, sobre(3).add(V(0, 1, 0)), col('Cronomante'), { color2: col2('Cronomante') }); S.ecos();
  sin(plano({ objetivo: V(POS[3].x, 1.9, POS[3].z), ancho: 5.0, alto: 4.8, polar: 1.3, azimut: -0.2 }, 1.5));
  const ecos = [['Aprendiz', {}], [null, { capa: 'opaca' }], ['Estratega', {}]].map(([n, o], i) => {
    const e = actor(n, sobre(3), o); e.scale.setScalar(0.8); const ms = materialesDe(e); opacidad(e, 0, ms);
    const hasta = sobre(3).add(V(-1.15 + i * 1.15, 1.75 + (i === 1 ? 0.3 : 0), -0.75));
    sin(tw(1.2, k => { e.position.lerpVectors(sobre(3), hasta, k); opacidad(e, 0.45 * k, ms); chispas(e.position.clone().add(V(0, 0.7, 0)), { n: 1, color: col('Cronomante'), vel: 0.2, vida: 0.7 }); }, sale));
    return { e, ms, hasta };
  });
  await espera(2.4);
  di('…y trae al presente a quien elija: la Estratega baja al Portal y Lumo pasa a ser un eco más.');
  const el = ecos[2], msTop = materialesDe(top); S.lanzar(500);
  await tw(1.3, k => { el.e.position.lerpVectors(el.hasta, sobre(3), k); el.e.scale.setScalar(mezcla(0.8, 1, k)); opacidad(el.e, mezcla(0.45, 1, k), el.ms);
    top.position.lerpVectors(sobre(3), el.hasta, k); top.scale.setScalar(mezcla(1, 0.8, k)); opacidad(top, mezcla(1, 0.45, k), msTop); });
  rj.parar(); S.impacto(660); sin(destello(rj.g.position, col2('Cronomante'), 3.5, 0.6));
  llegada(3, col('Cronomante'));
  await espera(0.9); S.seVa(); rj.apagar();
  await Promise.all([[ecos[0].e, ecos[0].ms], [ecos[1].e, ecos[1].ms], [top, msTop]].map(([e, ms]) => { const de = e.position.clone(); return tw(1.1, k => { e.position.lerpVectors(de, sobre(3), k); opacidad(e, 0.45 * (1 - k), ms); }, entra).then(() => quitarActor(e)); }));
  reloj.userData.apagar(); r2.userData.apagar(); c.userData.rumbo = 0;
  await espera(1.5);
});

escena('6.2', 'Habilidades', 'Estratega', async () => {
  sin(plano(T.general(), 0));
  const c = actor('Estratega', sobre(0)), a = actor('Maestro', sobre(4)), b = actor('Reena', sobre(1));
  di('Estratega: sus orbes mágicos vuelan hasta dos Portales, los alzan por el aire…');
  await espera(1.2); mirar(c, centro());
  const r = runa(c.position, col('Estratega'), 0.95);
  S.cargar(196, 1.1); await conjurar(c, { dur: 1.1, lanza: 'abierto' });
  // Seis orbes de colores por Portal: salen de sus manos y se colocan bajo el borde de la tarima.
  const cs = [0x5fd0a0, 0xe8a040, 0xe04a6a, 0x5ab8e8, 0xf0e070, 0xb07ae8]; let agarre = 0;
  const orbes = [4, 1].flatMap((pi, q) => cs.map((cc, n) => { const o = temp(luz(cc, 0.5)); o.position.copy(mano(c, q)); return { o, pi, n, cc, de: mano(c, q) }; }));
  const sitio = (x, t) => { const an = x.n / 6 * Math.PI * 2 + t * 2.2; return portales[x.pi].position.clone().add(V(Math.cos(an) * 1.42, 0.12, Math.sin(an) * 1.42)); };
  cadaFrame((dt, t) => orbes.forEach(x => { if (agarre >= 1) x.o.position.copy(sitio(x, t)); else x.o.position.copy(arco(x.de, sitio(x, t), agarre, 2.0, (x.n - 2.5) * 0.08)); if (Math.random() < 0.35) chispas(x.o.position, { n: 1, color: x.cc, vel: 0.15, vida: 0.5, tam: 0.1 }); }));
  S.lanzar(); await tw(1.1, k => { agarre = k; });
  posar(c, 'alzar', 4); S.piedra(); temblar(0.15); humo(POS[4], { n: 14, color: 0x9a94a8, radio: 1.2 }); humo(POS[1], { n: 14, color: 0x9a94a8, radio: 1.2 });
  cadaFrame(() => { a.position.copy(portales[4].position).y += ALTURA_TARIMA; b.position.copy(portales[1].position).y += ALTURA_TARIMA; });
  const ALTO = 2.3; await tw(1.4, k => { portales[4].position.y = ALTO * k; portales[1].position.y = ALTO * k; });
  di('…y los intercambian en un giro circular, con todo lo que tienen encima.');
  // Giro: los dos Portales recorren media circunferencia alrededor del punto medio.
  const medio = POS[4].clone().lerp(POS[1], 0.5), radio = POS[4].distanceTo(POS[1]) / 2, a0 = Math.atan2(POS[4].z - medio.z, POS[4].x - medio.x);
  S.estratega(); sin(plano({ ...T.general(), azimut: 0.35 }, 3.2));
  await tw(3.2, (k, kl) => { [[4, 0], [1, Math.PI]].forEach(([pi, d]) => { const an = a0 + d + k * Math.PI; portales[pi].position.set(medio.x + Math.cos(an) * radio, ALTO + Math.sin(kl * Math.PI * 3) * 0.12, medio.z + Math.sin(an) * radio); });
    if (Math.abs(kl - 0.5) < 0.008) S.estratega(); });
  await tw(1.2, k => { portales[4].position.y = ALTO * (1 - k); portales[1].position.y = ALTO * (1 - k); }, entra);
  S.golpeSuelo(); temblar(0.3); humo(POS[4], { n: 16, color: 0x9a94a8, radio: 1.3 }); humo(POS[1], { n: 16, color: 0x9a94a8, radio: 1.3 });
  orbes.forEach(x => { chispas(x.o.position, { n: 8, color: x.cc, vel: 0.9, vida: 0.9 }); quitar(x.o); });
  encender(portales[4], 1.5); encender(portales[1], 1.5); posar(c, null, 4); r.userData.apagar(); c.userData.rumbo = 0;
  sin(plano(T.general(), 1.5)); await espera(2.4);
});

escena('6.3', 'Habilidades', 'Cronista', async () => {
  sin(plano(dos(POS[0], POS[4], 4.2, { objetivo: V(0.8, 1, 4.0) }), 0));
  const c = actor('Cronista', sobre(0)), sora = actor('Sora', sobre(4)); actor(null, hueco(0, 1), { capa: 'opaca' });
  di('Cronista: escribe en su libro a quien ocupa un Portal y se lo lleva a su mano…');
  await espera(1.2); mirar(c, POS[4]);
  const r = runa(c.position, col('Cronista'), 0.95);
  posar(c, 'leer', 5); S.cargar(260, 0.9); await espera(0.9); S.cronista();
  const libro = () => { const p = new THREE.Vector3(); c.userData.modelo.art.libro.getWorldPosition(p); return p; };
  const ms = materialesDe(sora);
  await tw(1.5, (k, kl) => { opacidad(sora, 1 - k, ms); const p = arco(pecho(sora), libro(), (kl * 3) % 1, 1.0); chispas(p, { n: 3, color: col('Cronista'), color2: 0xffffff, vel: 0.15, vida: 0.5, tam: 0.12 }); });
  quitarActor(sora); sin(destello(libro(), col('Cronista'), 1.2, 0.5)); encender(portales[4], 0.3);
  di('…donde aparece con la orientación que le toque. En el Portal vuelve a asomar quien estaba debajo.');
  await espera(0.5); S.lanzar(700);
  await rayo(libro(), hueco(0, -1).add(V(0, 0.9, 0)), col('Cronista'), { alto: 0.8, dur: 0.6 });
  const nueva = actor('Sora', hueco(0, -1)); S.aparece(); sin(aparecer(nueva, 0.7)); chispas(hueco(0, -1).add(V(0, 0.8, 0)), { n: 20, color: col('Cronista'), vel: 0.6, vida: 1 });
  posar(c, null, 4); r.userData.apagar(); c.userData.rumbo = 0;
  sin(plano(dos(POS[0], POS[4], 4.2), 1.5));
  await regresar('Aprendiz', 4); encender(portales[4], 1.2);
  await espera(1.8);
});

escena('6.4', 'Habilidades', 'Aprendiz', async () => {
  sin(plano(T.general(), 0));
  const c = actor('Aprendiz', sobre(0));
  const A = [actor('Cronomante', hueco(1, -1), { capa: 'translucida' }), actor(null, hueco(1, 1), { capa: 'opaca' })];
  const B = [actor('Reena', hueco(2, -1), { capa: 'translucida' }), actor(null, hueco(2, 1), { capa: 'opaca' })];
  di('Aprendiz: uso su habilidad sobre dos rivales, que intercambian sus manos completas. Con más ímpetu que oficio, levanta un remolino de pergaminos…');
  await espera(1.2); mirar(c, V(0, 0, -1));
  const r = runa(c.position, col('Aprendiz'), 0.95);
  S.cargar(300, 1.0); await conjurar(c, { dur: 1.0, lanza: 'celebrar' }); S.aprendiz();
  const todos = [...A, ...B], de = todos.map(x => x.position.clone()), a = [de[2], de[3], de[0], de[1]];
  todos.forEach(x => { x.userData.elevaObj = 0.5; });
  sin(espera(0.9).then(() => { posar(c, 'apuro', 10); S.ups(); }));
  // Las cartas no se giran al cambiar de mano: la que cada rival veía (opaca para mí) pasa a ser la que
  // su nuevo dueño no ve, y por tanto la veo yo; la que yo veía queda oculta para mí, pero la recuerdo.
  sin(espera(1.3).then(() => { S.clarividente(); return Promise.all([opacarCapa(A[0]), opacarCapa(B[0]), aclararCapa(A[1], 'Maestro'), aclararCapa(B[1], 'Lumo')]); }));
  await tw(2.4, (k, kl) => { todos.forEach((x, i) => { x.position.copy(arco(de[i], a[i], k, 1.6, i < 2 ? 0.3 : 0.3)); x.userData.rumbo = kl * Math.PI * 4;
    if (Math.random() < 0.7) chispas(x.position.clone().add(V(0, 1, 0)), { n: 2, color: 0xfff3d6, color2: col('Aprendiz'), vel: 0.9, vida: 0.8, tam: 0.2, giro: 6, radio: 0.5 }); }); });
  todos.forEach(x => { x.userData.elevaObj = 0; x.userData.rumbo = 0; }); S.impacto(330);
  di('…y las cartas cambian de mano sin girarse: las dos que yo veía quedan ocultas (pero las recuerdo) y las dos que no veía quedan a la vista. Con buena memoria, conozco las cuatro.');
  posar(c, null, 4); r.userData.apagar(); c.userData.rumbo = 0;
  await espera(4);
});

escena('6.5', 'Habilidades', 'Pícaro', async () => {
  const O = centro(), sitioCr = O.clone().add(V(0, 0, -0.9));
  sin(plano(dos(POS[0], O, 5.5, { alto: 8.5 }), 0));
  const c = actor('Pícaro', sobre(0));
  di('Pícaro (pasiva): una invocación acaba de tener éxito y la criatura reparte sus Gemas…');
  await espera(1.2); S.invBoom(); ui.flash(0.5); temblar(0.3); sin(destello(O.clone().add(V(0, 3, -0.9)), col('Cirelia'), 8, 1.2));
  const cr = actor('Cirelia', sitioCr); cr.userData.sombra.visible = false; posar(cr, 'ofrenda', 4); S.invCoro(9); await aparecer(cr, 1.2);
  const C = sitioCr.clone().add(V(0, 3.3, 0.3));
  const gs = ['C', 'C', 'azul', 'C'].map((t, n) => { const g = temp(gema(t, t === 'azul' ? 1 : 1.2)); g.userData.orbita = true; g.userData.an = n / 4 * 6.283; return g; });
  cadaFrame(dt => gs.forEach(g => { g.rotation.y += dt * 2.5; if (g.userData.orbita) { g.userData.an += dt * 1.1; const baja = g.userData.color === 0x4aa8ff; g.position.set(C.x + Math.cos(g.userData.an) * 1.4, baja ? 1.5 : C.y, C.z + Math.sin(g.userData.an) * 0.8); } }));
  await espera(1.6);
  di('…el Pícaro se acerca con sigilo y le roba una Gema azul…');
  posar(c, 'sigilo', 6); await caminar(c, pie(0), { vel: 0.7, mudo: true, cadencia: 9 });
  sin(plano(dos(POS[0], O, 5.5, { alto: 7, objetivo: O.clone().lerp(POS[0], 0.3).setY(1.2) }), 2.5));
  await caminar(c, sitioCr.clone().add(V(0.9, 0, 1.5)), { vel: 1.25, mudo: true, cadencia: 10, alFinal: Math.PI });
  const azul = gs[2]; azul.userData.orbita = false; S.gemaVuela(); posar(c, 'orbeAlto', 12);
  await volar(azul, mano(c).add(V(0, 0.25, 0)), 0.45, 0.3); S.picaro(); chispas(azul.position, { n: 14, color: col('Pícaro'), vel: 0.6 });
  const lleva = cadaFrame(() => azul.position.copy(mano(c)).add(V(0, 0.22, 0)));
  posar(cr, 'dudaI', 5); S.duda(); await espera(0.5); posar(c, 'sigilo', 8);
  di('…vuelve a su Portal, la deja allí para su dueño…');
  await caminar(c, pie(0), { vel: 1.9, mudo: true, cadencia: 12 }); posar(cr, 'ofrenda', 3);
  sin(plano({ ...T.mio(), ancho: 5.4, alto: 4.2, objetivo: m0(1.2, 0.4) }, 1.4));
  await caminar(c, sobre(0), { vel: 1.2, mudo: true }); posar(c, 'reverencia', 8); await espera(0.4);
  lleva(); await volar(azul, sobre(0).add(V(0.45, 0.3, 0.45)), 0.5, 0.4); S.gema(2); chispas(azul.position, { n: 12, color: 0x4aa8ff, vel: 0.5 });
  di('…y se marcha del Portal para desvanecerse sin dejar rastro.');
  posar(c, 'sigilo', 8); await caminar(c, pie(0).add(V(0.5, 0, 0.5)), { vel: 1.3, mudo: true, cadencia: 11, alFinal: 0 });
  posar(c, 'lanzarD', 14); await espera(0.2);
  S.puf(); humo(c.position, { n: 30, color: 0x6a7a9a, radio: 0.5, sube: 1.2, alfa: 0.8 }); chispas(pecho(c), { n: 14, color: col('Pícaro'), vel: 1 });
  await desvanecer(c, 0.15); encender(portales[0], 0.25);
  await espera(2.4);
});

async function animalito(nombre, texto, hacer) {
  sin(plano({ ...T.mio(), ancho: 4.6, alto: 3.4, objetivo: m0(0.9, 0.1), polar: 1.3 }, 0));
  const c = actor(nombre, sobre(0)); c.userData.alegre = true;
  di(texto); await espera(1);
  await hacer(c);
  S.tierno(); for (let i = 0; i < 3; i++) { chispas(cabeza(c), { n: 8, color: 0xff8ab0, color2: col2(nombre), vel: 0.25, dir: V(0, 0.7, 0), vida: 1.4, tam: 0.2 }); await espera(0.35); }
  await espera(1.4);
}
escena('6.6', 'Habilidades', 'Reena', () => animalito('Reena', 'Reena no tiene ninguna habilidad… pero es adorable.', async c => {
  const o = sobre(0);
  for (const [x, z] of [[0.55, 0.2], [0, 0.6], [-0.55, 0.2], [0, 0]]) await caminar(c, o.clone().add(V(x, 0, z)), { vel: 2.4, mudo: true });
  S.reena(); await saltar(c, 0.35, 0.35); await saltar(c, 0.45, 0.4, Math.PI * 2); S.reena();
}));
escena('6.7', 'Habilidades', 'Sora', () => animalito('Sora', 'Sora tampoco tiene habilidad: alza el vuelo, rodea el Portal y vuelve a posarse.', async c => {
  const o = sobre(0); S.sora(); await espera(0.7); S.aleteo(); c.userData.mudo = true; c.userData.andandoObj = 1;
  await tw(3.2, (k, kl) => { const an = k * Math.PI * 2; c.position.set(o.x + Math.sin(an) * 1.35, o.y + Math.sin(kl * Math.PI) * 1.5, o.z + 0.3 - Math.cos(an) * 1.0 + 0.7 * Math.sin(kl * Math.PI)); c.userData.rumbo = an + Math.PI / 2;
    if (Math.random() < 0.3) chispas(c.position.clone().add(V(0, 0.7, 0)), { n: 1, color: col('Sora'), vel: 0.2, grav: 0.8, vida: 1.2 }); if (Math.abs(kl - 0.5) < 0.01) S.aleteo(); });
  c.position.copy(o); c.userData.andandoObj = 0; c.userData.rumbo = 0; S.sora();
}));
escena('6.8', 'Habilidades', 'Lumo', () => animalito('Lumo', 'Lumo, sin habilidad: unos brincos, una reverencia… y a seguir siendo adorable.', async c => {
  const o = sobre(0); S.lumo();
  for (const [x, z] of [[-0.5, 0.3], [0.5, 0.3], [0, 0]]) { sin(saltar(c, 0.3, 0.5)); await caminar(c, o.clone().add(V(x, 0, z)), { vel: 1.6, mudo: true }); }
  c.userData.inclina = 0.3; c.userData.cabx = 0.5; S.lumo(); await espera(0.9); c.userData.inclina = 0; c.userData.cabx = 0;
}));

escena('6.9', 'Habilidades', 'Maestro', async () => {
  sin(plano(dos(POS[0], POS[1], 4.4), 0));
  const c = actor('Maestro', sobre(0)); const t = actor('Cronista', hueco(1, 1), { capa: 'translucida' }); actor(null, hueco(1, -1), { capa: 'opaca' });
  di('Maestro: toma con su magia la carta que ve en la mano de un rival (la que ese rival no conoce)…');
  await espera(1.2); mirar(c, t.position);
  const r = runa(c.position, col('Maestro'), 0.95);
  S.maestro(); const desde = await conjurar(c, { dur: 1.3, lanza: 'abierto' });
  const cs = [0xe04a4a, 0x5ab8e8, 0x5fd0a0, 0xf0c84a]; S.lanzar();
  await Promise.all(cs.map((cc, i) => rayo(i % 2 ? mano(c, 1) : desde, pecho(t), cc, { lado: (i - 1.5) * 0.25, alto: 1.2 + i * 0.2, dur: 0.7 + i * 0.08 })));
  di('…y la baja al instante a un Portal de ese mismo jugador, que repone su mano.');
  S.levita(); t.userData.elevaObj = 1.1; const orb = cadaFrame((dt, tt) => { for (let i = 0; i < 2; i++) { const an = tt * 5 + i * Math.PI; chispas(pecho(t).add(V(Math.cos(an) * 0.7, 0, Math.sin(an) * 0.7)), { n: 1, color: cs[(i + Math.floor(tt * 4)) % 4], vel: 0.1, vida: 0.5 }); } });
  await espera(0.9); sin(plano(dos(hueco(1, 1), POS[1], 3.6, { alto: 4.6 }), 1.4));
  const de = t.position.clone(), a = sobre(1); let hecho = false;
  await tw(1.8, k => { t.position.lerpVectors(de, a, k); if (!hecho && k > 0.35) { hecho = true; sin(quitarCapa(t)); } });
  t.userData.elevaObj = 0; await espera(0.6); orb(); llegada(1, col('Maestro'));
  posar(c, null, 4); r.userData.apagar(); c.userData.rumbo = 0;
  await espera(0.8); const n = actor('Reena', hueco(1, 1), { capa: 'translucida' }); S.aparece(); await aparecer(n, 0.8);
  await espera(1.6);
});

escena('6.10', 'Habilidades', 'Clarividente', async () => {
  sin(plano({ ...T.mio(), ancho: 5.8, alto: 3.8 }, 0));
  const c = actor('Clarividente', sobre(0)), v = actor('Aprendiz', hueco(0, -1)), o = actor(null, hueco(0, 1), { capa: 'opaca' });
  di('Clarividente (pasiva): mientras esté visible en mi Portal, su orbe me deja ver también mi carta oculta…');
  await espera(1.2); mirar(c, o.position);
  const r = runa(c.position, col('Clarividente'), 0.95);
  S.cargar(330, 1.2); const desde = await conjurar(c, { pose: 'orbeAlto', lanza: 'orbeAlto', dur: 1.3 }); S.clarividente();
  const ojo = ojoDeLuz(cabeza(c).add(V(0, 0.9, 0)), col('Clarividente')); await ojo.abrir();
  const haz = hazDeLuz(ojo.s.position, pecho(o), col('Clarividente'));
  await rayo(desde.add(V(0, 0.3, 0)), pecho(o), col('Clarividente'), { color2: col2('Clarividente'), alto: 1.0 });
  sin(destello(pecho(o), col('Clarividente'), 2, 0.8));
  const giro = cadaFrame((dt, t) => { for (let i = 0; i < 2; i++) { const an = t * 6 + i * Math.PI, y = (t * 0.9 + i * 0.5) % 1 * 2; chispas(o.position.clone().add(V(Math.cos(an) * 0.75, y, Math.sin(an) * 0.75)), { n: 1, color: col('Clarividente'), color2: 0xffffff, vel: 0.05, vida: 0.6, tam: 0.12 }); } });
  await aclararCapa(o, 'Maestro'); await espera(0.6); giro(); haz.apagar(); ojo.cerrar();
  di('…y un velo de bruma impide a los demás ver ninguna de las dos.');
  S.velo();
  await tw(2.6, (k, kl) => { for (const x of [v, o]) { const an = kl * 14 + (x === v ? 0 : 2); humo(x.position.clone().add(V(Math.cos(an) * 0.8, 0.2, Math.sin(an) * 0.8)), { n: 1, color: 0x7fd8e8, radio: 0.1, alfa: 0.4, sube: 0.9 }); chispas(x.position.clone().add(V(Math.cos(an) * 0.8, 0.3, Math.sin(an) * 0.8)), { n: 1, color: col('Clarividente'), vel: 0.1, dir: V(0, 0.8, 0), vida: 1 }); } });
  posar(c, null, 4); r.userData.apagar(); c.userData.rumbo = 0; await espera(1.6);
});

escena('6.11', 'Habilidades', 'Ocultista', async () => {
  sin(plano(dos(POS[0], POS[3], 3.4), 0));
  const c = actor('Ocultista', sobre(0)), t = actor('Estratega', sobre(3)); const ms = materialesDe(t);
  di('Ocultista: envuelve en sombra a quien ocupa un Portal; la carta queda bocabajo, como si no hubiera nadie…');
  await espera(1.2);
  S.ocultista(); await hechizo(c, pecho(t), { f: 110, pose: 'juntas', lanza: 'lanzar', nota: 130 });
  sin(tw(1.2, () => humo(t.position, { n: 2, color: 0x141230, radio: 0.4, sube: 1.4, alfa: 0.85 })));
  await tw(1.2, k => opacidad(t, 1 - k, ms)); encender(portales[3], 0.12); t.visible = false;
  await espera(1.4);
  di('…y, si la carta estaba oculta, la devuelve a la luz.');
  S.revelar(); await hechizo(c, sobre(3).add(V(0, 1, 0)), { f: 160, pose: 'juntas', lanza: 'celebrar', nota: 523 });
  t.visible = true; chispas(pecho(t), { n: 30, color: col('Ocultista'), color2: 0xffffff, vel: 0.9, vida: 1.2 });
  await tw(0.9, k => opacidad(t, k, ms)); encender(portales[3], 1.4);
  await espera(1.8);
});

escena('6.12', 'Habilidades', 'Centinela', async () => {
  sin(plano(dos(POS[0], POS[4], 4.2), 0));
  const c = actor('Centinela', sobre(0)), malo = actor('Ocultista', sobre(4));
  di('Centinela: la única que no es maga. Lo suyo es físico: planta la lanza y sus escudos rodean el Portal…');
  await espera(1.2); mirar(malo, POS[0]); mirar(c, POS[4]);
  const r = runa(malo.position, col('Ocultista'), 0.95); S.cargar(110, 1.2);
  sin(conjurar(malo, { pose: 'juntas', dur: 1.2 }).then(async desde => {
    const dir = POS[4].clone().sub(POS[0]).setY(0).normalize(), p = sobre(0).add(dir.multiplyScalar(1.8)).add(V(0, 1.0, 0));
    S.lanzar(300); await rayo(desde, p, col('Ocultista'), { alto: 1.6, dur: 1.0, tam: 0.8 });
    S.clang(); temblar(0.3);
    chispas(p, { n: 40, color: 0xffb060, color2: 0xfff0c0, vel: 2.4, grav: 5, vida: 0.8, tam: 0.1 });
    S.zas(); sin(rayo(p, p.clone().add(V(3, 5, -2)), col('Ocultista'), { alto: 0.3, dur: 0.6 })); r.userData.apagar();
  }));
  posar(c, 'lanzaAlta', 7); await espera(0.55); posar(c, 'lanzaGolpe', 20); await espera(0.14);
  S.golpeSuelo(); temblar(0.22); humo(c.position.clone().add(V(-0.3, 0, 0.3)), { n: 10, color: 0xa89a88, radio: 0.4, sube: 0.3 });
  await espera(0.3); posar(c, 'bloqueo', 14); escudos(0);
  await espera(1.6);
  di('…señal para toda la mesa de que ningún hechizo puede tocar sus Portales mientras ella siga a la vista.');
  posar(c, 'guardia', 5); await espera(0.5); c.userData.rumbo = 0; malo.userData.rumbo = 0; posar(malo, 'apuro', 6);
  await espera(2.2);
});

escena('6.13', 'Habilidades', 'Metamorfo', async () => {
  sin(plano({ ...T.mio(), ancho: 4.8, alto: 3.8, objetivo: m0(1.1, 0.3) }, 0));
  const c = actor('Metamorfo', sobre(0)); const gs = misGemas(3);
  di('Metamorfo: pago una Gema azul…');
  await espera(1.2); posar(c, 'abierto', 5); S.gemaVuela();
  await volar(gs[0], pecho(c).add(V(0, 0, 0.3)), 0.9, 1.0); S.pagar(); chispas(gs[0].position, { n: 22, color: 0x4aa8ff, color2: 0xffffff, vel: 0.8 }); quitar(gs[0]);
  di('…y adopta el aspecto de otro personaje (aquí, el Cronomante). Conserva su melena rosa y su humo: sigue siendo él.');
  const r = runa(c.position, col('Metamorfo'), 1.0, 3);
  posar(c, 'alzar', 5); S.cargar(196, 0.8); await espera(0.8); S.metamorfo();
  await transformar(c, 'Cronomante', kl => { for (let i = 0; i < 3; i++) { const an = kl * 16 + i * 2.1; chispas(c.position.clone().add(V(Math.cos(an) * 0.6, 0.2 + kl * 1.6, Math.sin(an) * 0.6)), { n: 1, color: col('Metamorfo'), color2: col2('Metamorfo'), vel: 0.15, vida: 0.9, tam: 0.2 }); }
    if (Math.random() < 0.3) humo(c.position, { n: 1, color: 0xf0a8d0, radio: 0.4, alfa: 0.35 }); },
    m => m.art.pelo.forEach(p => p.color.set(0xf0b8d8)));
  S.impacto(523); onda(sobre(0), col('Metamorfo'), 1, 30); r.userData.apagar();
  await espera(2.6);
});

escena('6.14', 'Habilidades', 'Entusiasta', async () => {
  sin(plano({ ...T.mio(), ancho: 5.2, alto: 4.4, objetivo: m0(1.3, 0.4) }, 0));
  const c = actor('Entusiasta', sobre(0)); const gs = misGemas(3);
  di('Entusiasta (pasiva): cuando una invocación tiene éxito, lo celebra con tanto ímpetu…');
  await espera(1.4); await destelloInvocacion();
  posar(c, 'celebrar', 10); S.entusiasta(); S.boing(); await saltar(c, 0.45, 0.45);
  S.boing(); S.entusiasta(); await saltar(c, 0.6, 0.6, Math.PI * 2);
  di('…que su dueño pierde una Gema azul.');
  sin(caminar(c, sobre(0).add(V(-0.2, 0, 0.75)), { vel: 2.6, mudo: true }));
  await espera(0.25); S.boing(); const g = gs[1];
  await volar(g, V(1.8, 2.6, POS[0].z + 0.8), 0.7, 1.2, 0, sale); romperGema(g);
  posar(c, 'apuro', 10); S.ups(); await espera(1.2);
  sin(caminar(c, sobre(0), { vel: 1 })); posar(c, null, 4);
  await espera(1.8);
});

// ------------------------------------------------------------ invocación
async function invocacion({ criatura, mesa, need, duplicado }) {
  sin(plano(T.general(), 0));
  const O = centro(), R = O.clone().add(V(0, 0, -0.6)), sitioCr = O.clone().add(V(0, 0, -1.3));
  const ac = mesa.map((n, i) => actor(n, sobre(i)));
  const req = ac.filter(a => need.includes(a.userData.nombre));
  const tono = col(criatura), tono2 = col2(criatura), F = R.clone().add(V(0, 3.9, 0));
  const vista = (o = {}) => { const g = T.general(); return { ...g, ...o }; };
  di('Los tres personajes requeridos están visibles en Portales distintos y todos los Portales están ocupados. Las runas despiertan…');
  await espera(1.6);
  for (let i = 0; i < 5; i++) { encender(portales[i], 1.6); S.runa(i * 2); onda(sobre(i), portales[i].userData.tono, 1, 26, 1.8); await espera(0.32); }
  di('…los invocadores alzan su magia y la funden en el cielo.');
  // El gran círculo lleva la misma estrella que tendrá el Portal que nazca de él.
  const gran = runa(R, tono, 5.4, 0.5, portales[5].userData.variante.puntas), gran2 = runa(R.clone().add(V(0, 0.01, 0)), tono2, 3.3, -0.9, 6);
  S.invInicio(4.2);
  req.forEach(a => { mirar(a, F); posar(a, 'alzar', 4); a.userData.elevaObj = 0.3; });
  sin(plano(vista({ objetivo: R.clone().setY(2.1), polar: 1.28, azimut: 0.25 }), 4.2));
  await tw(4.2, (k, kl) => {
    for (const a of req) { const c = col(a.userData.nombre), p = arco(mano(a), F, (kl * 4 + a.position.x) % 1, 1.2); chispas(p, { n: 2, color: c, color2: 0xffffff, vel: 0.12, vida: 0.5, tam: 0.14 + kl * 0.1 }); }
    const an = kl * 30, rr = 2.6 * (1 - kl) + 0.2; chispas(F.clone().add(V(Math.cos(an) * rr, Math.sin(an * 0.7) * 0.4, Math.sin(an) * rr)), { n: 2, color: tono, color2: tono2, vel: 0.1, vida: 0.7, tam: 0.2 });
    if (Math.random() < kl) chispas(R.clone().add(V((Math.random() - 0.5) * 8, 0.1, (Math.random() - 0.5) * 8)), { n: 1, color: tono, vel: 0.1, dir: V(0, 2.5, 0), vida: 1.2 });
    mundo.cam.temblor = Math.max(mundo.cam.temblor, kl * kl * 0.06);
  }, lineal);
  // ¡Estallido! La criatura cruza el umbral.
  S.invBoom(); ui.flash(0.9); temblar(0.6); sin(destello(F, 0xffffff, 12, 1.4)); onda(R, tono, 3, 60, 4); onda(R, tono2, 2, 40, 2.5);
  chispas(F, { n: 120, color: tono, color2: tono2, vel: 3.2, vida: 1.8, grav: 0.8, tam: 0.22 });
  req.forEach(a => { posar(a, null, 3); a.userData.elevaObj = 0; a.userData.rumbo = 0; });
  di(`¡${criatura} cruza el umbral!`);
  const cr = actor(criatura, sitioCr.clone().setY(-5)); const msC = materialesDe(cr); opacidad(cr, 0, msC); cr.userData.sombra.visible = false;
  const alred = (ancho, y0, y1) => sitioCr.clone().add(V((Math.random() - 0.5) * ancho, y0 + Math.random() * (y1 - y0), (Math.random() - 0.5) * 1.2));
  S.invCoro(9); sin(plano({ objetivo: sitioCr.clone().setY(2.9), ancho: 9.5, alto: 9.4, polar: 1.38, azimut: -0.2 }, 3));
  await tw(3.0, (k, kl) => { cr.position.y = mezcla(-5, 0.5, k); opacidad(cr, Math.min(1, kl * 2), msC);
    for (let i = 0; i < 3; i++) chispas(alred(2.4, 0, 4.5), { n: 1, color: tono, color2: tono2, vel: 0.3, dir: V(0, 1.2, 0), vida: 1.1, tam: 0.2 }); }, sale);
  let flota = true; cadaFrame((dt, t) => { if (!flota) return; cr.position.y = 0.5 + Math.sin(t * 1.1) * 0.12; if (Math.random() < 0.5) chispas(alred(2, 0.5, 4.5), { n: 1, color: tono, color2: tono2, vel: 0.2, dir: V(0, 0.5, 0), vida: 1 }); });
  posar(cr, 'alzar', 3); await espera(1.0);
  // Las Gemas de la invocación orbitan a su alrededor.
  di('En agradecimiento, ofrece sus Gemas y las hace levitar hasta quienes la invocaron.');
  const C = sitioCr.clone().add(V(0, 3.9, 0.2)), tipo = INFO[criatura].gema;
  const gs = Array.from({ length: 5 }, (_, i) => { const g = temp(gema(tipo, 1.25)); g.position.copy(C); g.userData.orbita = true; g.userData.an = i / 5 * Math.PI * 2; return g; });
  let radio = 0; sin(tw(1.0, k => { radio = 1.5 * k; }, sale));
  cadaFrame((dt, t) => gs.forEach(g => { g.rotation.y += dt * 2.5; if (g.userData.orbita) { g.userData.an += dt * 1.3; g.position.set(C.x + Math.cos(g.userData.an) * radio, C.y + Math.sin(g.userData.an * 2 + t) * 0.15, C.z + 0.3 + Math.sin(g.userData.an) * radio * 0.55); } }));
  gs.forEach((g, i) => sin(espera(i * 0.12).then(() => S.gema(i))));
  posar(cr, 'ofrenda', 3); await espera(1.6);
  sin(plano(vista({ polar: 1.08 }), 1.6));
  // Reparto: solo a requeridos únicos que estén en el Portal de un jugador (0, 1 y 2).
  const dup = duplicado ? ac.filter(a => a.userData.nombre === duplicado) : [];
  let n = 0;
  for (const nombre of need) {
    const quienes = ac.filter(a => a.userData.nombre === nombre);
    if (quienes.length === 1 && ac.indexOf(quienes[0]) < 3) {
      const a = quienes[0], g = gs[n++]; g.userData.orbita = false; S.gemaVuela();
      await volar(g, cabeza(a).add(V(0, 0.15, 0)), 1.4, 2.0, n % 2 ? 0.12 : -0.12);
      S.gema(n * 2); chispas(g.position, { n: 22, color: tono, color2: 0xffffff, vel: 0.7 }); posar(a, 'celebrar', 8); sin(saltar(a, 0.2, 0.4)); sin(espera(1.1).then(() => posar(a, null, 4)));
      await espera(0.45);
    }
  }
  if (dup.length > 1) {
    di(`Pero hay dos ${duplicado}s a la vista: la invocación duda, no sabe a cuál enviar la Gema…`);
    const g = gs[n]; g.userData.orbita = false; const pa = cabeza(dup[0]).add(V(0, 0.5, 0)), pb = cabeza(dup[1]).add(V(0, 0.5, 0)), medio = pa.clone().lerp(pb, 0.5).add(V(0, 1.6, 0));
    await volar(g, medio, 1.0, 0.8);
    for (let i = 0; i < 4; i++) { const hacia = i % 2 ? pb : pa; posar(cr, hacia.x < sitioCr.x ? 'dudaD' : 'dudaI', 6); S.duda(); posar(dup[i % 2], 'celebrar', 6); posar(dup[1 - i % 2], null, 6);
      await volar(g, medio.clone().lerp(hacia, 0.6), 0.6 - i * 0.05, 0.25); await volar(g, medio, 0.5 - i * 0.04, 0.2); }
    dup.forEach(a => posar(a, 'apuro', 6)); posar(cr, 'ofrenda', 4);
    di('…así que no se la da a nadie: esa Gema vuelve con la criatura.');
    S.perdida(); g.userData.brillo.material.opacity = 0.3;
    await volar(g, C.clone().add(V(0, 0, 0.3)), 1.3, 0.8); g.userData.brillo.material.opacity = 0.6; g.userData.an = 0; g.userData.orbita = true;
    await espera(0.8); dup.forEach(a => posar(a, null, 4));
  }
  di('Siempre sobran Gemas: las que nadie recibe se van con la criatura.');
  await espera(0.9);
  const resto = gs.slice(n); resto.forEach(g => { g.userData.orbita = false; });
  await Promise.all(resto.map((g, i) => espera(i * 0.15).then(() => volar(g, C.clone().add(V(0, -0.8, 0)), 0.8, 0.3)).then(() => { chispas(g.position, { n: 8, color: tono, vel: 0.4 }); quitar(g); })));
  // La criatura parte; el círculo de la invocación se encoge y queda como la runa del nuevo Portal.
  di('La criatura parte. El círculo de la invocación deja su marca en el suelo, se encoge…');
  posar(cr, 'alzar', 3); S.seMarcha(); flota = false; gran2.userData.apagar(1.5);
  sin(plano({ objetivo: POS[5].clone().lerp(R, 0.4).setY(1.4), ancho: 9.5, alto: 7.5, polar: 1.1, azimut: 0.3 }, 2.5));
  const y0 = cr.position.y;
  await tw(2.2, (k, kl) => { opacidad(cr, 1 - k, msC); cr.position.y = y0 + k * 3; chispas(alred(1.6, 1, 6), { n: 2, color: tono, color2: tono2, vel: 0.4, dir: V(0, 2, 0), vida: 1.2 }); }, entra);
  quitarActor(cr);
  const de = gran.position.clone(), a5 = POS[5].clone().setY(0.04); S.cargar(160, 2.0);
  await tw(2.2, k => { gran.position.lerpVectors(de, a5, k); gran.scale.setScalar(mezcla(5.4, 1.03, k)); if (Math.random() < 0.6) { const an = Math.random() * 6.28, rr = gran.scale.x; chispas(gran.position.clone().add(V(Math.cos(an) * rr, 0.05, Math.sin(an) * rr)), { n: 1, color: tono, vel: 0.1, dir: V(0, 0.8, 0), vida: 0.8 }); } });
  di('…y se convierte en la runa de un nuevo Portal, que se alza a su alrededor.');
  S.impacto(523); onda(a5, tono, 1, 30, 1.6); await espera(0.7);
  const nuevo = portales[5]; nuevo.visible = true; nuevo.position.set(POS[5].x, -3.2, POS[5].z); encender(nuevo, 0.05);
  S.piedra(); const b = cadaFrame(() => { mundo.cam.temblor = Math.max(mundo.cam.temblor, 0.05); if (Math.random() < 0.5) humo(POS[5], { n: 1, color: 0x9a94a8, radio: 1.3 }); });
  await tw(2.6, k => { nuevo.position.y = mezcla(-3.2, 0, k); gran.position.y = Math.max(0.04, nuevo.position.y + ALTURA_TARIMA + 0.02); }, sale); b();
  S.golpeSuelo(); temblar(0.3); encender(nuevo, 1.6); S.runa(9); onda(POS[5], nuevo.userData.tono, 1.2, 40, 2.4); gran.userData.apagar(1.2);
  portales.slice(0, 5).forEach(p => encender(p, 0.7));
  sin(plano(vista({ azimut: 0.2 }), 2.5)); await espera(3.4);
}
escena('7a', 'Invocación', 'Invocación de Cirelia', () => invocacion({ criatura: 'Cirelia', need: ['Aprendiz', 'Centinela', 'Pícaro'], mesa: ['Aprendiz', 'Centinela', 'Pícaro', 'Lumo', 'Cronista'] }));
escena('7b', 'Invocación', 'Invocación con un personaje repetido', () => invocacion({ criatura: 'Baelorith', need: ['Estratega', 'Cronomante', 'Cronista'], mesa: ['Cronista', 'Estratega', 'Cronista', 'Reena', 'Cronomante'], duplicado: 'Cronista' }));

// ------------------------------------------------ colocar Portales a mano
let colocando = false, agarrado = -1, gancho = null;
const _ray = new THREE.Raycaster(), _suelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), _pt = new THREE.Vector3();
function puntoSuelo(e) { const r = mundo.lienzo.getBoundingClientRect(); _ray.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1), mundo.camara); return _ray.ray.intersectPlane(_suelo, _pt) ? _pt.clone() : null; }
function prepararColocacion() {
  // Gancho de grúa: cable que baja del cielo y garfio que sujeta el Portal por arriba.
  gancho = new THREE.Group(); const metal = new THREE.MeshLambertMaterial({ color: 0xd8dce8, emissive: 0x30344a });
  const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 30, 5), metal); cable.position.y = 15.6;
  const garfio = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 14, Math.PI * 1.5), metal); garfio.position.y = 0.3; garfio.rotation.z = Math.PI * 0.75;
  const barra = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.07, 0.07), metal);
  gancho.add(cable, garfio, barra); gancho.visible = false; mundo.escena.add(gancho);
  const el = mundo.lienzo; let alto = 0, altoObj = 0, bajaGancho = 20;
  el.addEventListener('pointerdown', e => { if (!colocando || agarrado >= 0) return; const p = puntoSuelo(e); if (!p) return;
    let mejor = -1, d = 2.2; portales.forEach((po, i) => { const q = po.position.distanceTo(p); if (q < d) { d = q; mejor = i; } });
    if (mejor < 0) return; agarrado = mejor; altoObj = 0.9; bajaGancho = 12; gancho.visible = true; S.zas(); });
  el.addEventListener('pointermove', e => { if (!colocando || agarrado < 0) return; const p = puntoSuelo(e); if (!p) return;
    p.x = Math.max(-12, Math.min(12, p.x)); p.z = Math.max(-12, Math.min(12, p.z)); portales[agarrado].position.x = p.x; portales[agarrado].position.z = p.z; });
  const soltar = () => { if (agarrado < 0) return; const i = agarrado; agarrado = -1; altoObj = 0; POS[i].set(portales[i].position.x, 0, portales[i].position.z); orientar();
    S.golpeSuelo(); humo(POS[i], { n: 12, color: 0x9a94a8, radio: 1.2 }); try { localStorage.setItem('inv3d.portales', JSON.stringify(POS.map(p => [+p.x.toFixed(2), +p.z.toFixed(2)]))); } catch { /* sin almacenamiento */ } };
  el.addEventListener('pointerup', soltar); el.addEventListener('pointercancel', soltar);
  let ultimo = 0;
  siempre(dt => { if (!colocando) return;
    alto += (altoObj - alto) * Math.min(1, dt * 9); bajaGancho += ((agarrado >= 0 ? 0 : 20) - bajaGancho) * Math.min(1, dt * (agarrado >= 0 ? 12 : 3));
    const i = agarrado >= 0 ? (ultimo = agarrado) : ultimo; portales.forEach((p, n) => { p.position.y = n === i ? alto : 0; });
    gancho.position.set(portales[i].position.x, 3.05 + alto + bajaGancho, portales[i].position.z - 0.78); gancho.visible = bajaGancho < 19; });
}
/** Entra o sale del modo de colocar los Portales arrastrándolos. */
export function modoColocar(si) {
  limpiar(); colocando = si; mundo.bloqueoCamara = si; portales[5].visible = si; agarrado = -1; if (gancho) gancho.visible = false;
  portales.forEach(p => { p.position.y = 0; });
  if (si) { ui.di('Arrastra cada Portal a donde mejor te quede en tu pantalla. Un gancho lo levanta por arriba y lo suelta donde lo dejes.'); sin(plano({ objetivo: V(0, 0, 1.5), ancho: 15, alto: 15, polar: 0.42, azimut: 0 }, 0.8)); }
}
export function restablecerPortales() { POS_INICIAL.forEach(([x, z], i) => { POS[i].set(x, 0, z); portales[i].position.copy(POS[i]); }); orientar(); try { localStorage.removeItem('inv3d.portales'); } catch { /* sin almacenamiento */ } }

export { ESCENAS };
/** Lanza una escena (cancela la que hubiera). Devuelve true si llegó al final. */
export async function reproducir(id) {
  limpiar();
  const e = ESCENAS.find(x => x.id === id); if (!e) return false;
  try { await e.run(); return true; } catch (err) { if (err !== CANCELADO) { console.error(err); ui.di('Error en la escena: ' + err.message); } return false; }
}
