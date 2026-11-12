// Mundo 3D de la maqueta: renderizador, cámara orbital táctil, bucle y
// pequeño motor de animaciones (tweens con promesas, cancelables al cambiar
// de escena). Solo presentación: aquí no hay ninguna regla del juego.
import * as THREE from '../../vendor/three/three.module.min.js';
export { THREE };

export const CANCELADO = Symbol('cancelado');
export const suave = k => k * k * (3 - 2 * k);
export const lineal = k => k;
export const entra = k => k * k;
export const sale = k => 1 - (1 - k) * (1 - k);
export const rebote = k => { const s = 1.70158; const t = k - 1; return t * t * ((s + 1) * t + s) + 1; };
export const mezcla = (a, b, k) => a + (b - a) * k;
export const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);

export const mundo = {
  calidad: 'alta', renderer: null, escena: null, camara: null, lienzo: null,
  fps: 60, tiempo: 0,
  cam: { objetivo: V(0, 0.8, 0.3), ancho: 9, alto: 7, azimut: 0, polar: 1.0, temblor: 0 },
  usuario: { azimut: 0, polar: 0, zoom: 1 },
};

let generacion = 0;
const tweens = new Set();
const porFrame = new Set();   // se borran al cambiar de escena
const fijos = new Set();      // viven siempre (orbes de los Portales, partículas)

/** Anima durante `dur` segundos; `fn(kSuavizado, kLineal)`. Promesa cancelable. */
export function tw(dur, fn, ease = suave) {
  return new Promise((res, rej) => {
    if (dur <= 0) { fn?.(1, 1); res(); return; }
    tweens.add({ t: 0, dur, fn, ease, res, rej });
  });
}
export const espera = s => tw(s, null);
export function cadaFrame(fn) { porFrame.add(fn); return () => porFrame.delete(fn); }
export function siempre(fn) { fijos.add(fn); return () => fijos.delete(fn); }
export function cancelarTodo() {
  generacion++;
  for (const t of tweens) t.rej(CANCELADO);
  tweens.clear(); porFrame.clear();
}
export const generacionActual = () => generacion;

let bucle = null, antesBucle = 0;
/** Detiene el dibujo (lienzo oculto) sin perder nada. */
export function pausar() { mundo.renderer?.setAnimationLoop(null); }
export function reanudar() { if (!mundo.renderer) return; ajustarTamano(); antesBucle = performance.now(); mundo.renderer.setAnimationLoop(bucle); }

export function crearMundo(lienzo, calidad, { controles = true } = {}) {
  mundo.calidad = calidad; mundo.lienzo = lienzo;
  const alta = calidad === 'alta';
  const renderer = new THREE.WebGLRenderer({ canvas: lienzo, antialias: alta, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, alta ? 2 : 1.25));
  const escena = new THREE.Scene();
  escena.background = new THREE.Color(0x0a0f24);
  escena.fog = new THREE.FogExp2(0x0a0f24, 0.028);
  const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 120);
  Object.assign(mundo, { renderer, escena, camara });

  const hemi = new THREE.HemisphereLight(0xc4d6ff, 0x1c1736, 1.5); escena.add(hemi);
  const sol = new THREE.DirectionalLight(0xfff1dc, 1.5); sol.position.set(3, 6, 5); escena.add(sol);
  mundo.luces = { hemi, sol };
  // Decorado por defecto (suelo oscuro y estrellas). El Escenario lo cambia
  // por el ambiente elegido (ambiente.js); la maqueta lo deja tal cual.
  const decorado = new THREE.Group(); escena.add(decorado); mundo.decorado = decorado;

  // Suelo: disco oscuro con un degradado y anillos tenues.
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const x = c.getContext('2d');
  const g = x.createRadialGradient(128, 128, 10, 128, 128, 128);
  g.addColorStop(0, '#2a3566'); g.addColorStop(0.55, '#171f44'); g.addColorStop(1, '#0a0f24');
  x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(170,200,255,.07)'; x.lineWidth = 1.2;
  for (const r of [36, 62, 90, 118]) { x.beginPath(); x.arc(128, 128, r, 0, 7); x.stroke(); }
  const tSuelo = new THREE.CanvasTexture(c); tSuelo.colorSpace = THREE.SRGBColorSpace;
  const suelo = new THREE.Mesh(new THREE.CircleGeometry(16, 40), new THREE.MeshBasicMaterial({ map: tSuelo }));
  suelo.rotation.x = -Math.PI / 2; decorado.add(suelo);

  // Estrellas.
  const n = alta ? 320 : 160; const p = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, e = 0.08 + Math.random() * 1.2, r = 60;
    p[i * 3] = Math.cos(a) * Math.cos(e) * r; p[i * 3 + 1] = Math.sin(e) * r; p[i * 3 + 2] = Math.sin(a) * Math.cos(e) * r;
  }
  const ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(p, 3));
  decorado.add(new THREE.Points(ge, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 0.35, fog: false, transparent: true, opacity: 0.85 })));

  ajustarTamano();
  window.addEventListener('resize', ajustarTamano);
  if (controles) controlesTactiles(lienzo);
  let acum = 0, cuadros = 0; antesBucle = performance.now();
  bucle = ahora => {
    const dt = Math.min(0.05, Math.max(0, (ahora - antesBucle) / 1000)) * (mundo.velocidad ?? 1); antesBucle = ahora;
    mundo.tiempo += dt; acum += dt; cuadros++;
    if (acum >= 0.5) { mundo.fps = Math.round(cuadros / acum); acum = 0; cuadros = 0; }
    for (const t of [...tweens]) {
      t.t += dt; const k = Math.min(1, t.t / t.dur);
      try { t.fn?.(t.ease(k), k); } catch (e) { console.error(e); }
      if (k >= 1) { tweens.delete(t); t.res(); }
    }
    for (const f of [...porFrame]) f(dt, mundo.tiempo);
    for (const f of fijos) f(dt, mundo.tiempo);
    colocarCamara();
    renderer.render(escena, camara);
  };
  renderer.setAnimationLoop(bucle);
  return mundo;
}

function ajustarTamano() {
  const { renderer, camara, lienzo } = mundo;
  const w = lienzo.clientWidth, h = lienzo.clientHeight; if (!w || !h) return;
  renderer.setSize(w, h, false);
  camara.aspect = w / h; camara.fov = w < h ? 58 : 42; camara.updateProjectionMatrix();
}

function colocarCamara() {
  const { camara, cam, usuario } = mundo;
  const tv = Math.tan(THREE.MathUtils.degToRad(camara.fov / 2));
  const radio = Math.max(cam.ancho / 2 / (tv * camara.aspect), cam.alto / 2 / tv) * usuario.zoom;
  const polar = THREE.MathUtils.clamp(cam.polar + usuario.polar, 0.25, 1.5);
  const az = cam.azimut + usuario.azimut;
  const o = cam.objetivo;
  camara.position.set(o.x + radio * Math.sin(polar) * Math.sin(az), o.y + radio * Math.cos(polar), o.z + radio * Math.sin(polar) * Math.cos(az));
  if (cam.temblor > 0.001) {
    camara.position.x += (Math.random() - 0.5) * cam.temblor;
    camara.position.y += (Math.random() - 0.5) * cam.temblor;
    cam.temblor *= 0.88;
  }
  camara.lookAt(o);
}

/** Mueve la cámara a un plano { objetivo, ancho, alto, azimut, polar }. */
export function plano(p, dur = 1.2) {
  const c = mundo.cam;
  const de = { o: c.objetivo.clone(), ancho: c.ancho, alto: c.alto, az: c.azimut, po: c.polar };
  const a = { o: p.objetivo ?? de.o, ancho: p.ancho ?? de.ancho, alto: p.alto ?? (p.ancho != null ? p.ancho * 0.8 : de.alto), az: p.azimut ?? 0, po: p.polar ?? 1.12 };
  return tw(dur, k => {
    c.objetivo.lerpVectors(de.o, a.o, k);
    c.ancho = mezcla(de.ancho, a.ancho, k); c.alto = mezcla(de.alto, a.alto, k);
    c.azimut = mezcla(de.az, a.az, k); c.polar = mezcla(de.po, a.po, k);
  });
}
export function temblar(f = 0.25) { mundo.cam.temblor = f; }
export function reiniciarVistaUsuario() { Object.assign(mundo.usuario, { azimut: 0, polar: 0, zoom: 1 }); }

function controlesTactiles(el) {
  const dedos = new Map(); let distAntes = 0;
  el.style.touchAction = 'none';
  el.addEventListener('pointerdown', e => { dedos.set(e.pointerId, [e.clientX, e.clientY]); el.setPointerCapture(e.pointerId); });
  const fuera = e => { dedos.delete(e.pointerId); distAntes = 0; };
  el.addEventListener('pointerup', fuera); el.addEventListener('pointercancel', fuera);
  el.addEventListener('pointermove', e => {
    const antes = dedos.get(e.pointerId); if (!antes) return;
    if (mundo.bloqueoCamara) { dedos.set(e.pointerId, [e.clientX, e.clientY]); return; }
    dedos.set(e.pointerId, [e.clientX, e.clientY]);
    const u = mundo.usuario;
    if (dedos.size === 1) {
      u.azimut -= (e.clientX - antes[0]) * 0.006;
      u.polar = THREE.MathUtils.clamp(u.polar - (e.clientY - antes[1]) * 0.004, -0.8, 0.5);
    } else if (dedos.size === 2) {
      const [a, b] = [...dedos.values()]; const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (distAntes) u.zoom = THREE.MathUtils.clamp(u.zoom * distAntes / d, 0.45, 1.8);
      distAntes = d;
    }
  });
  el.addEventListener('wheel', e => {
    e.preventDefault();
    mundo.usuario.zoom = THREE.MathUtils.clamp(mundo.usuario.zoom * (1 + e.deltaY * 0.001), 0.45, 1.8);
  }, { passive: false });
}

/** Punto del arco (Bézier cuadrática) entre a y b con el centro elevado `alto`. */
export function arco(a, b, k, alto = 1.5, lado = 0) {
  const m = a.clone().lerp(b, 0.5); m.y += alto;
  if (lado) { const d = b.clone().sub(a); m.x += -d.z * lado; m.z += d.x * lado; }
  const u = 1 - k;
  return V(u * u * a.x + 2 * u * k * m.x + k * k * b.x, u * u * a.y + 2 * u * k * m.y + k * k * b.y, u * u * a.z + 2 * u * k * m.z + k * k * b.z);
}
