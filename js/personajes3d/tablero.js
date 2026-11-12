// Escenario (1.36.0): la partida entera en 3D, sin cartas. Cada Portal de la
// mesa es un umbral de piedra con su personaje encima, las cartas de cada
// mano son figuras encapuchadas junto a los Portales de su dueña y todo lo
// que pasa en la partida se ve con los personajes: suben la escalinata, se
// quitan el manto, conjuran, se intercambian, llega la criatura invocada…
//
// Solo presentación. No contiene ni una regla: lee la vista pública que ya
// calcula vista-mesa.js (construirVistaMesa: una carta que quien mira no
// puede ver llega con `nombre: null`, así que aquí nunca hay un modelo dentro
// de un encapuchado opaco) y cuenta los toques a mesa3d.js, que es quien
// llama a las acciones de siempre (actions.js).
//
// Cómo se anima: cada vez que la partida se repinta, el tablero compara lo
// que enseña con lo nuevo (por Portal y por hueco de mano) y escenifica la
// diferencia. espectaculo.js le avisa además de quién ha jugado, qué
// habilidad se ha activado y qué invocación se ha completado, y espera a que
// termine (ocupado / cuandoLibre) antes de pasar el turno.
import { THREE, mundo, crearMundo, tw, espera, V, lineal, sale, arco, pausar, reanudar, siempre, cancelarTodo, CANCELADO } from './mundo.js';
import { crearEfectos, chispas, humo, onda, destello, rayo, gema, quitar } from './efectos.js';
import { crearPortal, encender, VARIANTES, ALTURA_TARIMA, texturaDisco, nombrarPortal } from './portales.js';
import { crearActor, quitarActor, INFO, posar, mano, caminar, quitarCapa, aclararCapa, opacarCapa, conjurar, transformar, opacidad, materialesDe } from './personajes.js';
import { S, iniciarAudio, ponerSonido } from './sonido.js';
import { firmaPortal, cambioPortal } from '../vista-mesa.js';

const SEP = 3.5;                 // distancia entre Portales vecinos
const CRIATURA_POR_NIVEL = { C: 'Cirelia', B: 'Baelorith', A: 'Aelgorth', '*': 'Aelgorth' };
const COLOR_ESTADO = { destino: 0xffd36a, objetivo: 0x5fe8ff, activable: 0xc58bff };
const CLAVE_POSICIONES = 'inv3d.tablero';

let lienzo = null, visible = false, construido = false, firmaPartida = '';
const portales = new Map();      // clave → { g, actor, firma, cv, altura, insignia, anillo, nombre, estado, nuevo }
const manos = new Map();         // idx de jugadora → [{ actor, firma, cv, lado }]
const actores = new Set();
let disp = null;                 // disposición actual (posiciones de Portales, manos y asientos)
let inter = { estados: new Map(), seleccion: null, propio: null, jugable: false };
let selPrevia = null;            // última carta elegida de la mano propia (para saber cuál se jugó)
let alTocar = () => {};
let mazo = null;
let desplaz = {};
try { desplaz = JSON.parse(localStorage.getItem(CLAVE_POSICIONES) ?? '{}') || {}; } catch { desplaz = {}; }

// ---------------------------------------------------------------- arranque

const CSS = `
#tablero3d{position:fixed;inset:0;width:100%;height:100%;display:block;z-index:40;touch-action:none;background:#0a0f24;-webkit-tap-highlight-color:transparent}
#tablero3d.oculto{display:none}`;

export function iniciar() {
  if (lienzo) return;
  const estilo = document.createElement('style'); estilo.textContent = CSS; document.head.appendChild(estilo);
  lienzo = document.createElement('canvas'); lienzo.id = 'tablero3d'; lienzo.className = 'oculto';
  lienzo.setAttribute('aria-label', 'Escenario 3D de la partida'); document.body.appendChild(lienzo);
  let calidad = 'alta';
  try { calidad = localStorage.getItem('inv3d.calidad') ?? (Math.min(innerWidth, innerHeight) < 600 ? 'baja' : 'alta'); } catch { /* por defecto */ }
  try { crearMundo(lienzo, calidad, { controles: false }); } catch (e) { lienzo.remove(); lienzo = null; throw e; }
  mundo.escena.fog.density = 0.017;
  mundo.velocidad = 1.5;
  crearEfectos();
  controles(lienzo);
  siempre(seguir);
  pausar();
  // Al girar el móvil la mesa se vuelve a disponer (vertical: más estrecha y alargada).
  window.addEventListener('resize', () => { if (visible && construido && ultimaVista && !pendiente) { pendiente = ultimaVista; if (!temporizador && !trabajando) temporizador = setTimeout(procesar, 0); } });
  window.addEventListener('unhandledrejection', e => { if (e.reason === CANCELADO) e.preventDefault(); });
}

export function mostrar() {
  if (!lienzo) iniciar();
  if (visible) return;
  visible = true; lienzo.classList.remove('oculto'); reanudar();
}

/** Se oculta (vuelta a la Mesa): se corta lo que estuviera en marcha y la próxima vez se monta de cero. */
export function ocultar() {
  if (!lienzo || !visible) return;
  visible = false; lienzo.classList.add('oculto');
  cortar(); pausar(); construido = false;
  avisarLibres();
}

/** Partida nueva o vuelta al menú: se vacía el escenario. Las esperas pendientes se descartan. */
export function reiniciar() {
  esperas = [];
  if (!lienzo) return;
  cortar(); construido = false; firmaPartida = '';
  for (const a of [...actores]) retirar(a);
  manos.clear();
  for (const p of portales.values()) { p.g.visible = false; p.actor = null; }
  if (visible) { visible = false; lienzo.classList.add('oculto'); pausar(); }
}

function cortar() { pendiente = null; anuncios = []; clearTimeout(temporizador); temporizador = null; cancelarTodo(); trabajando = false; }

export function fijarAlTocar(fn) { alTocar = fn; }
export function fijarSonido(si, gesto = false) { ponerSonido(si); if (si && gesto) iniciarAudio(); }

// ------------------------------------------------- cola de actualizaciones

let pendiente = null, anuncios = [], trabajando = false, temporizador = null, esperas = [];

/**
 * La mesa se ha repintado. `vista` es construirVistaMesa(); `interaccion`
 * dice qué Portales brillan y por qué ('destino' | 'objetivo' | 'bloqueado'
 * | 'activable'), qué carta propia está elegida y si se puede jugar.
 */
export function actualizar({ vista, interaccion, margenes }) {
  if (!lienzo) iniciar();
  mostrar();
  inter = interaccion;
  if (margenes) margen = margenes;
  if (inter.seleccion !== null && inter.seleccion !== undefined) selPrevia = inter.seleccion;
  const firma = [vista.propio, ...vista.rivales].map(a => a.nombre).sort().join('|') + '#' + (vista.propio.portales.length + vista.rivales.length);
  if (firma !== firmaPartida) { if (firmaPartida) reiniciar(); firmaPartida = firma; mostrar(); construido = false; }
  pendiente = vista;
  if (!temporizador && !trabajando) temporizador = setTimeout(procesar, 0);
}

/** espectaculo.js cuenta qué ha pasado: { tipo: 'carta' | 'habilidad' | 'invocacion', ... }. */
export function anunciar(ev) {
  if (!visible) return;
  anuncios.push(ev);
  if (!temporizador && !trabajando) temporizador = setTimeout(procesar, 0);
}

export const ocupado = () => visible && (trabajando || !!pendiente || !!temporizador || anuncios.length > 0);
export function cuandoLibre() { return ocupado() ? new Promise(r => esperas.push(r)) : Promise.resolve(); }
function avisarLibres() { if (ocupado()) return; const e = esperas; esperas = []; e.forEach(r => r()); }

async function procesar() {
  temporizador = null;
  if (trabajando) return;
  trabajando = true;
  try {
    while (visible && (pendiente || anuncios.length)) {
      const v = pendiente ?? ultimaVista; pendiente = null;
      const an = anuncios; anuncios = [];
      if (!v) break;
      mundo.velocidad = pendiente ? 2.4 : 1.5;
      if (!construido) construir(v); else await aplicar(v, an);
      ultimaVista = v;
    }
  } catch (e) {
    if (e !== CANCELADO) { console.error(e); construido = false; }
  } finally {
    trabajando = false;
    if (visible && pendiente) temporizador = setTimeout(procesar, 0);
    else avisarLibres();
  }
}
let ultimaVista = null;

// ------------------------------------------------------------ disposición

const giro = (x, z) => {   // los Portales miran sobre todo hacia quien mira la pantalla, algo girados hacia el centro
  const d = Math.hypot(x, z) || 1, fx = -x / d * 0.5, fz = 1 - z / d * 0.5;
  return z > 1 && Math.abs(x) < 1 ? 0 : Math.atan2(fx, fz);
};

function disponer(v) {
  const asientos = [v.propio, ...v.rivales], n = asientos.length;
  // En vertical (móvil) la mesa se estrecha y se alarga para llenar la pantalla.
  const vertical = (lienzo?.clientHeight ?? 0) > (lienzo?.clientWidth ?? 1) * 1.1;
  const ex = vertical ? 0.55 : 1, ez = vertical ? 1.4 : 1;
  const rx = (n <= 2 ? 0 : n === 3 ? 6.8 : 7.8) * ex, rz = (n <= 2 ? 5.6 : n === 3 ? 5.8 : 6.2) * ez;
  const d = { portales: new Map(), manos: new Map(), asientos: new Map(), n, polar: vertical ? 0.74 : 0.92 };
  asientos.forEach((a, k) => {
    const th = Math.PI / 2 + k * 2 * Math.PI / n;
    const cx = Math.abs(Math.cos(th)) < 1e-6 ? 0 : Math.cos(th) * rx, cz = Math.sin(th) * rz;
    const t = V(Math.sin(th), 0, -Math.cos(th)), u = V(Math.cos(th), 0, Math.sin(th));
    const rot = giro(cx, cz), np = a.portales.length;
    a.portales.forEach((pv, j) => {
      const off = (j - (np - 1) / 2) * SEP;
      d.portales.set(`${a.idx}:${j}`, { pos: V(cx + t.x * off, 0, cz + t.z * off), rot, nombre: a.nombre, rel: `${n}|${k}:${j}` });
    });
    const abre = (np - 1) / 2 * SEP + 2.05;
    d.asientos.set(a.idx, { pos: V(cx, 0, cz), rot, t, u, abre, nombre: a.nombre, activa: a.activa });
  });
  const nc = v.centrales.length;
  v.centrales.forEach((pv, c) => d.portales.set(`n:${c}`, { pos: V((c - (nc - 1) / 2) * SEP, 0, n === 3 ? -0.4 : 0), rot: 0, nombre: null, rel: `${n}|n:${c}` }));
  d.mazo = nc ? V(0, 0, n === 3 ? -2.9 : -2.7) : V(0, 0, 0);
  d.centro = V(0, 0, nc ? 0 : 0);
  // Encuadre: todo lo que hay en la mesa.
  const xs = [], zs = [];
  d.portales.forEach(p => { xs.push(p.pos.x); zs.push(p.pos.z); });
  d.asientos.forEach(s => { xs.push(s.pos.x + s.t.x * s.abre, s.pos.x - s.t.x * s.abre); zs.push(s.pos.z + s.t.z * s.abre, s.pos.z - s.t.z * s.abre); });
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const prof = vertical ? 0.8 : 0.62;
  d.camara = { objetivo: V((x0 + x1) / 2, 0.9, (z0 + z1) / 2 + 0.5), ancho: x1 - x0 + 3.6, alto: (z1 - z0) * prof + 5.4 };
  return d;
}

function posPortal(clave) {
  const d = disp?.portales.get(clave); if (!d) return null;
  const o = desplaz[d.rel];
  return o ? d.pos.clone().add(V(o[0], 0, o[1])) : d.pos.clone();
}

function posMano(idx, lado) {
  const s = disp?.asientos.get(idx); if (!s) return null;
  return { pos: s.pos.clone().addScaledVector(s.t, lado * s.abre).addScaledVector(s.u, 0.35), rot: s.rot };
}

function anclaPos(an) {
  if (an.tipo === 'portal') { const p = portales.get(an.clave); return p ? { pos: p.g.position.clone().add(V(0, ALTURA_TARIMA, 0)), rot: p.g.rotation.y, fija: true } : null; }
  if (an.tipo === 'mano') return posMano(an.idx, an.lado);
  return null;
}

// ------------------------------------------------------- piezas del tablero

let matProxy, geoProxyPortal, geoProxyMano, geoAnillo;
function proxy(geo, pick, y) {
  matProxy ??= new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false, colorWrite: false });
  const m = new THREE.Mesh(geo, matProxy); m.position.y = y; m.userData.pick = pick; pickables.add(m); return m;
}
const pickables = new Set();

let nPortales = 0;
function asegurarPortal(clave) {
  let p = portales.get(clave);
  if (p) return p;
  const i = nPortales++;
  const g = crearPortal(VARIANTES[(i + 2) % VARIANTES.length], i + 1);
  geoProxyPortal ??= new THREE.CylinderGeometry(1.55, 1.55, 3.3, 10);
  g.add(proxy(geoProxyPortal, { tipo: 'portal', clave }, 1.55));
  geoAnillo ??= new THREE.PlaneGeometry(2, 2);
  const anillo = new THREE.Mesh(geoAnillo, new THREE.MeshBasicMaterial({ map: texturaDisco(12), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  anillo.rotation.x = -Math.PI / 2; anillo.position.y = ALTURA_TARIMA + 0.03; anillo.scale.setScalar(1.55); anillo.renderOrder = 13; g.add(anillo);
  const insignia = textoSprite(''); insignia.position.set(1.05, 0.62, 1.15); g.add(insignia);
  mundo.escena.add(g);
  p = { g, actor: null, firma: undefined, cv: null, altura: 0, insignia, anillo, nombre: undefined, estado: '', nuevo: false };
  portales.set(clave, p);
  return p;
}

function textoSprite(texto, o = {}) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96;
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false }));
  const alto = o.alto ?? 0.36; sp.scale.set(alto * 256 / 96, alto, 1); sp.renderOrder = 30;
  sp.userData.poner = t => {
    const x = c.getContext('2d'); x.clearRect(0, 0, 256, 96); sp.visible = !!t; if (!t) return;
    x.font = `700 ${o.letra ?? 52}px system-ui, sans-serif`; const w = Math.min(244, x.measureText(t).width + 44);
    x.fillStyle = o.fondo ?? 'rgba(12,9,34,.82)'; x.strokeStyle = o.borde ?? 'rgba(255,255,255,.45)'; x.lineWidth = 4;
    x.beginPath(); x.roundRect((256 - w) / 2, 12, w, 72, 36); x.fill(); x.stroke();
    x.fillStyle = o.color ?? '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(t, 128, 50);
    tex.needsUpdate = true;
  };
  sp.userData.poner(texto);
  return sp;
}

function crearMazo() {
  const g = new THREE.Group();
  const piedra = new THREE.MeshLambertMaterial({ color: 0x4a5282, flatShading: true });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.65, 0.3, 8), piedra); base.position.y = 0.15; g.add(base);
  const cristal = new THREE.Mesh(new THREE.OctahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color: 0x2b2740, emissive: 0x3a2a80, flatShading: true }));
  cristal.position.y = 0.95; cristal.scale.set(1, 1.5, 1); g.add(cristal);
  const ins = textoSprite('', { alto: 0.34 }); ins.position.set(0, 1.75, 0); g.add(ins);
  siempre((dt, t) => { cristal.rotation.y = t * 0.6; cristal.position.y = 0.95 + Math.sin(t * 1.4) * 0.06; });
  mundo.escena.add(g);
  return { g, ins };
}

/** Figura para una carta. En un Portal, a cara descubierta si es pública; en una mano, siempre con manto. */
function figura(cv, pos, rumbo, enMano) {
  const nombre = cv?.visible ? (cv.ficha || cv.nombre) : null;
  const conModelo = !!nombre && !!INFO[nombre];
  const capa = !cv?.visible || !conModelo ? 'opaca' : enMano ? 'translucida' : null;
  const a = crearActor(capa === 'opaca' ? null : nombre, pos, { capa, rumbo, fijo: true });
  a.userData.cv = cv;
  if (cv?.visible && !conModelo) etiqueta(a, cv.nombre);
  if (cv?.visible && cv.ficha && !enMano) marcaMetamorfo(a, true);
  actores.add(a);
  return a;
}
function etiqueta(a, texto) { const s = textoSprite(texto, { alto: 0.3, letra: 40 }); s.position.y = 2.3; a.add(s); a.userData.etiqueta = s; }
/** El Metamorfo transformado lleva encima, como la ficha de la mesa, un rótulo de quién es en realidad. */
function marcaMetamorfo(a, si) {
  if (a.userData.marca) { a.remove(a.userData.marca); a.userData.marca = null; }
  if (!si) return;
  const s = textoSprite('🎭 Metamorfo', { alto: 0.28, letra: 38, fondo: 'rgba(90,20,70,.85)', borde: '#ff9ad8', color: '#ffe0f4' });
  s.position.y = 2.35; a.add(s); a.userData.marca = s;
}
function retirar(a) { if (!a) return; actores.delete(a); a.traverse(o => pickables.delete(o)); quitarActor(a); }

function proxyMano(a) {
  geoProxyMano ??= new THREE.CylinderGeometry(0.55, 0.55, 2.1, 8);
  a.add(proxy(geoProxyMano, { tipo: 'mano', actor: a }, 1.05));
}

// -------------------------------------------------- montaje sin animación

function construir(v) {
  for (const a of [...actores]) retirar(a);
  for (const p of portales.values()) { p.actor = null; p.g.visible = false; }
  manos.clear();
  disp = disponer(v);
  mazo ??= crearMazo();
  mazo.g.position.copy(disp.mazo);
  disp.portales.forEach((d, clave) => {
    const p = asegurarPortal(clave);
    p.g.visible = true; p.g.position.copy(posPortal(clave)); p.g.rotation.y = d.rot; p.g.scale.setScalar(1); p.nuevo = false;
    ponerNombre(p, d.nombre);
    ponerContenido(p, verPortal(v, clave), true);
  });
  for (const a of [v.propio, ...v.rivales]) {
    manos.set(a.idx, a.mano.map((cv, k) => nuevaMano(a.idx, cv, k === 0 ? -1 : 1, null)));
  }
  pintarEstados(v);
  encuadrar(true);
  construido = true;
}

function verPortal(v, clave) {
  const [a, b] = clave.split(':');
  if (a === 'n') return v.centrales[+b];
  const asiento = v.propio.idx === +a ? v.propio : v.rivales.find(r => r.idx === +a);
  return asiento?.portales[+b];
}

function ponerNombre(p, nombre) { if (p.nombre !== nombre) { nombrarPortal(p.g, nombre); p.nombre = nombre; } }

function ponerContenido(p, pv, conActor) {
  p.firma = firmaPortal(pv); p.cv = pv.top; p.altura = pv.altura;
  p.insignia.userData.poner(pv.altura > 1 ? `${pv.altura}` : '');
  if (conActor) {
    retirar(p.actor); p.actor = null;
    if (pv.top) { const pos = p.g.position.clone().add(V(0, ALTURA_TARIMA, 0)); p.actor = figura(pv.top, pos, p.g.rotation.y, false); p.actor.userData.ancla = { tipo: 'portal', clave: claveDe(p) }; }
  }
}
const claveDe = p => { for (const [k, q] of portales) if (q === p) return k; return null; };

function nuevaMano(idx, cv, lado, desde) {
  const destino = posMano(idx, lado);
  const a = figura(cv, desde ?? destino.pos, destino.rot, true);
  a.userData.ancla = { tipo: 'mano', idx, lado };
  proxyMano(a);
  return { actor: a, firma: firmaMano(cv), cv, lado };
}
const firmaMano = cv => (cv ? (cv.visible ? cv.nombre : '?') : '-');

// ---------------------------------------------------------- seguimiento

const _d = new THREE.Vector3();
const camBase = { objetivo: V(0, 0.9, 0), ancho: 14, alto: 10 };
const pan = V();
let margen = { arriba: 0, abajo: 0 };   // lo que tapan la barra de arriba y los botones de abajo, en píxeles
function seguir(dt, t) {
  // Portales: se deslizan a su sitio (cambio de asiento, Portal nuevo…).
  for (const [clave, p] of portales) {
    if (!p.g.visible || p.arrastrando) continue;
    const obj = posPortal(clave); if (!obj) continue;
    p.g.position.lerp(obj, Math.min(1, dt * 4));
    const d = disp.portales.get(clave).rot - p.g.rotation.y; p.g.rotation.y += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 4);
    // Brillo según lo que se puede hacer con él.
    const m = p.anillo.material, e = p.estado;
    if (COLOR_ESTADO[e]) { m.color.setHex(COLOR_ESTADO[e]); m.opacity = 0.5 + Math.sin(t * 4.5) * 0.3; p.anillo.rotation.z += dt * (e === 'activable' ? 1.2 : 0.6); }
    else m.opacity = Math.max(0, m.opacity - dt * 3);
  }
  // Figuras: las de un Portal van pegadas a él; las de una mano caminan hasta su hueco.
  for (const a of actores) {
    const u = a.userData; if (u.ocupado || !u.ancla) continue;
    const an = anclaPos(u.ancla); if (!an) continue;
    if (an.fija) { a.position.copy(an.pos); u.rumbo = an.rot; continue; }
    _d.subVectors(an.pos, a.position); _d.y = 0; const dist = _d.length();
    if (dist > 0.05) { const paso = Math.min(dist, dt * 2.6); a.position.addScaledVector(_d, paso / dist); u.rumbo = Math.atan2(_d.x, _d.z); u.andandoObj = 1; u.cadencia = 8; }
    else { u.andandoObj = 0; u.rumbo = an.rot; }
  }
  // Mano propia: la figura elegida se alza sobre un círculo dorado.
  const propias = manos.get(inter.propio) ?? [];
  propias.forEach((h, k) => { if (h.actor) h.actor.userData.elevaObj = inter.jugable && inter.seleccion === k ? 0.38 : 0; });
  // Cámara: encuadre de la mesa + lo que la jugadora haya girado, acercado o desplazado.
  const c = mundo.cam, k = Math.min(1, dt * 3);
  _d.copy(camBase.objetivo).add(pan); c.objetivo.lerp(_d, k);
  // La mesa se encuadra en la franja libre entre la barra de arriba y los botones de abajo.
  const H = lienzo.clientHeight || 1, W = lienzo.clientWidth || 1, libre = Math.max(H * 0.4, H - margen.arriba - margen.abajo);
  c.ancho += (camBase.ancho - c.ancho) * k; c.alto += (camBase.alto * H / libre - c.alto) * k; c.azimut = 0; c.polar = disp?.polar ?? 0.92;
  mundo.camara.setViewOffset(W, H, 0, -(margen.arriba - margen.abajo) / 2, W, H);
}

function encuadrar(ya = false) {
  if (!disp) return;
  Object.assign(camBase, { objetivo: disp.camara.objetivo.clone(), ancho: disp.camara.ancho, alto: disp.camara.alto });
  if (ya) { mundo.cam.objetivo.copy(camBase.objetivo).add(pan); mundo.cam.ancho = camBase.ancho; mundo.cam.alto = camBase.alto; mundo.cam.polar = disp.polar; mundo.cam.azimut = 0; }
}

function pintarEstados(v) {
  for (const [clave, p] of portales) p.estado = inter.estados?.get(clave) ?? '';
  if (mazo) mazo.ins.userData.poner(`${v.mazo}`);
}

// ----------------------------------------------------------- animaciones

const sobre = clave => portales.get(clave).g.position.clone().add(V(0, ALTURA_TARIMA, 0));
const local = (clave, x, z) => { const g = portales.get(clave).g, r = g.rotation.y; return V(g.position.x + x * Math.cos(r) + z * Math.sin(r), 0, g.position.z - x * Math.sin(r) + z * Math.cos(r)); };
const escalon = (clave, k) => { const p = local(clave, 0, k ? 1.0 : 1.66); p.y = k ? ALTURA_TARIMA : 0; return p; };

/** Subir a la tarima: de frente y por la escalinata; si se llega por un lado o por detrás, se rodea el Portal. */
async function subir(a, clave, o = {}) {
  const c = sobre(clave), rot = portales.get(clave).g.rotation.y, vel = o.vel ?? 1.9;
  const punto = (an, r) => V(c.x + Math.sin(an + rot) * r, 0, c.z + Math.cos(an + rot) * r);
  let an = Math.atan2(a.position.x - c.x, a.position.z - c.z) - rot; an = Math.atan2(Math.sin(an), Math.cos(an));
  const lado = Math.sign(an) || 1, tramos = [];
  if (Math.abs(an) > 2.0) tramos.push(punto(lado * 2.0, 2.9));
  if (Math.abs(an) > 1.45) tramos.push(punto(lado * 1.3, 2.8));
  if (Math.abs(an) > 0.5) tramos.push(punto(lado * 0.5, 2.45));
  tramos.push(local(clave, 0, 2.05));
  for (const t of tramos) if (a.position.distanceTo(t) > 0.25) await caminar(a, t, { vel, alFinal: Math.atan2(c.x - t.x, c.z - t.z) });
  await caminar(a, escalon(clave, 0), { vel: 1.1, alFinal: rot + Math.PI });
  await caminar(a, escalon(clave, 1), { vel: 0.8, cadencia: 7, ease: lineal, alFinal: rot + Math.PI });
  o.antesDeEntrar?.();
  await caminar(a, c, { vel: 1.1, alFinal: rot });
}
async function bajar(a, clave) {
  const r = portales.get(clave).g.rotation.y;
  await caminar(a, escalon(clave, 1), { vel: 1.1, alFinal: r });
  await caminar(a, escalon(clave, 0), { vel: 0.8, cadencia: 7, ease: lineal, alFinal: r });
  await caminar(a, local(clave, 0, 2.15), { vel: 1.1, alFinal: r });
}

function llegada(clave) {
  const p = portales.get(clave); if (!p) return;
  encender(p.g, 1.6); S.llegada();
  onda(sobre(clave), p.g.userData.tono, 1, 26, 1.8);
  chispas(sobre(clave), { n: 20, color: p.g.userData.tono, vel: 0.6, dir: V(0, 1.5, 0), vida: 1.2, radio: 0.6 });
  espera(1.3).then(() => encender(p.g, 0.6), () => {});
}

/** La figura se deshace en humo (cambia de manto, se va al mazo…). */
async function disolver(a) {
  if (!a) return;
  a.userData.ocupado = true;
  const p = a.position.clone();
  S.puf(); humo(p.clone().add(V(0, 0.6, 0)), { n: 10, radio: 0.35, color: 0x6a62a8, tam: 0.5, sube: 0.7 });
  chispas(p.clone().add(V(0, 1, 0)), { n: 8, color: 0xb0a8ff, vel: 0.5, vida: 0.8 });
  const ms = materialesDe(a);
  await tw(0.6, k => opacidad(a, 1 - k, ms));
  retirar(a);
}
/** El personaje de debajo queda tapado: se hunde en la tarima. */
async function hundir(a) {
  if (!a) return;
  a.userData.ocupado = true;
  const y0 = a.position.y, ms = materialesDe(a);
  humo(a.position.clone().add(V(0, 0.2, 0)), { n: 6, radio: 0.4, color: 0x5a5290, tam: 0.4 });
  await tw(0.8, k => { a.position.y = y0 - k * 1.3; opacidad(a, 1 - k, ms); });
  retirar(a);
}
/** Una figura nueva aparece en el Portal entre humo (lo que había debajo, una carta que se voltea…). */
async function surgir(p, cv) {
  const clave = claveDe(p), pos = sobre(clave);
  const a = figura(cv, pos.clone().add(V(0, -0.9, 0)), p.g.rotation.y, false);
  a.userData.ancla = { tipo: 'portal', clave }; a.userData.ocupado = true; p.actor = a;
  const ms = materialesDe(a); opacidad(a, 0, ms);
  humo(pos.clone().add(V(0, 0.3, 0)), { n: 8, radio: 0.4, color: 0x7a70c0, tam: 0.45 });
  await tw(0.8, k => { a.position.y = pos.y - 0.9 * (1 - k); opacidad(a, k, ms); }, sale);
  a.userData.ocupado = false;
  return a;
}

/** Una carta llega a un Portal: la figura camina, sube la escalinata y, si es pública, se quita el manto por el camino. */
async function entrar(p, viajero, pv) {
  const clave = claveDe(p), viejo = p.actor, cv = pv.top;
  let a = viajero?.actor;
  if (!a) { a = figura({ visible: false }, (disp.mazo ?? V()).clone(), 0, true); humo(a.position.clone().add(V(0, 0.5, 0)), { n: 8 }); }
  a.userData.ocupado = true; a.userData.ancla = null;
  p.actor = a;
  const nombre = cv?.visible ? (cv.ficha || cv.nombre) : null;
  let rev = null;
  if (nombre && INFO[nombre] && a.userData.capa) rev = quitarCapa(a, nombre);
  else if (!cv?.visible && a.userData.capa?.userData.translucida) rev = opacarCapa(a);
  try {
    await subir(a, clave, { antesDeEntrar: () => { hundir(viejo).catch(() => {}); } });
  } finally {
    if (p.actor === a && a.parent && a.userData.ocupado) a.userData.ancla = { tipo: 'portal', clave };
  }
  llegada(clave);
  await rev;
  a.userData.cv = cv;
  // Sin modelo posible (o se volteó por el camino): se cambia por la figura correcta.
  const bien = cv?.visible ? !!a.userData.modelo || !INFO[nombre] : !a.userData.modelo;
  if (!bien || (cv?.visible && !INFO[nombre])) { retirar(a); p.actor = null; await surgir(p, cv); }
  else { a.userData.ocupado = false; if (cv?.ficha) marcaMetamorfo(a, true); }
}

/** El de arriba se va (Cronista): baja por la escalinata y se pone el manto; debajo reaparece el anterior. */
async function salir(p, pv) {
  const clave = claveDe(p), a = p.actor; p.actor = null;
  const tareas = [];
  if (a) { a.userData.ocupado = true; a.userData.ancla = null; tareas.push(bajar(a, clave).then(() => disolver(a))); }
  if (pv.top) tareas.push(espera(0.6).then(() => surgir(p, pv.top)));
  await Promise.all(tareas);
  return local(clave, 0, 2.15);
}

/** La carta de arriba se voltea (Ocultista): el manto la cubre o se cae. */
async function voltear(p, pv) {
  const a = p.actor, cv = pv.top, nombre = cv?.visible ? (cv.ficha || cv.nombre) : null;
  if (a && nombre && INFO[nombre] && a.userData.capa && !a.userData.capa.userData.translucida) {
    a.userData.ocupado = true; S.revelar();
    await quitarCapa(a, nombre); a.userData.cv = cv; a.userData.ocupado = false;
    if (a.userData.etiqueta) { a.remove(a.userData.etiqueta); a.userData.etiqueta = null; }
    if (cv.ficha) marcaMetamorfo(a, true);
    return;
  }
  S.velo(); p.actor = null;
  await Promise.all([disolver(a), cv ? surgir(p, cv) : Promise.resolve()]);
}

/** El Metamorfo se transforma (o vuelve a ser él): gira como un remolino. */
async function metamorfosis(p, pv) {
  const a = p.actor, cv = pv.top, nuevo = cv.ficha || 'Metamorfo';
  if (!a?.userData.modelo || !INFO[nuevo]) return voltear(p, pv);
  a.userData.ocupado = true; S.metamorfo(); marcaMetamorfo(a, false);
  await transformar(a, nuevo, kl => { if (Math.random() < 0.8) chispas(a.position.clone().add(V(0, 0.4 + kl * 1.4, 0)), { n: 3, color: 0xff9ad8, color2: 0xd9b0ff, vel: 0.9, dir: V(0, 0.6, 0), vida: 0.9, giro: 6 }); });
  a.userData.cv = cv; a.userData.ocupado = false;
  if (cv.ficha) marcaMetamorfo(a, true);
}

/** Estratega: los dos personajes saltan en arco y cambian de Portal. */
async function cruzar(p1, p2) {
  const a1 = p1.actor, a2 = p2.actor, c1 = claveDe(p1), c2 = claveDe(p2);
  const s1 = sobre(c1), s2 = sobre(c2);
  p1.actor = a2; p2.actor = a1;
  for (const a of [a1, a2]) if (a) { a.userData.ocupado = true; }
  S.estratega();
  await tw(1.3, (k, kl) => {
    if (a1) { a1.position.copy(arco(s1, s2, k, 2.4, 0.15)); chispas(a1.position.clone().add(V(0, 0.8, 0)), { n: 1, color: 0xffa25f, vel: 0.1, vida: 0.6 }); }
    if (a2) { a2.position.copy(arco(s2, s1, k, 2.4, 0.15)); chispas(a2.position.clone().add(V(0, 0.8, 0)), { n: 1, color: 0xfff0a8, vel: 0.1, vida: 0.6 }); }
  });
  if (a1) a1.userData.ancla = { tipo: 'portal', clave: c2 };
  if (a2) a2.userData.ancla = { tipo: 'portal', clave: c1 };
  for (const a of [a1, a2]) if (a) a.userData.ocupado = false;
  llegada(c1); llegada(c2);
}

/** Una figura de la mano cambia lo que deja ver (Clarividente, Aprendiz, cambio de quien mira…). */
async function cambiarMano(h, cv) {
  const a = h.actor, antes = h.cv;
  h.cv = cv; h.firma = firmaMano(cv);
  if (antes && !antes.visible && cv?.visible && INFO[cv.nombre] && a.userData.capa && !a.userData.capa.userData.translucida) { a.userData.cv = cv; return aclararCapa(a, cv.nombre); }
  if (antes?.visible && cv && !cv.visible && a.userData.capa?.userData.translucida) { a.userData.cv = cv; return opacarCapa(a); }
  const ancla = a.userData.ancla, pos = a.position.clone();
  disolver(a).catch(() => {});
  const nueva = figura(cv, pos, a.rotation.y, true); nueva.userData.ancla = ancla; proxyMano(nueva); h.actor = nueva;
  const ms = materialesDe(nueva); opacidad(nueva, 0, ms);
  await tw(0.6, k => opacidad(nueva, k, ms));
}

/** Conjuro de quien activa una habilidad, hacia lo que ha cambiado. */
async function conjuro(an, destinos) {
  const p = portales.get(an.origen), a = p?.actor;
  const color = INFO[an.nombre]?.color ?? 0xffffff, color2 = INFO[an.nombre]?.color2 ?? 0xffffff;
  if (!a?.userData.modelo) return;
  S.cargar(220, 0.9);
  const desde = await conjurar(a, {});
  S.lanzar(600);
  const lista = destinos.length ? destinos : [sobre(an.origen).add(V(0, 1.2, 0))];
  await Promise.all(lista.map(d => rayo(desde, d, color, { color2, alto: 1.5, dur: 0.75 })));
  for (const d of lista) { destello(d, color, 1.8, 0.6).catch(() => {}); onda(d, color, 0.8, 20); }
  S.impacto(392);
}

/** Invocación completada: las runas despiertan, los requeridos alzan su magia y llega la criatura, que reparte Gemas. */
async function invocar(an, v) {
  const nombre = INFO[an.nombre]?.gema ? an.nombre : CRIATURA_POR_NIVEL[an.nivel] ?? 'Cirelia';
  const tono = INFO[nombre].color, tono2 = INFO[nombre].color2;
  const centro = disp.centro.clone(), F = centro.clone().add(V(0, 4.4, 0));
  const ps = [...portales.values()].filter(p => p.g.visible && !p.nuevo);
  S.invInicio(3.2);
  for (const p of ps) { encender(p.g, 1.6); onda(p.g.position.clone().add(V(0, ALTURA_TARIMA, 0)), p.g.userData.tono, 1, 22, 1.8); await espera(0.15); }
  const req = ps.map(p => p.actor).filter(a => a?.userData.modelo && a.userData.cv?.visible && an.need?.includes(a.userData.cv.ficha || a.userData.cv.nombre));
  req.forEach(a => { posar(a, 'alzar', 4); a.userData.elevaObj = 0.25; });
  await tw(2.4, (k, kl) => {
    for (const a of req) chispas(arco(mano(a), F, (kl * 3 + a.position.x * 0.1) % 1, 1.4), { n: 2, color: INFO[a.userData.nombre]?.color ?? tono, color2: 0xffffff, vel: 0.12, vida: 0.5, tam: 0.14 });
    const ang = kl * 26, r = 2.4 * (1 - kl) + 0.2;
    chispas(F.clone().add(V(Math.cos(ang) * r, Math.sin(ang * 0.7) * 0.4, Math.sin(ang) * r)), { n: 2, color: tono, color2: tono2, vel: 0.1, vida: 0.7, tam: 0.2 });
    mundo.cam.temblor = Math.max(mundo.cam.temblor, kl * kl * 0.05);
  }, lineal);
  S.invBoom(); mundo.cam.temblor = 0.5;
  destello(F, 0xffffff, 11, 1.3).catch(() => {}); onda(centro, tono, 3, 60, 4); onda(centro, tono2, 2, 40, 2.5);
  chispas(F, { n: 110, color: tono, color2: tono2, vel: 3, vida: 1.7, grav: 0.8, tam: 0.22 });
  req.forEach(a => { posar(a, null, 3); a.userData.elevaObj = 0; });
  const cr = crearActor(nombre, centro.clone().setY(-4.6), { fijo: true }); actores.add(cr);
  cr.userData.ocupado = true; cr.userData.sombra.visible = false;
  const ms = materialesDe(cr); opacidad(cr, 0, ms);
  await tw(1.6, k => { cr.position.y = -4.6 * (1 - k); opacidad(cr, k, ms); }, sale);
  S.invCoro();
  // Gemas para cada jugadora, hacia su sitio en la mesa.
  const tipo = an.nivel === '*' ? 'A' : an.nivel;
  const vuelos = [];
  for (const r of an.recompensas ?? []) {
    if (!(r.gemas > 0)) continue;
    const s = [...disp.asientos.values()].find(x => x.nombre === r.jugadora); if (!s) continue;
    for (let i = 0; i < Math.min(r.gemas, 4); i++) vuelos.push(lanzarGema(F.clone().add(V(0, -1.2, 0)), s.pos.clone().addScaledVector(s.u, 1.2).setY(0.9), tipo, i * 0.18));
  }
  await Promise.all(vuelos);
  await espera(0.9);
  await tw(1.0, k => opacidad(cr, 1 - k, ms));
  retirar(cr);
  ps.forEach(p => encender(p.g, 0.6));
}
async function lanzarGema(desde, hasta, tipo, retraso) {
  await espera(retraso);
  const g = gema(tipo, 1.6); g.position.copy(desde); S.gemaVuela();
  try {
    await tw(1.1, k => { g.position.copy(arco(desde, hasta, k, 2.2)); g.rotation.y += 0.2; chispas(g.position, { n: 0.5, color: g.userData.color, vel: 0.05, vida: 0.5, tam: 0.08 }); });
    destello(hasta, g.userData.color, 1.6, 0.5).catch(() => {}); S.gema();
  } finally { quitar(g); }
}

/** Un Portal nuevo (tras una invocación) se alza desde la mesa. */
async function alzarPortal(p) {
  p.nuevo = false; p.g.visible = true; S.piedra?.();
  onda(p.g.position, p.g.userData.tono, 1.4, 40, 2.2);
  await tw(1.2, k => { p.g.scale.set(1, Math.max(0.01, k), 1); }, sale);
  if (p.actor) p.actor.visible = true;
}

// ------------------------------------------------------- comparar y animar

function emparejar(viejos, nuevos, preferido) {
  if (nuevos.length >= viejos.length) return { quedan: viejos.map((h, i) => [h, i]), quitados: [], nuevos: nuevos.slice(viejos.length).map((_, i) => viejos.length + i) };
  const r = viejos.length - nuevos.length;
  if (r === 1) {
    const cands = [...new Set([preferido, ...viejos.map((_, i) => i)].filter(i => Number.isInteger(i) && i >= 0 && i < viejos.length))];
    const exacto = cands.find(q => viejos.filter((_, i) => i !== q).every((h, i) => h.firma === nuevos[i]));
    const q = exacto ?? cands[0];
    return { quedan: viejos.filter((_, i) => i !== q).map((h, i) => [h, i]), quitados: [viejos[q]], nuevos: [] };
  }
  return { quedan: viejos.slice(0, nuevos.length).map((h, i) => [h, i]), quitados: viejos.slice(nuevos.length), nuevos: [] };
}

async function aplicar(v, an) {
  const antes = disp;
  disp = disponer(v);
  if (!antes || antes.n !== disp.n) encuadrar(); else encuadrar();
  if (mazo) mazo.g.position.copy(disp.mazo);
  pintarEstados(v);

  // 1. Portales nuevos (aparecen al final, tras la escena) y nombres.
  const nuevosPortales = [];
  disp.portales.forEach((d, clave) => {
    const existia = portales.has(clave) && portales.get(clave).g.visible;
    const p = asegurarPortal(clave);
    ponerNombre(p, d.nombre);
    if (!existia) {
      p.g.visible = false; p.g.position.copy(posPortal(clave)); p.g.rotation.y = d.rot; p.g.scale.set(1, 0.01, 1); p.nuevo = true;
      ponerContenido(p, verPortal(v, clave), true); if (p.actor) p.actor.visible = false;
      nuevosPortales.push(p);
    }
  });
  for (const [clave, p] of portales) if (p.g.visible && !disp.portales.has(clave)) { p.g.visible = false; retirar(p.actor); p.actor = null; }

  // 2. Manos: qué figuras se han ido (hacia un Portal, normalmente), cuáles quedan y cuáles llegan.
  const viajeros = [], llegan = [], morfos = [];
  const activa = an.find(e => e.tipo === 'carta')?.actor ?? v.activa.idx;
  for (const a of [v.propio, ...v.rivales]) {
    const viejos = manos.get(a.idx) ?? [], firmas = a.mano.map(firmaMano);
    const pref = a.idx === inter.propio ? selPrevia : null;
    const { quedan, quitados } = emparejar(viejos, firmas, pref);
    quitados.forEach(h => { if (h.actor) viajeros.push({ idx: a.idx, actor: h.actor, cv: h.cv }); });
    const lista = [];
    for (const [h, i] of quedan) { lista[i] = h; if (!h.actor) { h.cv = a.mano[i]; h.firma = firmas[i]; continue; } h.actor.userData.ancla = { tipo: 'mano', idx: a.idx, lado: h.lado }; if (h.firma !== firmas[i]) morfos.push([h, a.mano[i]]); }
    const usados = new Set(lista.filter(Boolean).map(h => h.lado));
    for (let i = 0; i < firmas.length; i++) if (!lista[i]) { const lado = [-1, 1].find(l => !usados.has(l)) ?? 1; usados.add(lado); lista[i] = { actor: null, firma: firmas[i], lado, cv: a.mano[i], idx: a.idx }; llegan.push(lista[i]); }
    manos.set(a.idx, lista);
  }
  if (inter.seleccion === null || inter.seleccion === undefined) selPrevia = null;
  viajeros.sort((x, y) => (y.idx === activa) - (x.idx === activa));

  // 3. Portales: qué ha cambiado en cada uno.
  const cambios = [];
  disp.portales.forEach((d, clave) => {
    const p = portales.get(clave); if (p.nuevo) return;
    const pv = verPortal(v, clave), f = firmaPortal(pv);
    if (p.firma === undefined || p.firma === f) { p.insignia.userData.poner(pv.altura > 1 ? `${pv.altura}` : ''); return; }
    cambios.push({ p, pv, antes: p.firma, ahora: f, tipo: cambioPortal(p.firma, f) });
  });
  // Estratega: dos Portales que se han intercambiado el contenido.
  const cruces = [];
  for (const c1 of cambios) for (const c2 of cambios) if (c1 !== c2 && !c1.cruce && !c2.cruce && c1.ahora === c2.antes && c2.ahora === c1.antes) { c1.cruce = c2.cruce = true; cruces.push([c1, c2]); }
  for (const c of cambios) { c.p.firma = c.ahora; c.p.cv = c.pv.top; c.p.altura = c.pv.altura; c.p.insignia.userData.poner(c.pv.altura > 1 ? `${c.pv.altura}` : ''); }

  // 4. Escena: conjuro (si hay habilidad), cambios en los Portales, invocación, Portal nuevo y cartas robadas.
  const hab = an.find(e => e.tipo === 'habilidad');
  if (hab) await conjuro(hab, [...cambios.filter(c => claveDe(c.p) !== hab.origen).map(c => sobre(claveDe(c.p)).add(V(0, 1.2, 0))), ...morfos.map(([h]) => h.actor.position.clone().add(V(0, 1.1, 0)))].slice(0, 4));

  let salidaHacia = null;
  const tareas = [];
  for (const [c1, c2] of cruces) tareas.push(cruzar(c1.p, c2.p));
  for (const c of cambios) {
    if (c.cruce) continue;
    if (c.tipo === 'entra') tareas.push(entrar(c.p, viajeros.shift(), c.pv));
    else if (c.tipo === 'sale') tareas.push(salir(c.p, c.pv).then(pie => { salidaHacia ??= pie; }));
    else if (c.tipo === 'transforma') tareas.push(metamorfosis(c.p, c.pv));
    else tareas.push(voltear(c.p, c.pv));
  }
  for (const [h, cv] of morfos) tareas.push(cambiarMano(h, cv));
  await Promise.all(tareas);
  for (const vj of viajeros) disolver(vj.actor).catch(() => {});

  for (const e of an.filter(x => x.tipo === 'invocacion')) await invocar(e, v);
  for (const p of nuevosPortales) await alzarPortal(p);

  // Cartas que entran en una mano: salen del mazo (o del pie del Portal del que vienen) y caminan a su hueco.
  for (const h of llegan) {
    const desde = salidaHacia ?? disp.mazo.clone();
    const n = nuevaMano(h.idx, h.cv, h.lado, desde);
    humo(desde.clone().add(V(0, 0.5, 0)), { n: 6, radio: 0.3, color: 0x6a62a8, tam: 0.4 });
    const lista = manos.get(h.idx); const i = lista.indexOf(h); if (i >= 0) lista[i] = n; else retirar(n.actor);
  }
  if (llegan.length) { S.aparece(); await espera(Math.min(2.2, 0.8 + llegan.length * 0.2)); }
}

// ------------------------------------------------------------- controles

const raycaster = new THREE.Raycaster();
const _ndc = new THREE.Vector2();
const suelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

function rayoDesde(x, y) {
  const r = lienzo.getBoundingClientRect();
  _ndc.set((x - r.left) / r.width * 2 - 1, -((y - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(_ndc, mundo.camara);
  return raycaster;
}
function elegir(x, y) {
  const objs = [...pickables].filter(m => { let o = m; while (o) { if (!o.visible) return false; if (o === mundo.escena) return true; o = o.parent; } return false; });
  const hit = rayoDesde(x, y).intersectObjects(objs, false)[0];
  return hit?.object.userData.pick ?? null;
}

function traducir(pick) {
  if (!pick) return { tipo: 'nada' };
  if (pick.tipo === 'portal') return { tipo: 'portal', clave: pick.clave };
  for (const [idx, lista] of manos) {
    const k = lista.findIndex(h => h.actor === pick.actor);
    if (k >= 0) return { tipo: 'mano', jugadora: idx, k, cv: lista[k].cv };
  }
  return { tipo: 'nada' };
}

function controles(el) {
  const dedos = new Map();
  let gesto = null, ultimoToque = null, largo = null;
  const fin = () => { clearTimeout(largo); largo = null; };
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture?.(e.pointerId);
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1) {
      const pick = elegir(e.clientX, e.clientY);
      gesto = { tipo: 'toque', x0: e.clientX, y0: e.clientY, t0: performance.now(), pick, boton: e.button, mayus: e.shiftKey };
      fin();
      if (pick?.tipo === 'portal') largo = setTimeout(() => {
        if (gesto?.tipo !== 'toque') return;
        const p = portales.get(pick.clave); if (!p) return;
        gesto.tipo = 'mover'; gesto.clave = pick.clave; p.arrastrando = true; p.g.position.y = 0.25;
        navigator.vibrate?.(20); el.style.cursor = 'grabbing';
      }, 480);
    } else if (dedos.size === 2) {
      fin();
      if (gesto?.tipo === 'mover') soltarPortal();
      const [a, b] = [...dedos.values()];
      gesto = { tipo: 'pinza', dist: Math.hypot(a.x - b.x, a.y - b.y), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2 };
    }
  });
  const mover = e => {
    const antes = dedos.get(e.pointerId); if (!antes || !gesto) return;
    const ahora = { x: e.clientX, y: e.clientY }; dedos.set(e.pointerId, ahora);
    const u = mundo.usuario;
    if (gesto.tipo === 'toque' && Math.hypot(e.clientX - gesto.x0, e.clientY - gesto.y0) > 9) { fin(); gesto.tipo = gesto.boton === 2 || gesto.mayus ? 'desplazar' : 'girar'; }
    if (gesto.tipo === 'girar') {
      u.azimut -= (ahora.x - antes.x) * 0.006;
      u.polar = THREE.MathUtils.clamp(u.polar - (ahora.y - antes.y) * 0.004, -0.62, 0.5);
    } else if (gesto.tipo === 'desplazar') desplazar(ahora.x - antes.x, ahora.y - antes.y);
    else if (gesto.tipo === 'pinza' && dedos.size >= 2) {
      const [a, b] = [...dedos.values()], d = Math.hypot(a.x - b.x, a.y - b.y), mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      u.zoom = THREE.MathUtils.clamp(u.zoom * gesto.dist / d, 0.28, 1.7);
      desplazar(mx - gesto.mx, my - gesto.my);
      Object.assign(gesto, { dist: d, mx, my });
    } else if (gesto.tipo === 'mover') {
      const p = portales.get(gesto.clave), punto = new THREE.Vector3();
      if (p && rayoDesde(e.clientX, e.clientY).ray.intersectPlane(suelo, punto)) { p.g.position.x = punto.x; p.g.position.z = punto.z; }
    }
  };
  el.addEventListener('pointermove', mover);
  const soltarPortal = () => {
    const p = portales.get(gesto.clave), d = disp?.portales.get(gesto.clave);
    if (p && d) { p.arrastrando = false; p.g.position.y = 0; desplaz[d.rel] = [p.g.position.x - d.pos.x, p.g.position.z - d.pos.z]; try { localStorage.setItem(CLAVE_POSICIONES, JSON.stringify(desplaz)); } catch { /* nada */ } S.piedra?.(); onda(p.g.position, p.g.userData.tono, 1, 24, 1.6); }
    el.style.cursor = '';
  };
  const arriba = e => {
    if (!dedos.has(e.pointerId)) return;
    dedos.delete(e.pointerId); fin();
    if (!gesto) return;
    if (gesto.tipo === 'mover') { soltarPortal(); gesto = null; return; }
    if (gesto.tipo === 'toque' && e.type === 'pointerup' && performance.now() - gesto.t0 < 600) {
      const t = traducir(gesto.pick), ahora = performance.now();
      const clave = t.tipo === 'portal' ? t.clave : t.tipo === 'mano' ? `m${t.jugadora}:${t.k}` : 'nada';
      const doble = !!ultimoToque && ultimoToque.clave === clave && ahora - ultimoToque.t < 380 && Math.hypot(e.clientX - ultimoToque.x, e.clientY - ultimoToque.y) < 40;
      ultimoToque = doble ? null : { clave, t: ahora, x: e.clientX, y: e.clientY };
      if (t.tipo === 'nada' && doble) reencuadrar();
      else alTocar({ ...t, doble });
    }
    gesto = dedos.size ? { tipo: 'nada' } : null;
  };
  el.addEventListener('pointerup', arriba); el.addEventListener('pointercancel', arriba);
  el.addEventListener('wheel', e => { e.preventDefault(); mundo.usuario.zoom = THREE.MathUtils.clamp(mundo.usuario.zoom * (1 + e.deltaY * 0.001), 0.28, 1.7); }, { passive: false });
}

function desplazar(dx, dy) {
  const c = mundo.camara, dist = c.position.distanceTo(mundo.cam.objetivo);
  const porPixel = 2 * dist * Math.tan(THREE.MathUtils.degToRad(c.fov / 2)) / (lienzo.clientHeight || 1);
  const az = mundo.cam.azimut + mundo.usuario.azimut;
  const dcha = V(Math.cos(az), 0, -Math.sin(az)), fondo = V(-Math.sin(az), 0, -Math.cos(az));
  pan.addScaledVector(dcha, -dx * porPixel).addScaledVector(fondo, dy * porPixel * 1.4);
  pan.clampLength(0, 12);
}

/** Vuelve a la vista de toda la mesa (doble toque en un hueco, o botón). */
export function reencuadrar() { pan.set(0, 0, 0); Object.assign(mundo.usuario, { azimut: 0, polar: 0, zoom: 1 }); }

/** Devuelve los Portales a su sitio de siempre. */
export function recolocarPortales() {
  desplaz = {}; try { localStorage.removeItem(CLAVE_POSICIONES); } catch { /* nada */ }
}

/** Punto de la pantalla donde se ve un Portal ({ clave }) o una figura de mano ({ jugadora, k }). Para pruebas automáticas. */
export function puntoEnPantalla(o) {
  let p = null;
  if (o.clave) { const q = portales.get(o.clave); if (q) p = q.g.position.clone().add(V(0, 1.0, 0)); }
  else { const h = manos.get(o.jugadora)?.[o.k]; if (h?.actor) p = h.actor.position.clone().add(V(0, 1.0, 0)); }
  if (!p) return null;
  p.project(mundo.camara);
  const r = lienzo.getBoundingClientRect();
  return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
}
/** Qué hay bajo un punto de la pantalla (para pruebas automáticas). */
export function queHayEn(x, y) { const t = traducir(elegir(x, y)); return { tipo: t.tipo, clave: t.clave, jugadora: t.jugadora, k: t.k }; }
