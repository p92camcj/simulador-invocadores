// Ambiente del Escenario (1.37.0): hora del día, cielo y suelo, o "sin
// decorado" con una paleta de color. Solo presentación: aquí no hay ninguna
// regla del juego.
//
// - Hora: amanecer (luz amarilla), pleno día, atardecer (naranja rojiza),
//   noche estrellada con luna, u "hora real", que sigue el reloj del
//   dispositivo y pasa poco a poco de una a otra.
// - Cielo: despejado, algunas nubes (teñidas según la hora), cubierto,
//   lluvia leve o tormenta con relámpagos y truenos.
// - Suelo: empedrado antiguo, hierba baja, tablero de madera o arena con el
//   mar de fondo. Todas las texturas se dibujan aquí con canvas: no hay
//   imágenes de terceros.
//
// Lo elegido se guarda en el dispositivo (localStorage 'inv3d.ambiente').
import { THREE, mundo, siempre } from './mundo.js';
import { ambienteSonoro, trueno } from './sonido.js';

const CLAVE = 'inv3d.ambiente';

/** Opciones del panel "Ambiente" (mesa3d.js las pinta): [valor, icono, texto]. */
export const OPCIONES_AMBIENTE = {
  hora: [['real', '🕰️', 'Hora real'], ['amanecer', '🌅', 'Amanecer'], ['dia', '☀️', 'Pleno día'], ['atardecer', '🌇', 'Atardecer'], ['noche', '🌙', 'Noche']],
  cielo: [['despejado', '🌤️', 'Despejado'], ['nubes', '⛅', 'Algunas nubes'], ['cubierto', '☁️', 'Cubierto'], ['lluvia', '🌦️', 'Lluvia'], ['tormenta', '⛈️', 'Tormenta']],
  suelo: [['empedrado', '🧱', 'Empedrado'], ['hierba', '🌿', 'Hierba'], ['madera', '🪵', 'Madera'], ['arena', '🏖️', 'Arena y mar'], ['ninguno', '✨', 'Sin decorado']],
  paleta: [['noche', '#1b2550', 'Azul noche'], ['violeta', '#3a2366', 'Violeta'], ['bosque', '#164a30', 'Bosque'], ['burdeos', '#5a1a28', 'Burdeos'], ['pizarra', '#3b4148', 'Pizarra'], ['pergamino', '#e6d6b4', 'Pergamino'], ['celeste', '#a9d3ef', 'Celeste']],
};
const DEFECTO = { hora: 'real', cielo: 'nubes', suelo: 'empedrado', paleta: 'noche' };

// "Sin decorado": fondo liso, disco con degradado y, en las oscuras, estrellas.
const PALETAS = {
  noche: { fondo: '#0a0f24', centro: '#2a3566', medio: '#171f44', anillos: 'rgba(170,200,255,.07)', estrellas: true },
  violeta: { fondo: '#130822', centro: '#4f3384', medio: '#2a1a4c', anillos: 'rgba(220,190,255,.08)', estrellas: true },
  bosque: { fondo: '#04140c', centro: '#22603e', medio: '#113524', anillos: 'rgba(180,255,210,.07)', estrellas: true },
  burdeos: { fondo: '#18060b', centro: '#712739', medio: '#3c121d', anillos: 'rgba(255,190,200,.07)', estrellas: true },
  pizarra: { fondo: '#16191d', centro: '#525a64', medio: '#2c3238', anillos: 'rgba(220,230,240,.07)', estrellas: false },
  pergamino: { fondo: '#d8c7a4', centro: '#fff7e6', medio: '#e2d1ae', anillos: 'rgba(110,80,40,.10)', estrellas: false, claro: true },
  celeste: { fondo: '#9cc8e6', centro: '#f4fbff', medio: '#b9dcf2', anillos: 'rgba(40,90,140,.10)', estrellas: false, claro: true },
};

// Fotogramas clave de la hora. `elev`/`az`: dónde está el astro (el sol o la luna).
const HORAS = {
  noche: { arriba: '#03060f', horiz: '#17204a', astro: '#dfe8ff', luz: '#9db4ff', luzInt: 0.75, elev: 0.75, az: 0.5, hemiC: '#7385c8', hemiS: '#141226', hemiInt: 1.05, estrellas: 1, luna: 1, nubes: '#59628a', nubesSombra: '#1d2240' },
  amanecer: { arriba: '#5a82c8', horiz: '#ffd774', astro: '#fff1a8', luz: '#ffd45c', luzInt: 1.5, elev: 0.1, az: -0.55, hemiC: '#f6e8c4', hemiS: '#4b3c3e', hemiInt: 1.35, estrellas: 0, luna: 0, nubes: '#fff0b8', nubesSombra: '#c98a8e' },
  dia: { arriba: '#2c6fd6', horiz: '#c3e3ff', astro: '#fffbe8', luz: '#fff4e0', luzInt: 1.8, elev: 1.0, az: 0.15, hemiC: '#dce9ff', hemiS: '#5d5a4a', hemiInt: 1.55, estrellas: 0, luna: 0, nubes: '#ffffff', nubesSombra: '#b9c6d8' },
  atardecer: { arriba: '#25296a', horiz: '#ff6a36', astro: '#ffb070', luz: '#ff6a32', luzInt: 1.35, elev: 0.09, az: 0.55, hemiC: '#e9b9b0', hemiS: '#3c2038', hemiInt: 1.25, estrellas: 0.15, luna: 0, nubes: '#ffa45e', nubesSombra: '#9a3a6a' },
};
// Hora real: a qué hora corresponde cada fotograma (se mezcla entre ellos).
const RELOJ = [[0, 'noche'], [5.6, 'noche'], [7.4, 'amanecer'], [9.6, 'dia'], [17.6, 'dia'], [19.8, 'atardecer'], [21.6, 'noche'], [24, 'noche']];

const CIELOS = {
  despejado: { nubes: 0, gris: 0, oscuro: 0, niebla: 1, lluvia: 0 },
  nubes: { nubes: 9, gris: 0, oscuro: 0, niebla: 1, lluvia: 0 },
  cubierto: { nubes: 24, gris: 0.62, oscuro: 0.22, niebla: 1.25, lluvia: 0, tapa: 1 },
  lluvia: { nubes: 26, gris: 0.72, oscuro: 0.38, niebla: 1.4, lluvia: 1, tapa: 1 },
  tormenta: { nubes: 30, gris: 0.78, oscuro: 0.58, niebla: 1.5, lluvia: 1.7, tapa: 1, rayos: true },
};

let cfg = leer();
let raiz = null;          // grupo con todo el decorado del ambiente
let cielo = null, estrellas = null, nubes = [], lluvia = null, rayo = null, mar = null, espuma = null, sombras = null;
let p = null;             // parámetros de luz/color actuales (mezclados)
let destello = 0, proximoRayo = 6, relojReal = 0, sonidoEncendido = false;
let antes = performance.now();
const reducido = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const alta = () => mundo.calidad === 'alta';

function leer() {
  try { return { ...DEFECTO, ...(JSON.parse(localStorage.getItem(CLAVE) ?? '{}') || {}) }; } catch { return { ...DEFECTO }; }
}
export const ambienteActual = () => ({ ...cfg });

/** Cambia una o varias opciones ({ hora, cielo, suelo, paleta }) y lo aplica al momento. */
export function fijarAmbiente(cambio) {
  cfg = { ...cfg, ...cambio };
  try { localStorage.setItem(CLAVE, JSON.stringify(cfg)); } catch { /* nada */ }
  if (raiz) montar();
}

/** Se llama una vez, con el mundo ya creado (tablero.js). */
export function crearAmbiente() {
  if (raiz) return;
  mundo.camara.far = 600; mundo.camara.updateProjectionMatrix();
  raiz = new THREE.Group(); mundo.escena.add(raiz);
  montar();
  bucle();
}

/** Sonido ambiente solo mientras se ve el Escenario. */
export function sonidoAmbiente(si) { sonidoEncendido = si; ponerCapas(si ? capasSonido() : []); }
let capasPuestas = '';
function ponerCapas(l) { capasPuestas = l.join(); ambienteSonoro(l); }

// ------------------------------------------------------------------ montaje

function vaciar() {
  for (const o of [...raiz.children]) {
    raiz.remove(o);
    o.traverse(h => { h.geometry?.dispose(); const m = h.material; (Array.isArray(m) ? m : m ? [m] : []).forEach(x => { x.map?.dispose(); x.dispose(); }); });
  }
  cielo = estrellas = lluvia = rayo = mar = espuma = sombras = null; nubes = [];
}

function montar() {
  vaciar();
  const sinDecorado = cfg.suelo === 'ninguno';
  mundo.decorado.visible = false;
  if (sinDecorado) montarSinDecorado();
  else {
    p = mezclaHora();
    montarCielo();
    montarSuelo(cfg.suelo);
    montarNubes();
    if (cfg.cielo === 'nubes') montarSombras();
    if (CIELOS[cfg.cielo].lluvia) montarLluvia();
    aplicarLuz();
  }
  if (sonidoEncendido) ponerCapas(capasSonido());
}

function capasSonido() {
  if (cfg.suelo === 'ninguno') return [];
  const c = CIELOS[cfg.cielo], l = [];
  if (cfg.cielo === 'tormenta') l.push('tormenta'); else if (c.lluvia) l.push('lluvia');
  else if (c.tapa) l.push('viento');
  if (cfg.suelo === 'arena') l.push('mar');
  if (!c.lluvia) { const h = horaEfectiva(); if (h === 'noche') l.push('grillos'); else if (h === 'amanecer' || h === 'dia') l.push('pajaros'); }
  return l;
}

/** La hora que manda ahora (con "hora real", la del reloj del dispositivo). */
function horaEfectiva() {
  if (cfg.hora !== 'real') return cfg.hora;
  const h = horaDelReloj(); let mejor = 'noche', d = 99;
  for (const [t, n] of RELOJ) { const dd = Math.abs(t - h); if (dd < d) { d = dd; mejor = n; } }
  return mejor;
}
const horaDelReloj = () => { const a = new Date(); return a.getHours() + a.getMinutes() / 60; };

/** Parámetros de luz y color de la hora elegida (o mezcla de dos con la hora real). */
function mezclaHora() {
  if (cfg.hora !== 'real') return clonar(HORAS[cfg.hora] ?? HORAS.noche);
  const h = horaDelReloj();
  let i = 0; while (i < RELOJ.length - 2 && RELOJ[i + 1][0] <= h) i++;
  const [t0, a] = RELOJ[i], [t1, b] = RELOJ[i + 1];
  const k = t1 > t0 ? Math.min(1, Math.max(0, (h - t0) / (t1 - t0))) : 0;
  return mezclar(HORAS[a], HORAS[b], k * k * (3 - 2 * k));
}
function clonar(o) { const r = {}; for (const [k, v] of Object.entries(o)) r[k] = typeof v === 'string' ? new THREE.Color(v) : v; return r; }
function mezclar(a, b, k) {
  const r = {};
  for (const key of Object.keys(a)) r[key] = typeof a[key] === 'string' ? new THREE.Color(a[key]).lerp(new THREE.Color(b[key]), k) : a[key] + (b[key] - a[key]) * k;
  return r;
}
/** El tiempo apaga los colores: hacia gris y más oscuro. */
function tiempo(c) {
  const t = CIELOS[cfg.cielo]; const r = c.clone();
  if (t.gris) { const l = r.r * 0.3 + r.g * 0.59 + r.b * 0.11; r.lerp(new THREE.Color(l, l, l * 1.06), t.gris); }
  if (t.oscuro) r.multiplyScalar(1 - t.oscuro);
  return r;
}

function aplicarLuz() {
  const t = CIELOS[cfg.cielo], { hemi, sol } = mundo.luces;
  const horiz = tiempo(p.horiz);
  mundo.escena.background = horiz.clone();
  mundo.escena.fog.color.copy(horiz);
  mundo.escena.fog.density = 0.0075 * t.niebla * t.niebla;
  hemi.color.copy(tiempo(p.hemiC)); hemi.groundColor.copy(p.hemiS);
  hemi.intensity = p.hemiInt * (1 - t.oscuro * 0.35);
  sol.color.copy(p.luz).lerp(new THREE.Color(0xc8d0dc), t.gris * 0.6);
  sol.intensity = p.luzInt * (t.tapa ? 0.4 - t.oscuro * 0.15 : 1);
  const d = direccionAstro();
  sol.position.copy(d).multiplyScalar(20);
  if (cielo) {
    const u = cielo.material.uniforms;
    u.arriba.value.copy(tiempo(p.arriba)); u.horiz.value.copy(horiz); u.abajo.value.copy(horiz).multiplyScalar(0.8);
    u.astroCol.value.copy(p.astro); u.astroDir.value.copy(d);
    u.luna.value = p.luna; u.tapa.value = t.tapa ? 1 : 0;
  }
  if (estrellas) estrellas.material.opacity = p.estrellas * (t.tapa ? 0.05 : 0.9);
  const cn = tiempo(p.nubes), cs = tiempo(p.nubesSombra);
  nubes.forEach(n => n.material.color.copy(n.userData.baja ? cs.clone().lerp(cn, 0.35) : cn.clone().lerp(cs, n.userData.sombra)));
  if (mar) {
    mar.material.color.copy(tiempo(new THREE.Color('#1d5f86').lerp(p.horiz, 0.18)).multiplyScalar(cfg.hora === 'noche' ? 0.5 : 1));
    mar.material.emissive.copy(p.luz).multiplyScalar(0.03);
  }
}

function direccionAstro() {
  const e = p.elev, a = p.az;
  // El astro queda al fondo de la mesa (lado -z), un poco a un lado.
  return new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).normalize();
}

// ------------------------------------------------------------------- cielo

function montarCielo() {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: {
      arriba: { value: new THREE.Color() }, horiz: { value: new THREE.Color() }, abajo: { value: new THREE.Color() },
      astroCol: { value: new THREE.Color() }, astroDir: { value: new THREE.Vector3(0, 1, 0) },
      luna: { value: 0 }, tapa: { value: 0 }, destello: { value: 0 },
    },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 arriba, horiz, abajo, astroCol, astroDir; uniform float luna, tapa, destello; varying vec3 vDir;
      void main(){
        vec3 d = normalize(vDir); float h = d.y;
        vec3 c = h > 0.0 ? mix(horiz, arriba, pow(clamp(h * 1.6, 0.0, 1.0), 0.55)) : mix(horiz, abajo, clamp(-h * 4.0, 0.0, 1.0));
        float s = max(dot(d, normalize(astroDir)), 0.0);
        float disco = smoothstep(mix(0.9993, 0.9996, luna), mix(0.9996, 0.99985, luna), s);
        float halo = pow(s, mix(9.0, 40.0, luna)) * mix(0.55, 0.25, luna) + pow(s, 260.0) * 0.5;
        c += astroCol * (disco * (1.0 - tapa * 0.92) + halo * (1.0 - tapa * 0.75));
        c = mix(c, vec3(0.92, 0.95, 1.0), destello * 0.55);
        gl_FragColor = vec4(c, 1.0);
        #include <colorspace_fragment>
      }`,
  });
  cielo = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 18), mat);
  cielo.renderOrder = -10; cielo.frustumCulled = false;
  raiz.add(cielo);

  const n = alta() ? 700 : 350, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.06 + Math.pow(Math.random(), 0.8) * 1.45, r = 380;
    pos[i * 3] = Math.cos(a) * Math.cos(e) * r; pos[i * 3 + 1] = Math.sin(e) * r; pos[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  estrellas = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xe4ecff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, depthWrite: false }));
  estrellas.renderOrder = -9; estrellas.frustumCulled = false;
  raiz.add(estrellas);
}

let texNube = null;
function texturaNube() {
  if (texNube) return texNube;
  const c = document.createElement('canvas'); c.width = 256; c.height = 128;
  const x = c.getContext('2d');
  // Varias bolas de algodón: más claras arriba, con la base algo más plana.
  for (let i = 0; i < 26; i++) {
    const px = 40 + Math.random() * 176, py = 54 + Math.random() * 34 - Math.abs(px - 128) * 0.12, r = 20 + Math.random() * 26;
    const gr = x.createRadialGradient(px, py - r * 0.35, r * 0.1, px, py, r);
    gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(0.6, 'rgba(235,238,245,.55)'); gr.addColorStop(1, 'rgba(220,225,235,0)');
    x.fillStyle = gr; x.beginPath(); x.arc(px, py, r, 0, 7); x.fill();
  }
  // Base en sombra.
  x.globalCompositeOperation = 'source-atop';
  const gs = x.createLinearGradient(0, 40, 0, 120); gs.addColorStop(0, 'rgba(0,0,0,0)'); gs.addColorStop(1, 'rgba(60,70,90,.45)');
  x.fillStyle = gs; x.fillRect(0, 0, 256, 128);
  texNube = new THREE.CanvasTexture(c); texNube.colorSpace = THREE.SRGBColorSpace;
  return texNube;
}

function montarNubes() {
  const t = CIELOS[cfg.cielo]; if (!t.nubes) return;
  const tex = texturaNube();
  const n = alta() ? t.nubes : Math.ceil(t.nubes * 0.6);
  for (let i = 0; i < n; i++) {
    const baja = !!t.tapa && i % 2 === 1;
    const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: t.tapa ? 0.95 : 0.9 });
    const s = new THREE.Sprite(m);
    // Más nubes al fondo (-z), que es hacia donde mira la cámara.
    const ang = -Math.PI / 2 + (Math.random() - 0.5) * (i % 3 ? 2.2 : 6.2), r = 110 + Math.random() * 150;
    const alto = (t.tapa ? 22 : 16) + Math.random() * (t.tapa ? 30 : 34);
    const ancho = (t.tapa ? 120 : 60) + Math.random() * 80;
    s.scale.set(ancho, ancho * 0.45, 1);
    s.userData = { ang, r, alto, vel: 0.004 + Math.random() * 0.006, sombra: Math.random() * 0.4, baja, fondo: i % 3 !== 0 };
    s.renderOrder = -8;
    colocarNube(s);
    nubes.push(s); raiz.add(s);
  }
  // Cubierto: un techo de nubes que tapa todo el cielo.
  if (t.tapa) {
    for (let i = 0; i < 10; i++) {
      const m = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false, opacity: 0.9 });
      const s = new THREE.Sprite(m); const ancho = 260 + Math.random() * 120;
      s.scale.set(ancho, ancho * 0.5, 1);
      s.userData = { ang: (i / 10) * Math.PI * 2, r: 60 + Math.random() * 90, alto: 95 + Math.random() * 40, vel: 0.003, sombra: 0.5, baja: true };
      s.renderOrder = -8; colocarNube(s); nubes.push(s); raiz.add(s);
    }
  }
}
// Sombras de las nubes sobre la mesa: así se nota el cielo aunque la cámara mire hacia abajo.
function montarSombras() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  for (let i = 0; i < 9; i++) {
    const px = azar(0, 256), py = azar(0, 256), r = azar(30, 60);
    enMosaico(x, 256, () => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, 'rgba(0,0,0,.9)'); g.addColorStop(0.6, 'rgba(0,0,0,.45)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); });
  }
  const tx = new THREE.CanvasTexture(c); tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(2, 2);
  sombras = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshBasicMaterial({ map: tx, color: 0x000000, transparent: true, opacity: cfg.hora === 'noche' ? 0.12 : 0.3, depthWrite: false }));
  sombras.rotation.x = -Math.PI / 2; sombras.position.y = 0.04; sombras.renderOrder = 1;
  raiz.add(sombras);
}

function colocarNube(s) { const u = s.userData; s.position.set(Math.cos(u.ang) * u.r, u.alto, Math.sin(u.ang) * u.r); }

// ----------------------------------------------------------------- lluvia

function montarLluvia() {
  const fuerza = CIELOS[cfg.cielo].lluvia;
  const n = Math.round((alta() ? 900 : 450) * fuerza), pos = new Float32Array(n * 6), datos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { datos[i * 3] = (Math.random() * 2 - 1) * 22; datos[i * 3 + 1] = Math.random() * 18; datos[i * 3 + 2] = (Math.random() * 2 - 1) * 22; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  lluvia = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xc4d2e6, transparent: true, opacity: cfg.cielo === 'tormenta' ? 0.5 : 0.38, depthWrite: false }));
  lluvia.frustumCulled = false;
  lluvia.userData = { n, datos, vel: 16 + fuerza * 5, sesgo: fuerza > 1 ? 0.18 : 0.06 };
  raiz.add(lluvia);
  if (CIELOS[cfg.cielo].rayos) {
    rayo = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xeef3ff, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    rayo.frustumCulled = false; rayo.renderOrder = -7;
    raiz.add(rayo);
    proximoRayo = 3 + Math.random() * 5;
  }
}

function moverLluvia(dt) {
  const { n, datos, vel, sesgo } = lluvia.userData, pos = lluvia.geometry.attributes.position.array;
  const largo = 0.5;
  for (let i = 0; i < n; i++) {
    let y = datos[i * 3 + 1] - vel * dt;
    if (y < 0) { y += 18; datos[i * 3] = (Math.random() * 2 - 1) * 22; datos[i * 3 + 2] = (Math.random() * 2 - 1) * 22; }
    datos[i * 3 + 1] = y;
    const x = datos[i * 3] + y * sesgo, z = datos[i * 3 + 2], o = i * 6;
    pos[o] = x; pos[o + 1] = y; pos[o + 2] = z;
    pos[o + 3] = x - sesgo * largo; pos[o + 4] = y + largo; pos[o + 5] = z;
  }
  lluvia.geometry.attributes.position.needsUpdate = true;
}

function lanzarRayo() {
  // Un rayo lejano, al fondo; el destello es suave (sin parpadeos rápidos).
  const ang = -Math.PI / 2 + (Math.random() - 0.5) * 2.2, r = 90 + Math.random() * 90;
  let x = Math.cos(ang) * r, z = Math.sin(ang) * r, y = 110;
  const pts = [new THREE.Vector3(x, y, z)];
  while (y > 0) { y -= 6 + Math.random() * 10; x += (Math.random() - 0.5) * 12; z += (Math.random() - 0.5) * 6; pts.push(new THREE.Vector3(x, Math.max(0, y), z)); }
  rayo.geometry.dispose(); rayo.geometry = new THREE.BufferGeometry().setFromPoints(pts);
  rayo.userData.vida = 0.35;
  destello = reducido() ? 0.25 : 1;
  const cerca = 1 - (r - 90) / 90;
  setTimeout(() => trueno(cerca), (0.5 + (1 - cerca) * 2) * 1000);
  proximoRayo = 6 + Math.random() * 10;
}

// ------------------------------------------------------------------ suelos

function lienzo(t = 512) { const c = document.createElement('canvas'); c.width = c.height = t; return [c, c.getContext('2d')]; }
const azar = (a, b) => a + Math.random() * (b - a);
function textura(c, repetir) {
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repetir, repetir);
  t.anisotropy = Math.min(8, mundo.renderer.capabilities.getMaxAnisotropy?.() ?? 1);
  return t;
}
/** Dibuja algo en las nueve copias vecinas para que la textura empalme sin costuras. */
function enMosaico(x, t, fn) { for (const dx of [-t, 0, t]) for (const dy of [-t, 0, t]) { x.save(); x.translate(dx, dy); fn(); x.restore(); } }
function grano(x, t, n, colores, tam = 1.5) {
  for (let i = 0; i < n; i++) { x.fillStyle = colores[(Math.random() * colores.length) | 0]; x.fillRect(Math.random() * t, Math.random() * t, tam, tam); }
}

function texturaEmpedrado() {
  const t = 512, [c, x] = lienzo(t);
  x.fillStyle = '#3a342c'; x.fillRect(0, 0, t, t);
  grano(x, t, 4000, ['#2c2822', '#463e33', '#3d4a2c']);
  // Adoquines irregulares por hileras, cada uno con su tono y un bisel de luz.
  const filas = 7, alto = t / filas;
  for (let f = 0; f < filas; f++) {
    let px = azar(0, 40);
    while (px < t + 10) {
      const w = azar(46, 92), y0 = f * alto, cx = px, cy = y0;
      const tono = azar(0.82, 1.15), base = [118, 110, 98].map(v => Math.round(v * tono + azar(-8, 8)));
      enMosaico(x, t, () => {
        const r = 11, x0 = cx + 3 + azar(-1, 1), yy = cy + 3 + azar(-1, 1), ww = w - 6, hh = alto - 6;
        x.beginPath(); x.roundRect ? x.roundRect(x0, yy, ww, hh, r) : x.rect(x0, yy, ww, hh);
        const g = x.createLinearGradient(x0, yy, x0 + ww, yy + hh);
        g.addColorStop(0, `rgb(${base.map(v => v + 26).join(',')})`); g.addColorStop(0.5, `rgb(${base.join(',')})`); g.addColorStop(1, `rgb(${base.map(v => v - 30).join(',')})`);
        x.fillStyle = g; x.fill();
        x.strokeStyle = 'rgba(20,16,12,.55)'; x.lineWidth = 2; x.stroke();
      });
      px += w;
    }
  }
  // Desgaste: motas, grietas finas y algo de musgo en las juntas.
  grano(x, t, 6000, ['rgba(255,255,255,.07)', 'rgba(0,0,0,.12)', 'rgba(80,110,50,.18)'], 2);
  x.strokeStyle = 'rgba(25,20,15,.35)'; x.lineWidth = 1;
  for (let i = 0; i < 40; i++) { let a = azar(0, t), b = azar(0, t); x.beginPath(); x.moveTo(a, b); for (let k = 0; k < 4; k++) { a += azar(-10, 10); b += azar(-10, 10); x.lineTo(a, b); } x.stroke(); }
  return textura(c, 150);
}

function texturaHierba() {
  const t = 512, [c, x] = lienzo(t);
  x.fillStyle = '#466f2c'; x.fillRect(0, 0, t, t);
  // Manchas de tono, luego briznas cortas en todas direcciones.
  for (let i = 0; i < 60; i++) { const px = azar(0, t), py = azar(0, t), r = azar(30, 80); enMosaico(x, t, () => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, Math.random() < 0.5 ? 'rgba(110,150,60,.35)' : 'rgba(40,70,25,.35)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }); }
  const verdes = ['#5d8c36', '#6f9e3f', '#3f6a25', '#7fae4a', '#4f7d2e', '#8cb85a'];
  x.lineWidth = 1.4; x.lineCap = 'round';
  for (let i = 0; i < 9000; i++) {
    const px = azar(0, t), py = azar(0, t), l = azar(4, 9), a = -Math.PI / 2 + azar(-0.7, 0.7);
    x.strokeStyle = verdes[(Math.random() * verdes.length) | 0];
    x.beginPath(); x.moveTo(px, py); x.lineTo(px + Math.cos(a) * l, py + Math.sin(a) * l); x.stroke();
  }
  // Alguna florecilla suelta.
  for (let i = 0; i < 26; i++) { const px = azar(0, t), py = azar(0, t); x.fillStyle = ['#fff7d6', '#ffe066', '#d9c2ff'][i % 3]; x.beginPath(); x.arc(px, py, 1.8, 0, 7); x.fill(); }
  return textura(c, 110);
}

function texturaMadera() {
  const t = 512, [c, x] = lienzo(t);
  const tablas = 6, h = t / tablas;
  for (let f = 0; f < tablas; f++) {
    const tono = azar(0.85, 1.12), base = [140, 92, 52].map(v => Math.round(v * tono));
    let px = azar(-200, 0);
    while (px < t) {
      const w = azar(240, 420), y0 = f * h;
      const x0 = px;
      enMosaico(x, t, () => {
        x.fillStyle = `rgb(${base.join(',')})`; x.fillRect(x0, y0, w, h);
        // Vetas onduladas.
        for (let v = 0; v < 14; v++) {
          const yv = y0 + azar(3, h - 3), am = azar(1, 4), fr = azar(0.01, 0.03), fase = azar(0, 6);
          x.strokeStyle = `rgba(${Math.random() < 0.5 ? '60,35,15' : '190,140,90'},${azar(0.15, 0.35)})`; x.lineWidth = azar(0.6, 1.8);
          x.beginPath(); for (let k = 0; k <= w; k += 8) { const yy = yv + Math.sin(k * fr + fase) * am; k ? x.lineTo(x0 + k, yy) : x.moveTo(x0, yy); } x.stroke();
        }
        // Algún nudo.
        if (Math.random() < 0.5) { const nx = x0 + azar(30, w - 30), ny = y0 + h / 2 + azar(-10, 10); x.fillStyle = 'rgba(70,40,18,.55)'; x.beginPath(); x.ellipse(nx, ny, azar(5, 9), azar(3, 5), 0, 0, 7); x.fill(); }
        // Juntas.
        x.fillStyle = 'rgba(30,18,8,.8)'; x.fillRect(x0, y0, 2, h); x.fillRect(x0, y0 + h - 2, w, 2);
        x.fillStyle = 'rgba(255,220,170,.12)'; x.fillRect(x0, y0, w, 1.5);
      });
      px += w;
    }
  }
  return textura(c, 4);
}

function texturaArena() {
  const t = 512, [c, x] = lienzo(t);
  x.fillStyle = '#d8bf8c'; x.fillRect(0, 0, t, t);
  for (let i = 0; i < 50; i++) { const px = azar(0, t), py = azar(0, t), r = azar(30, 90); enMosaico(x, t, () => { const g = x.createRadialGradient(px, py, 0, px, py, r); g.addColorStop(0, Math.random() < 0.5 ? 'rgba(240,220,170,.35)' : 'rgba(170,140,95,.3)'); g.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = g; x.fillRect(px - r, py - r, r * 2, r * 2); }); }
  // Ondas que deja el viento.
  x.lineWidth = 2;
  for (let i = 0; i < 26; i++) {
    const y0 = (i / 26) * t, fase = azar(0, 6);
    x.strokeStyle = 'rgba(150,120,80,.22)';
    enMosaico(x, t, () => { x.beginPath(); for (let k = 0; k <= t; k += 8) { const yy = y0 + Math.sin(k * 0.025 + fase) * 5; k ? x.lineTo(k, yy) : x.moveTo(0, yy); } x.stroke(); });
  }
  grano(x, t, 14000, ['#c2a674', '#efdcb2', '#b39463', '#fff1cf'], 1.4);
  return textura(c, 110);
}

function montarSuelo(tipo) {
  const mat = new THREE.MeshStandardMaterial({ roughness: 0.95, metalness: 0 });
  const mojado = !!CIELOS[cfg.cielo].lluvia;
  if (tipo === 'madera') {
    // Un gran tablero redondo de madera sobre tierra oscura.
    const tapa = new THREE.MeshStandardMaterial({ map: texturaMadera(), roughness: mojado ? 0.45 : 0.7 });
    const canto = new THREE.MeshStandardMaterial({ color: 0x5a3519, roughness: 0.8 });
    const mesa = new THREE.Mesh(new THREE.CylinderGeometry(17, 17.3, 0.5, 72), [canto, tapa, canto]);
    mesa.position.y = -0.25; raiz.add(mesa);
    mat.color.set(0x2a2219);
    const s = new THREE.Mesh(new THREE.CircleGeometry(320, 48), mat); s.rotation.x = -Math.PI / 2; s.position.y = -0.5; raiz.add(s);
  } else {
    mat.map = { empedrado: texturaEmpedrado, hierba: texturaHierba, arena: texturaArena }[tipo]();
    if (mojado) { mat.roughness = 0.55; mat.color.set(0xb8b8b8); }
    const s = new THREE.Mesh(new THREE.CircleGeometry(320, 64), mat);
    s.rotation.x = -Math.PI / 2; s.position.y = -0.01;
    raiz.add(s);
  }
  if (tipo === 'arena') montarMar();
}

const ORILLA = -19;   // el mar empieza detrás de la mesa
function montarMar() {
  const g = new THREE.PlaneGeometry(700, 340, alta() ? 120 : 70, alta() ? 50 : 30);
  g.rotateX(-Math.PI / 2); g.translate(0, 0.05, ORILLA - 170);
  g.userData.base = Float32Array.from(g.attributes.position.array);
  mar = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1d5f86, roughness: 0.22, metalness: 0.15, transparent: true, opacity: 0.94 }));
  raiz.add(mar);
  // Arena mojada y espuma en la orilla, que va y viene.
  const c = document.createElement('canvas'); c.width = 256; c.height = 32;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 32); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.55, 'rgba(255,255,255,.85)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = gr; x.fillRect(0, 0, 256, 32);
  for (let i = 0; i < 300; i++) { x.fillStyle = 'rgba(255,255,255,.6)'; x.beginPath(); x.arc(Math.random() * 256, 8 + Math.random() * 18, Math.random() * 2, 0, 7); x.fill(); }
  const tx = new THREE.CanvasTexture(c); tx.wrapS = THREE.RepeatWrapping; tx.repeat.set(30, 1); tx.colorSpace = THREE.SRGBColorSpace;
  espuma = new THREE.Mesh(new THREE.PlaneGeometry(700, 3.2), new THREE.MeshBasicMaterial({ map: tx, transparent: true, depthWrite: false, opacity: 0.8 }));
  espuma.rotation.x = -Math.PI / 2; espuma.position.set(0, 0.09, ORILLA);
  raiz.add(espuma);
  const mo = new THREE.Mesh(new THREE.PlaneGeometry(700, 5), new THREE.MeshStandardMaterial({ color: 0x8a7350, transparent: true, opacity: 0.55, roughness: 0.4, depthWrite: false }));
  mo.rotation.x = -Math.PI / 2; mo.position.set(0, 0.02, ORILLA + 1.5);
  raiz.add(mo);
}

function moverMar(t) {
  const g = mar.geometry, a = g.attributes.position.array, b = g.userData.base;
  for (let i = 0; i < a.length; i += 3) {
    const x = b[i], z = b[i + 2], lejos = Math.min(1, (ORILLA - z) / 12);
    a[i + 1] = b[i + 1] + lejos * (Math.sin(x * 0.11 + t * 1.1) * 0.22 + Math.sin(z * 0.17 - t * 1.6) * 0.28 + Math.sin((x + z) * 0.33 + t * 2.3) * 0.08);
  }
  g.attributes.position.needsUpdate = true; g.computeVertexNormals();
  const ola = Math.sin(t * 0.85);
  espuma.position.z = ORILLA + 1 + ola * 1.2; espuma.material.opacity = 0.45 + 0.35 * (0.5 + 0.5 * ola);
  espuma.material.map.offset.x = t * 0.004;
}

// ------------------------------------------------------------ sin decorado

function montarSinDecorado() {
  const pal = PALETAS[cfg.paleta] ?? PALETAS.noche;
  const fondo = new THREE.Color(pal.fondo);
  mundo.escena.background = fondo; mundo.escena.fog.color.copy(fondo); mundo.escena.fog.density = 0.017;
  const { hemi, sol } = mundo.luces;
  hemi.color.set(pal.claro ? 0xffffff : 0xc4d6ff); hemi.groundColor.set(pal.claro ? 0x8a7a66 : 0x1c1736); hemi.intensity = pal.claro ? 1.8 : 1.5;
  sol.color.set(0xfff1dc); sol.intensity = 1.5; sol.position.set(3, 6, 5);
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, pal.centro); g.addColorStop(0.55, pal.medio); g.addColorStop(1, pal.fondo);
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = pal.anillos; x.lineWidth = 1.2;
  for (const r of [36, 62, 90, 118]) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); }
  const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(16, 48), new THREE.MeshBasicMaterial({ map: tx }));
  suelo.rotation.x = -Math.PI / 2; raiz.add(suelo);
  if (pal.estrellas) {
    const n = alta() ? 320 : 160, ps = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 1.2, r = 60;
      ps[i * 3] = Math.cos(a) * Math.cos(e) * r; ps[i * 3 + 1] = Math.sin(e) * r; ps[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
    }
    const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(ps, 3));
    raiz.add(new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.35, fog: false, transparent: true, opacity: 0.85 })));
  }
}

// ------------------------------------------------------------------- bucle
// El ambiente va a su ritmo (reloj real): no se acelera ni se frena con el
// deslizador de velocidad de las animaciones.

function bucle() {
  const cam = mundo.camara;
  const paso = () => {
    const ahora = performance.now(), dt = Math.min(0.05, (ahora - antes) / 1000); antes = ahora;
    const t = ahora / 1000;
    if (cielo) { cielo.position.copy(cam.position); estrellas.position.copy(cam.position); estrellas.rotation.y = t * 0.002; }
    for (const n of nubes) {
      const u = n.userData; u.ang += u.vel * dt;
      if (u.fondo && u.ang > -Math.PI / 2 + 1.35) u.ang -= 2.7;   // las del fondo vuelven a entrar por el otro lado, fuera de cámara
      colocarNube(n);
    }
    if (lluvia) moverLluvia(dt);
    if (sombras) { sombras.material.map.offset.x = t * 0.004; sombras.material.map.offset.y = t * 0.0015; }
    if (mar) moverMar(t);
    if (rayo) {
      proximoRayo -= dt;
      if (proximoRayo <= 0) lanzarRayo();
      if (rayo.userData.vida > 0) { rayo.userData.vida -= dt; rayo.material.opacity = Math.max(0, rayo.userData.vida / 0.35); }
    }
    if (destello > 0.001) {
      destello *= Math.pow(0.02, dt);   // se apaga en ~0,5 s
      if (cielo) cielo.material.uniforms.destello.value = destello;
      mundo.luces.hemi.intensity = p.hemiInt * (1 - CIELOS[cfg.cielo].oscuro * 0.35) + destello * 1.6;
    } else if (cielo && cielo.material.uniforms.destello.value) { cielo.material.uniforms.destello.value = 0; aplicarLuz(); }
    // Hora real: se recalcula la luz cada medio minuto.
    if (cfg.hora === 'real' && cfg.suelo !== 'ninguno' && (relojReal += dt) > 30) {
      relojReal = 0; p = mezclaHora(); aplicarLuz();
      if (sonidoEncendido && capasSonido().join() !== capasPuestas) ponerCapas(capasSonido());
    }
  };
  // siempre() da el tiempo ya escalado por la velocidad; aquí se usa el reloj real.
  siempre(paso);
}
