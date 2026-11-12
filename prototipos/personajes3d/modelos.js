// Modelos 3D de los personajes, construidos por código (sin archivos de
// modelo): figuras articuladas de pocos polígonos con sombreado de dibujo
// animado, que recrean la ropa, el pelo, los colores y los objetos de las
// ilustraciones originales (assets/personajes). Cada modelo devuelve sus
// articulaciones (`art`) para que personajes.js las anime. Mira hacia +Z;
// su izquierda (I) es +X y su derecha (D) es -X. Origen en los pies.
import { THREE } from './mundo.js';

const grad = new THREE.DataTexture(new Uint8Array([120, 120, 120, 255, 200, 200, 200, 255, 255, 255, 255, 255]), 3, 1, THREE.RGBAFormat);
grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;

const ESF = new THREE.SphereGeometry(1, 14, 10);
const ESF_BAJA = new THREE.SphereGeometry(1, 8, 6);
const CIL = (rt, rb, h, n = 9, abierto = false) => new THREE.CylinderGeometry(rt, rb, h, n, 1, abierto);
const CONO = (r, h, n = 7) => new THREE.ConeGeometry(r, h, n);

function materiales() {
  const cache = new Map();
  return (color, o = {}) => {
    const k = color + JSON.stringify({ ...o, mapa: o.mapa?.uuid });
    if (!cache.has(k)) cache.set(k, o.luz
      ? new THREE.MeshBasicMaterial({ color, transparent: !!o.alfa, opacity: o.alfa ?? 1, side: o.doble ? THREE.DoubleSide : THREE.FrontSide, blending: o.aditivo ? THREE.AdditiveBlending : THREE.NormalBlending, depthWrite: !o.aditivo })
      : new THREE.MeshToonMaterial({ color: o.mapa ? 0xffffff : color, map: o.mapa ?? null, gradientMap: grad, side: o.doble ? THREE.DoubleSide : THREE.FrontSide, emissive: o.emisivo ?? 0x000000, emissiveIntensity: o.emisivo ? 0.6 : 1 }));
    return cache.get(k);
  };
}
const hex = c => '#' + new THREE.Color(c).getHexString();
const tono = (c, k) => '#' + new THREE.Color(c).multiplyScalar(k).getHexString();
/** Tela pintada: degradado, pliegues, bordado en el bajo y motivos dispersos. `bajo`: 'arriba' (túnicas) o 'abajo' (capas). */
function texturaTela(c, c2, bajo = 'arriba', motivo = 'estrellas') {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 256; const x = cv.getContext('2d');
  const g = x.createLinearGradient(0, bajo === 'arriba' ? 256 : 0, 0, bajo === 'arriba' ? 0 : 256);
  g.addColorStop(0, tono(c, 1.12)); g.addColorStop(0.6, hex(c)); g.addColorStop(1, tono(c, 0.72)); x.fillStyle = g; x.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? 'rgba(0,0,20,.07)' : 'rgba(255,255,255,.05)'; x.fillRect(i * 16 + 3, 0, 5, 256); }
  let s = 11; const rnd = () => (s = (s * 16807 + 7) % 2147483647) / 2147483647;
  x.fillStyle = x.strokeStyle = hex(c2); x.globalAlpha = 0.55;
  for (let i = 0; i < 26; i++) { const px = rnd() * 256, py = 40 + rnd() * 180, r = 2 + rnd() * 3; x.beginPath();
    if (motivo === 'estrellas') { for (let j = 0; j < 8; j++) { const a = j * Math.PI / 4, rr = j % 2 ? r * 0.4 : r * 1.5; x.lineTo(px + Math.cos(a) * rr, py + Math.sin(a) * rr); } x.fill(); }
    else { x.arc(px, py, r * 1.3, 0, 7); x.lineWidth = 1.2; x.stroke(); x.beginPath(); x.moveTo(px, py); x.lineTo(px, py - r); x.moveTo(px, py); x.lineTo(px + r * 0.7, py); x.stroke(); } }
  x.globalAlpha = 1; const y0 = bajo === 'arriba' ? 0 : 226;
  x.fillStyle = hex(c2); x.fillRect(0, y0, 256, 30); x.fillStyle = tono(c2, 0.6); x.fillRect(0, bajo === 'arriba' ? 30 : 222, 256, 4);
  x.fillStyle = tono(c, 0.8); for (let i = 0; i < 16; i++) { const px = i * 16 + 8, py = y0 + 15; x.beginPath(); x.moveTo(px, py - 9); x.lineTo(px + 6, py); x.lineTo(px, py + 9); x.lineTo(px - 6, py); x.fill(); }
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t;
}
/** Cara pintada sobre la esfera de la cabeza (el frente cae en u = 0,25). */
function texturaCara(piel, pelo, ojos, iris = 0x3a6a9a) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const x = cv.getContext('2d');
  x.fillStyle = hex(piel); x.fillRect(0, 0, 512, 256);
  const cx = 128, cy = 128; x.lineCap = 'round';
  for (const s of [1, -1]) {
    const ex = cx + s * 30;
    x.fillStyle = 'rgba(240,120,120,.28)'; x.beginPath(); x.ellipse(cx + s * 44, cy + 26, 15, 9, 0, 0, 7); x.fill();
    x.strokeStyle = tono(pelo, 0.7); x.lineWidth = 4; x.beginPath(); x.moveTo(ex - 14, cy - 24 + s * 0); x.quadraticCurveTo(ex, cy - 31, ex + 14, cy - 24); x.stroke();
    if (ojos === 'cerrados') { x.strokeStyle = '#2a1c24'; x.lineWidth = 4; x.beginPath(); x.moveTo(ex - 13, cy - 4); x.quadraticCurveTo(ex, cy + 8, ex + 13, cy - 4); x.stroke();
      x.lineWidth = 2; for (const d of [-9, 0, 9]) { x.beginPath(); x.moveTo(ex + d, cy + (d ? 0 : 3)); x.lineTo(ex + d * 1.25, cy + (d ? 6 : 9)); x.stroke(); } }
    else { x.fillStyle = '#fff'; x.beginPath(); x.ellipse(ex, cy, 13, 12, 0, 0, 7); x.fill(); x.fillStyle = hex(iris); x.beginPath(); x.arc(ex, cy + 1, 9, 0, 7); x.fill();
      x.fillStyle = '#14101a'; x.beginPath(); x.arc(ex, cy + 1, 4.5, 0, 7); x.fill(); x.fillStyle = '#fff'; x.beginPath(); x.arc(ex + 3, cy - 3, 2.6, 0, 7); x.fill();
      x.strokeStyle = '#2a1c24'; x.lineWidth = 3.5; x.beginPath(); x.moveTo(ex - 14, cy - 5); x.quadraticCurveTo(ex, cy - 16, ex + 14, cy - 5); x.stroke(); }
  }
  x.strokeStyle = 'rgba(120,50,50,.8)'; x.lineWidth = 3; x.beginPath(); x.moveTo(cx - 9, cy + 44); x.quadraticCurveTo(cx, cy + 50, cx + 9, cy + 44); x.stroke();
  x.strokeStyle = 'rgba(90,50,40,.35)'; x.lineWidth = 2; x.beginPath(); x.moveTo(cx - 2, cy + 18); x.lineTo(cx + 3, cy + 22); x.stroke();
  const t = new THREE.CanvasTexture(cv); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function pieza(padre, geo, mat, x = 0, y = 0, z = 0, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.scale.set(sx, sy, sz); padre.add(m); return m;
}
function pivote(padre, x = 0, y = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, y, z); padre.add(g); return g; }

/** Tela (capa, cinta) que ondea: plano con el borde superior fijo. */
function tela(padre, mat, ancho, largo, o = {}) {
  const geo = new THREE.PlaneGeometry(ancho, largo, o.sx ?? 3, o.sy ?? 5); geo.translate(0, -largo / 2, 0);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const u = p.getX(i) / (ancho / 2), v = -p.getY(i) / largo;
    p.setZ(i, (o.curva ?? 0) * u * u * (1 - v * 0.5) - v * (o.caida ?? 0));
    if (o.abre) p.setX(i, p.getX(i) * (1 + v * o.abre));
  }
  const m = new THREE.Mesh(geo, mat); padre.add(m);
  m.userData.tela = { base: p.array.slice(), largo, amp: o.amp ?? 0.03, vel: o.vel ?? 2.2, fase: Math.random() * 6, empuje: o.empuje ?? 0.3 };
  return m;
}

// ------------------------------------------------------------------ humano
function humano(p) {
  const M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [] };
  const a = p.ancho ?? 1, piel = M(p.piel);
  const cadera = art.cadera = pivote(g, 0, 0.88, 0);
  const torso = art.torso = pivote(cadera, 0, 0.02, 0);
  const cTorso = M(p.torso.c);
  pieza(cadera, ESF, M(p.piernas?.c ?? p.tunica?.c ?? p.torso.c), 0, 0, 0, 0.17 * a, 0.12, 0.125 * a);
  const tm = pieza(torso, CIL(0.2, 0.155, 0.48, 10), cTorso, 0, 0.26, 0); tm.scale.set(a, 1, 0.68 * (0.6 + 0.4 * a));
  pieza(torso, ESF, cTorso, 0, 0.47, 0, 0.225 * a, 0.085, 0.13);
  if (p.torso.c2) pieza(torso, new THREE.BoxGeometry(0.1, 0.44, 0.02), M(p.torso.c2), 0, 0.26, 0.128 * (0.6 + 0.4 * a) + 0.004 * a);
  if (p.cinturon) { const c = pieza(torso, new THREE.TorusGeometry(0.16 * a, 0.022, 5, 12), M(p.cinturon), 0, 0.03, 0); c.rotation.x = Math.PI / 2; c.scale.set(1, 0.72, 1); pieza(torso, ESF_BAJA, M(p.joya ?? 0xf0c84a, { emisivo: p.joya ?? 0xf0c84a }), 0, 0.03, 0.125, 0.03); }
  for (const [i, c] of (p.joyas ?? []).entries()) pieza(torso, ESF_BAJA, M(c, { emisivo: c }), 0, 0.42 - i * 0.1, 0.135 * (0.6 + 0.4 * a), 0.022);
  pieza(torso, CIL(0.05, 0.055, 0.1, 8), piel, 0, 0.56, 0);

  // Cabeza
  const cabeza = art.cabeza = pivote(torso, 0, 0.6, 0);
  pieza(cabeza, ESF, p.rico ? M(p.piel, { mapa: texturaCara(p.piel, p.pelo?.c ?? 0x3a2a20, p.ojos ?? 'abiertos', p.iris) }) : piel, 0, 0.12, 0, 0.145, 0.16, 0.15);
  if (p.ojos !== 'ninguno' && !p.rico) for (const s of [1, -1]) {
    const cerr = p.ojos === 'cerrados';
    pieza(cabeza, ESF_BAJA, M(0x1a1420), s * 0.055, 0.115, 0.136, cerr ? 0.03 : 0.02, cerr ? 0.006 : 0.028, 0.012);
    pieza(cabeza, new THREE.BoxGeometry(0.05, 0.008, 0.01), M(p.pelo?.c ?? 0x3a2a20), s * 0.055, 0.165, 0.138).rotation.z = -s * 0.12;
  }
  if (p.pelo) {
    const mp = M(p.pelo.c), L = p.pelo.largo ?? 0, v = p.pelo.volumen ?? 1; art.pelo.push(mp);
    const casco = pieza(cabeza, new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.56), mp, 0, 0.135, -0.012, 0.158 * v, 0.168, 0.165 * v); casco.rotation.x = -0.35;
    pieza(cabeza, ESF, mp, 0, 0.1, -0.06, 0.15 * v, 0.15, 0.12);
    if (L > 0) { pieza(cabeza, ESF, mp, 0, 0.02 - L * 0.22, -0.1, 0.15 * v, 0.14 + L * 0.3, 0.07);
      if (L > 0.1) for (const s of [1, -1]) pieza(cabeza, ESF, mp, s * 0.13 * v, 0.03 - L * 0.12, -0.02, 0.045 * v, 0.1 + L * 0.2, 0.06); }
    if (p.pelo.rizos) for (let i = 0; i < 9; i++) { const an = i / 9 * 6.28; pieza(cabeza, ESF_BAJA, mp, Math.cos(an) * 0.14, 0.16 + Math.sin(i * 2.3) * 0.05, Math.sin(an) * 0.13 - 0.02, 0.065); }
    if (p.pelo.flequillo) pieza(cabeza, ESF, mp, 0.02, 0.23, 0.09, 0.12, 0.05, 0.07);
  }
  if (p.barba) { pieza(cabeza, ESF, M(p.barba), 0, 0.03, 0.09, 0.09, 0.07, 0.07); }
  if (p.gafas) for (const s of [1, -1]) { const t = pieza(cabeza, new THREE.TorusGeometry(0.036, 0.007, 4, 10), M(0x3a3030), s * 0.056, 0.115, 0.146); t.scale.z = 0.5; }
  if (p.capucha) {
    const mc = M(p.capucha, { doble: true });
    const h = pieza(cabeza, new THREE.SphereGeometry(1, 14, 9, 0, Math.PI * 2, 0, Math.PI * 0.72), mc, 0, 0.13, -0.03, 0.19, 0.2, 0.2); h.rotation.x = -1.05;
    pieza(cabeza, CONO(0.1, 0.2, 7), mc, 0, 0.24, -0.19).rotation.x = -2.0;
    pieza(torso, ESF, M(p.capucha), 0, 0.5, -0.02, 0.24 * a, 0.09, 0.16);
  }

  // Brazos
  const brazo = lado => {
    const s = lado === 'I' ? 1 : -1, mg = p.mangas ?? {}, cm = M(mg['c' + lado] ?? mg.c ?? p.torso.c);
    const metal = p.brazoMecanico === lado;
    const b = art['brazo' + lado] = pivote(torso, s * 0.225 * a, 0.45, 0);
    if (p.hombreras) pieza(b, ESF, M(p.hombreras), s * 0.02, 0.03, 0, 0.1, 0.075, 0.1);
    if (mg.abombadas) pieza(b, ESF, cm, 0, -0.12, 0, 0.082, 0.15, 0.082); else pieza(b, CIL(0.058, 0.05, 0.28, 8), metal ? M(0x8a909c) : cm, 0, -0.14, 0);
    const c = art['codo' + lado] = pivote(b, 0, -0.28, 0);
    pieza(c, ESF_BAJA, metal ? M(0x6a707c) : cm, 0, 0, 0, 0.052);
    if (metal) pieza(c, CIL(0.045, 0.04, 0.26, 6), M(0x9aa0ac), 0, -0.13, 0);
    else if (mg.anchas) pieza(c, CIL(0.05, 0.115, 0.27, 9), cm, 0, -0.135, 0);
    else pieza(c, CIL(0.046, 0.04, 0.26, 8), mg.desnudo ? piel : cm, 0, -0.13, 0);
    if (p.rico && !metal) { const pu = pieza(c, new THREE.TorusGeometry(mg.anchas ? 0.112 : 0.045, 0.014, 5, 12), M(p.tunica?.c2 ?? 0xc8a040), 0, -0.262, 0); pu.rotation.x = Math.PI / 2; }
    art['mano' + lado] = pieza(c, ESF_BAJA, metal ? M(0x7a808c) : M(p.manos ?? p.piel), 0, -0.3, 0, 0.05, 0.06, 0.05);
  };
  brazo('I'); brazo('D');

  // Piernas (ocultas bajo una túnica larga) y túnica
  const larga = (p.tunica?.largo ?? 0) >= 0.9;
  for (const lado of ['I', 'D']) {
    const s = lado === 'I' ? 1 : -1, pr = p.piernas ?? {};
    const pi = art['pierna' + lado] = pivote(cadera, s * 0.09 * a, -0.02, 0);
    const ro = art['rodilla' + lado] = pivote(pi, 0, -0.42, 0);
    if (!larga) {
      const cp = M(pr['c' + lado] ?? pr.c ?? 0x3a3030);
      pieza(pi, CIL(0.078, 0.06, 0.42, 8), cp, 0, -0.21, 0); pieza(ro, ESF_BAJA, cp, 0, 0, 0, 0.06);
      pieza(ro, CIL(0.058, 0.048, 0.38, 8), M(pr.botas ?? pr.c ?? 0x3a3030), 0, -0.19, 0);
    }
    pieza(ro, ESF, M(pr.botas ?? p.tunica?.c2 ?? 0x4a3828), 0, -0.4, 0.045, 0.062, 0.05, 0.115);
  }
  if (p.tunica) {
    const t = p.tunica, L = t.largo * 0.84, vu = t.vuelo ?? 0.34;
    const pts = [[0.165 * a, 0.12], [0.2 * a, -0.04], [(0.2 * a + vu) / 2, -L * 0.55], [vu, -L]].map(q => new THREE.Vector2(q[0], q[1]));
    const f = art.falda = pivote(cadera, 0, 0, 0);
    const fm = pieza(f, new THREE.LatheGeometry(pts, p.rico ? 20 : 12), M(t.c, p.rico ? { doble: true, mapa: texturaTela(t.c, t.c2 ?? t.c, 'arriba', p.motivo) } : { doble: true })); fm.scale.z = 0.86; if (p.rico) fm.material.map.repeat.x = 2;
    if (t.c2) { const r = pieza(f, new THREE.TorusGeometry(vu, 0.022, 5, 14), M(t.c2), 0, -L, 0); r.rotation.x = Math.PI / 2; r.scale.set(1, 0.86, 1);
      if (t.panel) { const pn = pieza(f, new THREE.BoxGeometry(0.13, L, 0.015), M(t.c2), 0, -L / 2 - 0.02, (0.2 * a + vu) / 2 * 0.86 + 0.012); pn.rotation.x = -Math.atan2(vu - 0.2 * a, L) * 0.86; } }
  }
  if (p.capa) {
    const c = p.capa, m = tela(torso, M(c.c, p.rico ? { doble: true, mapa: texturaTela(c.c, c.c2 ?? p.tunica?.c2 ?? 0xc8a040, 'abajo', p.motivo) } : { doble: true }), (c.ancho ?? 0.52) * a, c.largo * 1.25, { curva: 0.13, caida: 0.1, abre: c.abre ?? 0.35, amp: 0.035 });
    m.position.set(0, 0.5, -0.125); art.telas.push(m);
  }
  g.scale.setScalar((p.alto ?? 1.7) / 1.72);
  return { raiz: g, art, tipo: 'humano', M, alto: p.alto ?? 1.7 };
}

/** Objeto que flota y gira junto a una mano o sobre la cabeza. */
function flotante(m, obj, ancla, o = {}) { m.art.flotantes.push({ obj, ancla, radio: o.radio ?? 0, y: o.y ?? 0.12, vel: o.vel ?? 1, fase: o.fase ?? 0, sube: o.sube ?? 0.02 }); return obj; }
function orbe(m, color, r = 0.05) { const o = new THREE.Mesh(ESF_BAJA, m.M(color, { emisivo: color })); o.scale.setScalar(r); m.raiz.add(o); o.userData.color = color; return o; }

const HUMANOS = {
  'Aprendiz': { alto: 1.58, piel: 0xf2c9a8, pelo: { c: 0x8a5ab8, largo: 0.15, flequillo: true }, gafas: true, torso: { c: 0xf0dca8, c2: 0x3f8f6a }, cinturon: 0x7a5230, joya: 0x3fb890,
    mangas: { c: 0xf0dca8 }, tunica: { c: 0xe8cf98, c2: 0x3f8f6a, largo: 0.36, vuelo: 0.27 }, piernas: { c: 0x6b4a2a, botas: 0x8a5a30 }, capa: { c: 0xe8843a, largo: 0.5 } },
  'Centinela': { alto: 1.74, piel: 0xa8693f, pelo: { c: 0x5a3520, largo: 0.45 }, torso: { c: 0xb8322a, c2: 0xd8a040 }, hombreras: 0xc8442f, cinturon: 0x7a5230,
    mangas: { c: 0x6a2a2a }, tunica: { c: 0x7a1f1f, c2: 0xd8a040, largo: 0.42, vuelo: 0.27 }, piernas: { c: 0x2a2a38, botas: 0xb8322a }, capa: { c: 0xa82820, largo: 0.92 } },
  'Clarividente': { rico: true, motivo: 'estrellas', alto: 1.7, piel: 0xf0cfb0, pelo: { c: 0x1c1c2c, largo: 0.8 }, ojos: 'cerrados', capucha: 0x1f8a80, torso: { c: 0xe8d49a, c2: 0x1f8a80 }, cinturon: 0xc8a040, joya: 0x5fe8ff, joyas: [0x5fe8ff],
    mangas: { c: 0x23988c, anchas: true }, tunica: { c: 0xf0dca0, c2: 0xc8a040, largo: 1, vuelo: 0.42, panel: true }, capa: { c: 0x1f8a80, largo: 1, ancho: 0.6 } },
  'Cronista': { alto: 1.6, ancho: 1.28, piel: 0xf4c8a8, pelo: { c: 0xc8401c, largo: 0.1, rizos: true, volumen: 1.05 }, torso: { c: 0x2f8f7a, c2: 0xf0c84a }, cinturon: 0xc8a040, joya: 0x3fd8b0, joyas: [0xe04a4a, 0x3fd8b0],
    mangas: { c: 0x2f8f7a, anchas: true }, tunica: { c: 0x6f4a98, c2: 0xf0c84a, largo: 1, vuelo: 0.46, panel: true }, capa: { c: 0x8a5ab0, largo: 0.95, ancho: 0.62 } },
  'Cronomante': { rico: true, motivo: 'relojes', iris: 0x4a8ab8, alto: 1.76, piel: 0xe0b090, pelo: { c: 0x4a3020, largo: 0.05, flequillo: true }, barba: 0x4a3020, torso: { c: 0xe8dcc0, c2: 0x8a6ab8 }, cinturon: 0x7a5230, joya: 0xe04a6a, joyas: [0xe04a6a, 0x5ab8e8],
    mangas: { c: 0xe8dcc0 }, brazoMecanico: 'D', tunica: { c: 0xe8dcc0, c2: 0xb8a070, largo: 0.78, vuelo: 0.3 }, piernas: { c: 0x4a3828, botas: 0x7a5230 }, capa: { c: 0x7a5ab0, largo: 0.95 } },
  'Entusiasta': { alto: 1.52, piel: 0xf4c8a0, pelo: { c: 0xc85a2a, largo: 0 }, torso: { c: 0xe8408a, c2: 0x7a3ab8 }, cinturon: 0x3a8ae0,
    mangas: { cI: 0x3a6ad8, cD: 0x7a3ab8, abombadas: false }, manos: 0xb040c0, piernas: { cI: 0x7a3ab8, cD: 0xe8408a, botas: 0xe8408a } },
  'Estratega': { alto: 1.66, piel: 0xf8d8c0, pelo: { c: 0xf08a4a, largo: 1, volumen: 1.12 }, ojos: 'cerrados', torso: { c: 0xf8b078 }, cinturon: 0xe07a3a, joya: 0x5fd0a0,
    mangas: { c: 0xf8c090, abombadas: true }, tunica: { c: 0xf09a5a, c2: 0xf8d0a0, largo: 1, vuelo: 0.48 } },
  'Maestro': { alto: 1.76, piel: 0xf0c8a0, pelo: { c: 0xe8c860, largo: 0.05, flequillo: true }, torso: { c: 0xf0e0b0, c2: 0xc89a3a }, hombreras: 0xc89a3a, cinturon: 0xc89a3a, joya: 0xe04a4a, joyas: [0x3fd8b0, 0xe04a4a],
    mangas: { c: 0xf0e0b0 }, tunica: { c: 0xf0e0b0, c2: 0xc89a3a, largo: 0.45, vuelo: 0.27 }, piernas: { c: 0x4a3828, botas: 0xd8b870 }, capa: { c: 0xb03a28, largo: 1.02, ancho: 0.66, abre: 0.55 } },
  'Metamorfo': { alto: 1.72, piel: 0xf8dcd0, pelo: { c: 0xf0b8d8, largo: 1 }, ojos: 'cerrados', torso: { c: 0xf0a8c0, c2: 0xf8d8a0 }, cinturon: 0xe07a9a, joya: 0xe04a6a,
    mangas: { c: 0xf4b0c8, anchas: true }, tunica: { c: 0x7ab8e8, c2: 0xf4b0c8, largo: 1, vuelo: 0.44, panel: true }, capa: { c: 0x9ad0f0, largo: 0.6 } },
  'Ocultista': { alto: 1.72, piel: 0x07070f, ojos: 'ninguno', capucha: 0x2a4ab0, torso: { c: 0x2f55c0, c2: 0x8ad0f0 }, cinturon: 0x8ad0f0, joya: 0x4a9cff, manos: 0x1a2a6a,
    mangas: { c: 0x2f55c0, anchas: true }, tunica: { c: 0x2848a8, c2: 0x8ad0f0, largo: 1, vuelo: 0.4, panel: true }, capa: { c: 0x2a4ab0, largo: 0.55, ancho: 0.6 } },
  'Pícaro': { alto: 1.68, piel: 0xf0c8a0, pelo: { c: 0xe0c070, largo: 0.05, flequillo: true }, torso: { c: 0x2a5a9a, c2: 0xc8a040 }, cinturon: 0x5a4028,
    mangas: { c: 0x2a5a9a }, tunica: { c: 0x2a5a9a, largo: 0.3, vuelo: 0.25 }, piernas: { c: 0x202028, botas: 0xf0c8a0 }, capa: { c: 0x3a4a44, largo: 0.5, ancho: 0.4 } },
};

const EXTRAS = {
  'Aprendiz'(m) { // hojas de pergamino revoloteando
    for (let i = 0; i < 6; i++) { const h = new THREE.Mesh(new THREE.PlaneGeometry(0.11, 0.15), m.M(0xfff3d6, { doble: true })); m.raiz.add(h); flotante(m, h, 'torso', { radio: 0.5 + (i % 3) * 0.12, y: -0.5 + i * 0.22, vel: 0.9 + i * 0.13, fase: i * 1.1, sube: 0.08 }); h.userData.gira = 1 + i * 0.3; }
  },
  'Centinela'(m) { // lanza en la mano derecha y escudo en el antebrazo izquierdo
    const l = art => { const g = new THREE.Group(); pieza(g, CIL(0.016, 0.016, 2.0, 6), m.M(0x7a5230)); pieza(g, CONO(0.045, 0.24, 4), m.M(0xd8dce8), 0, 1.12, 0); pieza(g, CIL(0.03, 0.03, 0.05, 6), m.M(0xd8a040), 0, 0.98, 0); return g; };
    const lanza = m.art.lanza = l(); lanza.position.set(0, 0.25, 0.02); lanza.rotation.x = Math.PI / 2 - 0.12; m.art.manoD.parent.add(lanza); lanza.position.y = -0.3;
    const e = m.art.escudo = new THREE.Group(); const disco = pieza(e, CIL(0.2, 0.2, 0.035, 6), m.M(0xb8322a)); disco.rotation.x = Math.PI / 2; const b = pieza(e, CIL(0.09, 0.11, 0.05, 6), m.M(0xd8a040)); b.rotation.x = Math.PI / 2; b.position.z = 0.012;
    e.position.set(0.06, -0.16, 0.02); e.rotation.y = Math.PI / 2; m.art.codoI.add(e);
  },
  'Clarividente'(m) { flotante(m, orbe(m, 0x5fe8ff, 0.085), 'manoD', { y: 0.15 }); },
  'Cronista'(m) { // libro abierto en la mano izquierda; llama en la derecha
    const l = new THREE.Group(); for (const s of [1, -1]) { const t = pieza(l, new THREE.BoxGeometry(0.15, 0.02, 0.2), m.M(0x7a4a2a), s * 0.075, 0, 0); t.rotation.z = s * 0.25; const h = pieza(l, new THREE.BoxGeometry(0.135, 0.02, 0.18), m.M(0xfff3d6), s * 0.072, 0.014, 0); h.rotation.z = s * 0.25; }
    l.position.set(0, -0.33, 0.06); l.rotation.x = Math.PI / 2 - 0.3; m.art.codoI.add(l); m.art.libro = l;
    flotante(m, orbe(m, 0x6ff0d0, 0.06), 'manoD', { y: 0.14 });
  },
  'Entusiasta'(m) { // gorro de bufón con cascabeles, gola y pelota
    const c = m.art.cabeza, cols = [0xe8408a, 0x7a3ab8, 0x3a6ad8];
    [-1, 0, 1].forEach((s, i) => { const p = pivote(c, s * 0.09, 0.24, -0.02); p.rotation.z = -s * 0.95; p.rotation.x = s === 0 ? -0.5 : 0; pieza(p, CONO(0.085, 0.3, 6), m.M(cols[i]), 0, 0.12, 0); pieza(p, ESF_BAJA, m.M(0xf0c84a, { emisivo: 0xf0c84a }), 0, 0.28, 0, 0.03); });
    for (let i = 0; i < 7; i++) { const an = i / 7 * 6.28; const p = pieza(m.art.torso, CONO(0.06, 0.16, 4), m.M(i % 2 ? 0xf0c84a : 0xe8408a), Math.cos(an) * 0.15, 0.5, Math.sin(an) * 0.11); p.rotation.set(Math.sin(an) * 1.9, 0, -Math.cos(an) * 1.9); }
    flotante(m, orbe(m, 0x5ab8ff, 0.07), 'manoI', { y: 0.2, sube: 0.06 });
  },
  'Estratega'(m) { // arco de esferas de colores sobre la cabeza (malabares)
    const cols = [0x5fd0a0, 0xe8a040, 0xe04a6a, 0x5ab8e8, 0xf0e070, 0xb07ae8, 0xf08a4a];
    cols.forEach((c, i) => flotante(m, orbe(m, c, 0.04), 'arco', { fase: i / (cols.length - 1), vel: 0.35 }));
  },
  'Maestro'(m) { [0xe04a4a, 0x5ab8e8, 0x5fd0a0, 0xb07ae8, 0xf0c84a].forEach((c, i) => flotante(m, orbe(m, c, 0.045), i % 2 ? 'manoI' : 'manoD', { radio: 0.16, y: 0.16 + (i % 3) * 0.07, vel: 1.4 + i * 0.2, fase: i * 1.3 })); },
  'Ocultista'(m) { flotante(m, orbe(m, 0x6ab8ff, 0.07), 'manos', { y: 0.1 }); pieza(m.art.torso, ESF, m.M(0x2a4ab0), 0, 0.47, 0, 0.27, 0.1, 0.17); },
  'Pícaro'(m) { flotante(m, orbe(m, 0xbfe6ff, 0.06), 'manoD', { y: 0.16 }); },
};

// ---------------------------------------------------------------- animales
function cuadrupedo(p) {
  const M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [], patas: [] };
  const c = M(p.c), L = p.largo, alt = p.altura;
  const cuerpo = art.torso = pivote(g, 0, alt, 0);
  pieza(cuerpo, ESF, c, 0, 0, 0, p.grosor, p.grosor * 0.95, L / 2);
  if (p.panza) pieza(cuerpo, ESF, M(p.panza), 0, -0.03, 0.02, p.grosor * 0.9, p.grosor * 0.85, L / 2 * 0.9);
  [[1, 1], [-1, 1], [1, -1], [-1, -1]].forEach(([s, f]) => {
    const pa = pivote(cuerpo, s * p.grosor * 0.55, -p.grosor * 0.4, f * L * 0.34);
    const lp = alt - p.grosor * 0.4;
    pieza(pa, CIL(p.pata * 1.25, p.pata, lp * 0.95, 6), M(p.cPata ?? p.c), 0, -lp / 2, 0); pieza(pa, ESF_BAJA, M(p.pezuna), 0, -lp + 0.025, 0.012, p.pata * 1.35, 0.03, p.pata * 1.6);
    art.patas.push(pa);
  });
  const cuello = art.cuello = pivote(cuerpo, 0, p.grosor * 0.5, L * 0.38); cuello.rotation.x = p.cuelloInc;
  pieza(cuello, CIL(p.grosor * 0.5, p.grosor * 0.68, p.cuello, 8), c, 0, p.cuello / 2, 0);
  const cab = art.cabeza = pivote(cuello, 0, p.cuello + p.cabeza * 0.5, 0); cab.rotation.x = -p.cuelloInc;
  pieza(cab, ESF, M(p.cCabeza ?? p.c), 0, 0, 0, p.cabeza, p.cabeza * 0.95, p.cabeza * 1.05);
  pieza(cab, ESF, M(p.cHocico ?? p.c), 0, -p.cabeza * 0.25, p.cabeza * 0.85, p.cabeza * 0.5, p.cabeza * 0.42, p.cabeza * 0.6);
  pieza(cab, ESF_BAJA, M(0x2a2020), 0, -p.cabeza * 0.16, p.cabeza * 1.42, p.cabeza * 0.14);
  for (const s of [1, -1]) {
    pieza(cab, ESF_BAJA, M(p.ojo ?? 0x1a1420), s * p.cabeza * 0.5, p.cabeza * 0.15, p.cabeza * 0.78, p.cabeza * 0.17, p.cabeza * 0.2, p.cabeza * 0.1);
    pieza(cab, ESF_BAJA, M(0x0a0a10), s * p.cabeza * 0.52, p.cabeza * 0.15, p.cabeza * 0.86, p.cabeza * 0.08);
    const o = pivote(cab, s * p.cabeza * 0.62, p.cabeza * 0.6, -p.cabeza * 0.1); o.rotation.z = -s * (p.orejaCaida ? 2.6 : 0.55); if (p.orejaCaida) o.position.y = p.cabeza * 0.75;
    pieza(o, ESF, M(p.cOreja ?? p.c), 0, p.oreja * 0.5, 0, p.oreja * 0.38, p.oreja * 0.62, p.oreja * 0.14); (art.orejas ??= []).push(o);
  }
  const cola = art.cola = pivote(cuerpo, 0, p.grosor * 0.3, -L / 2 + 0.02); cola.rotation.x = p.colaInc ?? 0.6;
  pieza(cola, ESF, M(p.cCola ?? p.c), 0, p.cola * 0.5, 0, p.cola * 0.32, p.cola * 0.6, p.cola * 0.32);
  if (p.capa) {
    const mc = M(p.capa, { doble: true });
    const lomo = pieza(cuerpo, new THREE.CylinderGeometry(p.grosor * 1.12, p.grosor * 1.3, L * 0.8, 10, 1, true, -Math.PI * 0.62, Math.PI * 1.24), mc, 0, 0.0, -L * 0.05); lomo.rotation.x = Math.PI / 2; lomo.rotation.y = Math.PI;
    const t = tela(cuerpo, mc, p.grosor * 2.2, alt * 0.75, { curva: -0.1, caida: 0.12, amp: 0.03, sy: 4 }); t.position.set(0, p.grosor * 0.6, -L * 0.42); art.telas.push(t);
    pieza(cuello, new THREE.TorusGeometry(p.grosor * 0.68, 0.03, 5, 10), M(p.broche ?? 0xc8a040), 0, 0.03, 0).rotation.x = Math.PI / 2;
    pieza(cuello, ESF_BAJA, M(p.joya, { emisivo: p.joya }), 0, 0.03, p.grosor * 0.7, 0.045);
    if (p.capuchaCaida) pieza(cuello, ESF, mc, 0, 0.1, -p.grosor * 0.6, p.grosor * 0.6, p.grosor * 0.4, p.grosor * 0.5);
  }
  for (const [x, y, z] of p.gemas ?? []) pieza(cuerpo, new THREE.OctahedronGeometry(0.035, 0), M(p.joya, { emisivo: p.joya }), x, y, z);
  if (p.gemaFrente) pieza(cab, new THREE.OctahedronGeometry(0.035, 0), M(p.joya, { emisivo: p.joya }), 0, p.cabeza * 0.55, p.cabeza * 0.82);
  return { raiz: g, art, tipo: 'cuadrupedo', M, alto: p.altoTotal };
}
const CUADRUPEDOS = {
  'Lumo': { c: 0xf4e0a0, panza: 0xfbf0c8, largo: 0.62, altura: 0.62, grosor: 0.16, pata: 0.03, pezuna: 0x6a4a2a, cuello: 0.26, cuelloInc: 0.5, cabeza: 0.13, oreja: 0.26, cola: 0.2, cCola: 0xfbf0c8, colaInc: -0.9,
    ojo: 0x3fb870, capa: 0x3f7a3a, joya: 0xf09a3a, gemas: [[0.15, 0.03, 0.1], [0.16, -0.02, -0.12], [-0.15, 0.03, 0.05]], gemaFrente: true, altoTotal: 1.2 },
  'Reena': { c: 0xf4f0e8, largo: 0.6, altura: 0.44, grosor: 0.17, pata: 0.04, pezuna: 0xf4f0e8, cuello: 0.14, cuelloInc: 0.7, cabeza: 0.15, cCabeza: 0x1c1c22, cHocico: 0xf4f0e8, cOreja: 0x1c1c22, oreja: 0.2, orejaCaida: true,
    cola: 0.26, colaInc: -0.5, capa: 0x2a55b8, broche: 0x7a5ab0, joya: 0x4aa8ff, capuchaCaida: true, altoTotal: 0.95 },
};
function buho() {
  const M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [], alas: [] };
  const c = M(0xf08a3a), cuerpo = art.torso = pivote(g, 0, 0.42, 0);
  pieza(cuerpo, ESF, c, 0, 0, 0, 0.2, 0.26, 0.18); pieza(cuerpo, ESF, M(0xfbe0b0), 0, -0.03, 0.06, 0.15, 0.2, 0.14);
  const cab = art.cabeza = pivote(cuerpo, 0, 0.3, 0.01);
  pieza(cab, ESF, c, 0, 0, 0, 0.19, 0.16, 0.17);
  for (const s of [1, -1]) {
    pieza(cab, ESF, M(0xfbe0b0), s * 0.075, 0.0, 0.12, 0.075, 0.075, 0.05); pieza(cab, ESF_BAJA, M(0x4ac860, { emisivo: 0x2a8a40 }), s * 0.075, 0.0, 0.15, 0.048, 0.048, 0.03); pieza(cab, ESF_BAJA, M(0x0a0a10), s * 0.075, 0.0, 0.172, 0.024);
    pieza(cab, CONO(0.045, 0.13, 4), c, s * 0.13, 0.15, 0).rotation.z = -s * 0.5;
    const ala = pivote(cuerpo, s * 0.17, 0.12, 0);
    pieza(ala, ESF, M(0xe07828), s * 0.24, 0, 0, 0.26, 0.035, 0.15);
    for (let i = 0; i < 4; i++) pieza(ala, ESF_BAJA, M(i % 2 ? 0xf8a850 : 0xe07828), s * (0.2 + i * 0.09), -0.01, -0.1, 0.05, 0.02, 0.13).rotation.y = s * 0.2 * i;
    art.alas.push(ala);
    pieza(cuerpo, ESF_BAJA, M(0xd8a040), s * 0.07, -0.27, 0.05, 0.035, 0.02, 0.06);
  }
  pieza(cab, CONO(0.03, 0.07, 4), M(0xf0c84a), 0, -0.04, 0.17).rotation.x = Math.PI / 2 + 0.5;
  pieza(cuerpo, ESF, M(0xe07828), 0, -0.16, -0.16, 0.1, 0.03, 0.14);
  for (const [x, y] of [[0, 0.02], [-0.07, -0.08], [0.07, -0.08]]) pieza(cuerpo, new THREE.OctahedronGeometry(0.03, 0), M(0xf8d070, { emisivo: 0xf8b050 }), x, y, 0.19);
  g.scale.setScalar(1.5);
  return { raiz: g, art, tipo: 'ave', M, alto: 1.15 };
}

// ---------------------------------------------------------------- criaturas
const CRIATURAS_3D = {
  'Cirelia':   { c: 0xffc94a, c2: 0xfff3c0, cintas: [0xffc94a, 0xffe9a0, 0xff9a3a], halo: true, corona: 7 },
  'Baelorith': { c: 0xd8284a, c2: 0xffb0c0, cintas: [0xd8284a, 0xff7a9a, 0xfff0f4], puas: true, corona: 5 },
  'Aelgorth':  { c: 0x7a5ae8, c2: 0xc8b8ff, cintas: [0x7a5ae8, 0x4a3ab0, 0xb8a0ff], estrellas: true, corona: 0 },
};
function criatura(nombre) {
  const p = CRIATURAS_3D[nombre], M = materiales(), g = new THREE.Group(), art = { telas: [], flotantes: [], pelo: [] };
  const cuerpoM = M(p.c, { emisivo: p.c });
  const tronco = art.torso = pivote(g, 0, 2.3, 0);
  const pts = [[0.02, -1.5], [0.12, -1.0], [0.2, -0.3], [0.16, 0.1], [0.3, 0.6], [0.34, 0.85], [0.12, 1.0]].map(q => new THREE.Vector2(q[0], q[1]));
  pieza(tronco, new THREE.LatheGeometry(pts, 10), cuerpoM).scale.z = 0.7;
  const cab = art.cabeza = pivote(tronco, 0, 1.12, 0);
  pieza(cab, ESF, M(p.c2, { emisivo: p.c2 }), 0, 0.14, 0, 0.14, 0.22, 0.15);
  for (let i = 0; i < p.corona; i++) { const an = (i / (p.corona - 1) - 0.5) * 2.2; const k = pieza(cab, CONO(0.045, 0.5 - Math.abs(an) * 0.12, 4), cuerpoM, Math.sin(an) * 0.16, 0.38 + Math.cos(an) * 0.14, -0.02); k.rotation.z = -an; }
  for (const lado of ['I', 'D']) {
    const s = lado === 'I' ? 1 : -1; const b = art['brazo' + lado] = pivote(tronco, s * 0.36, 0.82, 0);
    pieza(b, CIL(0.05, 0.035, 0.7, 6), cuerpoM, 0, -0.35, 0); const c = art['codo' + lado] = pivote(b, 0, -0.7, 0);
    pieza(c, CIL(0.035, 0.02, 0.7, 6), cuerpoM, 0, -0.35, 0); art['mano' + lado] = pieza(c, ESF_BAJA, M(p.c2, { emisivo: p.c2 }), 0, -0.74, 0, 0.06, 0.1, 0.05);
    if (p.puas) for (let i = 0; i < 3; i++) pieza(b, CONO(0.05, 0.4, 4), cuerpoM, s * 0.05, 0.06 + i * 0.02, -0.03 * i).rotation.z = -s * (0.5 + i * 0.5);
  }
  const n = 9;
  for (let i = 0; i < n; i++) {
    const an = i / n * Math.PI * 2, alto = i % 3 === 0;
    const m = tela(tronco, M(p.cintas[i % 3], { luz: true, alfa: 0.72, doble: true }), 0.34, alto ? 2.6 : 2.0, { sx: 1, sy: 8, amp: 0.2, vel: 1.6, abre: -0.5, empuje: 0 });
    m.position.set(Math.cos(an) * 0.22, alto ? 0.8 : -0.2, Math.sin(an) * 0.16 - 0.05); m.rotation.y = -an + Math.PI / 2; m.rotation.z = Math.cos(an) * 0.5; m.rotation.x = -0.25;
    m.renderOrder = 9; art.telas.push(m);
  }
  if (p.halo) { const h = pieza(tronco, new THREE.TorusGeometry(1.0, 0.025, 5, 28), M(p.c2, { luz: true }), 0, 1.0, -0.3); art.halo = h;
    for (let i = 0; i < 12; i++) { const an = i / 12 * 6.283; const r = pieza(h, CONO(0.035, i % 3 ? 0.22 : 0.4, 4), M(p.c2, { luz: true }), Math.cos(an) * 1.12, Math.sin(an) * 1.12, 0); r.rotation.z = an - Math.PI / 2; } }
  if (p.estrellas) for (let i = 0; i < 14; i++) { const s = pieza(g, new THREE.OctahedronGeometry(0.05, 0), M(p.c2, { luz: true }), 0, 0, 0); flotante({ art }, s, 'torso', { radio: 0.7 + (i % 4) * 0.25, y: -1.4 + i * 0.2, vel: 0.3 + (i % 5) * 0.08, fase: i * 1.7, sube: 0.1 }); }
  g.scale.setScalar(1.25);
  return { raiz: g, art, tipo: 'criatura', M, alto: 4.6, color: p.c, color2: p.c2 };
}

// --------------------------------------------------- ilustración recortada
const LAMINAS = { 'Clarividente': { archivo: 'clarividente', alto: 1.7, razon: 475 / 747, mano: [0.33, 0.55] } };
/** Alternativa a comparar: la ilustración original recortada, de pie y siempre de frente a la cámara. */
function lamina(nombre) {
  const d = LAMINAS[nombre], tex = new THREE.TextureLoader().load('../assets/figuras/' + d.archivo + '.webp'); tex.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group(), geo = new THREE.PlaneGeometry(d.alto * d.razon, d.alto); geo.translate(0, d.alto / 2, 0);
  const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.08, side: THREE.DoubleSide })); m.renderOrder = 5; g.add(m);
  return { raiz: g, art: { telas: [], flotantes: [], pelo: [] }, tipo: 'lamina', alto: d.alto, ancho: d.alto * d.razon, manoUV: d.mano };
}

/** Construye el modelo 3D de un personaje o criatura por su nombre. */
export function construirModelo(nombre) {
  let m;
  if (nombre.startsWith('lamina:')) { m = lamina(nombre.slice(7)); m.nombre = nombre.slice(7); return m; }
  if (HUMANOS[nombre]) { m = humano(HUMANOS[nombre]); EXTRAS[nombre]?.(m); }
  else if (CUADRUPEDOS[nombre]) m = cuadrupedo(CUADRUPEDOS[nombre]);
  else if (nombre === 'Sora') m = buho();
  else if (CRIATURAS_3D[nombre]) m = criatura(nombre);
  else throw new Error('Sin modelo: ' + nombre);
  m.nombre = nombre; return m;
}
export const NOMBRES_PERSONAJES = [...Object.keys(HUMANOS), ...Object.keys(CUADRUPEDOS), 'Sora'];
export const NOMBRES_CRIATURAS = Object.keys(CRIATURAS_3D);
