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
import { THREE, mundo, crearMundo, tw, espera, V, lineal, sale, entra, rebote, mezcla, arco, pausar, reanudar, siempre, siempreReal, cadaFrame, temblar, cancelarTodo, CANCELADO } from './mundo.js';
import { crearEfectos, chispas, humo, onda, destello, rayo, gema, quitar } from './efectos.js';
import { crearPortal, encender, VARIANTES, ALTURA_TARIMA, texturaDisco, nombrarPortal } from './portales.js';
import { crearActor, quitarActor, INFO, posar, mano, cabeza, pecho, mirar, saltar, caminar, quitarCapa, aclararCapa, opacarCapa, conjurar, transformar, opacidad, materialesDe } from './personajes.js';
import { runa, ojoDeLuz, hazDeLuz, relojArena, orbe, quitarOrbe, COLORES_ORBES, limpiarMagia, crearEscudos } from './magia.js';
import { S, iniciarAudio, ponerSonido, sonidoActivo } from './sonido.js';
import { crearAmbiente, sonidoAmbiente, fijarAmbiente as fijarAmb, ambienteActual, OPCIONES_AMBIENTE } from './ambiente.js';
import { velocidadAnimaciones, alCambiarVelocidad } from '../velocidad.js';
export { OPCIONES_AMBIENTE, ambienteActual };
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
  mundo.velocidad = 1.5 * velocidadAnimaciones();
  alCambiarVelocidad(v => { mundo.velocidad = 1.5 * v; });
  crearAmbiente();
  crearEfectos();
  controles(lienzo);
  siempre(seguirActores);
  siempreReal(seguirMesa); siempreReal(seguirEscudos);
  pausar();
  // Al girar el móvil la mesa se vuelve a disponer (vertical: más estrecha y alargada).
  window.addEventListener('resize', () => { if (visible && construido && ultimaVista && !pendiente) { pendiente = ultimaVista; if (!temporizador && !trabajando) temporizador = setTimeout(procesar, 0); } });
  window.addEventListener('unhandledrejection', e => { if (e.reason === CANCELADO) e.preventDefault(); });
}

export function mostrar() {
  if (!lienzo) iniciar();
  if (visible) return;
  visible = true; lienzo.classList.remove('oculto'); reanudar();
  sonidoAmbiente(true);
}

/** Se oculta (vuelta a la Mesa): se corta lo que estuviera en marcha y la próxima vez se monta de cero. */
export function ocultar() {
  if (!lienzo || !visible) return;
  visible = false; lienzo.classList.add('oculto');
  sonidoAmbiente(false);
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
  for (const e of gemasAsiento.values()) { e.g.visible = false; e.firma = null; }
  quitarEscudos();
  if (visible) { visible = false; lienzo.classList.add('oculto'); pausar(); sonidoAmbiente(false); }
}

function cortar() {
  pendiente = null; anuncios = []; clearTimeout(temporizador); temporizador = null; cancelarTodo(); limpiarMagia(); trabajando = false;
  foco = null; ecos = null;
  for (const p of portales.values()) { p.levita = false; p.crono = null; if (!p.arrastrando) p.g.position.y = 0; }
}

export function fijarAlTocar(fn) { alTocar = fn; }
export function fijarSonido(si, gesto = false) { ponerSonido(si); if (si && gesto) iniciarAudio(); }
/** Ambiente del Escenario (hora, cielo, suelo, paleta): ver ambiente.js. */
export function fijarAmbiente(cambio) { fijarAmb(cambio); }

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
      mundo.velocidad = 1.5 * velocidadAnimaciones();
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
    d.asientos.set(a.idx, { pos: V(cx, 0, cz), rot, t, u, abre, np, nombre: a.nombre, activa: a.activa, frente: V(Math.sin(rot), 0, Math.cos(rot)) });
  });
  const nc = v.centrales.length;
  v.centrales.forEach((pv, c) => d.portales.set(`n:${c}`, { pos: V((c - (nc - 1) / 2) * SEP, 0, n === 3 ? -0.4 : 0), rot: 0, nombre: null, rel: `${n}|n:${c}` }));
  d.mazo = nc ? V(0, 0, n === 3 ? -2.9 : -2.7) : V(0, 0, 0);
  d.centro = V(0, 0, nc ? 0 : 0);
  // Encuadre: todo lo que hay en la mesa.
  const xs = [], zs = [];
  d.portales.forEach(p => { xs.push(p.pos.x); zs.push(p.pos.z); });
  d.asientos.forEach(s => { xs.push(s.pos.x + s.t.x * s.abre, s.pos.x - s.t.x * s.abre); zs.push(s.pos.z + s.t.z * s.abre, s.pos.z - s.t.z * s.abre); });
  // …y las Gemas que cada asiento tiene delante.
  d.asientos.forEach(s => { xs.push(s.pos.x + s.frente.x * 2.9); zs.push(s.pos.z + s.frente.z * 2.9); });
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

/** Hueco de una carta de la mano: al lado del Portal del extremo (y lo sigue si se mueve el Portal). */
function posMano(idx, lado) {
  const s = disp?.asientos.get(idx); if (!s) return null;
  const clave = `${idx}:${lado < 0 ? 0 : s.np - 1}`, p = portales.get(clave);
  const base = p?.g.visible ? V(p.g.position.x, 0, p.g.position.z) : posPortal(clave);
  if (!base) return { pos: s.pos.clone().addScaledVector(s.t, lado * s.abre).addScaledVector(s.u, 0.35), rot: s.rot };
  return { pos: base.addScaledVector(s.t, lado * 2.05).addScaledVector(s.u, 0.35), rot: s.rot };
}

function anclaPos(an) {
  if (an.tipo === 'portal') { const p = portales.get(an.clave); return p ? { pos: p.g.position.clone().add(V(0, ALTURA_TARIMA, 0)), rot: p.g.rotation.y, fija: true } : null; }
  if (an.tipo === 'mano') return posMano(an.idx, an.lado);
  return null;
}

// ------------------------------------------------------- piezas del tablero

let matProxy, geoProxyPortal, geoProxyFigura, geoProxyMano, geoAnillo;
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
  // Se toca por la base (tarima y escalinata) o por el personaje de encima, nunca por el arco:
  // así no se toca sin querer el Portal de delante al apuntar a la base de otro.
  geoProxyPortal ??= new THREE.CylinderGeometry(1.6, 1.7, 0.7, 12);
  geoProxyFigura ??= new THREE.CylinderGeometry(0.55, 0.55, 2.0, 8);
  const pick = { tipo: 'portal', clave };
  const pb = proxy(geoProxyPortal, pick, 0.25), pf = proxy(geoProxyFigura, pick, ALTURA_TARIMA + 1.0);
  pb.position.z = 0.25; g.add(pb, pf);
  geoAnillo ??= new THREE.PlaneGeometry(2, 2);
  const anillo = new THREE.Mesh(geoAnillo, new THREE.MeshBasicMaterial({ map: texturaDisco(12), color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  anillo.rotation.x = -Math.PI / 2; anillo.position.y = ALTURA_TARIMA + 0.03; anillo.scale.setScalar(1.55); anillo.renderOrder = 13; g.add(anillo);
  const insignia = textoSprite(''); insignia.position.set(1.05, 0.62, 1.15); g.add(insignia);
  mundo.escena.add(g);
  p = { g, actor: null, firma: undefined, cv: null, altura: 0, insignia, anillo, nombre: undefined, estado: '', nuevo: false, pick };
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
  siempreReal((dt, t) => { cristal.rotation.y = t * 0.6; cristal.position.y = 0.95 + Math.sin(t * 1.4) * 0.06; });
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
  actualizarGemas(v); actualizarEscudos(v, false);
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
/** A ritmo real: Portales en su sitio, su brillo, las Gemas de cada asiento y la cámara. */
function seguirMesa(dt, t) {
  // Portales: se deslizan a su sitio (cambio de asiento, Portal nuevo…).
  for (const [clave, p] of portales) {
    if (!p.g.visible) continue;
    if (!p.arrastrando && !p.levita) {
      const obj = posPortal(clave);
      if (obj) {
        p.g.position.lerp(obj, Math.min(1, dt * 4));
        const d = disp.portales.get(clave).rot - p.g.rotation.y; p.g.rotation.y += Math.atan2(Math.sin(d), Math.cos(d)) * Math.min(1, dt * 4);
      }
    }
    // Brillo según lo que se puede hacer con él.
    const m = p.anillo.material, e = p.estado;
    if (COLOR_ESTADO[e]) { m.color.setHex(COLOR_ESTADO[e]); m.opacity = 0.5 + Math.sin(t * 4.5) * 0.3; p.anillo.rotation.z += dt * (e === 'activable' ? 1.2 : 0.6); }
    else m.opacity = Math.max(0, m.opacity - dt * 3);
  }
  colocarGemas(dt, t);
  // Cámara: encuadre de la mesa (o el foco de una animación) + lo que la jugadora haya girado, acercado o desplazado.
  const c = mundo.cam, k = Math.min(1, dt * (foco ? 1.6 : 3));
  const base = foco ?? camBase;
  _d.copy(base.objetivo); if (!foco) _d.add(pan); c.objetivo.lerp(_d, k);
  // La mesa se encuadra en la franja libre entre la barra de arriba y los botones de abajo.
  const H = lienzo.clientHeight || 1, W = lienzo.clientWidth || 1, libre = Math.max(H * 0.4, H - margen.arriba - margen.abajo);
  c.ancho += (base.ancho - c.ancho) * k; c.alto += (base.alto * H / libre - c.alto) * k; c.azimut = 0;
  const polar = foco?.polar ?? disp?.polar ?? 0.92; c.polar += (polar - c.polar) * k;
  mundo.camara.setViewOffset(W, H, 0, -(margen.arriba - margen.abajo) / 2, W, H);
}

/** Al ritmo de las animaciones: las figuras. */
function seguirActores(dt) {
  // Las de un Portal van pegadas a él; las de una mano caminan hasta su hueco.
  for (const a of actores) {
    const u = a.userData; if (u.ocupado || !u.ancla) continue;
    const an = anclaPos(u.ancla); if (!an) continue;
    if (an.fija) { a.position.copy(an.pos); u.rumbo = an.rot; continue; }
    _d.subVectors(an.pos, a.position); _d.y = 0; const dist = _d.length();
    // Si su Portal se arrastra, la mano lo sigue sin quedarse atrás.
    const prisa = arrastrandoAlguno ? 4 : 1;
    if (dist > 0.05) { const paso = Math.min(dist, dt * 2.6 * prisa); a.position.addScaledVector(_d, paso / dist); u.rumbo = Math.atan2(_d.x, _d.z); u.andandoObj = 1; u.cadencia = 8; }
    else { u.andandoObj = 0; u.rumbo = an.rot; }
  }
  // Mano propia: la figura elegida se alza sobre un círculo dorado.
  const propias = manos.get(inter.propio) ?? [];
  propias.forEach((h, k) => { if (h.actor) h.actor.userData.elevaObj = inter.jugable && inter.seleccion === k ? 0.38 : 0; });
}
let arrastrandoAlguno = false;

// --------------------------------------------------------------- foco
// Durante una animación lejana la cámara se acerca a donde pasa (y vuelve después).
let foco = null;
function enfocar(puntos, o = {}) {
  if (!puntos.length || !disp) return;
  const xs = puntos.map(p => p.x), zs = puntos.map(p => p.z);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), z0 = Math.min(...zs), z1 = Math.max(...zs);
  foco = {
    objetivo: V((x0 + x1) / 2, o.y ?? 1.3, (z0 + z1) / 2 + 0.4),
    ancho: Math.max(o.ancho ?? 7.5, x1 - x0 + 5), alto: Math.max(o.alto ?? 5.6, (z1 - z0) * 0.6 + 4.6),
    polar: o.polar ?? Math.min(1.2, (disp.polar ?? 0.92) + 0.18),
  };
}
const soltarFoco = () => { foco = null; };
/** ¿Está lejos de quien mira? (cualquier Portal que no sea de su asiento). */
const lejano = clave => !clave.startsWith(`${inter.propio}:`);

function encuadrar(ya = false) {
  if (!disp) return;
  Object.assign(camBase, { objetivo: disp.camara.objetivo.clone(), ancho: disp.camara.ancho, alto: disp.camara.alto });
  if (ya) { mundo.cam.objetivo.copy(camBase.objetivo).add(pan); mundo.cam.ancho = camBase.ancho; mundo.cam.alto = camBase.alto; mundo.cam.polar = disp.polar; mundo.cam.azimut = 0; }
}

function pintarEstados(v) {
  for (const [clave, p] of portales) p.estado = inter.estados?.get(clave) ?? '';
  if (mazo) mazo.ins.userData.poner(`${v.mazo}`);
}

// ------------------------------------------------- Gemas de cada asiento
// Delante de los Portales de cada jugadora: cuántas Gemas tiene y de qué
// nivel (eso es público, como en la mesa de verdad); su valor solo lo ve su
// dueña (rótulo con el total) y el de las Gemas de asterisco reveladas, todas.

const gemasAsiento = new Map();   // idx → { g, firma, piezas, rotulo }
const TIPO_GEMA = { unitaria: 'azul', C: 'C', B: 'B', A: 'A', '*': 'A' };
const unidadesPrevias = new Map();   // idx → Gemas de 1 que tenía (para saber si la Entusiasta ha regalado una)
function actualizarGemas(v) {
  const vistos = new Set();
  for (const a of [v.propio, ...v.rivales]) {
    vistos.add(a.idx); unidadesPrevias.set(a.idx, a.gemas.porNivel.unitaria);
    const gm = a.gemas, propio = a.idx === v.propio.idx;
    const firma = JSON.stringify([gm.porNivel, gm.reveladas, propio ? gm.total : null]);
    let e = gemasAsiento.get(a.idx);
    if (e?.firma === firma) continue;
    if (!e) { e = { g: new THREE.Group(), piezas: [], rotulo: null }; mundo.escena.add(e.g); gemasAsiento.set(a.idx, e); }
    e.firma = firma;
    e.piezas.forEach(x => quitar(x)); e.piezas = [];
    if (e.rotulo) { e.g.remove(e.rotulo); e.rotulo = null; }
    const lista = [];
    for (const n of ['unitaria', 'C', 'B', 'A', '*']) for (let i = 0; i < (gm.porNivel[n] ?? 0); i++) lista.push(n);
    const fila = 8, sep = 0.34;
    lista.forEach((n, i) => {
      const q = gema(TIPO_GEMA[n] ?? 'azul', 0.85); e.g.add(q);
      const f = Math.floor(i / fila), k = i % fila, enFila = Math.min(fila, lista.length - f * fila);
      q.position.set((k - (enFila - 1) / 2) * sep, 0.22, f * 0.36);
      q.userData.fase = i * 0.7;
      e.piezas.push(q);
    });
    const textos = [];
    if (propio && gm.total !== null) textos.push(`💎 ${gm.total}`);
    if (gm.reveladas.length) textos.push(gm.reveladas.map(x => `${x}*`).join(' '));
    if (textos.length) { e.rotulo = textoSprite(textos.join('  '), { alto: 0.32, letra: 44 }); e.rotulo.position.set(0, 0.75, 0); e.g.add(e.rotulo); }
    e.g.visible = true;
  }
  for (const [idx, e] of gemasAsiento) if (!vistos.has(idx)) { e.g.visible = false; e.firma = null; }
}
/** Sitio de las Gemas de un asiento: delante de sus Portales (los siguen si se mueven). */
function sitioGemas(idx) {
  const s = disp?.asientos.get(idx); if (!s) return null;
  const c = V();
  let n = 0;
  for (let j = 0; j < s.np; j++) { const p = portales.get(`${idx}:${j}`); if (p?.g.visible) { c.x += p.g.position.x; c.z += p.g.position.z; n++; } }
  if (!n) c.copy(s.pos); else c.multiplyScalar(1 / n);
  return { pos: c.addScaledVector(s.frente, 2.75), rot: s.rot };
}
function colocarGemas(dt, t) {
  for (const [idx, e] of gemasAsiento) {
    if (!e.g.visible) continue;
    const s = sitioGemas(idx); if (!s) continue;
    e.g.position.lerp(s.pos, Math.min(1, dt * 5)); e.g.rotation.y = s.rot;
    e.piezas.forEach(q => { q.rotation.y += dt * 1.2; q.position.y = 0.22 + Math.sin(t * 1.6 + q.userData.fase) * 0.03; });
  }
}

// ----------------------------------------------------------- animaciones

const sobre = clave => (portales.get(clave)?.g.position.clone() ?? V()).add(V(0, ALTURA_TARIMA, 0));
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
async function entrar(p, viajero, pv, mover = null) {
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
    if (mover) await mover(a, clave, () => { hundir(viejo).catch(() => {}); });
    else await subir(a, clave, { antesDeEntrar: () => { hundir(viejo).catch(() => {}); } });
  } finally {
    if (p.actor === a && a.parent && a.userData.ocupado) a.userData.ancla = { tipo: 'portal', clave };
  }
  llegada(clave);
  await rev;
  a.userData.cv = cv;
  // Sin modelo posible (o se volteó por el camino): se cambia por la figura correcta.
  const bien = cv?.visible ? !!a.userData.modelo || !INFO[nombre] : !a.userData.modelo;
  if (!bien || (cv?.visible && !INFO[nombre])) { retirar(a); p.actor = null; await surgir(p, cv); }
  else {
    if (cv?.ficha) marcaMetamorfo(a, true);
    // Cada cual llega a su manera: la Centinela planta la lanza, los animales hacen su gracia.
    try {
      if (cv?.visible && !cv.ficha && a.userData.modelo) {
        if (cv.nombre === 'Centinela') await plantarLanza(a);
        else if (['Reena', 'Sora', 'Lumo'].includes(cv.nombre)) await gracia(a, clave);
      }
    } finally { a.userData.ocupado = false; a.userData.alegre = false; }
  }
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
  // La sombra envuelve a quien se oculta.
  if (a && cv && !cv.visible) { const pos = a.position.clone(); tw(1.2, () => humo(pos, { n: 2, color: 0x141230, radio: 0.4, sube: 1.4, alfa: 0.85 })).catch(() => {}); }
  else if (cv?.visible) chispas(sobre(claveDe(p) ?? '').add(V(0, 1.1, 0)), { n: 30, color: INFO.Ocultista.color, color2: 0xffffff, vel: 0.9, vida: 1.2 });
  await Promise.all([disolver(a), cv ? surgir(p, cv) : Promise.resolve()]);
}

/** El Metamorfo se transforma (o vuelve a ser él): gira como un remolino. */
async function metamorfosis(p, pv, pagador = null) {
  const a = p.actor, cv = pv.top, nuevo = cv.ficha || 'Metamorfo';
  if (!a?.userData.modelo || !INFO[nuevo]) return voltear(p, pv);
  a.userData.ocupado = true; marcaMetamorfo(a, false);
  const col = INFO.Metamorfo.color, col2 = INFO.Metamorfo.color2;
  const r = runa(a.position, col, 1.0, 3);
  try {
    // Transformarse cuesta una Gema azul de quien juega: vuela desde sus Gemas hasta él.
    const sg = cv.ficha && pagador !== null ? sitioGemas(pagador) : null;
    if (sg) {
      const g = gema('azul', 1), de = sg.pos.clone().setY(0.4), hasta = pecho(a).add(V(0, 0, 0.3)); g.position.copy(de);
      posar(a, 'abierto', 5); S.gemaVuela();
      try { await tw(0.9, k => g.position.copy(arco(de, hasta, k, 1.0))); S.pagar(); chispas(g.position, { n: 22, color: 0x4aa8ff, color2: 0xffffff, vel: 0.8 }); } finally { quitar(g); }
    }
    posar(a, 'alzar', 5); S.cargar(196, 0.8); await espera(0.8); S.metamorfo();
    await transformar(a, nuevo, kl => { const fz = Math.sin(kl * Math.PI), o = a.position;
      for (let i = 0; i < 5; i++) { const an = kl * 30 + i * 1.257, y = ((kl * 2.2 + i * 0.2) % 1) * 2.1, rr = 0.25 + (1 - Math.abs(y / 2.1 - 0.5) * 2) * 0.5; chispas(V(o.x + Math.cos(an) * rr, o.y + y, o.z + Math.sin(an) * rr), { n: fz, color: col, color2: col2, vel: 0.08, vida: 0.8, tam: 0.11, giro: 6, radio: 0.02 }); }
      if (Math.random() < 0.6 * fz) humo(o, { n: 1, color: 0xf0a8d0, radio: 0.5, alfa: 0.35, alto: 1.6 }); },
      // Sea quien sea ahora, conserva su melena rosa: sigue siendo él.
      m => { if (nuevo !== 'Metamorfo') m.art?.pelo?.forEach(q => q.color.set(0xf0b8d8)); });
    S.impacto(523); onda(a.position.clone(), col, 1, 30);
  } finally { r.userData.apagar(); }
  a.userData.cv = cv; a.userData.ocupado = false;
  if (cv.ficha) marcaMetamorfo(a, true);
}

/**
 * Estratega: sus orbes vuelan bajo dos Portales, los alzan por el aire y los
 * intercambian en un giro circular, con todo lo que llevan encima.
 */
async function levitar(hab, p1, p2, v) {
  const c1 = claveDe(p1), c2 = claveDe(p2);
  const quien = hab ? portales.get(hab.origen)?.actor : null;
  const color = INFO.Estratega.color;
  const r = quien ? runa(quien.position, color, 0.95) : null;
  if (quien?.userData.modelo) { mirar(quien, p1.g.position.clone().lerp(p2.g.position, 0.5)); S.cargar(196, 1.1); await conjurar(quien, { dur: 1.1, lanza: 'abierto' }); }
  const salida = q => quien?.userData.modelo ? mano(quien, q) : (hab ? sobre(hab.origen).add(V(0, 1.6, 0)) : p1.g.position.clone().add(V(0, 4, 0)));
  // Seis orbes de colores por Portal, que se colocan girando bajo el borde de la tarima.
  const orbes = [p1, p2].flatMap((p, q) => COLORES_ORBES.map((cc, n) => { const o = orbe(cc); const de = salida(q); o.position.copy(de); return { o, p, n, cc, de }; }));
  let agarre = 0;
  const sitio = (x, t) => { const an = x.n / 6 * Math.PI * 2 + t * 2.2; return x.p.g.position.clone().add(V(Math.cos(an) * 1.42, 0.12, Math.sin(an) * 1.42)); };
  const fin = cadaFrame((dt, t) => orbes.forEach(x => { if (agarre >= 1) x.o.position.copy(sitio(x, t)); else x.o.position.copy(arco(x.de, sitio(x, t), agarre, 2.0, (x.n - 2.5) * 0.08)); if (Math.random() < 0.35) chispas(x.o.position, { n: 1, color: x.cc, vel: 0.15, vida: 0.5, tam: 0.1 }); }));
  try {
    S.lanzar(); await tw(1.1, k => { agarre = k; });
    if (quien?.userData.modelo) posar(quien, 'alzar', 4);
    const A = p1.g.position.clone().setY(0), B = p2.g.position.clone().setY(0);
    p1.levita = p2.levita = true;
    S.piedra(); temblar(0.15); humo(A, { n: 14, color: 0x9a94a8, radio: 1.2 }); humo(B, { n: 14, color: 0x9a94a8, radio: 1.2 });
    const ALTO = 2.3;
    await tw(1.4, k => { p1.g.position.y = ALTO * k; p2.g.position.y = ALTO * k; });
    // Giro: los dos Portales recorren media circunferencia alrededor del punto medio.
    const medio = A.clone().lerp(B, 0.5), radio = A.distanceTo(B) / 2, a0 = Math.atan2(A.z - medio.z, A.x - medio.x);
    S.estratega();
    await tw(3.0, (k, kl) => {
      [[p1, 0], [p2, Math.PI]].forEach(([p, d]) => { const an = a0 + d + k * Math.PI; p.g.position.set(medio.x + Math.cos(an) * radio, ALTO + Math.sin(kl * Math.PI * 3) * 0.12, medio.z + Math.sin(an) * radio); });
      if (Math.abs(kl - 0.5) < 0.008) S.estratega();
    });
    await tw(1.2, k => { p1.g.position.y = ALTO * (1 - k); p2.g.position.y = ALTO * (1 - k); }, entra);
    S.golpeSuelo(); temblar(0.3); humo(A, { n: 16, color: 0x9a94a8, radio: 1.3 }); humo(B, { n: 16, color: 0x9a94a8, radio: 1.3 });
  } finally {
    fin(); orbes.forEach(x => { chispas(x.o.position, { n: 8, color: x.cc, vel: 0.9, vida: 0.9 }); quitarOrbe(x.o); });
    p1.g.position.y = 0; p2.g.position.y = 0; p1.levita = p2.levita = false;
    if (quien?.userData.modelo) posar(quien, null, 4);
    r?.userData.apagar();
  }
  // Cada Portal (piedra y personaje) queda en el sitio del otro: se intercambian también en el mapa.
  portales.set(c1, p2); portales.set(c2, p1);
  p1.pick.clave = c2; p2.pick.clave = c1;
  if (p1.actor) p1.actor.userData.ancla = { tipo: 'portal', clave: c2 };
  if (p2.actor) p2.actor.userData.ancla = { tipo: 'portal', clave: c1 };
  for (const [clave, p] of [[c1, p2], [c2, p1]]) { ponerNombre(p, disp.portales.get(clave)?.nombre ?? null); ponerContenido(p, verPortal(v, clave), false); p.estado = inter.estados?.get(clave) ?? ''; }
  encender(p1.g, 1.5); encender(p2.g, 1.5); llegada(c1); llegada(c2);
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


/** Cronista: escribe en su libro a quien ocupa un Portal; se deshace en letras de luz que vuelan hasta sus páginas. */
async function cronista(hab, p, pv) {
  const clave = claveDe(p), a = p.actor, quien = portales.get(hab.origen)?.actor; p.actor = null;
  const color = INFO.Cronista.color, conModelo = quien?.userData.modelo && quien !== a;
  const r = quien && quien !== a ? runa(quien.position, color, 0.95) : null;
  let libro = () => (quien && quien !== a ? quien.position.clone() : sobre(hab.origen)).add(V(0, 1.3, 0));
  if (conModelo) {
    mirar(quien, p.g.position); posar(quien, 'leer', 5);
    const L = quien.userData.modelo.art?.libro; if (L) libro = () => L.getWorldPosition(new THREE.Vector3());
    S.cargar(260, 0.9); await espera(0.9);
  }
  S.cronista();
  if (a) {
    a.userData.ocupado = true; a.userData.ancla = null;
    const ms = materialesDe(a), pc = a.position.clone().add(V(0, 1.1, 0));
    await tw(1.5, (k, kl) => { opacidad(a, 1 - k, ms); chispas(arco(pc, libro(), (kl * 3) % 1, 1.0), { n: 3, color, color2: 0xffffff, vel: 0.15, vida: 0.5, tam: 0.12 }); });
    retirar(a);
  }
  const L = libro();
  destello(L, color, 1.2, 0.5).catch(() => {}); encender(p.g, 0.3);
  if (pv.top) await espera(0.4).then(() => surgir(p, pv.top));
  return { libro: L, usado: false, fin: () => { if (conModelo && !quien.userData.ocupado) posar(quien, null, 4); r?.userData.apagar(); } };
}

/** Maestro: su magia de colores toma la carta de la mano de un rival y la lleva flotando hasta su Portal. */
async function vueloMaestro(hab, a, clave, alLlegar) {
  const quien = portales.get(hab.origen)?.actor, color = INFO.Maestro.color;
  const r = quien ? runa(quien.position, color, 0.95) : null;
  const cs = [0xe04a4a, 0x5ab8e8, 0x5fd0a0, 0xf0c84a];
  let orb = () => {};
  try {
    let desde = sobre(hab.origen).add(V(0, 1.6, 0));
    S.maestro();
    if (quien?.userData.modelo) { mirar(quien, a.position); desde = await conjurar(quien, { dur: 1.3, lanza: 'abierto' }); }
    S.lanzar();
    const otra = quien?.userData.modelo ? mano(quien, 1) : desde;
    await Promise.all(cs.map((cc, i) => rayo(i % 2 ? otra : desde, pecho(a), cc, { lado: (i - 1.5) * 0.25, alto: 1.2 + i * 0.2, dur: 0.7 + i * 0.08 })));
    S.levita(); a.userData.elevaObj = 1.1;
    orb = cadaFrame((dt, tt) => { for (let i = 0; i < 2; i++) { const an = tt * 5 + i * Math.PI; chispas(pecho(a).add(V(Math.cos(an) * 0.7, 0, Math.sin(an) * 0.7)), { n: 1, color: cs[(i + Math.floor(tt * 4)) % 4], vel: 0.1, vida: 0.5 }); } });
    await espera(0.9);
    const de = a.position.clone(), hasta = sobre(clave);
    a.userData.rumbo = Math.atan2(hasta.x - de.x, hasta.z - de.z);
    let avisado = false;
    await tw(1.8, k => { a.position.lerpVectors(de, hasta, k); if (!avisado && k > 0.7) { avisado = true; alLlegar(); } });
    a.userData.rumbo = portales.get(clave).g.rotation.y;
  } finally {
    a.userData.elevaObj = 0; espera(0.5).then(orb, orb);
    if (quien?.userData.modelo && !quien.userData.ocupado) posar(quien, null, 4);
    r?.userData.apagar();
  }
  await espera(0.5);
}

/** Aprendiz: con más ímpetu que oficio, levanta un remolino y las dos manos se cruzan por el aire sin girarse. */
async function trueque(hab, A, B, v, morfos) {
  const quien = portales.get(hab.origen)?.actor, color = INFO.Aprendiz.color;
  const r = quien ? runa(quien.position, color, 0.95) : null;
  const LA = manos.get(A), LB = manos.get(B), mov = [];
  enfocar([...LA, ...LB].map(h => h.actor.position), { ancho: 9 });
  try {
    if (quien?.userData.modelo) { S.cargar(300, 1.0); await conjurar(quien, { dur: 1.0, lanza: 'celebrar' }); }
    S.aprendiz();
    const pasar = (lista, idx, otra) => lista.map((h, i) => {
      const lado = otra[i]?.lado ?? h.lado, hasta = posMano(idx, lado).pos.clone();
      h.actor.userData.ocupado = true; h.actor.userData.ancla = { tipo: 'mano', idx, lado };
      mov.push({ a: h.actor, de: h.actor.position.clone(), hasta }); h.lado = lado; h.idx = idx; return h;
    });
    const nA = pasar(LB, A, LA), nB = pasar(LA, B, LB);
    manos.set(A, nA); manos.set(B, nB);
    if (quien?.userData.modelo) espera(0.9).then(() => { posar(quien, 'apuro', 10); S.ups(); }, () => {});
    await tw(2.4, (k, kl) => mov.forEach(m => {
      m.a.position.copy(arco(m.de, m.hasta, k, 1.8, 0.3)); m.a.userData.rumbo = kl * Math.PI * 4;
      if (Math.random() < 0.7) chispas(m.a.position.clone().add(V(0, 1, 0)), { n: 2, color: 0xfff3d6, color2: color, vel: 0.9, vida: 0.8, tam: 0.2, giro: 6, radio: 0.5 });
    }));
    S.impacto(330);
  } finally {
    mov.forEach(m => { m.a.userData.ocupado = false; });
    if (quien?.userData.modelo && !quien.userData.ocupado) posar(quien, null, 4);
    r?.userData.apagar();
  }
  // Lo que cada figura deja ver ahora se compara de nuevo, ya en su nueva mano.
  for (let i = morfos.length - 1; i >= 0; i--) morfos.splice(i, 1);
  for (const a of [v.propio, ...v.rivales]) {
    const lista = manos.get(a.idx) ?? [];
    lista.forEach((h, i) => { if (!h.actor || !a.mano[i]) return; const f = firmaMano(a.mano[i]); if (h.firma !== f) morfos.push([h, a.mano[i]]); else h.cv = a.mano[i]; });
  }
}

/** Pícaro (pasiva): con sigilo, baja de su Portal, le roba una Gema azul a la criatura y la deja con las de su dueña. */
async function roboPicaro(p, cr, C, R) {
  const a = p.actor, clave = claveDe(p), idx = +clave.split(':')[0];
  a.userData.ocupado = true;
  const pie = local(clave, 0, 2.15);
  // Hasta dónde se acerca: lo más cerca del centro sin meterse en un Portal central.
  const centrales = [...portales.entries()].filter(([k, q]) => k.startsWith('n:') && q.g.visible).map(([, q]) => q.g.position);
  let alto = pie.clone();
  for (let t = 0; t <= 1; t += 0.04) { const q = pie.clone().lerp(R, t); if (centrales.some(c => Math.hypot(c.x - q.x, c.z - q.z) < 2.1)) break; alto = q; }
  const azul = gema('azul', 1.1); azul.position.copy(C);
  let lleva = () => {};
  try {
    const flota = alto.clone().add(V(0, 1.7, 0)), de0 = C.clone();
    S.gemaVuela(); tw(1.2, k => azul.position.copy(arco(de0, flota, k, 0.6))).catch(() => {});
    posar(a, 'sigilo', 6); await bajar(a, clave);
    const cerca = alto.clone().lerp(pie, Math.min(1, 0.9 / Math.max(0.9, alto.distanceTo(pie))));
    await caminar(a, cerca, { vel: 2.6, mudo: true, cadencia: 11 });
    posar(a, 'orbeAlto', 12); S.gemaVuela();
    const de1 = azul.position.clone(); await tw(0.45, k => azul.position.copy(arco(de1, mano(a).add(V(0, 0.25, 0)), k, 0.3)));
    S.picaro(); chispas(azul.position, { n: 14, color: INFO['Pícaro'].color, vel: 0.6 });
    lleva = cadaFrame(() => azul.position.copy(mano(a)).add(V(0, 0.22, 0)));
    posar(cr, 'dudaI', 5); S.duda(); await espera(0.5); posar(a, 'sigilo', 8);
    await caminar(a, pie, { vel: 3.0, mudo: true, cadencia: 12 }); posar(cr, 'ofrenda', 3);
    await subir(a, clave, { vel: 2.4 }); posar(a, 'reverencia', 8); await espera(0.4);
    lleva(); lleva = () => {};
    const de2 = azul.position.clone(), hasta = (sitioGemas(idx)?.pos ?? pie).clone().setY(0.4);
    await tw(0.6, k => azul.position.copy(arco(de2, hasta, k, 0.8)));
    S.gema(2); chispas(azul.position, { n: 12, color: 0x4aa8ff, vel: 0.5 });
    await espera(0.4);
  } finally {
    lleva(); quitar(azul); posar(a, null, 4);
    a.userData.ancla = { tipo: 'portal', clave }; a.userData.ocupado = false;
  }
}

/** Entusiasta (pasiva): lo celebra con tanto ímpetu que le lanza a la criatura una Gema azul de su dueña. */
async function ofrendaEntusiasta(p, cr, C) {
  const a = p.actor, clave = claveDe(p), idx = +clave.split(':')[0];
  a.userData.ocupado = true;
  const g = gema('azul', 1), sg = sitioGemas(idx); g.position.copy((sg?.pos ?? a.position).clone().setY(0.4));
  let lleva = () => {};
  try {
    posar(a, 'celebrar', 10); S.entusiasta(); S.boing(); await saltar(a, 0.45, 0.45);
    S.boing(); S.entusiasta(); await saltar(a, 0.6, 0.6, Math.PI * 2);
    S.gemaVuela(); posar(a, 'senalar', 10);
    const de = g.position.clone(); await tw(0.6, k => g.position.copy(arco(de, mano(a).add(V(0, 0.2, 0)), k, 0.6))); S.picaro();
    lleva = cadaFrame(() => g.position.copy(mano(a)).add(V(0, 0.2, 0)));
    mirar(a, C); posar(a, 'alzar', 7); S.boing(); await saltar(a, 0.35, 0.4); await espera(0.25);
    lleva(); lleva = () => {}; posar(a, 'lanzar', 18); S.lanzar(700);
    const de2 = g.position.clone();
    await tw(1.4, k => { g.position.copy(arco(de2, C, k, 2.4)); chispas(g.position, { n: 1, color: 0x4aa8ff, color2: 0xffffff, vel: 0.06, vida: 0.9, tam: 0.1 }); });
    S.gema(4); destello(C, 0x4aa8ff, 2.6, 0.8).catch(() => {}); chispas(C, { n: 30, color: 0x4aa8ff, color2: 0xffffff, vel: 0.9, vida: 1.2 }); posar(cr, 'alzar', 5);
    posar(a, 'celebrar', 8); S.entusiasta(); await saltar(a, 0.4, 0.45); await espera(0.4);
    posar(a, 'apuro', 10); S.ups(); await espera(1.0); posar(cr, 'ofrenda', 3);
  } finally {
    lleva(); quitar(g); posar(a, null, 4); a.userData.rumbo = p.g.rotation.y; a.userData.ocupado = false;
  }
}

/** Conjuro de quien activa una habilidad, hacia lo que ha cambiado. */
async function conjuro(an, destinos) {
  const p = portales.get(an.origen), a = p?.actor;
  const color = INFO[an.nombre]?.color ?? 0xffffff, color2 = INFO[an.nombre]?.color2 ?? 0xffffff;
  if (!a?.userData.modelo) return;
  const r = runa(a.position, color, 0.95); espera(2.4).then(() => r.userData.apagar(), () => r.userData.apagar());
  if (an.nombre === 'Ocultista') S.ocultista();
  S.cargar(an.nombre === 'Ocultista' ? 110 : 220, 0.9);
  if (destinos[0]) mirar(a, destinos[0]);
  const desde = await conjurar(a, an.nombre === 'Ocultista' ? { pose: 'juntas' } : {});
  S.lanzar(600);
  const lista = destinos.length ? destinos : [sobre(an.origen).add(V(0, 1.2, 0))];
  if (an.nombre === 'Cronomante') { const rj = relojArena(lista[0].clone().add(V(0, 3.2, 0)), color, color2, 0.5); S.cronomante(); espera(2.6).then(() => { rj.parar(); rj.apagar(); }, () => rj.apagar()); }
  await Promise.all(lista.map(d => rayo(desde, d, color, { color2, alto: 1.5, dur: 0.75 })));
  for (const d of lista) { destello(d, color, 1.8, 0.6).catch(() => {}); onda(d, color, 0.8, 20); }
  S.impacto(392);
}

/**
 * Invocación completada: las runas despiertan, los requeridos alzan su magia,
 * la criatura cruza el umbral y queda flotando muy por encima de los Portales
 * centrales, sus Gemas orbitan a su alrededor y vuelan hasta quienes la
 * invocaron (las que nadie recibe se van con ella). Al marcharse, el gran
 * círculo de la invocación se encoge hasta el sitio del Portal nuevo y se
 * queda como su runa mientras la piedra se alza.
 */
async function invocar(an, v, nuevos = []) {
  const nombre = INFO[an.nombre]?.gema ? an.nombre : CRIATURA_POR_NIVEL[an.nivel] ?? 'Cirelia';
  const tono = INFO[nombre].color, tono2 = INFO[nombre].color2;
  const ps = [...portales.values()].filter(p => p.g.visible && !p.nuevo);
  const centrales = [...portales.entries()].filter(([k, p]) => k.startsWith('n:') && p.g.visible && !p.nuevo).map(([, p]) => p.g.position);
  const R = (centrales.length ? centrales.reduce((a, b) => a.clone().add(b)).multiplyScalar(1 / centrales.length) : disp.centro.clone()).setY(0);
  const ALTO_CR = 4.4, sitioCr = R.clone().add(V(0, 0, -0.9)), F = sitioCr.clone().add(V(0, ALTO_CR + 2.2, 0));
  // Cámara: se aleja y mira más de frente para ver a la criatura en lo alto.
  enfocar([...ps.map(p => p.g.position)], { y: 3.6, alto: 12, ancho: (camBase.ancho ?? 12) * 0.95, polar: 1.22 });
  const CARGA = 5.2;
  S.invInicio(CARGA);
  // Las runas de cada Portal despiertan una a una y lanzan su luz hacia lo alto.
  let nr = 0;
  for (const p of ps) {
    const base = p.g.position.clone().add(V(0, ALTURA_TARIMA, 0));
    encender(p.g, 1.8); S.runa(nr++ * 2 % 9); onda(base, p.g.userData.tono, 1, 26, 1.8);
    chispas(base, { n: 26, color: p.g.userData.tono, color2: 0xffffff, vel: 0.5, dir: V(0, 3.2, 0), vida: 1.6, radio: 0.8, tam: 0.16 });
    await espera(0.3);
  }
  // El gran círculo lleva la misma estrella que tendrá el Portal que nazca de él.
  const puntas = nuevos[0]?.g.userData.variante?.puntas ?? 8;
  const gran = runa(R, tono, 5.4, 0.5, puntas), gran2 = runa(R.clone().add(V(0, 0.01, 0)), tono2, 3.3, -0.9, 6);
  const req = ps.map(p => p.actor).filter(a => a?.userData.modelo && a.userData.cv?.visible && an.need?.includes(a.userData.cv.ficha || a.userData.cv.nombre));
  req.forEach(a => { mirar(a, F); posar(a, 'alzar', 4); a.userData.elevaObj = 0.25; });
  const bases = ps.map(p => ({ pos: p.g.position.clone().add(V(0, ALTURA_TARIMA + 0.3, 0)), tono: p.g.userData.tono }));
  let pulso = 0;
  await tw(CARGA, (k, kl) => {
    // Los requeridos funden su magia en el cielo…
    for (const a of req) chispas(arco(mano(a), F, (kl * 4 + a.position.x * 0.1) % 1, 1.4), { n: 2, color: INFO[a.userData.nombre]?.color ?? tono, color2: 0xffffff, vel: 0.12, vida: 0.5, tam: 0.14 + kl * 0.1 });
    // …y cada Portal le envía un hilo de luz de su color.
    bases.forEach((b, i) => { if ((i + Math.floor(kl * 240)) % 2 === 0) chispas(arco(b.pos, F, (kl * 3 + i * 0.17) % 1, 2.2, i % 2 ? 0.25 : -0.25), { n: 1, color: b.tono, color2: 0xffffff, vel: 0.08, vida: 0.6, tam: 0.12 + kl * 0.08 }); });
    // Tres brazos de espiral que se cierran sobre el punto donde se abrirá el umbral.
    for (let j = 0; j < 3; j++) { const ang = kl * 30 + j * 2.094, r = 3.0 * (1 - kl) + 0.2; chispas(F.clone().add(V(Math.cos(ang) * r, Math.sin(ang * 0.7) * 0.5, Math.sin(ang) * r)), { n: 1, color: j ? tono2 : tono, color2: 0xffffff, vel: 0.1, vida: 0.8, tam: 0.2 }); }
    // El gran círculo levanta una cortina de luz que crece.
    for (let j = 0; j < 2; j++) { const ang = Math.random() * 6.283; if (Math.random() < 0.3 + kl) chispas(R.clone().add(V(Math.cos(ang) * 5.3, 0.05, Math.sin(ang) * 5.3)), { n: 1, color: j ? tono2 : tono, vel: 0.1, dir: V(0, 1.5 + kl * 3, 0), vida: 1.3, tam: 0.15 }); }
    if (Math.random() < kl) chispas(R.clone().add(V((Math.random() - 0.5) * 8, 0.1, (Math.random() - 0.5) * 8)), { n: 1, color: tono, vel: 0.1, dir: V(0, 2.5, 0), vida: 1.2 });
    // Latidos cada vez más seguidos.
    const lat = Math.floor(kl * kl * 9); if (lat !== pulso) { pulso = lat; onda(R, lat % 2 ? tono2 : tono, 1.5 + kl * 2, 34, 1.6); S.runa(lat); destello(F, tono, 1.5 + kl * 4, 0.5).catch(() => {}); }
    mundo.cam.temblor = Math.max(mundo.cam.temblor, kl * kl * 0.06);
  }, lineal);
  // ¡Estallido! Se abre el umbral: columna de luz, fogonazo y rayos hacia cada Portal.
  S.invBoom(); temblar(0.6); fogonazo(0.8);
  destello(F, 0xffffff, 12, 1.4).catch(() => {}); onda(R, tono, 3, 60, 4); onda(R, tono2, 2, 40, 2.5);
  espera(0.35).then(() => onda(R, 0xffffff, 2.5, 50, 3), () => {}); espera(0.7).then(() => onda(R, tono, 2, 44, 3), () => {});
  chispas(F, { n: 130, color: tono, color2: tono2, vel: 3.2, vida: 1.8, grav: 0.8, tam: 0.22 });
  bases.forEach((b, i) => espera(i * 0.07).then(() => rayo(F, b.pos, b.tono, { color2: 0xffffff, alto: 0.6, dur: 0.7, lado: i % 2 ? 0.3 : -0.3 }), () => {}).then(() => { destello(b.pos, b.tono, 1.6, 0.5).catch(() => {}); }, () => {}));
  const columna = hazDeLuz(F.clone().add(V(0, 9, 0)), R.clone().setY(0.1), tono);
  req.forEach(a => { posar(a, null, 3); a.userData.elevaObj = 0; });
  // La criatura sube desde el suelo hasta quedar flotando en lo alto.
  const cr = crearActor(nombre, sitioCr.clone().setY(-4), { fijo: true }); actores.add(cr);
  cr.userData.ocupado = true; cr.userData.sombra.visible = false;
  const ms = materialesDe(cr); opacidad(cr, 0, ms);
  const alred = (ancho, y0, y1) => sitioCr.clone().add(V((Math.random() - 0.5) * ancho, y0 + Math.random() * (y1 - y0), (Math.random() - 0.5) * 1.2));
  S.invCoro(9);
  await tw(3.6, (k, kl) => { cr.position.y = mezcla(-4, ALTO_CR, k); opacidad(cr, Math.min(1, kl * 2), ms);
    for (let i = 0; i < 3; i++) chispas(alred(2.4, cr.position.y, cr.position.y + 4), { n: 1, color: tono, color2: tono2, vel: 0.3, dir: V(0, 1.2, 0), vida: 1.1, tam: 0.2 });
    for (let j = 0; j < 2; j++) { const ang = kl * 22 + j * Math.PI, y = cr.position.y + ((kl * 3 + j * 0.5) % 1) * 4.2; chispas(V(sitioCr.x + Math.cos(ang) * 1.5, y, sitioCr.z + Math.sin(ang) * 1.5), { n: 2, color: j ? tono2 : 0xffffff, color2: tono, vel: 0.06, vida: 0.9, tam: 0.16 }); } }, sale);
  columna.apagar();
  S.impacto(392); onda(R, tono2, 2, 40, 2.4); destello(sitioCr.clone().setY(ALTO_CR + 2), tono, 5, 0.9).catch(() => {});
  let flota = true, latido = 0;
  const parar = cadaFrame((dt, t) => { if (!flota) return; cr.position.y = ALTO_CR + Math.sin(t * 1.1) * 0.15; if (Math.random() < 0.5) chispas(alred(2, ALTO_CR, ALTO_CR + 4), { n: 1, color: tono, color2: tono2, vel: 0.2, dir: V(0, 0.5, 0), vida: 1 });
    // Su presencia late sobre la mesa y llueve polvo de luz.
    latido += dt; if (latido > 1.7) { latido = 0; onda(R, tono, 1.2, 30, 2.6); }
    if (Math.random() < 0.35) chispas(R.clone().add(V((Math.random() - 0.5) * 9, ALTO_CR + 1 + Math.random() * 2, (Math.random() - 0.5) * 6)), { n: 1, color: tono2, color2: 0xffffff, vel: 0.05, grav: 0.5, vida: 2.2, tam: 0.1 }); });
  posar(cr, 'alzar', 3); await espera(1.2);
  // Sus Gemas orbitan a su alrededor…
  const tipo = INFO[nombre].gema ?? (an.nivel === '*' ? 'A' : an.nivel);
  const entregas = [];
  for (const r of an.recompensas ?? []) {
    if (!(r.gemas > 0)) continue;
    const s = [...disp.asientos.entries()].find(([, x]) => x.nombre === r.jugadora); if (!s) continue;
    const [idx] = s;
    // A quién: el personaje requerido que tiene en su Portal (o, si no se ve, a su sitio).
    const suyos = ps.filter(p => claveDe(p)?.startsWith(`${idx}:`)).map(p => p.actor).filter(a => a?.userData.modelo && an.need?.includes(a.userData.cv?.ficha || a.userData.cv?.nombre));
    for (let i = 0; i < Math.min(r.gemas, 4); i++) entregas.push({ idx, actor: suyos[i % Math.max(1, suyos.length)] ?? null });
  }
  const C = sitioCr.clone().add(V(0, ALTO_CR + 1.6, 0.4));
  const gs = Array.from({ length: Math.max(5, entregas.length) }, (_, i) => { const g = gema(tipo, 1.25); g.position.copy(C); g.userData.orbita = true; g.userData.an = i / 5 * Math.PI * 2; return g; });
  let radio = 0; tw(1.0, k => { radio = 1.6 * k; }, sale).catch(() => {});
  const orbita = cadaFrame((dt, t) => gs.forEach(g => { g.rotation.y += dt * 2.5; if (g.userData.orbita) { g.userData.an += dt * 1.3; g.position.set(C.x + Math.cos(g.userData.an) * radio, C.y + Math.sin(g.userData.an * 2 + t) * 0.15, C.z + Math.sin(g.userData.an) * radio * 0.55); } }));
  try {
    gs.forEach((g, i) => espera(i * 0.12).then(() => S.gema(i), () => {}));
    posar(cr, 'ofrenda', 3); await espera(2.2);
    // …y vuelan hasta quienes la invocaron: primero al personaje requerido, luego delante de su dueña.
    let n = 0;
    for (const e of entregas) {
      const g = gs[n++]; g.userData.orbita = false; S.gemaVuela();
      const de = g.position.clone();
      if (e.actor) {
        const cab = cabeza(e.actor).add(V(0, 0.15, 0));
        await tw(1.4, k => { g.position.copy(arco(de, cab, k, 2.0, n % 2 ? 0.12 : -0.12)); chispas(g.position, { n: 1, color: tono, color2: 0xffffff, vel: 0.05, vida: 0.8, tam: 0.1 }); });
        S.gema(n * 2); chispas(g.position, { n: 22, color: tono, color2: 0xffffff, vel: 0.7 });
        posar(e.actor, 'celebrar', 8); saltar(e.actor, 0.2, 0.4).catch(() => {}); espera(1.1).then(() => posar(e.actor, null, 4), () => {});
      }
      const sg = sitioGemas(e.idx), hasta = (sg?.pos ?? disp.asientos.get(e.idx).pos).clone().setY(0.4), de2 = g.position.clone();
      tw(0.8, k => g.position.copy(arco(de2, hasta, k, 1.2))).then(() => { destello(hasta, g.userData.color, 1.4, 0.5).catch(() => {}); S.gema(); quitar(g); }, () => quitar(g));
      await espera(0.35);
    }
    await espera(0.9);
    // Pasivas: el Pícaro le roba una Gema azul; la Entusiasta le regala una de su dueña.
    const enSuPortal = nom => ps.filter(p => !claveDe(p)?.startsWith('n:') && p.actor?.userData.modelo && !p.actor.userData.ocupado && p.actor.userData.cv?.visible && !p.actor.userData.cv.ficha && p.actor.userData.cv.nombre === nom);
    for (const p of enSuPortal('Pícaro')) await roboPicaro(p, cr, C, R);
    for (const p of enSuPortal('Entusiasta')) if ((unidadesPrevias.get(+claveDe(p).split(':')[0]) ?? 0) > 0) await ofrendaEntusiasta(p, cr, C);
    // Las que nadie recibe se van con la criatura.
    const resto = gs.slice(n); resto.forEach(g => { g.userData.orbita = false; });
    await Promise.all(resto.map((g, i) => espera(i * 0.15).then(() => { const de = g.position.clone(), a = C.clone().add(V(0, -0.8, 0)); return tw(0.8, k => g.position.copy(arco(de, a, k, 0.3))); }).then(() => { chispas(g.position, { n: 8, color: tono, vel: 0.4 }); quitar(g); })));
  } finally { orbita(); gs.forEach(g => quitar(g)); }
  // La criatura parte; el círculo de la invocación se encoge y queda como la runa del Portal nuevo.
  posar(cr, 'alzar', 3); S.seMarcha(); flota = false; gran2.userData.apagar(1.5);
  const y0 = cr.position.y;
  await tw(2.8, (k, kl) => { opacidad(cr, 1 - k, ms); cr.position.y = y0 + k * 3; chispas(alred(1.6, y0 + 1, y0 + 6), { n: 2, color: tono, color2: tono2, vel: 0.4, dir: V(0, 2, 0), vida: 1.2 });
    for (let j = 0; j < 2; j++) { const ang = kl * 26 + j * Math.PI, rr = 1.6 * (1 - kl) + 0.1; chispas(V(sitioCr.x + Math.cos(ang) * rr, cr.position.y + 1 + kl * 3, sitioCr.z + Math.sin(ang) * rr), { n: 1, color: 0xffffff, color2: tono, vel: 0.05, vida: 0.8, tam: 0.14 }); } }, entra);
  parar(); retirar(cr);
  const adios = sitioCr.clone().setY(y0 + 5);
  destello(adios, 0xffffff, 6, 0.9).catch(() => {}); chispas(adios, { n: 70, color: tono, color2: tono2, vel: 2.2, vida: 1.6, grav: 1.2, tam: 0.18 }); onda(R, tono, 2, 44, 3); fogonazo(0.25);
  const nuevo = nuevos[0];
  if (nuevo) {
    const destino = posPortal(claveDe(nuevo))?.setY(0.04) ?? R;
    const de = gran.position.clone(); S.cargar(160, 2.0);
    await tw(2.2, k => { gran.position.lerpVectors(de, destino, k); gran.scale.setScalar(mezcla(5.4, 1.03, k)); if (Math.random() < 0.6) { const a = Math.random() * 6.28, rr = gran.scale.x; chispas(gran.position.clone().add(V(Math.cos(a) * rr, 0.05, Math.sin(a) * rr)), { n: 1, color: tono, vel: 0.1, dir: V(0, 0.8, 0), vida: 0.8 }); } });
    S.impacto(523); onda(destino, tono, 1, 30, 1.6); await espera(0.5);
    await alzarPortal(nuevo, gran);
  } else gran.userData.apagar(1.2);
  ps.forEach(p => encender(p.g, 0.6));
  soltarFoco();
}

/** Un Portal nuevo (tras una invocación) se alza desde debajo de la mesa; la runa que lo trajo se queda en su tarima. */
async function alzarPortal(p, runaGuia = null) {
  p.nuevo = false; p.g.visible = true; p.g.scale.set(1, 1, 1); p.levita = true;
  const x = p.g.position.x, z = p.g.position.z;
  if (p.actor) p.actor.visible = true;
  encender(p.g, 0.05); S.piedra?.();
  const temblor = cadaFrame(() => { mundo.cam.temblor = Math.max(mundo.cam.temblor, 0.04); if (Math.random() < 0.5) humo(V(x, 0, z), { n: 1, color: 0x9a94a8, radio: 1.3 }); });
  try {
    await tw(2.4, k => { p.g.position.set(x, mezcla(-3.2, 0, k), z); if (runaGuia) runaGuia.position.y = Math.max(0.04, p.g.position.y + ALTURA_TARIMA + 0.02); }, sale);
  } finally { temblor(); p.g.position.y = 0; p.levita = false; }
  S.golpeSuelo(); temblar(0.3); encender(p.g, 1.6); S.runa(9); onda(V(x, 0, z), p.g.userData.tono, 1.2, 40, 2.4);
  runaGuia?.userData.apagar(1.2);
  espera(1.3).then(() => encender(p.g, 0.6), () => {});
}


// ------------------------------------------------- escudos de la Centinela
// Mientras una Centinela está a la vista, sus escudos flotan en corro
// alrededor de los Portales que protege (todos los de su dueña, o el Portal
// central en el que esté). Si alguien intenta un hechizo contra ellos, rebota.

const escudosPortal = new Map();   // clave → { g, k (0..1 aparición), fuera }
function protegidos(v) {
  const s = new Set();
  const esC = pv => pv?.top?.visible && pv.top.nombre === 'Centinela';
  for (const a of [v.propio, ...v.rivales]) if (a.portales.some(esC)) a.portales.forEach((_, j) => s.add(`${a.idx}:${j}`));
  v.centrales.forEach((pv, c) => { if (esC(pv)) s.add(`n:${c}`); });
  return s;
}
function actualizarEscudos(v, conSonido = true) {
  const quiero = protegidos(v);
  let nuevos = 0;
  for (const clave of quiero) {
    const e = escudosPortal.get(clave);
    if (e) { e.fuera = false; continue; }
    if (!portales.get(clave)?.g.visible) continue;
    const g = crearEscudos(); g.scale.setScalar(0.01); mundo.escena.add(g);
    escudosPortal.set(clave, { g, k: 0, fuera: false }); nuevos++;
  }
  for (const [clave, e] of escudosPortal) if (!quiero.has(clave)) e.fuera = true;
  if (nuevos && conSonido) S.clang();
}
function quitarEscudos() { for (const e of escudosPortal.values()) quitar(e.g); escudosPortal.clear(); }
function seguirEscudos(dt, t) {
  for (const [clave, e] of escudosPortal) {
    const p = portales.get(clave);
    if (!p?.g.visible) e.fuera = true;
    e.k = THREE.MathUtils.clamp(e.k + dt * (e.fuera ? -2.5 : 1.8), 0, 1);
    if (e.fuera && e.k <= 0) { quitar(e.g); escudosPortal.delete(clave); continue; }
    if (p) e.g.position.copy(p.g.position).add(V(0, ALTURA_TARIMA + Math.sin(t * 1.6 + p.g.position.x) * 0.06, 0));
    e.g.rotation.y += dt * 0.7; e.g.scale.setScalar(Math.max(0.01, rebote(e.k)));
    e.golpe = Math.max(0, (e.golpe ?? 0) - dt * 2.5);
    if (e.golpe > 0) e.g.scale.multiplyScalar(1 + e.golpe * 0.18);
  }
}

/**
 * Alguien apunta un hechizo a un Portal protegido: el rayo sale de quien
 * conjura, choca contra los escudos y sale rebotado. Devuelve false si ese
 * Portal no tiene escudos (y entonces no hay nada que enseñar).
 */
export function rebotar(clave, origen = null) {
  if (origen) ultimoOrigen = origen;
  const e = escudosPortal.get(clave), p = portales.get(clave);
  if (!e || e.fuera || !p || !visible) return false;
  const quien = ultimoOrigen ? portales.get(ultimoOrigen)?.actor : null;
  const nombre = quien?.userData.cv?.visible ? quien.userData.cv.nombre : null;
  const color = INFO[nombre]?.color ?? 0xb48cff, color2 = INFO[nombre]?.color2 ?? 0xffffff;
  const centro = sobre(clave);
  (async () => {
    let desde = quien ? quien.position.clone().add(V(0, 1.5, 0)) : centro.clone().add(V(0, 5, 4));
    const r = quien ? runa(quien.position, color, 0.95) : null;
    try {
      if (quien?.userData.modelo && !quien.userData.ocupado) { mirar(quien, p.g.position); S.cargar(110, 0.8); desde = await conjurar(quien, { pose: 'juntas', dur: 0.8 }); }
      const dir = desde.clone().sub(centro).setY(0); if (dir.lengthSq() < 0.01) dir.set(0, 0, 1); dir.normalize();
      const choque = centro.clone().addScaledVector(dir, 1.5).add(V(0, 1.0, 0));
      // La Centinela de ese asiento se pone en guardia.
      const guardianas = [...portales.values()].map(q => q.actor).filter(a => a?.userData.modelo && a.userData.cv?.visible && a.userData.cv.nombre === 'Centinela' && !a.userData.ocupado);
      guardianas.forEach(a => posar(a, 'bloqueo', 14));
      S.lanzar(300); await rayo(desde, choque, color, { color2, alto: 1.6, dur: 0.8, tam: 0.8 });
      S.clang(); temblar(0.3); e.golpe = 1;
      chispas(choque, { n: 40, color: 0xffb060, color2: 0xfff0c0, vel: 2.4, grav: 5, vida: 0.8, tam: 0.1 });
      onda(centro, 0xffc070, 1.2, 28, 1.4); destello(choque, 0xffe0a0, 2.2, 0.5).catch(() => {});
      S.zas();
      const lejos = choque.clone().addScaledVector(dir, 3.5).add(V((Math.random() - 0.5) * 3, 5, 0));
      rayo(choque, lejos, color, { alto: 0.3, dur: 0.6 }).catch(() => {});
      if (quien?.userData.modelo && !quien.userData.ocupado) posar(quien, 'apuro', 6);
      await espera(1.4);
      guardianas.forEach(a => { if (!a.userData.ocupado) posar(a, null, 5); });
      if (quien?.userData.modelo && !quien.userData.ocupado) posar(quien, null, 4);
    } finally { r?.userData.apagar(); }
  })().catch(() => {});
  return true;
}
let ultimoOrigen = null;

/** La Centinela, al llegar: planta la lanza y se pone en guardia. */
async function plantarLanza(a) {
  posar(a, 'lanzaAlta', 7); await espera(0.55); posar(a, 'lanzaGolpe', 20); await espera(0.14);
  S.golpeSuelo(); temblar(0.22); humo(a.position.clone().add(V(-0.3, 0, 0.3)), { n: 10, color: 0xa89a88, radio: 0.4, sube: 0.3 });
  await espera(0.3); posar(a, 'bloqueo', 14); await espera(0.9); posar(a, 'guardia', 5);
  espera(1.2).then(() => posar(a, null, 4), () => {});
}

/** Los animales no tienen habilidad, pero al llegar hacen su gracia. */
async function gracia(a, clave) {
  const nombre = a.userData.nombre, o = sobre(clave);
  a.userData.alegre = true;
  if (nombre === 'Reena') {
    for (const [x, z] of [[0.5, 0.2], [0, 0.55], [-0.5, 0.2], [0, 0]]) await caminar(a, o.clone().add(V(x, 0, z)), { vel: 2.4, mudo: true });
    S.reena(); await saltar(a, 0.35, 0.35); await saltar(a, 0.45, 0.4, Math.PI * 2);
  } else if (nombre === 'Sora') {
    S.sora(); await espera(0.4); S.aleteo(); a.userData.mudo = true; a.userData.andandoObj = 1;
    await tw(3.0, (k, kl) => { const an = k * Math.PI * 2; a.position.set(o.x + Math.sin(an) * 1.35, o.y + Math.sin(kl * Math.PI) * 1.5, o.z + 0.3 - Math.cos(an) * 1.0 + 0.7 * Math.sin(kl * Math.PI)); a.userData.rumbo = an + Math.PI / 2;
      if (Math.random() < 0.3) chispas(a.position.clone().add(V(0, 0.7, 0)), { n: 1, color: INFO.Sora.color, vel: 0.2, grav: 0.8, vida: 1.2 }); });
    a.position.copy(o); a.userData.andandoObj = 0; a.userData.mudo = false; S.sora();
  } else if (nombre === 'Lumo') {
    S.lumo();
    for (const [x, z] of [[-0.45, 0.3], [0.45, 0.3], [0, 0]]) { saltar(a, 0.3, 0.5).catch(() => {}); await caminar(a, o.clone().add(V(x, 0, z)), { vel: 1.6, mudo: true }); }
    a.userData.inclina = 0.3; a.userData.cabx = 0.5; await espera(0.8); a.userData.inclina = 0; a.userData.cabx = 0;
  } else return;
  S.tierno();
  for (let i = 0; i < 3; i++) { chispas(cabeza(a), { n: 8, color: 0xff8ab0, color2: INFO[nombre].color2, vel: 0.25, dir: V(0, 0.7, 0), vida: 1.4, tam: 0.2 }); await espera(0.3); }
}

// Destello a pantalla completa (la criatura cruza el umbral).
let velo = null;
function fogonazo(fuerza = 0.8) {
  if (!velo) { velo = document.createElement('div'); velo.style.cssText = 'position:fixed;inset:0;z-index:41;pointer-events:none;background:#fff;opacity:0;transition:opacity .7s ease-out'; document.body.appendChild(velo); }
  velo.style.transition = 'none'; velo.style.opacity = String(fuerza);
  requestAnimationFrame(() => requestAnimationFrame(() => { velo.style.transition = 'opacity .8s ease-out'; velo.style.opacity = '0'; }));
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
  // Si pasa lejos de quien mira, la cámara se acerca para verlo bien.
  const implicados = [...new Set([hab?.origen, ...cambios.map(c => claveDe(c.p))].filter(k => k && portales.has(k)))];
  if (hab && implicados.some(lejano)) enfocar(implicados.map(k => portales.get(k).g.position));
  // Escenas con puesta en escena propia (las demás usan el conjuro general).
  const asientoDe = h => { for (const [idx, l] of manos) if (l.includes(h)) return idx; return null; };
  const cCronista = hab?.nombre === 'Cronista' ? cambios.find(c => !c.cruce && c.tipo === 'sale') : null;
  const cMaestro = hab?.nombre === 'Maestro' && viajeros.length ? cambios.find(c => !c.cruce && c.tipo === 'entra') : null;
  const cambiadas = [...new Set(morfos.map(([h]) => asientoDe(h)))].filter(x => x !== null);
  const hayTrueque = hab?.nombre === 'Aprendiz' && cambiadas.length === 2 && cambiadas.every(x => (manos.get(x) ?? []).every(h => h.actor)) && manos.get(cambiadas[0]).length === manos.get(cambiadas[1]).length;
  if (hayTrueque) await trueque(hab, cambiadas[0], cambiadas[1], v, morfos);
  let cron = null;
  if (hab && hab.nombre !== 'Estratega' && !cCronista && !cMaestro && !hayTrueque && !cambios.some(c => c.p.crono)) await conjuro(hab, [...cambios.filter(c => claveDe(c.p) !== hab.origen).map(c => sobre(claveDe(c.p)).add(V(0, 1.2, 0))), ...morfos.map(([h]) => h.actor.position.clone().add(V(0, 1.1, 0)))].slice(0, 4));

  // Clarividente que acaba de quedar visible en el Portal de su dueña: su ojo de luz alcanza la mano.
  const clarividentes = cambios.filter(c => !c.cruce && c.pv.top?.visible && c.pv.top.nombre === 'Clarividente' && !c.pv.top.ficha && !claveDe(c.p).startsWith('n:') && !(c.antes ?? '').includes('Clarividente'));
  const duenas = new Set(clarividentes.map(c => +claveDe(c.p).split(':')[0]));
  const morfosLuego = morfos.filter(([h]) => duenas.has(h.actor?.userData.ancla?.idx));

  let salidaHacia = null;
  const tareas = [];
  for (const [c1, c2] of cruces) tareas.push(levitar(hab, c1.p, c2.p, v));
  for (const c of cambios) {
    if (c.cruce) continue;
    if (c.p.crono) tareas.push(finCronomante(c.p, c.pv));
    else if (c === cMaestro) tareas.push(entrar(c.p, viajeros.shift(), c.pv, (a, clave, alLlegar) => vueloMaestro(hab, a, clave, alLlegar)));
    else if (c.tipo === 'entra') tareas.push(entrar(c.p, viajeros.shift(), c.pv));
    else if (c === cCronista) tareas.push(cronista(hab, c.p, c.pv).then(x => { cron = x; }));
    else if (c.tipo === 'sale') tareas.push(salir(c.p, c.pv).then(pie => { salidaHacia ??= pie; }));
    else if (c.tipo === 'transforma') tareas.push(metamorfosis(c.p, c.pv, hab?.nombre === 'Metamorfo' ? v.activa.idx : null));
    else tareas.push(voltear(c.p, c.pv));
  }
  for (const [h, cv] of morfos) if (!morfosLuego.some(([x]) => x === h)) tareas.push(cambiarMano(h, cv));
  await Promise.all(tareas);
  for (const vj of viajeros) disolver(vj.actor).catch(() => {});
  for (const c of clarividentes) await clarividente(c.p, morfosLuego);
  actualizarEscudos(v);
  soltarFoco();

  const invocaciones = an.filter(x => x.tipo === 'invocacion');
  for (const e of invocaciones) await invocar(e, v, nuevosPortales.splice(0, 1));
  for (const p of nuevosPortales) await alzarPortal(p);

  // Cartas que entran en una mano: llegan andando por el lateral de su lado (o
  // desde el pie del Portal del que salen, con el Cronista) hasta su hueco.
  for (const h of llegan) {
    const s = disp.asientos.get(h.idx), hueco = posMano(h.idx, h.lado);
    const desde = salidaHacia ?? (s && hueco ? hueco.pos.clone().addScaledVector(s.t, h.lado * 3.4) : disp.mazo.clone());
    // Cronista: lo que escribió en su libro vuela hasta la mano y aparece allí.
    const delLibro = cron && !cron.usado && hueco;
    if (delLibro) { cron.usado = true; S.lanzar(700); await rayo(cron.libro, hueco.pos.clone().add(V(0, 0.9, 0)), INFO.Cronista.color, { alto: 0.8, dur: 0.6 }); chispas(hueco.pos.clone().add(V(0, 0.8, 0)), { n: 20, color: INFO.Cronista.color, vel: 0.6, vida: 1 }); }
    const n = nuevaMano(h.idx, h.cv, h.lado, delLibro ? hueco.pos.clone() : desde);
    if (!delLibro) humo(desde.clone().add(V(0, 0.5, 0)), { n: 6, radio: 0.3, color: 0x6a62a8, tam: 0.4 });
    const ms = materialesDe(n.actor); opacidad(n.actor, 0, ms); tw(0.6, k => opacidad(n.actor, k, ms)).catch(() => {});
    const lista = manos.get(h.idx); const i = lista.indexOf(h); if (i >= 0) lista[i] = n; else retirar(n.actor);
  }
  if (llegan.length) { S.aparece(); await espera(Math.min(2.2, 0.8 + llegan.length * 0.2)); }
  cron?.fin();
  actualizarGemas(v);
}

/**
 * Clarividente (pasiva): se abre un ojo de luz sobre ella y su haz alcanza
 * las figuras de la mano de su dueña; la que no veía se aclara para ella y
 * un velo de bruma las tapa para los demás.
 */
async function clarividente(p, morfosLuego) {
  const a = p.actor, clave = claveDe(p), idx = +clave.split(':')[0];
  const color = INFO.Clarividente.color, color2 = INFO.Clarividente.color2;
  const mano_ = (manos.get(idx) ?? []).map(h => h.actor).filter(Boolean);
  if (!mano_.length) { for (const [h, cv] of morfosLuego) await cambiarMano(h, cv); return; }
  if (lejano(clave)) enfocar([p.g.position, ...mano_.map(x => x.position)], { ancho: 7 });
  const r = runa(a?.position ?? sobre(clave), color, 0.95);
  S.cargar(330, 1.2);
  let desde = sobre(clave).add(V(0, 1.8, 0));
  if (a?.userData.modelo) desde = await conjurar(a, { pose: 'orbeAlto', lanza: 'orbeAlto', dur: 1.3 });
  S.clarividente();
  const ojo = ojoDeLuz((a?.userData.modelo ? cabeza(a) : sobre(clave).add(V(0, 2.2, 0))).add(V(0, 0.9, 0)), color); await ojo.abrir();
  const centroMano = mano_.reduce((s_, x) => s_.add(x.position), V()).multiplyScalar(1 / mano_.length);
  const haz = hazDeLuz(ojo.s.position, centroMano.clone().add(V(0, 1.1, 0)), color);
  await Promise.all(mano_.map(x => rayo(desde.clone().add(V(0, 0.3, 0)), pecho(x), color, { color2, alto: 1.0 })));
  mano_.forEach(x => destello(pecho(x), color, 2, 0.8).catch(() => {}));
  const giro = cadaFrame((dt, t) => { for (const x of mano_) for (let i = 0; i < 2; i++) { const an = t * 6 + i * Math.PI, y = (t * 0.9 + i * 0.5) % 1 * 2; chispas(x.position.clone().add(V(Math.cos(an) * 0.75, y, Math.sin(an) * 0.75)), { n: 1, color, color2: 0xffffff, vel: 0.05, vida: 0.6, tam: 0.12 }); } });
  try {
    await Promise.all(morfosLuego.map(([h, cv]) => cambiarMano(h, cv)));
    await espera(0.6);
  } finally { giro(); haz.apagar(); ojo.cerrar(); }
  S.velo();
  await tw(2.0, (k, kl) => { for (const x of mano_) { const an = kl * 14 + x.position.x; humo(x.position.clone().add(V(Math.cos(an) * 0.8, 0.2, Math.sin(an) * 0.8)), { n: 1, color: 0x7fd8e8, radio: 0.1, alfa: 0.4, sube: 0.9 }); chispas(x.position.clone().add(V(Math.cos(an) * 0.8, 0.3, Math.sin(an) * 0.8)), { n: 1, color, vel: 0.1, dir: V(0, 0.8, 0), vida: 1 }); } });
  if (a?.userData.modelo) posar(a, null, 4);
  r.userData.apagar();
}

// ------------------------------------------------------------- Cronomante
// Tras elegir el Portal, su pasado se alza como ecos sobre él (bajo un reloj
// de arena cuya arena sube) y la jugadora toca el eco que quiere traer al
// presente. Las cartas ocultas son ecos encapuchados, sin nada dentro.

let ecos = null;   // { clave, lista: [{ val, actor, ms }], reloj, runa, alElegir }

/** Muestra los ecos de un Portal. `opciones`: [{ val, lbl }] del picker (índices de la pila). */
export function mostrarEcos(clave, opciones, alElegir) {
  quitarEcos();
  const p = portales.get(clave); if (!p || !visible) return false;
  const color = INFO.Cronomante.color, color2 = INFO.Cronomante.color2;
  const base = sobre(clave), r = p.g.rotation.y;
  // El de arriba (el presente) ya está en el Portal: los ecos son los de debajo.
  const activas = opciones.filter(o => !o.disabled), pasado = activas.slice(0, -1);
  if (!pasado.length) return false;
  const reloj = relojArena(base.clone().add(V(0, 4.4, 0)), color, color2, 0.5);
  const anillo = runa(base, color, 1.25, -2.2, 6);
  S.cronomante(); S.ecos();
  const n = pasado.length;
  const lista = pasado.map((o, i) => {
    const nombre = Object.keys(INFO).find(k => o.lbl?.includes(k) && !INFO[k].gema) ?? null;
    const oculto = !nombre || /oculta/i.test(o.lbl ?? '');
    const a = crearActor(oculto ? null : nombre, base.clone(), { capa: oculto ? 'opaca' : null, rumbo: r, fijo: true });
    actores.add(a); a.userData.ocupado = true; a.scale.setScalar(0.72);
    const ms = materialesDe(a); opacidad(a, 0, ms);
    // En arco por encima y por detrás del Portal, todos a la vista.
    const ang = n === 1 ? 0 : (i / (n - 1) - 0.5) * Math.min(2.4, 0.75 * (n - 1));
    const hasta = local(clave, Math.sin(ang) * 1.9, -0.55 - (1 - Math.cos(ang)) * 0.5).setY(base.y + 1.55 + Math.cos(ang) * 0.35);
    geoProxyMano ??= new THREE.CylinderGeometry(0.55, 0.55, 2.1, 8);
    a.add(proxy(geoProxyMano, { tipo: 'eco', val: o.val }, 1.05));
    tw(1.2, k => { a.position.lerpVectors(base, hasta, k); opacidad(a, 0.55 * k, ms); chispas(a.position.clone().add(V(0, 0.7, 0)), { n: 1, color, vel: 0.2, vida: 0.7 }); }, sale).catch(() => {});
    a.userData.hasta = hasta;
    return { val: o.val, actor: a, ms, hasta };
  });
  // Tocar la figura que ya está arriba también vale: se queda donde está.
  ecos = { clave, lista, reloj, anillo, alElegir, presente: activas.at(-1)?.val };
  if (lejano(clave)) enfocar([p.g.position], { y: 2.2, alto: 6.4, ancho: 6.5, polar: 1.15 });
  return true;
}

/** Quita los ecos sin elegir (cancelar). */
export function quitarEcos() {
  if (!ecos) return;
  const e = ecos; ecos = null;
  e.reloj.apagar(); e.anillo.userData.apagar();
  for (const x of e.lista) { const de = x.actor.position.clone(), b = sobre(e.clave); tw(0.9, k => { x.actor.position.lerpVectors(de, b, k); opacidad(x.actor, 0.55 * (1 - k), x.ms); }, entra).then(() => retirar(x.actor), () => retirar(x.actor)); }
  soltarFoco();
}

/** Se ha elegido un eco (tocándolo o en la lista): baja al Portal y el de arriba pasa a ser un eco más. */
export function elegirEco(val) {
  if (!ecos) return;
  const e = ecos; ecos = null;
  const p = portales.get(e.clave); if (!p) return;
  const elegido = e.lista.find(x => String(x.val) === String(val));
  const top = p.actor;
  S.lanzar(500);
  const tareas = [];
  if (elegido) {
    p.crono = { actor: elegido.actor, listo: null };
    elegido.actor.traverse(o => pickables.delete(o));
    const de = elegido.actor.position.clone(), b = sobre(e.clave);
    tareas.push(tw(1.3, k => { elegido.actor.position.lerpVectors(de, b, k); elegido.actor.scale.setScalar(mezcla(0.72, 1, k)); opacidad(elegido.actor, mezcla(0.55, 1, k), elegido.ms); }));
    if (top) { top.userData.ocupado = true; const mt = materialesDe(top), h = elegido.hasta; tareas.push(tw(1.3, k => { top.position.lerpVectors(b, h, k); top.scale.setScalar(mezcla(1, 0.72, k)); opacidad(top, mezcla(1, 0.45, k), mt); })); }
  }
  p.crono ??= { actor: top ?? null };   // se ha quedado el de arriba
  p.crono.listo = Promise.all(tareas).then(async () => {
    S.impacto(660); destello(e.reloj.g.position, INFO.Cronomante.color2, 3.5, 0.6).catch(() => {}); e.reloj.parar();
    llegada(e.clave); await espera(0.8); S.seVa(); e.reloj.apagar(); e.anillo.userData.apagar();
    const resto = e.lista.filter(x => x !== elegido).map(x => [x.actor, x.ms]);
    if (top && elegido) resto.push([top, materialesDe(top)]);
    await Promise.all(resto.map(([a, ms]) => { const de = a.position.clone(), b = sobre(e.clave); return tw(1.0, k => { a.position.lerpVectors(de, b, k); opacidad(a, 0.45 * (1 - k), ms); }, entra).then(() => retirar(a)); }));
  }).catch(() => {});
  // Si la Portal no llega a cambiar de aspecto (mismo personaje), se cierra igual.
  const c = p.crono;
  c.listo.then(() => setTimeout(() => { if (p.crono === c && visible) finCronomante(p, { top: p.cv }).catch(() => {}); }, 1500));
}

/** El Portal del Cronomante cambia: se queda la figura del eco elegido (o la correcta si no cuadra). */
async function finCronomante(p, pv) {
  const c = p.crono; p.crono = null;
  await c.listo;
  const a = c.actor, cv = pv.top, nombre = cv?.visible ? (cv.ficha || cv.nombre) : null;
  const cuadra = a && a.parent && (cv?.visible ? a.userData.nombre === nombre && !!INFO[nombre] : !a.userData.modelo);
  if (p.actor && p.actor !== a && p.actor.parent) retirar(p.actor);
  if (cuadra) {
    p.actor = a; a.userData.cv = cv; a.userData.ocupado = false; a.userData.ancla = { tipo: 'portal', clave: claveDe(p) }; a.scale.setScalar(1);
    if (cv?.ficha) marcaMetamorfo(a, true);
  } else { if (a) retirar(a); p.actor = null; await surgir(p, cv); }
  soltarFoco();
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
  if (pick.tipo === 'eco') return { tipo: 'eco', val: pick.val };
  for (const [idx, lista] of manos) {
    const k = lista.findIndex(h => h.actor === pick.actor);
    if (k >= 0) return { tipo: 'mano', jugadora: idx, k, cv: lista[k].cv };
  }
  // Una figura ya subida a un Portal cuenta como ese Portal.
  for (const [clave, p] of portales) if (p.actor && p.actor === pick.actor) return { tipo: 'portal', clave };
  const an = pick.actor?.userData.ancla;
  if (an?.tipo === 'portal' && portales.has(an.clave)) return { tipo: 'portal', clave: an.clave };
  return { tipo: 'nada' };
}

function controles(el) {
  const dedos = new Map();
  let gesto = null, ultimoToque = null, largo = null;
  const fin = () => { clearTimeout(largo); largo = null; };
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    if (sonidoActivo()) iniciarAudio();   // el audio solo puede arrancar tras un toque
    el.setPointerCapture?.(e.pointerId);
    dedos.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (dedos.size === 1) {
      const pick = elegir(e.clientX, e.clientY);
      gesto = { tipo: 'toque', x0: e.clientX, y0: e.clientY, t0: performance.now(), pick, boton: e.button, mayus: e.shiftKey };
      fin();
      if (pick?.tipo === 'portal') largo = setTimeout(() => {
        if (gesto?.tipo !== 'toque') return;
        const p = portales.get(pick.clave); if (!p) return;
        gesto.tipo = 'mover'; gesto.clave = pick.clave; p.arrastrando = true; arrastrandoAlguno = true; p.g.position.y = 0.25;
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
    arrastrandoAlguno = false;
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
      if (t.tipo === 'eco') ecos?.alElegir?.(t.val);
      else if (ecos && t.tipo === 'portal' && t.clave === ecos.clave && ecos.presente !== undefined) ecos.alElegir?.(ecos.presente);
      else if (t.tipo === 'nada' && doble) reencuadrar();
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
/** Mientras se elige el ambiente, la cámara se levanta para enseñar el cielo y el horizonte. */
let panoramica = null;
export function vistaPanoramica(si) {
  const u = mundo.usuario;
  if (si === !!panoramica) return;
  const de = { polar: u.polar, zoom: u.zoom };
  let a;
  if (si) { panoramica = de; a = { polar: 0.42, zoom: Math.max(u.zoom, 1.12) }; }
  else { a = panoramica; panoramica = null; }
  tw(0.9, k => { u.polar = de.polar + (a.polar - de.polar) * k; u.zoom = de.zoom + (a.zoom - de.zoom) * k; }).catch(() => {});
}

export function reencuadrar() { pan.set(0, 0, 0); Object.assign(mundo.usuario, { azimut: 0, polar: 0, zoom: 1 }); }

/** Devuelve los Portales a su sitio de siempre. */
export function recolocarPortales() {
  desplaz = {}; try { localStorage.removeItem(CLAVE_POSICIONES); } catch { /* nada */ }
}

/** Punto de la pantalla donde se ve un Portal ({ clave }) o una figura de mano ({ jugadora, k }). Para pruebas automáticas. */
export function puntoEnPantalla(o) {
  let p = null;
  if (o.eco !== undefined) { const e = ecos?.lista.find(x => x.val === o.eco); if (e) p = e.actor.position.clone().add(V(0, 1.0, 0)); }
  else if (o.clave) { const q = portales.get(o.clave); if (q) p = q.g.position.clone().add(V(0, 1.0, 0)); }
  else { const h = manos.get(o.jugadora)?.[o.k]; if (h?.actor) p = h.actor.position.clone().add(V(0, 1.0, 0)); }
  if (!p) return null;
  p.project(mundo.camara);
  const r = lienzo.getBoundingClientRect();
  return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height };
}
/** Qué hay bajo un punto de la pantalla (para pruebas automáticas). */
export function queHayEn(x, y) { const t = traducir(elegir(x, y)); return { tipo: t.tipo, clave: t.clave, jugadora: t.jugadora, k: t.k }; }
