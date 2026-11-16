// Funda «Por bloques» (1.41.0): figuritas de bloques de juguete con tetones
// hexagonales, Portales de ladrillos y una placa como suelo. Solo estética: la
// partida, las animaciones y los toques son los del Escenario (tablero.js);
// estas piezas imitan el esqueleto de modelos.js (brazoI/D, manoI/D, cabeza,
// torso, piernas…) para que personajes.js las mueva igual.
// Las piezas vienen de la maqueta prototipos/figuras-bloques.html.
import { THREE, siempreReal } from './mundo.js';
import { registrarFunda } from './funda.js';

const luzFalsa = () => new THREE.Object3D();   // sin luces por figura: en móvil saldrían caras
// plástico brillante
const plastico = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0, ...extra });
const brillo = (color, intensidad = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: intensidad, roughness: 0.2, transparent: true, opacity: 0.85 });

function sombra(m) { m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return m; }
// Une las piezas fijas de un grupo en una malla por material (muchas menos llamadas de dibujo en móvil).
// Deja aparte lo transparente, lo multimaterial y lo que flota o se anima.
function firma(m) { return [m.color?.getHexString(), m.emissive?.getHexString(), m.emissiveIntensity, m.metalness, m.roughness, m.map?.uuid, m.side].join('|'); }
function fundir(g) {
  g.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(g.matrixWorld).invert(), lotes = new Map(), quitar = [];
  g.traverse(o => {
    if (!o.isMesh || o.isInstancedMesh || Array.isArray(o.material) || o.material.transparent) return;
    for (let a = o; a && a !== g; a = a.parent) if (a.userData.flota || a.userData.noFundir) return;
    const k = firma(o.material); if (!lotes.has(k)) lotes.set(k, { mat: o.material, piezas: [] });
    lotes.get(k).piezas.push({ geo: o.geometry, m: new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld) }); quitar.push(o);
  });
  quitar.forEach(o => o.parent.remove(o));
  for (const { mat, piezas } of lotes.values()) {
    const pos = [], nor = [], uv = [];
    for (const { geo, m } of piezas) {
      const gg = (geo.index ? geo.toNonIndexed() : geo.clone()).applyMatrix4(m);
      pos.push(...gg.attributes.position.array); nor.push(...gg.attributes.normal.array);
      if (gg.attributes.uv) uv.push(...gg.attributes.uv.array); else uv.push(...new Array(gg.attributes.position.count * 2).fill(0));
    }
    const bg = new THREE.BufferGeometry();
    bg.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); bg.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); bg.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    const mm = new THREE.Mesh(bg, mat); mm.castShadow = mm.receiveShadow = true; g.add(mm);
  }
  return g;
}

// ---------- placa base con tetones ----------
// Tetones HEXAGONALES (no redondos): estilo propio, inspirado en los juguetes de bloques sin copiarlos.
const TETON = new THREE.CylinderGeometry(0.25, 0.25, 0.17, 6);
// Orbes y llamas que levitan: cada uno con su propio ritmo (arriba/abajo, izquierda/derecha).
const FLOTANTES = [];
let semillaFlot = 1;
function flotar(obj, amp = 0.12) {
  const r = () => (semillaFlot = (semillaFlot * 16807) % 2147483647) / 2147483647;
  obj.userData.flota = { base: obj.position.clone(), amp, fx: 0.7 + r() * 0.9, fy: 0.9 + r() * 1.1, fz: 0.6 + r() * 0.8, px: r() * 6.28, py: r() * 6.28, pz: r() * 6.28 };
  FLOTANTES.push(obj);
  return obj;
}
function moverFlotantes(T) {
  for (const o of FLOTANTES) {
    if (!o.parent) continue;
    const u = o.userData.flota;
    o.position.set(u.base.x + Math.sin(T * u.fx + u.px) * u.amp, u.base.y + Math.sin(T * u.fy + u.py) * u.amp * 1.3, u.base.z + Math.sin(T * u.fz + u.pz) * u.amp * 0.6);
  }
}
function placa(ancho, fondo, color, paso = 0.8) {
  const g = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(ancho * paso, 0.32, fondo * paso), plastico(color));
  base.position.y = -0.16;
  g.add(base);
  const mt = plastico(color);
  const tetones = new THREE.InstancedMesh(TETON, mt, ancho * fondo);
  let i = 0; const m = new THREE.Matrix4();
  for (let x = 0; x < ancho; x++) for (let z = 0; z < fondo; z++) {
    m.makeTranslation((x - (ancho - 1) / 2) * paso, 0.085, (z - (fondo - 1) / 2) * paso);
    tetones.setMatrixAt(i++, m);
  }
  g.add(tetones);
  return sombra(g);
}
// Portal de bloques: la misma construcción que el Portal del Escenario (tarima escalonada con
// disco rúnico, escalinata delantera, piedras bajas con ojos rúnicos, dos pilares altos con arco,
// dos pilares bajos, resplandor del umbral), montada con ladrillos y tetones hexagonales.
const ALTO = 0.96; // altura de la tarima: tres capas de ladrillo
const PIEDRA = '#a9a4b8', PIEDRA_OSC = '#827d94', PIEDRA_CLARA = '#c4bfd2';
function discoRunico(color) {
  const c = document.createElement('canvas'); c.width = c.height = 512; const x = c.getContext('2d');
  x.translate(256, 256); x.strokeStyle = '#fff'; x.fillStyle = '#fff'; x.lineCap = 'round';
  x.lineWidth = 10; x.beginPath(); x.arc(0, 0, 236, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 5; x.beginPath(); x.arc(0, 0, 200, 0, Math.PI * 2); x.stroke();
  x.beginPath(); x.arc(0, 0, 70, 0, Math.PI * 2); x.stroke();
  x.lineWidth = 6; x.beginPath();
  for (let k = 0; k <= 5; k++) { const a = -Math.PI / 2 + k * Math.PI * 4 / 5; const px = Math.cos(a) * 196, py = Math.sin(a) * 196; k ? x.lineTo(px, py) : x.moveTo(px, py); }
  x.stroke();
  for (let k = 0; k < 12; k++) { // runas cuadradas entre los dos círculos
    const a = k / 12 * Math.PI * 2; x.save(); x.rotate(a); x.translate(0, -218);
    x.lineWidth = 4; x.strokeRect(-9, -9, 18, 18); if (k % 3 === 0) x.fillRect(-4, -4, 8, 8); x.restore();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return new THREE.MeshBasicMaterial({ map: t, color, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false });
}
function ladrillo(ancho, alto, fondo, color, tetones = true) {
  const g = new THREE.Group();
  const b = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), plastico(color)); g.add(b);
  if (tetones) {
    const nx = Math.max(1, Math.round(ancho / 0.8)), nz = Math.max(1, Math.round(fondo / 0.8));
    for (let a = 0; a < nx; a++) for (let c = 0; c < nz; c++) {
      const t = new THREE.Mesh(TETON, plastico(color)); t.position.set((a - (nx - 1) / 2) * 0.8 * Math.min(1, ancho / (nx * 0.8)), alto / 2 + 0.085, (c - (nz - 1) / 2) * 0.8 * Math.min(1, fondo / (nz * 0.8))); g.add(t);
    }
  }
  return g;
}
function portal(color = '#7b5fd0', variante = 0) {
  const g = new THREE.Group();
  const runas = [];
  // tarima: tres capas de 12 lados, cada una algo más estrecha, con tetones en el borde
  [[2.55, PIEDRA, 18], [2.3, PIEDRA_OSC, 16], [2.05, '#5d5870', 0]].forEach(([rad, col, n], k) => {
    const capa = new THREE.Mesh(new THREE.CylinderGeometry(rad, rad, 0.32, 12), plastico(col));
    capa.position.y = 0.16 + k * 0.32; g.add(capa);
    for (let q = 0; q < n; q++) {
      const a = (q + 0.5) / n * Math.PI * 2; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.42) continue; // hueco de la escalinata
      const t = new THREE.Mesh(TETON, plastico(col)); t.position.set(Math.cos(a) * (rad - 0.18), 0.32 * (k + 1) + 0.085, Math.sin(a) * (rad - 0.18)); g.add(t);
    }
  });
  // disco rúnico encendido sobre la tarima
  const disco = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 3.9), discoRunico(color));
  disco.rotation.x = -Math.PI / 2; disco.position.y = ALTO + 0.01; g.add(disco); runas.push(disco);
  // escalinata delantera
  [[0.32, 3.0], [0.64, 2.6]].forEach(([h, z]) => { const e = ladrillo(1.6, h, 0.42, PIEDRA, true); e.position.set(0, h / 2, z); g.add(e); });
  // piedras bajas con ojo rúnico alrededor
  for (let q = 0; q < 9; q++) {
    const a = q / 9 * Math.PI * 2 + 0.35; if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.45) continue;
    const pz = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.38, 0.36, 6), plastico(PIEDRA_OSC)); pz.position.set(Math.cos(a) * 3.15, 0.18, Math.sin(a) * 3.15); g.add(pz);
    const ojo = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.05, 6), brillo(color, 1.6)); ojo.position.set(pz.position.x, 0.38, pz.position.z); g.add(ojo); runas.push(ojo);
  }
  // pilares de ladrillos 1x1 con tira de runas
  const pilar = (x, z, n, roto) => {
    const pg = new THREE.Group(); pg.position.set(x, 0, z); g.add(pg);
    const basa = ladrillo(1.0, 0.32, 1.0, PIEDRA_OSC, false); basa.position.y = 0.16; pg.add(basa);
    for (let k = 0; k < n; k++) {
      const b = ladrillo(0.78, 0.62, 0.78, k % 2 ? PIEDRA : PIEDRA_CLARA, k === n - 1);
      b.position.y = 0.32 + 0.31 + k * 0.64;
      if (roto && k === n - 1) { b.rotation.set(0.15, 0.4, 0.35); b.position.x += 0.12; }
      pg.add(b);
      if (!(roto && k === n - 1)) { const tira = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.36, 0.02), brillo(color, 1.4)); tira.position.set(0, b.position.y, 0.4); pg.add(tira); runas.push(tira); }
    }
    return 0.32 + n * 0.64;
  };
  const altoP = pilar(-1.45, -1.6, 7, false); pilar(1.45, -1.6, 7, variante === 2);
  pilar(-2.35, -0.35, 3, variante === 1); pilar(2.35, -0.35, 3, false);
  // arco de ladrillos entre los pilares altos (entero, o roto según la variante)
  const piezas = 9;
  for (let k = 0; k < piezas; k++) {
    if (variante === 2 && k > 5) continue;
    if (variante === 1 && k === 4) continue;
    const a = Math.PI * (k + 0.5) / piezas;
    const b = ladrillo(0.55, 0.42, 0.78, k % 2 ? PIEDRA : PIEDRA_CLARA, false);
    b.position.set(-Math.cos(a) * 1.45, altoP + Math.sin(a) * 1.1, -1.6); b.rotation.z = a - Math.PI / 2; g.add(b);
  }
  const clave = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.1, 6), brillo(color, 1.8)); clave.rotation.x = Math.PI / 2; clave.position.set(0, altoP + 1.1, -1.18);
  if (variante !== 2) { g.add(clave); runas.push(clave); }
  // resplandor del umbral
  const umbral = new THREE.Mesh(new THREE.PlaneGeometry(2.3, altoP - ALTO + 0.6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  umbral.position.set(0, ALTO + (altoP - ALTO + 0.6) / 2, -1.62); g.add(umbral);
  // chispas flotantes del Portal
  for (let k = 0; k < 4; k++) {
    const ch = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), brillo(color, 2));
    ch.position.set((k - 1.5) * 0.9, 2.2 + (k % 2) * 1.3, -1.0 + (k % 3) * 0.5); g.add(flotar(ch, 0.35));
  }
  g.userData.runas = runas;
  return sombra(g);
}

// ---------- texturas impresas (cara y torso) ----------
function lienzo(w, h, pinta) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d'); pinta(x, w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
  return t;
}
const NEGRO = '#1a1418';

// la cara se dibuja centrada en u = 0.5 (la cabeza gira 180° para que el centro mire al frente)
function cara(piel, opciones = {}) {
  const { ojos = 'abiertos', boca = 'sonrisa', barba = null, cejas = NEGRO, gafas = false, sombraTotal = false, mejillas = false, ojosBrillo = null } = opciones;
  return lienzo(512, 256, (x, w, h) => {
    x.fillStyle = sombraTotal ? '#0b0d1a' : piel; x.fillRect(0, 0, w, h);
    const cx = w / 2, oy = 108, sep = 34;
    x.lineCap = 'round';
    if (sombraTotal) {
      if (ojosBrillo) {
        x.shadowColor = ojosBrillo; x.shadowBlur = 18; x.fillStyle = ojosBrillo;
        for (const s of [-1, 1]) { x.beginPath(); x.ellipse(cx + s * sep, oy + 8, 9, 5, 0, 0, Math.PI * 2); x.fill(); }
        x.shadowBlur = 0;
      }
      return;
    }
    if (barba) {
      x.fillStyle = barba;
      x.beginPath(); x.moveTo(cx - 84, 70); x.lineTo(cx - 70, 70); x.quadraticCurveTo(cx - 66, 150, cx, 158); x.quadraticCurveTo(cx + 66, 150, cx + 70, 70); x.lineTo(cx + 84, 70);
      x.quadraticCurveTo(cx + 86, 226, cx, 240); x.quadraticCurveTo(cx - 86, 226, cx - 84, 70); x.fill();
      x.beginPath(); x.moveTo(cx - 44, 150); x.quadraticCurveTo(cx, 128, cx + 44, 150); x.quadraticCurveTo(cx, 146, cx - 44, 150); x.fill(); // bigote
      x.fillStyle = piel; x.beginPath(); x.ellipse(cx, 172, 20, 8, 0, 0, Math.PI * 2); x.fill();
      x.strokeStyle = NEGRO; x.lineWidth = 4; x.beginPath(); x.moveTo(cx - 12, 172); x.lineTo(cx + 12, 172); x.stroke();
    }
    x.strokeStyle = cejas; x.lineWidth = 7;
    for (const s of [-1, 1]) { x.beginPath(); x.moveTo(cx + s * (sep - 16), oy - 26); x.quadraticCurveTo(cx + s * sep, oy - 34, cx + s * (sep + 16), oy - 26); x.stroke(); }
    x.fillStyle = NEGRO; x.strokeStyle = NEGRO; x.lineWidth = 6;
    for (const s of [-1, 1]) {
      if (ojos === 'cerrados') { x.beginPath(); x.arc(cx + s * sep, oy - 2, 12, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
      else {
        x.beginPath(); x.ellipse(cx + s * sep, oy, 8.5, 11, 0, 0, Math.PI * 2); x.fill();
        x.fillStyle = '#fff'; x.beginPath(); x.arc(cx + s * sep + 3, oy - 4, 3, 0, Math.PI * 2); x.fill(); x.fillStyle = NEGRO;
      }
    }
    if (gafas) {
      x.strokeStyle = '#3a2a22'; x.lineWidth = 5;
      for (const s of [-1, 1]) { x.beginPath(); x.arc(cx + s * sep, oy, 21, 0, Math.PI * 2); x.stroke(); }
      x.beginPath(); x.moveTo(cx - 13, oy - 2); x.lineTo(cx + 13, oy - 2); x.stroke();
    }
    if (mejillas) { x.fillStyle = 'rgba(235,110,110,.45)'; for (const s of [-1, 1]) { x.beginPath(); x.arc(cx + s * 62, oy + 30, 13, 0, Math.PI * 2); x.fill(); } }
    x.strokeStyle = NEGRO; x.lineWidth = 6;
    if (boca === 'sonrisa') { x.beginPath(); x.arc(cx, 132, 26, 0.2 * Math.PI, 0.8 * Math.PI); x.stroke(); }
    else if (boca === 'serena') { x.beginPath(); x.arc(cx, 128, 16, 0.25 * Math.PI, 0.75 * Math.PI); x.stroke(); }
    else if (boca === 'carcajada') {
      x.fillStyle = '#5a1a22'; x.beginPath(); x.moveTo(cx - 34, 130); x.quadraticCurveTo(cx, 186, cx + 34, 130); x.closePath(); x.fill();
      x.fillStyle = '#fff'; x.fillRect(cx - 26, 130, 52, 9);
    } else if (boca === 'firme' && !barba) { x.beginPath(); x.moveTo(cx - 16, 140); x.lineTo(cx + 16, 138); x.stroke(); }
  });
}

// torso: lienzo frontal; pinta(x, w, h) dibuja los detalles impresos
function torsoTex(color, pinta) {
  return lienzo(256, 256, (x, w, h) => { x.fillStyle = color; x.fillRect(0, 0, w, h); pinta && pinta(x, w, h); });
}
function gema(x, cx, cy, r, color) {
  x.fillStyle = '#e7c35a'; x.beginPath(); x.moveTo(cx, cy - r - 5); x.lineTo(cx + r + 5, cy); x.lineTo(cx, cy + r + 5); x.lineTo(cx - r - 5, cy); x.fill();
  x.fillStyle = color; x.beginPath(); x.moveTo(cx, cy - r); x.lineTo(cx + r, cy); x.lineTo(cx, cy + r); x.lineTo(cx - r, cy); x.fill();
  x.fillStyle = 'rgba(255,255,255,.7)'; x.beginPath(); x.arc(cx - r / 3, cy - r / 3, r / 4, 0, Math.PI * 2); x.fill();
}

// ---------- la figurita ----------
// Medidas aproximadas de un muñequito de bloques (unidades: 1 ≈ 1 cm de juguete ×2.5)
function trapecio(anchoArriba, anchoAbajo, alto, fondo) {
  const g = new THREE.BoxGeometry(anchoAbajo, alto, fondo);
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) > 0) p.setX(i, p.getX(i) * anchoArriba / anchoAbajo);
  g.computeVertexNormals();
  return g;
}

function figura(d) {
  const f = new THREE.Group();
  const piel = d.piel || '#f2c9a0';
  f.userData.piernas = []; f.userData.falda = !!d.falda;

  // piernas o falda
  if (d.falda) {
    const falda = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.95, 1.55, 4, 1), plastico(d.falda));
    falda.rotation.y = Math.PI / 4; falda.scale.z = 0.62; falda.position.y = 0.78;
    f.add(falda);
    if (d.faldaRibete) {
      const rib = new THREE.Mesh(new THREE.CylinderGeometry(0.97, 0.97, 0.12, 4, 1), plastico(d.faldaRibete));
      rib.rotation.y = Math.PI / 4; rib.scale.z = 0.62; rib.position.y = 0.06; f.add(rib);
    }
  } else {
    const cadera = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.28, 0.62), plastico(d.cadera || d.piernas[0]));
    cadera.position.y = 1.45; f.add(cadera);
    d.piernas.forEach((c, i) => {
      const s = i === 0 ? -1 : 1;
      const pierna = new THREE.Group();
      const muslo = new THREE.Mesh(new THREE.BoxGeometry(0.58, 1.05, 0.62), plastico(c));
      muslo.position.y = -0.55; pierna.add(muslo);
      const pie = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.32, 0.78), plastico(d.botas || c));
      pie.position.set(0, -1.15, 0.08); pierna.add(pie);
      if (d.botas) { const caña = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.45, 0.64), plastico(d.botas)); caña.position.y = -0.85; pierna.add(caña); }
      pierna.position.set(s * 0.31, 1.32, 0);
      pierna.rotation.x = (d.paso || 0) * s;
      f.add(pierna); f.userData.piernas.push(pierna); pierna.userData.base = pierna.rotation.x;
    });
  }

  // torso con estampado
  const tt = torsoTex(d.torso, d.estampado);
  const matTorso = [plastico(d.torso), plastico(d.torso), plastico(d.torso), plastico(d.torso), plastico('#ffffff', { map: tt }), plastico(d.torso)];
  const torso = new THREE.Mesh(trapecio(0.95, 1.3, 1.3, 0.62), matTorso);
  torso.position.y = 2.25; f.add(torso);

  // brazos y manos en C
  const hombroY = 2.72;
  [-1, 1].forEach(s => {
    const brazo = new THREE.Group();
    const color = (s < 0 ? d.brazoIzq : d.brazoDer) || d.brazos || d.torso;
    const sup = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.23, 0.95, 16), plastico(color, color === '#9aa3ad' ? { metalness: 0.7, roughness: 0.25 } : {}));
    sup.position.y = -0.45; brazo.add(sup);
    const hombro = new THREE.Mesh(new THREE.SphereGeometry(0.22, 16, 12), plastico(color)); brazo.add(hombro);
    const puno = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.14, 16), plastico(d.puños || color)); puno.position.y = -0.95; brazo.add(puno);
    const mano = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.08, 10, 18, Math.PI * 1.45), plastico(d.manos || piel));
    mano.rotation.set(0, Math.PI / 2, Math.PI * 0.77); mano.position.y = -1.13; brazo.add(mano);
    brazo.position.set(s * 0.6, hombroY, 0);
    const pose = (s < 0 ? d.poseIzq : d.poseDer) || [0.25, 0.12];
    brazo.rotation.x = -pose[0];
    brazo.rotation.z = s * pose[1];
    brazo.userData.mano = mano; brazo.userData.base = [brazo.rotation.x, brazo.rotation.z];
    f.add(brazo);
    f.userData[s < 0 ? 'brazoIzq' : 'brazoDer'] = brazo;
  });

  // cuello y cabeza
  const cuello = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 16), plastico(piel)); cuello.position.y = 2.96; f.add(cuello);
  const cabeza = new THREE.Group(); cabeza.position.y = 3.45; f.add(cabeza);
  const caraMat = plastico('#ffffff', { map: cara(piel, d.cara) });
  const craneo = new THREE.Mesh(new THREE.CylinderGeometry(0.43, 0.43, 0.82, 40, 1), [caraMat, plastico(d.cara?.sombraTotal ? '#0b0d1a' : piel), plastico(piel)]);
  craneo.rotation.y = Math.PI; cabeza.add(craneo);
  for (const y of [0.41, -0.41]) { const bisel = new THREE.Mesh(new THREE.TorusGeometry(0.39, 0.05, 8, 40), plastico(piel)); bisel.rotation.x = Math.PI / 2; bisel.position.y = y; cabeza.add(bisel); }
  const tet = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.16, 6), plastico(piel)); tet.position.y = 0.5; cabeza.add(tet);

  if (d.pelo) cabeza.add(d.pelo());
  if (d.capa) f.add(capa(d.capa, d.capaLarga));
  if (d.extra) d.extra(f, cabeza);
  f.userData.cabeza = cabeza;
  return sombra(f);
}

// capa: lámina doblada a la espalda
function capa(color, larga = 2.3) {
  const g = new THREE.Group();
  const forma = new THREE.Shape();
  forma.moveTo(-0.5, 0); forma.lineTo(0.5, 0); forma.lineTo(0.85, -larga); forma.lineTo(-0.85, -larga); forma.closePath();
  const geo = new THREE.ExtrudeGeometry(forma, { depth: 0.06, bevelEnabled: false });
  const m = new THREE.Mesh(geo, plastico(color, { side: THREE.DoubleSide }));
  m.position.set(0, 2.9, -0.37); m.rotation.x = 0.1;
  g.add(m);
  return g;
}

// ---------- piezas de pelo y sombreros ----------
function peloMelena(color, largo = 1.0, flequillo = true) {
  return () => {
    const g = new THREE.Group(); const mt = plastico(color);
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.52, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mt); casco.position.y = 0.24; casco.scale.set(1, 1.05, 1); g.add(casco);
    const trasera = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.62, largo, 32, 1, true, Math.PI * 0.3, Math.PI * 1.4), plastico(color, { side: THREE.DoubleSide }));
    trasera.position.y = 0.26 - largo / 2; g.add(trasera);
    for (const s of [-1, 1]) { const mech = new THREE.Mesh(new THREE.BoxGeometry(0.16, largo * 0.85, 0.3), mt); mech.position.set(s * 0.47, 0.26 - largo * 0.45, 0.22); mech.rotation.z = s * -0.08; g.add(mech); }
    if (flequillo) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.16, 0.2), mt); f.position.set(0, 0.36, 0.38); f.rotation.x = -0.35; g.add(f); }
    return g;
  };
}
function peloCorto(color, despeinado = true) {
  return () => {
    const g = new THREE.Group(); const mt = plastico(color);
    const casco = new THREE.Mesh(new THREE.SphereGeometry(0.5, 32, 16, 0, Math.PI * 2, 0, Math.PI * 0.5), mt); casco.position.y = 0.27; casco.scale.y = 0.9; g.add(casco);
    const nuca = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.5, 32, 1, true, Math.PI * 0.42, Math.PI * 1.16), plastico(color, { side: THREE.DoubleSide })); nuca.position.y = 0.1; g.add(nuca);
    if (despeinado) for (let k = 0; k < 5; k++) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), mt);
      const a = -0.9 + k * 0.45; m.position.set(Math.sin(a) * 0.3, 0.62 - Math.abs(a) * 0.05, Math.cos(a) * 0.2 + 0.08); m.scale.set(1.2, 0.6, 1); m.rotation.z = -a * 0.5; g.add(m);
    }
    return g;
  };
}
function capucha(color, forro = '#0b0d1a', pico = true) {
  return () => {
    const g = new THREE.Group();
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.64, 32, 20, Math.PI * 0.78, Math.PI * 1.44, 0, Math.PI * 0.78), plastico(color, { side: THREE.DoubleSide }));
    c.position.y = 0.05;
    const frente = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 20, 0, Math.PI * 2, 0, Math.PI * 0.2), plastico(color)); frente.position.y = 0.05; frente.scale.set(1, 1.15, 1); g.add(frente); c.scale.set(1, 1.15, 1); g.add(c);
        if (pico) { const p = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.45, 16), plastico(color)); p.position.set(0, 0.62, -0.12); p.rotation.x = -0.5; g.add(p); }
    const cuelloC = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.28, 32), plastico(color)); cuelloC.position.y = -0.58; g.add(cuelloC);
    return g;
  };
}

// ---------- animales de bloques ----------
function animal(tipo) {
  const f = new THREE.Group(), U = f.userData;
  U.animal = true; U.piernas = []; U.falda = false;
  const add = (geo, mat, x, y, z, padre = f) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); padre.add(m); return m; };
  const B = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const cabeza = new THREE.Group(); f.add(cabeza); U.cabeza = cabeza;
  const ojo = (padre, x, y, z, iris = '#3aa65a', r = 0.12) => { add(new THREE.CylinderGeometry(r, r, 0.06, 6), plastico(iris), x, y, z, padre).rotation.x = Math.PI / 2; add(new THREE.CylinderGeometry(r * 0.5, r * 0.5, 0.08, 6), plastico('#111'), x, y, z + 0.02, padre).rotation.x = Math.PI / 2; add(new THREE.SphereGeometry(r * 0.25, 6, 4), plastico('#fff'), x + r * 0.3, y + r * 0.3, z + 0.05, padre); };
  const pata = (x, z, alto, color, pezuna) => { const g = new THREE.Group(); g.position.set(x, alto, z); f.add(g); add(B(0.32, alto, 0.34), plastico(color), 0, -alto / 2, 0, g); if (pezuna) add(B(0.34, 0.16, 0.38), plastico(pezuna), 0, -alto + 0.08, 0.02, g); g.userData.base = 0; U.piernas.push(g); return g; };
  if (tipo === 'perro') { // Reena: perrita blanca y negra con capa azul
    const blanco = '#f4f1ea', negro = '#1d1b20';
    add(B(1.0, 0.9, 1.9), plastico(blanco), 0, 1.45, 0); add(B(1.02, 0.4, 0.9), plastico(negro), 0, 1.75, -0.4);
    [[-0.32, 0.65], [0.32, 0.65], [-0.32, -0.65], [0.32, -0.65]].forEach(([x, z]) => pata(x, z, 1.0, blanco));
    // capa azul con correa morada y gema
    add(B(1.25, 0.12, 1.7), plastico('#1f4fb0'), 0, 1.96, -0.05); for (const s of [-1, 1]) add(B(0.1, 0.9, 1.7), plastico('#1f4fb0'), s * 0.62, 1.55, -0.05);
    add(B(1.1, 0.22, 0.2), plastico('#6a3aa0'), 0, 1.65, 0.9); add(new THREE.CylinderGeometry(0.18, 0.18, 0.1, 6), brillo('#4ab0ff', 1.2), 0, 1.65, 1.02).rotation.x = Math.PI / 2;
    cabeza.position.set(0, 2.35, 1.0);
    add(B(0.85, 0.75, 0.75), plastico(blanco), 0, 0, 0, cabeza); add(B(0.87, 0.35, 0.77), plastico(negro), 0, 0.22, 0, cabeza);
    add(B(0.45, 0.35, 0.5), plastico(blanco), 0, -0.18, 0.55, cabeza); add(B(0.2, 0.14, 0.12), plastico(negro), 0, -0.06, 0.82, cabeza);
    for (const s of [-1, 1]) { const o = add(B(0.12, 0.5, 0.35), plastico(negro), s * 0.48, 0.35, -0.05, cabeza); o.rotation.z = s * 0.5; ojo(cabeza, s * 0.2, 0.05, 0.38, '#5a3a22', 0.1); }
    const cola = new THREE.Group(); cola.position.set(0, 1.85, -0.95); f.add(cola); const tubo = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0.5, -0.3), new THREE.Vector3(0, 0.9, -0.1), new THREE.Vector3(0, 0.8, 0.2)]);
    add(new THREE.TubeGeometry(tubo, 12, 0.11, 6), plastico(blanco), 0, 0, 0, cola); U.cola = cola;
  } else if (tipo === 'buho') { // Sora: búho naranja de ojos verdes, alas abiertas
    const nar = '#e8843a', claro = '#f6c08a', osc = '#b8551e';
    const cuerpo = add(new THREE.CylinderGeometry(0.7, 0.85, 1.6, 6), plastico(nar), 0, 1.8, 0);
    add(new THREE.CylinderGeometry(0.5, 0.62, 1.2, 6, 1, false, -0.8, 1.6), plastico(claro), 0, 1.7, 0.12);
    for (let k = 0; k < 4; k++) add(new THREE.OctahedronGeometry(0.1), brillo('#ffd86a', 1), (k % 2 ? 0.18 : -0.18), 1.4 + k * 0.22, 0.75);
    cabeza.position.set(0, 3.0, 0);
    add(new THREE.CylinderGeometry(0.75, 0.72, 0.85, 6), plastico(nar), 0, 0, 0, cabeza);
    add(new THREE.CylinderGeometry(0.62, 0.62, 0.08, 6), plastico(claro), 0, 0, 0.62, cabeza).rotation.x = Math.PI / 2;
    for (const s of [-1, 1]) { ojo(cabeza, s * 0.27, 0.05, 0.68, '#3fbf6b', 0.2); const t = add(new THREE.ConeGeometry(0.16, 0.5, 4), plastico(osc), s * 0.48, 0.55, 0, cabeza); t.rotation.z = -s * 0.35; }
    add(new THREE.ConeGeometry(0.1, 0.3, 4), plastico('#f2c230'), 0, -0.15, 0.72, cabeza).rotation.x = Math.PI / 2 + 0.4;
    U.alas = [-1, 1].map(s => { const ala = new THREE.Group(); ala.position.set(s * 0.7, 2.4, -0.1); f.add(ala);
      for (let k = 0; k < 4; k++) { const pl = add(B(0.5, 0.12, 1.6 - k * 0.25), plastico(k % 2 ? osc : nar), s * (0.35 + k * 0.42), 0.2 + k * 0.28, -0.1, ala); pl.rotation.z = s * 0.15; }
      ala.rotation.z = s * 0.5; return ala; });
    for (const s of [-1, 1]) { const g = pata(s * 0.3, 0.1, 0.9, '#f2c230'); }
  } else { // Lumo: cervato dorado con capa verde y gemas
    const piel = '#f2d58a', claro = '#fbe8b8';
    add(B(0.85, 0.8, 1.7), plastico(piel), 0, 1.75, 0);
    [[-0.27, 0.6], [0.27, 0.6], [-0.27, -0.6], [0.27, -0.6]].forEach(([x, z]) => pata(x, z, 1.35, piel, '#3a2a1e'));
    for (let k = 0; k < 4; k++) add(new THREE.OctahedronGeometry(0.11), brillo('#ffb84a', 1), (k % 2 ? 0.44 : -0.44), 1.75, -0.5 + k * 0.33);
    add(B(1.0, 0.12, 1.0), plastico('#3f7a3a'), 0, 2.18, 0.35); for (const s of [-1, 1]) add(B(0.1, 0.5, 0.9), plastico('#3f7a3a'), s * 0.5, 1.95, 0.35);
    add(new THREE.OctahedronGeometry(0.14), brillo('#ffb84a', 1.2), 0, 2.0, 0.92);
    add(B(0.4, 0.9, 0.45), plastico(piel), 0, 2.45, 0.7).rotation.x = 0.35;
    cabeza.position.set(0, 3.0, 0.95);
    add(B(0.65, 0.6, 0.65), plastico(piel), 0, 0, 0, cabeza); add(B(0.4, 0.32, 0.45), plastico(claro), 0, -0.14, 0.42, cabeza); add(B(0.16, 0.12, 0.1), plastico('#2a1d14'), 0, -0.04, 0.66, cabeza);
    for (const s of [-1, 1]) { const o = add(B(0.18, 0.7, 0.35), plastico(piel), s * 0.48, 0.5, -0.05, cabeza); o.rotation.z = s * 0.7; ojo(cabeza, s * 0.18, 0.08, 0.33, '#3fbf6b', 0.12); }
    add(new THREE.OctahedronGeometry(0.1), brillo('#ffb84a', 1.2), 0, 0.3, 0.33, cabeza);
    const cola = new THREE.Group(); cola.position.set(0, 2.05, -0.85); f.add(cola); add(B(0.2, 0.35, 0.18), plastico(claro), 0, 0.1, 0, cola); U.cola = cola;
  }
  // brazos de mentira (las animaciones comunes los ignoran) y «mano» en la cabeza
  for (const k of ['brazoIzq', 'brazoDer']) { const b = new THREE.Group(); b.userData.base = [0, 0]; b.userData.mano = new THREE.Object3D(); cabeza.add(b); b.add(b.userData.mano); b.userData.mano.position.set(0, 0, 0.6); U[k] = b; }
  U.extraAnim = (f, t, modo) => {
    const rapido = modo === 'andar' || modo === 'celebrar' || modo === 'saludar' || modo === 'alzar';
    if (U.cola) U.cola.rotation.z = Math.sin(t * (rapido ? 14 : 5)) * 0.5;
    if (U.alas) U.alas.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.5 + Math.sin(t * (rapido ? 12 : 3)) * (rapido ? 0.5 : 0.12)); });
    if (U.alas) f.position.y += 0.4 + Math.sin(t * 2) * 0.1; // el búho flota un poco
    if (modo === 'saludar' || modo === 'alzar') { f.position.y += Math.abs(Math.sin(t * 5)) * 0.5; cabeza.rotation.z = Math.sin(t * 6) * 0.2; }
  };
  // Sora es un búho: mucho más pequeño que los demás personajes
  if (tipo === 'buho') { const peq = new THREE.Group(); peq.scale.setScalar(0.5); [...f.children].forEach(c => peq.add(c)); f.add(peq); }
  return sombra(f);
}

// ---------- personajes ----------
const PERSONAJES = {
  clarividente: () => figura({
    piel: '#f3d2b3', torso: '#e7b45c', brazos: '#e7b45c', falda: '#e9a24a', faldaRibete: '#1f6f6a',
    capa: '#1f6f6a', capaLarga: 2.6,
    cara: { ojos: 'cerrados', boca: 'serena', cejas: '#1a1418' },
    estampado: (x, w, h) => {
      x.fillStyle = '#1f6f6a'; x.beginPath(); x.moveTo(w / 2 - 50, 0); x.lineTo(w / 2 + 50, 0); x.lineTo(w / 2 + 26, h); x.lineTo(w / 2 - 26, h); x.fill();
      x.strokeStyle = '#f5d27a'; x.lineWidth = 6; x.stroke();
      gema(x, w / 2, 70, 16, '#3fd0c0'); gema(x, w / 2, 150, 12, '#3fd0c0');
      x.strokeStyle = '#f5d27a'; x.lineWidth = 5; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 70, 30); x.quadraticCurveTo(w / 2 + s * 100, 120, w / 2 + s * 60, 230); x.stroke(); }
    },
    pelo: () => { const g = peloMelena('#16131c', 0.9, false)(); g.add(capucha('#1f6f6a')()); return g; },
    poseDer: [1.1, 0.35], poseIzq: [0.35, 0.15],
    extra: (f) => {
      // el orbe va en la mano derecha: la sigue al andar o al usar la habilidad, y levita sobre la palma
      const orbe = new THREE.Mesh(new THREE.SphereGeometry(0.34, 24, 16), brillo('#5ff2e6', 2.2));
      orbe.position.set(0, -1.25, 0.6); f.userData.brazoDer.add(flotar(orbe, 0.07));
      orbe.add(luzFalsa('#5ff2e6', 2, 3));
      humo(f, '#4fe0d6', 0.9);
    },
  }),

  cronomante: () => figura({
    piel: '#efc29a', torso: '#f1dfb4', brazoIzq: '#9aa3ad', brazoDer: '#f1dfb4', piernas: ['#4a3426', '#4a3426'], cadera: '#5b3d2a', botas: '#6b4428',
    capa: '#6e4f9a', capaLarga: 2.4, manos: '#efc29a',
    cara: { boca: 'firme', barba: '#5a3a22', cejas: '#4a2e1a' },
    estampado: (x, w, h) => {
      x.fillStyle = '#6e4f9a'; x.beginPath(); x.moveTo(0, 0); x.lineTo(60, 0); x.lineTo(30, 120); x.lineTo(0, 140); x.fill();
      x.beginPath(); x.moveTo(w, 0); x.lineTo(w - 60, 0); x.lineTo(w - 30, 120); x.lineTo(w, 140); x.fill();
      x.fillStyle = '#5b3d2a'; x.fillRect(0, 175, w, 40);
      gema(x, w / 2, 195, 17, '#d23a3a'); gema(x, w / 2 - 70, 195, 8, '#3a7bd2'); gema(x, w / 2 + 70, 195, 8, '#3aa65a');
      gema(x, w / 2 - 42, 70, 9, '#c9479a'); gema(x, w / 2 + 42, 70, 9, '#c9479a');
      x.strokeStyle = '#d6b36a'; x.lineWidth = 4; x.beginPath(); x.moveTo(w / 2, 0); x.lineTo(w / 2, 175); x.stroke();
    },
    pelo: peloCorto('#6b4226'),
    poseDer: [1.25, 0.45], poseIzq: [1.25, 0.45],
    extra: (f) => {
      for (const s of [-1, 1]) {
        // una llama azul sobre cada mano: va con el brazo y levita por su cuenta
        const brazo = f.userData[s < 0 ? 'brazoIzq' : 'brazoDer'];
        const fuego = new THREE.Group();
        const llama = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.7, 12), brillo('#57c8ff', 2.4)); llama.position.y = 0.3; fuego.add(llama);
        const n = new THREE.Mesh(new THREE.SphereGeometry(0.2, 12, 10), brillo('#a9e6ff', 2)); fuego.add(n);
        fuego.position.set(0, -1.2, 0.55); fuego.rotation.x = brazo.rotation.x * -1; brazo.add(flotar(fuego, 0.08));
      }
      f.userData.brazoDer.children.at(-1).add(luzFalsa('#57c8ff', 3, 4));
    },
  }),

  centinela: () => figura({
    piel: '#8a5a3c', torso: '#b5332b', brazos: '#b5332b', piernas: ['#3a1e1e', '#3a1e1e'], cadera: '#7a2a24', botas: '#8f2a22', manos: '#8a5a3c',
    capa: '#c2402f', capaLarga: 2.3,
    cara: { boca: 'firme', cejas: '#1a1012' },
    estampado: (x, w, h) => {
      x.fillStyle = '#8f2620'; x.fillRect(0, 0, w, 30);
      x.strokeStyle = '#e2b453'; x.lineWidth = 7;
      x.beginPath(); x.moveTo(30, 40); x.quadraticCurveTo(w / 2, 120, w - 30, 40); x.stroke();
      x.beginPath(); x.moveTo(w / 2, 90); x.lineTo(w / 2, 230); x.stroke();
      x.fillStyle = '#e2b453'; x.fillRect(0, 200, w, 22);
      gema(x, w / 2, 210, 12, '#e8473a');
      x.strokeStyle = '#7a1f1a'; x.lineWidth = 4; for (const s of [-1, 1]) for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(w / 2 + s * 30, 120 + k * 25); x.lineTo(w / 2 + s * 100, 110 + k * 25); x.stroke(); }
    },
    pelo: () => {
      const g = peloCorto('#1c1210', false)();
      const mono = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 12), plastico('#1c1210')); mono.position.set(0, 0.45, -0.38); g.add(mono);
      return g;
    },
    poseIzq: [0.95, 0.1], poseDer: [0.6, 0.25],
    extra: (f) => {
      const lanza = new THREE.Group();
      const asta = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 5.4, 10), plastico('#6b4428')); lanza.add(asta);
      const punta = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.6, 4), plastico('#c9ced6', { metalness: 0.8, roughness: 0.25 })); punta.position.y = 2.95; lanza.add(punta);
      lanza.position.set(-0.75, 2.4, 0.9); lanza.rotation.x = 0.05; f.add(lanza);
      const escudo = new THREE.Group();
      const placaE = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.1, 6), plastico('#8f2a22')); placaE.rotation.x = Math.PI / 2; escudo.add(placaE);
      const ribete = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.05, 8, 6), plastico('#e2b453')); escudo.add(ribete);
      const g = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), plastico('#e2b453')); g.position.z = 0.07; escudo.add(g);
      escudo.position.set(1.25, 3.9, 0.5); escudo.rotation.y = -0.3; f.add(escudo);
    },
  }),

  ocultista: () => figura({
    piel: '#0b0d1a', torso: '#2b3f92', brazos: '#2b3f92', falda: '#2b3f92', faldaRibete: '#d6b05a', manos: '#efc29a',
    capa: '#22327a', capaLarga: 2.8,
    cara: { sombraTotal: true, ojosBrillo: '#8fd8ff' },
    estampado: (x, w, h) => {
      x.strokeStyle = '#d6b05a'; x.lineWidth = 6;
      x.beginPath(); x.moveTo(w / 2 - 70, 0); x.lineTo(w / 2, 110); x.lineTo(w / 2 + 70, 0); x.stroke();
      x.beginPath(); x.moveTo(w / 2, 110); x.lineTo(w / 2, h); x.stroke();
      gema(x, w / 2, 70, 11, '#4a8cff');
      for (let k = 0; k < 4; k++) { x.fillStyle = '#d6b05a'; x.beginPath(); x.arc(40 + k * 58, 230, 6, 0, Math.PI * 2); x.fill(); }
    },
    pelo: capucha('#2b3f92', '#0b0d1a', true),
    poseDer: [1.0, -0.15], poseIzq: [1.0, -0.15],
    extra: (f) => {
      const orbe = new THREE.Mesh(new THREE.SphereGeometry(0.3, 24, 16), brillo('#7fc6ff', 2.6)); orbe.position.set(0, 2.15, 1.05); f.add(flotar(orbe, 0.06)); f.userData.orbe = orbe;
      orbe.add(luzFalsa('#7fc6ff', 4, 4));
    },
  }),

  entusiasta: () => figura({
    piel: '#f3cba5', torso: '#e8457a', brazoIzq: '#7b3fb0', brazoDer: '#e8457a', piernas: ['#e8457a', '#7b3fb0'], cadera: '#3a8fd6', botas: null, manos: '#7b3fb0', puños: '#f2c230',
    cara: { boca: 'carcajada', cejas: '#a2401c', mejillas: true },
    estampado: (x, w, h) => {
      for (let k = 0; k < 4; k++) { x.fillStyle = k % 2 ? '#7b3fb0' : '#f2c230'; x.beginPath(); const cx = 40 + k * 58; x.moveTo(cx, 0); x.lineTo(cx + 29, 50); x.lineTo(cx, 80); x.lineTo(cx - 29, 50); x.fill(); }
      x.fillStyle = '#7b3fb0'; x.beginPath(); x.moveTo(w / 2, 100); x.lineTo(w, 100); x.lineTo(w, h); x.lineTo(w / 2, h); x.fill();
      x.fillStyle = '#3a8fd6'; x.fillRect(0, 205, w, 30);
    },
    pelo: () => {
      const g = new THREE.Group();
      const banda = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.2, 32), plastico('#f2c230')); banda.position.y = 0.33; g.add(banda);
      const base = new THREE.Mesh(new THREE.SphereGeometry(0.47, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), plastico('#7b3fb0')); base.position.y = 0.4; g.add(base);
      [[-1, '#e8457a'], [1, '#7b3fb0']].forEach(([s, c]) => {
        const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(0, 0.6, 0), new THREE.Vector3(s * 0.5, 1.05, 0), new THREE.Vector3(s * 1.0, 0.95, 0.05), new THREE.Vector3(s * 1.15, 0.55, 0.1)]);
        const tubo = new THREE.Mesh(new THREE.TubeGeometry(curva, 24, 0.17, 12), plastico(c)); g.add(tubo);
        const cascabel = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), plastico('#f2c230', { metalness: 0.6, roughness: 0.25 })); cascabel.position.set(s * 1.17, 0.4, 0.1); g.add(cascabel);
      });
      const mech = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.12, 0.15), plastico('#c4542a')); mech.position.set(0, 0.22, 0.4); g.add(mech);
      return g;
    },
    poseDer: [1.35, 0.6], poseIzq: [0.3, 0.45], paso: 0.35,
    extra: (f) => {
      const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.66, 0.16, 8), plastico('#f2c230')); collar.position.y = 2.93; f.add(collar);
    },
  }),

  cronista: () => figura({
    piel: '#f2c29c', torso: '#6b4a9a', brazos: '#6b4a9a', falda: '#2f8a7a', faldaRibete: '#e2b453', manos: '#f2c29c', puños: '#e2b453',
    capa: '#5b3d8f', capaLarga: 2.5,
    cara: { boca: 'sonrisa', cejas: '#9a2e14', mejillas: true },
    estampado: (x, w, h) => {
      x.fillStyle = '#2f8a7a'; x.beginPath(); x.moveTo(w / 2 - 46, 0); x.lineTo(w / 2 + 46, 0); x.lineTo(w / 2 + 30, h); x.lineTo(w / 2 - 30, h); x.fill();
      x.strokeStyle = '#e2b453'; x.lineWidth = 6; x.stroke();
      gema(x, w / 2, 60, 15, '#3fd0a0'); gema(x, w / 2, 140, 10, '#c9479a');
      x.fillStyle = '#e2b453'; x.fillRect(0, 200, w, 18);
    },
    pelo: () => {
      const g = peloCorto('#c8401e', false)(); const mt = plastico('#c8401e');
      for (let k = 0; k < 11; k++) { const a = -2.4 + k * 0.48; const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), mt); b.position.set(Math.sin(a) * 0.5, 0.25 + (k % 2) * 0.18, Math.cos(a) * 0.45 - 0.02); g.add(b); }
      return g;
    },
    poseIzq: [1.2, 0.2], poseDer: [0.9, 0.4],
    extra: (f) => {
      // libro abierto en la mano izquierda
      const libro = new THREE.Group();
      for (const s of [-1, 1]) {
        const tapa = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.06, 0.75), plastico('#7a3a1a')); tapa.position.x = s * 0.28; tapa.rotation.z = s * 0.18; libro.add(tapa);
        const hojas = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.68), plastico('#f4ead0')); hojas.position.set(s * 0.26, 0.06, 0); hojas.rotation.z = s * 0.18; libro.add(hojas);
      }
      libro.position.set(0, -1.3, 0.35); libro.rotation.x = 1.2; f.userData.brazoIzq.add(flotar(libro, 0.03));
    },
  }),

  aprendiz: () => figura({
    piel: '#f3cfae', torso: '#f1e3c4', brazos: '#ecdcb8', puños: '#2f8a7a', piernas: ['#6b4a2a', '#6b4a2a'], cadera: '#5b3d2a', botas: '#7a4a24', manos: '#f3cfae',
    capa: '#d4572a', capaLarga: 1.7,
    cara: { boca: 'sonrisa', cejas: '#5a2a6a', gafas: true },
    estampado: (x, w, h) => {
      x.fillStyle = '#d4572a'; x.beginPath(); x.moveTo(0, 0); x.lineTo(w, 0); x.lineTo(w, 40); x.quadraticCurveTo(w / 2, 110, 0, 40); x.fill();
      x.fillStyle = '#3f8a5a'; x.fillRect(20, 60, 50, 140); x.fillRect(w - 70, 60, 50, 140);
      gema(x, w / 2, 70, 15, '#3fd0c0');
      x.fillStyle = '#6b4428'; x.fillRect(0, 195, w, 26); x.fillStyle = '#8a5a30'; x.fillRect(150, 205, 40, 40);
      x.fillStyle = '#e2b453'; x.fillRect(116, 198, 24, 20);
    },
    pelo: () => { const g = peloCorto('#7b3fa0', true)(); const f = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.18, 0.2), plastico('#7b3fa0')); f.position.set(-0.05, 0.38, 0.38); f.rotation.set(-0.3, 0, 0.2); g.add(f); return g; },
    poseDer: [1.0, 0.55], poseIzq: [0.9, 0.55],
    extra: (f) => {
      for (let k = 0; k < 6; k++) { // hojas de papel revoloteando
        const a = k / 6 * Math.PI * 2, hoja = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.6, 0.03), plastico('#f6efdc'));
        hoja.position.set(Math.cos(a) * 1.5, 1.2 + (k % 3) * 1.0, Math.sin(a) * 0.9); hoja.rotation.set(a, a * 2, a); f.add(flotar(hoja, 0.25)); (f.userData.hojas ||= []).push(hoja);
      }
    },
  }),

  picaro: () => figura({
    piel: '#f3cfae', torso: '#2a5c9a', brazos: '#2a5c9a', piernas: ['#26262e', '#26262e'], cadera: '#5b3d2a', botas: null, manos: '#f3cfae', puños: '#1f467a',
    capa: '#33363f', capaLarga: 2.1,
    cara: { boca: 'firme', cejas: '#b8862a' },
    estampado: (x, w, h) => {
      x.fillStyle = '#3a72b8'; x.beginPath(); x.moveTo(w / 2 - 70, 0); x.lineTo(w / 2, 120); x.lineTo(w / 2 + 70, 0); x.fill();
      x.strokeStyle = '#d6b05a'; x.lineWidth = 4; for (let k = 0; k < 3; k++) { x.beginPath(); x.moveTo(30, 150 + k * 12); x.lineTo(70, 130 + k * 12); x.lineTo(110, 150 + k * 12); x.stroke(); }
      x.strokeStyle = '#1f3a66'; x.lineWidth = 5; x.beginPath(); x.moveTo(w / 2, 120); x.lineTo(w / 2, h); x.stroke();
      x.fillStyle = '#6b4428'; x.fillRect(0, 205, w, 24);
    },
    pelo: () => { const g = peloCorto('#f0c24a', true)(); const cap = new THREE.Mesh(new THREE.SphereGeometry(0.42, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), plastico('#2a5c9a')); cap.position.set(0, -0.4, -0.42); cap.rotation.x = -1.4; g.add(cap); return g; },
    poseDer: [1.15, 0.3], poseIzq: [0.2, 0.12],
    extra: (f) => {
      // pies descalzos
      f.userData.piernas.forEach(p => { const pie = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.72), plastico('#f3cfae')); pie.position.set(0, -1.2, 0.1); p.add(pie); });
    },
  }),

  maestro: () => figura({
    piel: '#f3d2b3', torso: '#ecd39a', brazos: '#ecd39a', falda: '#e8c27a', faldaRibete: '#a8322a', manos: '#f3d2b3', puños: '#b8862a',
    capa: '#a8322a', capaLarga: 2.9,
    cara: { boca: 'firme', cejas: '#b8862a' },
    estampado: (x, w, h) => {
      x.fillStyle = '#a8322a'; x.fillRect(0, 0, 44, h); x.fillRect(w - 44, 0, 44, h);
      x.strokeStyle = '#b8862a'; x.lineWidth = 5; for (const s of [-1, 1]) { x.beginPath(); x.moveTo(w / 2 + s * 20, 10); x.quadraticCurveTo(w / 2 + s * 70, 100, w / 2 + s * 30, 200); x.stroke(); }
      gema(x, w / 2, 60, 15, '#d23a3a'); gema(x, w / 2, 120, 10, '#3aa65a'); gema(x, w / 2 - 50, 150, 8, '#3a7bd2'); gema(x, w / 2 + 50, 150, 8, '#c9479a');
      x.fillStyle = '#7a4a24'; x.fillRect(0, 200, w, 22); gema(x, w / 2, 211, 9, '#e2b453');
    },
    pelo: peloCorto('#f0c24a', false),
    poseDer: [0.95, 0.55], poseIzq: [0.95, 0.55],
    extra: (f) => {
      ['#e84a4a', '#3fbf6b', '#3a8fd6', '#9a5ad6', '#f2c230', '#ff8f3a'].forEach((c, k) => {
        const s = k < 3 ? -1 : 1, j = k % 3; const o = new THREE.Mesh(new THREE.SphereGeometry(0.16, 14, 10), brillo(c, 1.3));
        o.position.set(s * (1.1 + j * 0.35), 2.6 + j * 0.45, 0.6); f.add(flotar(o, 0.14));
      });
      const hombreras = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.68, 0.18, 8), plastico('#b8862a')); hombreras.position.y = 2.93; f.add(hombreras);
    },
  }),

  metamorfo: () => figura({
    piel: '#f6d6c8', torso: '#f5b8b0', brazos: '#f7c4b4', falda: '#86cbe0', faldaRibete: '#f59ab0', manos: '#f6d6c8', puños: '#86cbe0',
    capa: '#f7a6b8', capaLarga: 2.8,
    cara: { ojos: 'cerrados', boca: 'serena', cejas: '#d87aa0' },
    estampado: (x, w, h) => {
      x.fillStyle = '#86cbe0'; x.beginPath(); x.moveTo(w / 2 - 50, 0); x.lineTo(w / 2 + 50, 0); x.lineTo(w / 2 + 34, h); x.lineTo(w / 2 - 34, h); x.fill();
      x.strokeStyle = '#e2b453'; x.lineWidth = 5; x.stroke();
      gema(x, w / 2, 60, 14, '#f06aa8'); gema(x, w / 2, 130, 9, '#5fb8ff');
      x.fillStyle = '#c87a5a'; x.fillRect(0, 205, w, 16);
    },
    pelo: peloMelena('#f6b6c8', 1.45, false),
    poseDer: [0.8, 0.55], poseIzq: [0.8, 0.55],
    extra: (f) => { humo(f, '#ff8ad8', 0.9); },
  }),

  // ---------- animales: no tienen habilidad, cuentan para las invocaciones ----------
  reena: () => animal('perro'),
  sora: () => animal('buho'),
  lumo: () => animal('cervato'),

  estratega: () => figura({
    piel: '#f6d6bd', torso: '#f2a77a', brazos: '#f6b994', falda: '#f2a77a', faldaRibete: '#d9744a',
    cara: { ojos: 'cerrados', boca: 'serena', cejas: '#b8552c' },
    estampado: (x, w, h) => {
      x.fillStyle = '#f6c9a8'; x.beginPath(); x.moveTo(w / 2 - 80, 0); x.quadraticCurveTo(w / 2, 90, w / 2 + 80, 0); x.fill();
      x.strokeStyle = '#d9744a'; x.lineWidth = 5; x.beginPath(); x.moveTo(w / 2, 60); x.lineTo(w / 2, h); x.stroke();
      gema(x, w / 2, 60, 13, '#2f9b5b'); gema(x, w / 2, 130, 9, '#2f9b5b'); gema(x, w / 2, 190, 9, '#2f9b5b');
      x.fillStyle = '#c55d36'; x.fillRect(0, 225, w, 14);
    },
    pelo: peloMelena('#e0703a', 1.45, false),
    poseDer: [0.7, 0.55], poseIzq: [0.7, 0.55],
    extra: (f) => {
      const colores = ['#e84a4a', '#f2c230', '#3fbf6b', '#3a8fd6', '#9a5ad6', '#ff8f3a', '#5fe0e6'];
      colores.forEach((c, k) => {
        const a = Math.PI * (0.05 + 0.9 * k / (colores.length - 1));
        const o = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), brillo(c, 1.3));
        o.position.set(Math.cos(a) * 1.45, 3.4 + Math.sin(a) * 1.2, 0.2); f.add(flotar(o, 0.13));
        (f.userData.orbes ||= []).push(o);
      });
    },
  }),
};

function humo(f, color, op) {
  for (let k = 0; k < 9; k++) {
    const r = new THREE.Mesh(new THREE.TorusGeometry(0.25 + 0.05 * (k % 3), 0.06, 8, 20, Math.PI * 1.2), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.9, transparent: true, opacity: op * 0.6 }));
    const a = k / 9 * Math.PI * 2;
    r.position.set(Math.cos(a) * 1.25, 1.2 + (k % 4) * 0.7, Math.sin(a) * 0.6 - 0.1);
    r.rotation.set(a, a * 2, a);
    f.add(r);
  }
}

// La mano de cada jugador, junto a su Portal: un personaje que ven los demás y uno encapuchado
// (el que solo ve su dueña). Los demás nunca ven qué hay bajo la capucha.
function encapuchado() {
  const g = new THREE.Group();
  const cuerpo = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 1.25, 3.4, 6), plastico('#2a2c58')); cuerpo.position.y = 1.7; g.add(cuerpo);
  const cap = new THREE.Mesh(new THREE.ConeGeometry(0.85, 1.7, 6), plastico('#3a3e7a')); cap.position.y = 4.05; g.add(cap);
  const borde = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 6, 6), plastico('#6a6eb0')); borde.position.set(0, 3.55, 0.58); borde.rotation.x = -0.25; g.add(borde);
  const hueco = new THREE.Mesh(new THREE.CylinderGeometry(0.44, 0.44, 0.1, 6), plastico('#05050c')); hueco.rotation.x = Math.PI / 2 - 0.25; hueco.position.set(0, 3.55, 0.6); g.add(hueco);
  for (const sx of [-1, 1]) { const o = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.07, 0.05), brillo('#b8c0ff', 1.6)); o.position.set(sx * 0.15, 3.6, 0.67); g.add(o); }
  const ribete = new THREE.Mesh(new THREE.CylinderGeometry(1.27, 1.27, 0.14, 6), plastico('#6a6eb0')); ribete.position.y = 0.07; g.add(ribete);
  return sombra(g);
}
// ---------- las invocaciones ----------
// Los colores y adornos siguen a los modelos del Escenario (js/personajes3d/modelos.js).
// Cilast, Burnio y Aspir aún no tienen arte: su aspecto es una propuesta.
const CRIATURAS = {
  cilast: { nombre: 'Cilast', set: 'Introductorio', need: ['reena', 'picaro', 'sora'], gemas: 5, c: '#4ab0ff', c2: '#d4f0ff', osc: '#1a5a9a', cabeza: 'orejas', hombros: 'plumas', manto: true, flotan: 'plumas' },
  burnio: { nombre: 'Burnio', set: 'Introductorio', need: ['aprendiz', 'cronista', 'lumo'], gemas: 5, c: '#ff7a2a', c2: '#ffd27a', osc: '#8a3010', cabeza: 'astas', hombros: 'hojas', falda: 'llamas', flotan: 'brasas' },
  aspir: { nombre: 'Aspir', set: 'Introductorio', need: ['cronomante', 'estratega', 'sora'], gemas: 5, c: '#3fd0c0', c2: '#e0fff8', osc: '#146a6a', cabeza: 'remolino', alas: 'aire', flotan: 'anillos' },
  cirelia: { nombre: 'Cirelia', set: 'Normal', need: ['aprendiz', 'picaro', 'centinela'], gemas: 5, c: '#ffc94a', c2: '#fff3c0', osc: '#e08a20', cabeza: 'llamas', halo: true, falda: 'llamas', flotan: 'brasas' },
  baelorith: { nombre: 'Baelorith', set: 'Normal', need: ['estratega', 'cronomante', 'cronista'], gemas: 5, c: '#d8284a', c2: '#ffb0c0', osc: '#8a1030', cabeza: 'puas', hombros: 'puas', espada: true, manto: true, flotan: 'cristales' },
  aelgorth: { nombre: 'Aelgorth', set: 'Normal', need: ['clarividente', 'maestro', 'ocultista'], gemas: 5, c: '#6a4ae0', c2: '#c8b8ff', osc: '#2a1a80', cabeza: 'vacio', nucleo: true, manto: true, flotan: 'estrellas' },
  caisis: { nombre: 'Caisis', set: 'Floral', need: ['cronista', 'ocultista', 'centinela'], gemas: 5, c: '#ffd23a', c2: '#fff2a0', osc: '#e0a010', cabeza: 'girasol', hombros: 'hojas', falda: 'petalos', flotan: 'petalos' },
  brose: { nombre: 'Brose', set: 'Floral', need: ['aprendiz', 'maestro', 'estratega'], gemas: 5, c: '#e0283a', c2: '#ff9aa8', osc: '#9a1020', cabeza: 'capullo', hombros: 'hojas', falda: 'petalos', flotan: 'petalos' },
  aures: { nombre: 'Aures', set: 'Floral', need: ['picaro', 'clarividente', 'cronomante'], gemas: 5, c: '#8a6ae8', c2: '#d8c8ff', osc: '#4a30b0', cabeza: 'lirio', falda: 'petalos', manto: true, flotan: 'petalos' },
  madain: { nombre: 'Madain', set: 'Cuarta invocación', need: ['reena', 'metamorfo', 'sora', 'lumo'], gemas: 5, c: '#f4eefe', c2: '#ffffff', osc: '#b8a8e8', cabeza: 'luz', halo: true, nucleo: true, alas: 'plumas', flotan: 'gemas', gema: '*' },
};
const VERDE = '#3f9a4a';

// Una criatura de bloques: el mismo cuerpo para todas y los adornos de cada una
function criaturaBloques(D) {
  const g = new THREE.Group();
  const em = (c, i) => ({ emissive: c, emissiveIntensity: i });
  const cuerpo = plastico(D.c, em(D.osc, 0.45));
  const claro = plastico(D.c2, em(D.c, 0.55));
  const oscuro = plastico(D.osc, em(D.osc, 0.3));
  const cristal = new THREE.MeshStandardMaterial({ color: D.c2, emissive: D.c, emissiveIntensity: 0.9, transparent: true, opacity: 0.8, roughness: 0.1, flatShading: true });
  const hoja = plastico(VERDE, em('#1a5a20', 0.3));
  const add = (geo, mat, x, y, z, padre = g) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); padre.add(m); return m; };
  const cono = (r, h, mat, x, y, z, rz = 0, rx = 0, padre = g) => { const c = add(new THREE.ConeGeometry(r, h, 4), mat, x, y, z, padre); c.rotation.set(rx, 0, rz); return c; };
  // piernas que acaban en punta (flota), cinturón y torso con cristales
  for (const s of [-1, 1]) add(new THREE.CylinderGeometry(0.45, 0.1, 3.2, 4), cuerpo, s * 0.55, 2.0, 0).rotation.y = Math.PI / 4;
  add(new THREE.BoxGeometry(2.0, 0.5, 1.0), oscuro, 0, 3.7, 0);
  add(trapecio(1.6, 2.8, 2.6, 1.2), cuerpo, 0, 5.2, 0);
  if (D.nucleo) { const n = add(new THREE.OctahedronGeometry(0.55), D.gema ? arcoiris() : brillo(D.c2, 2), 0, 5.3, 0.62); n.scale.set(1, 1.3, 0.6); flotar(n, 0.05); }
  else for (const [x, y] of [[0, 5.4], [-0.55, 5.9], [0.55, 5.9], [0, 4.5]]) add(new THREE.OctahedronGeometry(0.28), cristal, x, y, 0.62).scale.set(1, 1.5, 0.6);
  // hombros
  for (const s of [-1, 1]) {
    if (D.hombros === 'puas') for (let i = 0; i < 3; i++) cono(0.28, 1.3 - i * 0.25, i ? oscuro : cuerpo, s * (1.5 + i * 0.3), 6.6 - i * 0.15, 0, -s * (0.4 + i * 0.4));
    if (D.hombros === 'hojas') for (let i = 0; i < 2; i++) { const h = add(new THREE.BoxGeometry(1.5, 0.12, 0.7), hoja, s * (1.7 + i * 0.4), 6.4 - i * 0.35, 0); h.rotation.z = -s * (0.35 + i * 0.3); }
    if (D.hombros === 'plumas') for (let i = 0; i < 3; i++) { const p = add(new THREE.BoxGeometry(0.35, 1.5 - i * 0.3, 0.12), i % 2 ? claro : cuerpo, s * (1.45 + i * 0.32), 6.5 - i * 0.2, 0); p.rotation.z = -s * (0.6 + i * 0.35); }
  }
  // brazos abiertos con manos en C
  const brazos = [];
  for (const s of [-1, 1]) {
    const b = new THREE.Group(); b.position.set(s * 1.55, 6.2, 0); g.add(b); brazos.push(b);
    add(new THREE.CylinderGeometry(0.3, 0.24, 2.6, 4), cuerpo, 0, -1.3, 0, b).rotation.y = Math.PI / 4;
    const mano = add(new THREE.TorusGeometry(0.35, 0.16, 8, 12, Math.PI * 1.45), claro, 0, -2.75, 0, b); mano.rotation.set(0, Math.PI / 2, Math.PI * 0.77);
    b.rotation.z = s * 0.7; b.rotation.x = -0.4;
  }
  // cabeza
  add(new THREE.CylinderGeometry(0.3, 0.3, 0.3, 6), oscuro, 0, 6.65, 0);
  const H = D.cabeza;
  if (H === 'capullo') { // Brose: sin cabeza, un capullo de rosa de pétalos enrollados
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; const p = add(new THREE.CylinderGeometry(0.5, 0.25, 1.6, 6, 1, true, 0, Math.PI), i % 2 ? cuerpo : claro, Math.cos(a) * 0.25, 7.5, Math.sin(a) * 0.25); p.rotation.y = -a; p.material = p.material.clone(); p.material.side = THREE.DoubleSide; }
    add(new THREE.SphereGeometry(0.45, 6, 4), cuerpo, 0, 7.9, 0);
    for (const s of [-1, 1]) { const h = add(new THREE.BoxGeometry(1.0, 0.1, 0.5), hoja, s * 0.6, 6.9, 0); h.rotation.z = s * 0.5; }
  } else if (H === 'girasol') { // Caisis: cara de girasol con pétalos
    const disco = add(new THREE.CylinderGeometry(0.75, 0.75, 0.35, 6), plastico('#6b4428'), 0, 7.6, 0.1); disco.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const p = add(new THREE.BoxGeometry(0.4, 1.0, 0.12), i % 2 ? cuerpo : claro, Math.cos(a) * 1.15, 7.6 + Math.sin(a) * 1.15, 0.05); p.rotation.z = a - Math.PI / 2; }
  } else if (H === 'luz') { // Madain: cabeza de luz blanca con corona de rayos
    const c = add(new THREE.CylinderGeometry(0.75, 0.75, 1.25, 6), brillo('#ffffff', 2.5), 0, 7.45, 0); flotar(c, 0.04);
  } else {
    const cab = add(new THREE.CylinderGeometry(0.7, 0.7, 1.2, 6), H === 'vacio' ? plastico('#1a1040', em('#2a1a80', 0.4)) : claro, 0, 7.4, 0);
    if (H === 'vacio') { const ojo = add(new THREE.OctahedronGeometry(0.3), brillo(D.c2, 2.2), 0, 7.45, 0.68); ojo.scale.set(1.4, 0.7, 0.5); }
    else add(new THREE.OctahedronGeometry(0.22), cristal, 0, 7.55, 0.66);
    if (H === 'puas') { cono(0.22, 2.0, cuerpo, 0, 8.9, 0); for (const s of [-1, 1]) for (let i = 0; i < 3; i++) cono(0.16, 1.4 - i * 0.3, i ? oscuro : cuerpo, s * (0.25 + i * 0.25), 8.4 - i * 0.12, 0, -s * (0.35 + i * 0.35)); }
    if (H === 'llamas') for (let i = 0; i < 7; i++) { const a = (i - 3) * 0.32; cono(0.2, 1.1 + (3 - Math.abs(i - 3)) * 0.35, i % 2 ? claro : cuerpo, Math.sin(a) * 0.7, 8.3 + Math.cos(a) * 0.2, 0, -a); }
    if (H === 'lirio') for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; const p = add(new THREE.BoxGeometry(0.6, 1.9, 0.12), i % 2 ? cuerpo : claro, Math.cos(a) * 0.55, 8.6, Math.sin(a) * 0.55); p.rotation.set(Math.sin(a) * 0.55, -a, -Math.cos(a) * 0.55); }
    if (H === 'orejas') for (const s of [-1, 1]) { cono(0.3, 1.9, cuerpo, s * 0.55, 8.6, 0, -s * 0.35); cono(0.16, 1.2, claro, s * 0.55, 8.4, 0.12, -s * 0.35); }
    if (H === 'astas') for (const s of [-1, 1]) {
      const a = add(new THREE.CylinderGeometry(0.1, 0.13, 1.6, 6), oscuro, s * 0.55, 8.6, 0); a.rotation.z = -s * 0.45;
      for (let i = 0; i < 2; i++) cono(0.14, 0.9, claro, s * (0.95 + i * 0.3), 8.9 + i * 0.45, 0, -s * (0.9 - i * 0.5));
      cono(0.16, 0.9, cuerpo, s * 0.95, 9.5, 0, -s * 0.2);
    }
    if (H === 'remolino') { const r = add(new THREE.TorusGeometry(1.05, 0.09, 6, 6), brillo(D.c2, 1.5), 0, 7.4, 0); r.rotation.x = Math.PI / 2.4; g.userData.gira = r; cono(0.3, 1.4, cuerpo, 0, 8.6, 0); }
  }
  // halo de rayos tras la cabeza
  if (D.halo) for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2; const r = add(new THREE.BoxGeometry(0.16, 0.9 + (i % 2) * 0.5, 0.08), brillo(D.gema ? '#fff6c8' : D.c, 1.6), Math.cos(a) * 1.6, 7.6 + Math.sin(a) * 1.6, -0.5); r.rotation.z = a - Math.PI / 2; }
  // falda
  if (D.falda) for (let i = 0; i < 10; i++) {
    const a = i / 10 * Math.PI * 2, x = Math.cos(a) * 1.2, z = Math.sin(a) * 0.7;
    if (D.falda === 'llamas') { const c = cono(0.32, 1.6 + (i % 3) * 0.4, i % 2 ? claro : cuerpo, x, 3.0, z, 0, Math.PI); c.rotation.z = -Math.cos(a) * 0.3; c.rotation.x = Math.PI + Math.sin(a) * 0.3; }
    else { const p = add(new THREE.BoxGeometry(0.75, 1.9, 0.14), i % 2 ? claro : cuerpo, x, 2.8, z); p.rotation.set(Math.sin(a) * 0.35, -a + Math.PI / 2, 0); }
  }
  // espada clavada delante
  if (D.espada) {
    const esp = new THREE.Group(); esp.position.set(0, 0, 1.4); g.add(esp);
    add(new THREE.BoxGeometry(0.28, 3.6, 0.1), cristal, 0, 2.2, 0, esp);
    add(new THREE.ConeGeometry(0.2, 0.6, 4), cristal, 0, 0.1, 0, esp).rotation.x = Math.PI;
    add(new THREE.BoxGeometry(1.4, 0.22, 0.3), oscuro, 0, 4.05, 0, esp);
    add(new THREE.BoxGeometry(0.22, 0.9, 0.22), oscuro, 0, 4.6, 0, esp);
    add(new THREE.OctahedronGeometry(0.22), cristal, 0, 5.2, 0, esp);
  }
  // manto de dos paños
  if (D.manto) for (const s of [-1, 1]) {
    const forma = new THREE.Shape(); forma.moveTo(0, 0); forma.lineTo(s * 1.0, 0); forma.lineTo(s * 2.6, -5.2); forma.lineTo(s * 0.2, -5.6); forma.closePath();
    const ala = add(new THREE.ExtrudeGeometry(forma, { depth: 0.08, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: D.c, emissive: D.osc, emissiveIntensity: 0.5, transparent: true, opacity: 0.85, side: THREE.DoubleSide }), s * 0.3, 6.5, -0.7);
    ala.rotation.x = 0.18;
  }
  // alas: de plumas (Madain, un lado frío y otro cálido) o de aire (Aspir)
  if (D.alas) {
    g.userData.alas = [];
    for (const s of [-1, 1]) {
      const ala = new THREE.Group(); ala.position.set(s * 0.8, 6.3, -0.6); g.add(ala); g.userData.alas.push(ala);
      const cols = D.alas === 'plumas' ? (s < 0 ? ['#bfe6ff', '#8ac8ff', '#e6f6ff'] : ['#ffe2b0', '#ffb8d0', '#fff2dc']) : [D.c, D.c2, D.c];
      for (let i = 0; i < 6; i++) {
        const largo = 3.4 - Math.abs(i - 1.5) * 0.45;
        const p = add(new THREE.BoxGeometry(0.5, largo, 0.1), D.alas === 'aire' ? new THREE.MeshStandardMaterial({ color: cols[i % 3], emissive: D.c, emissiveIntensity: 0.6, transparent: true, opacity: 0.6 }) : plastico(cols[i % 3], em(cols[i % 3], 0.35)), s * (0.6 + i * 0.55), 0.6 + i * 0.15, 0, ala);
        p.rotation.z = -s * (0.2 + i * 0.28); p.geometry.translate(0, largo / 2, 0);
      }
    }
  }
  // lo que flota a su alrededor
  const N = D.flotan === 'gemas' ? 7 : 8;
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2; let c;
    const ARCO = ['#e84a4a', '#f2c230', '#3fbf6b', '#3a8fd6', '#9a5ad6', '#ff8f3a', '#5ff2e6'];
    if (D.flotan === 'gemas') { c = add(new THREE.OctahedronGeometry(0.3), plastico(ARCO[i], em(ARCO[i], 0.8)), (i / (N - 1) - 0.5) * 7, 6.5 + Math.sin(i / (N - 1) * Math.PI) * 4, -0.9); c.scale.y = 1.5; }
    else if (D.flotan === 'estrellas') { c = add(new THREE.OctahedronGeometry(0.16), brillo('#ffffff', 2), Math.cos(a) * 2.8, 2.5 + (i % 4) * 1.4, Math.sin(a) * 1.6); }
    else if (D.flotan === 'petalos' || D.flotan === 'plumas') { c = add(new THREE.BoxGeometry(0.35, 0.08, 0.6), i % 2 ? claro : (D.flotan === 'petalos' ? cuerpo : hoja), Math.cos(a) * 2.8, 2.5 + (i % 4) * 1.3, Math.sin(a) * 1.5); c.rotation.set(a, a, 0); if (D.flotan === 'plumas') c.material = claro; }
    else if (D.flotan === 'brasas') { c = add(new THREE.BoxGeometry(0.25, 0.25, 0.25), brillo(i % 2 ? D.c : D.c2, 1.8), Math.cos(a) * 2.6, 2.4 + (i % 4) * 1.4, Math.sin(a) * 1.4); }
    else if (D.flotan === 'anillos') { c = add(new THREE.TorusGeometry(0.3, 0.06, 6, 6), brillo(D.c2, 1.5), Math.cos(a) * 2.7, 2.5 + (i % 4) * 1.3, Math.sin(a) * 1.5); }
    else { c = add(new THREE.OctahedronGeometry(0.2), cristal, Math.cos(a) * 2.6, 2.5 + (i % 4) * 1.3, Math.sin(a) * 1.4); c.scale.y = 1.6; }
    flotar(c, 0.25);
  }
  g.userData.brazos = brazos;
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
// Un material tornasolado para el corazón de Madain
function arcoiris() {
  const t = lienzo(64, 64, (x) => { const gr = x.createLinearGradient(0, 0, 64, 64); ['#ff6a6a', '#ffd86a', '#6aff9a', '#6ac8ff', '#c86aff'].forEach((col, i) => gr.addColorStop(i / 4, col)); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); });
  return new THREE.MeshStandardMaterial({ map: t, emissive: '#ffffff', emissiveMap: t, emissiveIntensity: 0.9, roughness: 0.1 });
}
// ---------------------------------------------------------------- adaptador
// Lo de arriba son las piezas de la maqueta (unidades de la maqueta: una
// figura mide ~4,1). Aquí se montan con el esqueleto que espera el Escenario.

// Orbes, llamas y chispas que levitan por su cuenta.
let quitarBucle = null, cuenta = 0;
function arrancarFlotantes() {
  quitarBucle ??= siempreReal((dt, t) => {
    moverFlotantes(t);
    if (++cuenta % 240 === 0) {   // de vez en cuando, se olvidan los que ya no están en escena
      for (let i = FLOTANTES.length - 1; i >= 0; i--) { let o = FLOTANTES[i]; while (o.parent) o = o.parent; if (!o.isScene) FLOTANTES.splice(i, 1); }
    }
  });
}

const ESCALA = 0.42;                  // figura de la maqueta → altura de un personaje del Escenario
const ESCALA_CRIATURA = 0.5;
const ESCALA_PORTAL = 0.42;
const ID = { 'Clarividente': 'clarividente', 'Cronomante': 'cronomante', 'Centinela': 'centinela', 'Ocultista': 'ocultista', 'Entusiasta': 'entusiasta',
  'Estratega': 'estratega', 'Cronista': 'cronista', 'Aprendiz': 'aprendiz', 'Pícaro': 'picaro', 'Maestro': 'maestro', 'Metamorfo': 'metamorfo',
  'Reena': 'reena', 'Sora': 'sora', 'Lumo': 'lumo' };
const vacio = () => new THREE.Object3D();
const altoDe = (o) => new THREE.Box3().setFromObject(o).max.y;

function humanoBloques(id) {
  const f = PERSONAJES[id](), U = f.userData;
  const raiz = new THREE.Group(); raiz.add(f); raiz.scale.setScalar(ESCALA);
  const alto = altoDe(f) * ESCALA;
  // Cintura: todo lo de arriba (torso, brazos, cabeza, capa…) gira desde aquí.
  const torso = new THREE.Group(); torso.position.y = 1.45; f.add(torso); f.updateMatrixWorld(true);
  for (const o of [...f.children]) if (o !== torso && !U.piernas.includes(o) && !(o.isMesh && o.position.y < 1.5)) torso.attach(o);
  // Lado I = +x (izquierda de la figura), como en modelos.js.
  const bI = U.brazoDer, bD = U.brazoIzq;
  const art = { cadera: vacio(), torso, cabeza: U.cabeza, brazoI: bI, brazoD: bD, codoI: vacio(), codoD: vacio(),
    manoI: bI.userData.mano, manoD: bD.userData.mano, telas: [], flotantes: [], pelo: [] };
  if (U.piernas.length === 2) Object.assign(art, { piernaI: U.piernas[1], piernaD: U.piernas[0], rodillaI: vacio(), rodillaD: vacio(), tobilloI: vacio(), tobilloD: vacio() });
  return { raiz, art, tipo: 'humano', alto, sinCodo: true, M: c => plastico(c) };
}

function animalBloques(id) {
  const f = PERSONAJES[id](), U = f.userData;
  const raiz = new THREE.Group(); raiz.add(f); raiz.scale.setScalar(ESCALA);
  const alto = altoDe(f) * ESCALA;
  delete U.extraAnim;
  if (U.alas) return { raiz, tipo: 'ave', alto, art: { cabeza: U.cabeza, torso: vacio(), alas: [U.alas[1], U.alas[0]], telas: [], flotantes: [], pelo: [] } };
  return { raiz, tipo: 'cuadrupedo', alto, art: { cabeza: U.cabeza, torso: vacio(), patas: U.piernas, cola: U.cola ?? vacio(), telas: [], flotantes: [], pelo: [] } };
}

function criaturaBloquesEscenario(nombre) {
  const D = CRIATURAS[nombre.toLowerCase()]; if (!D) return null;
  const g = criaturaBloques(D);
  const raiz = new THREE.Group(); raiz.add(g); raiz.scale.setScalar(ESCALA_CRIATURA);
  const [bD, bI] = g.userData.brazos;   // [-x, +x]
  const manoDe = b => { const m = vacio(); m.position.y = -2.75; b.add(m); return m; };
  const art = { torso: vacio(), cabeza: vacio(), brazoI: bI, brazoD: bD, codoI: vacio(), codoD: vacio(), manoI: manoDe(bI), manoD: manoDe(bD), telas: [], flotantes: [], pelo: [] };
  return { raiz, art, tipo: 'criatura', alto: 9 * ESCALA_CRIATURA, sinCodo: true, color: new THREE.Color(D.c).getHex(), color2: new THREE.Color(D.c2).getHex(), M: c => plastico(c) };
}

function construirModeloBloques(nombre) {
  if (!nombre || nombre.startsWith('lamina:')) return null;
  arrancarFlotantes();
  let m = null;
  if (ID[nombre]) m = PERSONAJES[ID[nombre]] && (['reena', 'sora', 'lumo'].includes(ID[nombre]) ? animalBloques(ID[nombre]) : humanoBloques(ID[nombre]));
  else m = criaturaBloquesEscenario(nombre);
  if (m) { m.nombre = nombre; m.raiz.traverse(o => { if (o.isMesh) o.receiveShadow = false; }); }
  return m;
}

/** Portal de ladrillos con la interfaz de portales.js (brillo de las runas, tono, variante). */
const ALTURA_TARIMA = 0.32;
function crearPortalBloques(v, semilla = 1) {
  arrancarFlotantes();
  const color = '#' + new THREE.Color(v.tono).getHexString();
  const interior = fundir(portal(color, semilla % 3));
  interior.scale.setScalar(ESCALA_PORTAL);
  interior.position.y = ALTURA_TARIMA - ALTO * ESCALA_PORTAL;   // la tarima queda a la altura de la del Escenario
  const g = new THREE.Group(); g.add(interior);
  const runas = interior.userData.runas;
  g.userData = { brillo: 0.6, brilloAhora: 0.6, tono: v.tono, variante: v };
  let visto = false;
  const parar = siempreReal((dt, t) => {
    if (!g.parent) { if (visto) parar(); return; }
    visto = true;
    const d = g.userData; d.brilloAhora += (d.brillo - d.brilloAhora) * Math.min(1, dt * 5);
    const k = Math.min(1, d.brilloAhora * (0.85 + Math.sin(t * 2.2 + semilla) * 0.15) * 1.25);
    for (const r of runas) r.material.opacity = k;
  });
  return g;
}

// Colores básicos de la placa (sin horas del día, cielo ni clima: Julio, 2026-11-16).
const PLACAS = [['verde', '#4f8a4b', 'Verde'], ['azul', '#3a6fc0', 'Azul'], ['rojo', '#b8403a', 'Rojo'], ['amarillo', '#e0b830', 'Amarillo'],
  ['naranja', '#e07a2a', 'Naranja'], ['morado', '#7a4ab0', 'Morado'], ['gris', '#8a8a96', 'Gris'], ['blanco', '#e8e6e0', 'Blanco'], ['negro', '#2e2e36', 'Negro'], ['marron', '#7a5534', 'Marrón']];

/** La mesa: una gran placa de color con tetones hexagonales. */
function crearSuelo(color) {
  const g = new THREE.Group();
  const lado = 100, p = placa(lado, lado, color);
  p.scale.setScalar(ESCALA); p.position.y = -0.03; g.add(p);
  p.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}

/** Ambiente fijo: luz de día limpia, fondo liso y la placa del color elegido. */
function montarAmbiente({ raiz, mundo, cfg }) {
  const color = (PLACAS.find(([k]) => k === cfg.placa) ?? PLACAS[0])[1];
  const fondo = new THREE.Color(color).lerp(new THREE.Color('#dfe9f5'), 0.72);
  mundo.escena.background = fondo; mundo.escena.fog.color.copy(fondo);
  const { hemi, sol } = mundo.luces;
  hemi.color.set(0xffffff); hemi.groundColor.set(0x9a8e7a); hemi.intensity = 1.9;
  sol.color.set(0xfff4e2); sol.intensity = 2.2; sol.position.set(4, 9, 6);
  raiz.add(crearSuelo(color));
}

registrarFunda('bloques', { construirModelo: construirModeloBloques, crearPortal: crearPortalBloques, montarAmbiente, opcionesAmbiente: { placa: PLACAS } });
