// espectaculo.js
//
// Modo espectáculo: capa de PRESENTACIÓN encima del motor del juego. No
// decide nada ni cambia ninguna regla: solo escucha lo que ya ha pasado
// (una carta bajada a un Portal, una habilidad aplicada, una invocación
// completada) y lo escenifica a pantalla completa con el arte de las propias
// personajes (assets/figuras/*.webp, preparados con tools/generar_figuras.py
// a partir de los SVG originales de assets/personajes/ — no se dibuja ningún
// personaje nuevo), la ilustración del Portal (assets/portal.jpg) y la de
// las criaturas invocadas que la tienen (assets/invocaciones/*.webp).
//
// Reglas de información oculta (igual que render.js): una escena solo
// muestra la cara de una carta si esa carta es PÚBLICA en la mesa en ese
// momento (o lo era antes de la acción, es decir, ya la había visto todo el
// mundo). Las cartas de la mano, las que quedan debajo de la pila de un
// Portal y las que pasan a estar ocultas se dibujan siempre con el reverso.
//
// Puntos de entrada (los únicos que usa el resto del código):
// - anunciarCartaJugada(jugadoraIdx, destKey)       → actions.js, Fase A
// - envolverHabilidad(name, ownerIdx, stack, onDone) → actions.js y bot.js, Fase B
// - anunciarInvocacion({...})                         → actions.js, fin de turno
// - cuandoTermineEspectaculo() / hayEspectaculoEnCurso() → espera a que acabe la cola
// - espectaculoActivo() / fijarEspectaculo(bool)      → interruptor (setup.js / index.html)

import { escenas3dActivas, reproducir3D, detener3D } from './escenas3d.js';

const CLAVE_PREFERENCIA = 'invocadores.espectaculo';

const ARCHIVO_FIGURA = {
  'Maestro': 'maestro', 'Clarividente': 'clarividente', 'Ocultista': 'ocultista',
  'Cronomante': 'cronomante', 'Estratega': 'estratega', 'Cronista': 'cronista',
  'Aprendiz': 'aprendiz', 'Centinela': 'centinela', 'Pícaro': 'picaro',
  'Metamorfo': 'metamorfo', 'Entusiasta': 'entusiasta', 'Reena': 'reena',
  'Sora': 'sora', 'Lumo': 'lumo',
};

// Colores sacados de la ilustración de cada carta (aura principal y
// secundaria), para que la luz de la escena "pertenezca" al personaje.
const COLORES = {
  'Maestro': ['#f4c95d', '#b8432a'],
  'Clarividente': ['#53e3d4', '#1d6f7c'],
  'Ocultista': ['#5b86ff', '#1c2b6e'],
  'Cronomante': ['#5fd6ec', '#c9a46b'],
  'Estratega': ['#ff9c6b', '#e8c46a'],
  'Cronista': ['#3fe3c3', '#7c40b2'],
  'Aprendiz': ['#f6d7a2', '#8b5cc8'],
  'Centinela': ['#e2553b', '#d9a441'],
  'Pícaro': ['#4fb7ff', '#2a4f9a'],
  'Metamorfo': ['#ff9ad6', '#7fb4ff'],
  'Entusiasta': ['#ff4fa3', '#3f7bff'],
  'Reena': ['#3566d6', '#e9e3d2'],
  'Sora': ['#ff9b3d', '#ffe08b'],
  'Lumo': ['#ffe58b', '#3f9b4b'],
};
// Criaturas invocadas con arte propio (assets/invocaciones/<nombre>.webp).
const CRIATURAS_CON_ARTE = new Set(['Cirelia', 'Baelorith', 'Aelgorth']);
const COLOR_NIVEL = { C: '#f2c94c', B: '#e0533a', A: '#9b59d0', '*': '#3fe0c5' };

// ---------- Preferencia on/off ----------

let activo = true;
try {
  const guardado = localStorage.getItem(CLAVE_PREFERENCIA);
  if (guardado !== null) activo = guardado === '1';
} catch { /* sin almacenamiento: se queda activado */ }

export function espectaculoActivo() {
  return activo && typeof document !== 'undefined';
}

export function fijarEspectaculo(valor) {
  activo = !!valor;
  try { localStorage.setItem(CLAVE_PREFERENCIA, activo ? '1' : '0'); } catch { /* nada */ }
  if (!activo) saltarTodo();
  actualizarBotonInterruptor();
}

function actualizarBotonInterruptor() {
  const btn = document.querySelector('#btnEspectaculo');
  if (btn) {
    btn.textContent = activo ? '✨ Escenas: sí' : '✨ Escenas: no';
    btn.setAttribute('aria-pressed', String(activo));
  }
  const chk = document.querySelector('#chkEspectaculo');
  if (chk) chk.checked = activo;
}

export function initEspectaculo() {
  actualizarBotonInterruptor();
  document.querySelector('#btnEspectaculo')?.addEventListener('click', () => fijarEspectaculo(!activo));
  document.querySelector('#chkEspectaculo')?.addEventListener('change', e => fijarEspectaculo(e.target.checked));
}

// ---------- Lectura de la mesa (solo lo público) ----------

function nombreVisible(carta) {
  return carta ? (carta.aspecto || carta.name) : null;
}

function etiquetaPortal(key) {
  const [tp, a, b] = key.split(':');
  if (tp === 'n') return `Portal central ${+a + 1}`;
  const p = window.players[+a];
  return p.portals.length > 1 ? `${p.name} · Portal ${+b + 1}` : `Portal de ${p.name}`;
}

/** El Portal dicho en una frase, desde el punto de vista de quien actúa. */
function frasePortal(key, actorIdx) {
  const [tp, a, b] = key.split(':');
  if (tp === 'n') return `el Portal central ${+a + 1}`;
  const p = window.players[+a];
  const num = p.portals.length > 1 ? ` ${+b + 1}` : '';
  return +a === actorIdx ? `su Portal${num}` : `el Portal${num} de ${p.name}`;
}

/** Contracciones: "a el" → "al", "de el" → "del". */
const al = frase => frase.startsWith('el ') ? `al ${frase.slice(3)}` : `a ${frase}`;
const del = frase => frase.startsWith('el ') ? `del ${frase.slice(3)}` : `de ${frase}`;

/** Normaliza 'p:j' (Portal propio de la jugadora activa) a 'a:turn:j'. */
function normalizarClave(destKey, jugadoraIdx) {
  const [tp, a, b] = destKey.split(':');
  if (tp === 'p') return `a:${jugadoraIdx}:${a}`;
  if (tp === 'n') return `n:${a}`;
  return `a:${a}:${b}`;
}

function pilaPorClave(key) {
  const [tp, a, b] = key.split(':');
  return tp === 'n' ? window.neutrals[+a] : window.players[+a].portals[+b];
}

function claveDePila(stack) {
  for (let i = 0; i < window.players.length; i++) {
    const j = window.players[i].portals.indexOf(stack);
    if (j >= 0) return `a:${i}:${j}`;
  }
  const k = window.neutrals.indexOf(stack);
  return k >= 0 ? `n:${k}` : null;
}

/** Foto pública de la mesa: por Portal, altura de pila y su carta superior
 *  (cara solo si es pública). Las manos, solo cuántas cartas tienen. */
function fotoMesa() {
  const portales = {};
  window.players.forEach((p, i) => p.portals.forEach((st, j) => {
    portales[`a:${i}:${j}`] = resumenPila(st);
  }));
  window.neutrals.forEach((st, k) => { portales[`n:${k}`] = resumenPila(st); });
  return { portales };
}

function resumenPila(st) {
  const top = st.at(-1);
  return {
    len: st.length,
    publica: !!top?.vis?.public,
    nombre: top?.vis?.public ? nombreVisible(top) : null,
    real: top?.vis?.public ? top.name : null,
  };
}

// ---------- Cola de escenas ----------

const cola = [];
let reproduciendo = false;
let saltarActual = null;
let esperando = [];

export function hayEspectaculoEnCurso() {
  return reproduciendo || cola.length > 0;
}

export function cuandoTermineEspectaculo() {
  if (!reproduciendo && !cola.length) return Promise.resolve();
  return new Promise(res => esperando.push(res));
}

/**
 * Corta las escenas en curso al salir de la partida. Las esperas pendientes
 * (cuandoTermineEspectaculo) se descartan sin resolverse: eran avances de
 * turno de una partida que ya no está en pantalla.
 */
export function detenerEspectaculo() {
  esperando = [];
  cola.length = 0;
  if (saltarActual) saltarActual();
}

/** Nombres para los pergaminos de los Portales 3D: quien actúa y las dos siguientes. */
function nombresDesde(actorIdx) {
  const js = window.players ?? [];
  if (!js.length) return [];
  const i0 = Number.isInteger(actorIdx) ? actorIdx : 0;
  return [0, 1, 2].filter(k => k < js.length).map(k => js[(i0 + k) % js.length].name);
}

function encolar(escena) {
  if (!espectaculoActivo()) return;
  cola.push(escena);
  if (!reproduciendo) siguiente();
}

function saltarTodo() {
  cola.length = 0;
  if (saltarActual) saltarActual();
}

function raiz() {
  let el = document.querySelector('#espectaculo');
  if (!el) {
    el = document.createElement('div');
    el.id = 'espectaculo';
    el.className = 'esp hidden';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.title = 'Toca para saltar la escena';
    el.addEventListener('click', () => saltarActual && saltarActual());
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && saltarActual) saltarActual();
    });
    document.body.appendChild(el);
  }
  return el;
}

function siguiente() {
  const escena = cola.shift();
  const el = raiz();
  if (!escena) {
    reproduciendo = false;
    el.classList.add('hidden');
    el.innerHTML = '';
    const pendientes = esperando;
    esperando = [];
    pendientes.forEach(r => r());
    return;
  }
  reproduciendo = true;
  // Personajes 3D (opcional): si la escena trae un descriptor `tres` y la
  // jugadora lo ha activado, se ve la animación 3D en lugar de la 2D. Si no
  // se puede (sin WebGL, sin red la primera vez…), se cae a la escena 2D.
  if (escena.tres && escenas3dActivas() && !escena.sin3d) {
    el.classList.add('hidden');
    el.innerHTML = '';
    const fin3d = () => detener3D();
    saltarActual = fin3d;
    const ritmo3d = cola.length >= 2 ? 0.55 : cola.length === 1 ? 0.8 : 1;
    reproducir3D(escena.tres, { titulo: escena.titulo, subtitulo: escena.subtitulo, nombres: nombresDesde(escena.actor), ritmo: ritmo3d })
      .then(visto => {
        if (saltarActual === fin3d) saltarActual = null;
        if (visto === null) { escena.sin3d = true; cola.unshift(escena); }
        siguiente();
      });
    return;
  }
  const reducido = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  // Si se acumulan escenas (p. ej. turnos seguidos de autómatas), se
  // aceleran para no ir por detrás de la partida.
  const ritmo = reducido ? 0.5 : (cola.length >= 2 ? 0.55 : cola.length === 1 ? 0.8 : 1);
  el.innerHTML = '';
  el.style.setProperty('--t', String(ritmo));
  el.classList.remove('hidden');
  const escenario = document.createElement('div');
  escenario.className = `esp-escenario esp-escenario--${escena.tipo}`;
  escenario.innerHTML = escena.html;
  el.appendChild(escenario);
  const fin = () => {
    if (saltarActual !== fin) return;
    saltarActual = null;
    clearTimeout(temporizador);
    escenario.classList.add('esp-salida');
    setTimeout(siguiente, 220);
  };
  saltarActual = fin;
  const temporizador = setTimeout(fin, escena.duracion * ritmo);
}

// ---------- Piezas de escena ----------

const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function vars(nombre) {
  const [c1, c2] = COLORES[nombre] || ['#c9b8ff', '#5a3fa0'];
  return `--c1:${c1};--c2:${c2};`;
}

/** Ruta del arte de cuerpo entero de un personaje (o null). También la usa
 *  render.js para los retratos pequeños de la versión de siempre. */
export function rutaFigura(nombre) {
  const archivo = ARCHIVO_FIGURA[nombre];
  return archivo ? `assets/figuras/${archivo}.webp` : null;
}

/** Ruta del arte de una criatura invocada (o null si no tiene). */
export function rutaCriatura(nombreInvocacion) {
  return CRIATURAS_CON_ARTE.has(nombreInvocacion)
    ? `assets/invocaciones/${nombreInvocacion.toLowerCase()}.webp`
    : null;
}

function figura(nombre, clase = '') {
  const archivo = ARCHIVO_FIGURA[nombre];
  if (!archivo) return '';
  return `<img class="esp-fig ${clase}" src="assets/figuras/${archivo}.webp" alt="${esc(nombre)}" draggable="false">`;
}

function reverso(clase = '') {
  return `<img class="esp-carta ${clase}" src="assets/cards/carta-oculta-reverso.png" alt="Carta oculta" draggable="false">`;
}

function carta(nombre, clase = '') {
  const archivo = ARCHIVO_FIGURA[nombre];
  if (!archivo) return reverso(clase);
  return `<img class="esp-carta ${clase}" src="assets/cards/${archivo}.png" alt="${esc(nombre)}" draggable="false">`;
}

/** El Portal: la ilustración de la carta de Portal (assets/portal.jpg), con
 *  la luz del personaje que lo atraviesa. */
function portal(etiqueta, clase = '') {
  return `
    <div class="esp-portal ${clase}">
      <img class="esp-portal-img" src="assets/portal.jpg" alt="" draggable="false">
      <div class="esp-portal-luz" aria-hidden="true"></div>
      <div class="esp-portal-espiral" aria-hidden="true"></div>
      ${etiqueta ? `<div class="esp-portal-etiqueta">${esc(etiqueta)}</div>` : ''}
    </div>`;
}

function chispas(n = 18) {
  let html = '<div class="esp-chispas" aria-hidden="true">';
  for (let i = 0; i < n; i++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 90 + Math.random() * 170;
    html += `<i style="--dx:${(Math.cos(ang) * dist).toFixed(0)}px;--dy:${(Math.sin(ang) * dist - 60).toFixed(0)}px;--r:${(Math.random() * 0.6).toFixed(2)}"></i>`;
  }
  return html + '</div>';
}

function rotulo(titulo, subtitulo = '') {
  return `<div class="esp-rotulo"><strong>${esc(titulo)}</strong>${subtitulo ? `<span>${esc(subtitulo)}</span>` : ''}</div>`;
}

/** Un Portal con su personaje encima (o un reverso si la carta está oculta). */
function ranura({ clave, nombre, publica = true, x = 50, clase = '', etiqueta, extra = '' }) {
  const nombreColor = publica ? nombre : null;
  return `
    <div class="esp-ranura ${clase}" style="--x:${x}%;${vars(nombreColor)}">
      ${portal(etiqueta ?? (clave ? etiquetaPortal(clave) : ''))}
      <div class="esp-aparicion">
        ${nombre && publica ? figura(nombre) : (nombre === null && publica === false ? reverso('esp-carta--en-portal') : '')}
      </div>
      ${extra}
    </div>`;
}

// ---------- Fase A: bajar una carta a un Portal ----------

export function anunciarCartaJugada(jugadoraIdx, destKey) {
  if (!espectaculoActivo()) return;
  const clave = normalizarClave(destKey, jugadoraIdx);
  const pila = pilaPorClave(clave);
  const top = pila.at(-1);
  if (!top) return;
  const nombre = nombreVisible(top);
  const anterior = pila.at(-2);
  const anteriorPublica = anterior?.vis?.public ? nombreVisible(anterior) : null;
  const jugadora = window.players[jugadoraIdx]?.name ?? '';
  const esCentinela = top.name === 'Centinela';

  const [tpClave, duenoClave] = clave.split(':');
  encolar({
    tipo: 'carta',
    tres: top.vis?.public !== false ? { tipo: 'carta', nombre, anterior: anteriorPublica, central: tpClave === 'n', propio: tpClave === 'n' || +duenoClave === jugadoraIdx } : null,
    actor: jugadoraIdx,
    titulo: nombre,
    subtitulo: `${jugadora} lo invoca en ${frasePortal(clave, jugadoraIdx)}`,
    duracion: 2300,
    html: `
      <div class="esp-fondo" style="${vars(nombre)}"></div>
      <div class="esp-ranura esp-ranura--sola" style="--x:50%;${vars(nombre)}">
        ${portal(etiquetaPortal(clave))}
        ${anteriorPublica ? `<div class="esp-pasado">${figura(anteriorPublica)}</div>` : ''}
        <div class="esp-aparicion esp-aparicion--sube">${figura(nombre)}</div>
        ${chispas()}
        ${esCentinela ? '<div class="esp-escudo" aria-hidden="true"></div>' : ''}
      </div>
      ${rotulo(nombre, `${jugadora} lo invoca en ${frasePortal(clave, jugadoraIdx)}`)}
      ${esCentinela ? '<div class="esp-nota">Las demás Centinelas se ocultan</div>' : ''}`,
  });
}

// ---------- Fase B: habilidades ----------

/**
 * Envuelve el onComplete de una activación: hace una foto pública de la mesa
 * ahora (antes de que la habilidad cambie nada) y, cuando la habilidad se
 * aplica de verdad, compara con la foto de después y lo escenifica. Si la
 * jugadora cancela un picker, onComplete nunca se llama y no hay escena.
 */
export function envolverHabilidad(name, ownerIdx, stack, onComplete) {
  if (typeof document === 'undefined') return onComplete;
  const antes = fotoMesa();
  const claveOrigen = stack ? claveDePila(stack) : null;
  return (...args) => {
    const r = onComplete(...args);
    try {
      if (espectaculoActivo()) anunciarHabilidad(name, ownerIdx, claveOrigen, antes, fotoMesa());
    } catch (e) {
      console.warn('Escena de habilidad no disponible:', e);
    }
    return r;
  };
}

function cambiosEntre(antes, despues) {
  return Object.keys(despues.portales)
    .filter(k => {
      const a = antes.portales[k], d = despues.portales[k];
      return !a || a.len !== d.len || a.publica !== d.publica || a.nombre !== d.nombre;
    })
    .map(k => ({ clave: k, antes: antes.portales[k] || { len: 0 }, despues: despues.portales[k] }));
}

function anunciarHabilidad(name, ownerIdx, claveOrigen, antes, despues) {
  const jugadora = window.players[ownerIdx]?.name ?? '';
  const cambios = cambiosEntre(antes, despues);
  const origen = claveOrigen ? despues.portales[claveOrigen] : null;
  const escena = ({
    Metamorfo: escenaMetamorfo,
    Maestro: escenaMaestro,
    Cronomante: escenaCronomante,
    Cronista: escenaCronista,
    Ocultista: escenaOcultista,
    Estratega: escenaEstratega,
    Aprendiz: escenaAprendiz,
  }[name] || escenaGenerica)({ name, jugadora, ownerIdx, claveOrigen, origen, cambios, antes, despues });
  if (escena) encolar({
    ...escena,
    tres: { tipo: 'habilidad', nombre: name, aspecto: name === 'Metamorfo' ? origen?.nombre : undefined },
    actor: ownerIdx,
    titulo: name,
    subtitulo: `${jugadora} activa su habilidad`,
  });
}

function cabecera(name, jugadora, lema) {
  return rotulo(`${name}`, `${jugadora} activa su habilidad${lema ? ` · ${lema}` : ''}`);
}

function escenaMetamorfo({ jugadora, claveOrigen, origen }) {
  const destino = origen?.nombre;
  if (!destino || destino === 'Metamorfo') return null;
  // Como en la mesa real: el Metamorfo sigue ahí y se le pone encima una
  // ficha con la cara del personaje. La escena lo cuenta en tres tiempos:
  // 1) sale el Metamorfo, 2) la ficha gira en el aire y se le clava en el
  // pecho, 3) un barrido de luz lo recorre de abajo arriba y lo "repinta"
  // como el otro personaje. Al final se ven las dos capas a la vez: el
  // disfraz delante y la silueta rosa del Metamorfo detrás, con la ficha.
  const fig = rutaFigura(destino);
  return {
    tipo: 'metamorfo',
    duracion: 4600,
    html: `
      <div class="esp-fondo" style="${vars('Metamorfo')}"></div>
      <div class="esp-ranura esp-ranura--sola" style="--x:50%;${vars('Metamorfo')}">
        ${portal(etiquetaPortal(claveOrigen))}
        <div class="esp-humo" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
        <div class="esp-aparicion esp-aparicion--meta esp-metamorfosis">
          ${figura('Metamorfo', 'esp-meta-sombra')}
          ${figura('Metamorfo', 'esp-meta-base')}
          <div class="esp-meta-disfraz">${figura(destino)}</div>
          <span class="esp-meta-barrido" aria-hidden="true"></span>
        </div>
        <div class="esp-meta-ficha" aria-hidden="true">
          <span class="esp-meta-ficha-cara">${fig ? `<img src="${fig}" alt="" draggable="false">` : ''}</span>
          <span class="esp-meta-ficha-canto"></span>
        </div>
        <span class="esp-meta-onda" aria-hidden="true"></span>
        ${chispas(30)}
      </div>
      ${rotulo(`Metamorfo → ${destino}`, `${jugadora} le pone la ficha de ${destino}: parece ${destino}, pero sigue siendo un Metamorfo.`)}`,
  };
}

function escenaMaestro({ jugadora, ownerIdx, claveOrigen, cambios }) {
  const destino = cambios.find(c => c.despues.len === c.antes.len + 1);
  if (!destino) return escenaGenerica({ name: 'Maestro', jugadora, claveOrigen, cambios });
  const [, ti] = destino.clave.split(':');
  const objetivo = window.players[+ti]?.name ?? '';
  const nombre = destino.despues.nombre;
  return {
    tipo: 'maestro',
    duracion: 3400,
    html: `
      <div class="esp-fondo" style="${vars('Maestro')}"></div>
      ${claveOrigen ? ranura({ clave: claveOrigen, nombre: 'Maestro', x: 24, clase: 'esp-ranura--lado' }) : ''}
      <div class="esp-ranura esp-ranura--objetivo" style="--x:70%;${vars(nombre)}">
        ${portal(etiquetaPortal(destino.clave))}
        <div class="esp-mano">Mano de ${esc(objetivo)}</div>
        <div class="esp-carta-viaje esp-carta-viaje--baja">
          <div class="esp-volteo">${reverso('esp-cara esp-cara--dorso')}${carta(nombre, 'esp-cara esp-cara--frente')}</div>
        </div>
        <div class="esp-aparicion esp-aparicion--tarde">${figura(nombre)}</div>
        ${chispas(14)}
      </div>
      <div class="esp-orbes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      ${rotulo('Maestro', `${jugadora} hace que ${objetivo} baje su carta ${al(frasePortal(destino.clave, +ti))}: ${nombre}`)}`,
  };
}

function escenaCronomante({ jugadora, claveOrigen, cambios, antes }) {
  // Lore: la Cronomante guarda memoria de todo lo que ha pasado por un
  // Portal. La pila (lo que quedó debajo) es el pasado; la carta de arriba,
  // el presente. Las cartas del pasado se dibujan siempre bocabajo: en la
  // mesa están tapadas.
  const c = cambios.find(x => x.despues.len === x.antes.len) || cambios[0];
  // Si la carta elegida era la que ya estaba arriba, no cambia nada en la
  // foto: se escenifica igualmente sobre el Portal de origen como "consulta".
  const clave = c?.clave;
  if (!clave) return escenaGenerica({ name: 'Cronomante', jugadora, claveOrigen, cambios });
  const despues = c.despues;
  const anterior = antes.portales[clave];
  const pasado = Math.max(1, Math.min(despues.len - 1, 7));
  let fantasmas = '';
  for (let i = 0; i < pasado; i++) {
    fantasmas += `<div class="esp-fantasma" style="--i:${i + 1}">${reverso()}</div>`;
  }
  return {
    tipo: 'cronomante',
    duracion: 3600,
    html: `
      <div class="esp-fondo" style="${vars('Cronomante')}"></div>
      <div class="esp-reloj" aria-hidden="true"></div>
      ${claveOrigen && claveOrigen !== clave ? ranura({ clave: claveOrigen, nombre: 'Cronomante', x: 18, clase: 'esp-ranura--lado' }) : ''}
      <div class="esp-ranura esp-ranura--sola esp-ranura--crono" style="--x:${claveOrigen && claveOrigen !== clave ? 62 : 50}%;${vars(despues.nombre || 'Cronomante')}">
        <div class="esp-pasillo" aria-hidden="true">${fantasmas}</div>
        ${portal(etiquetaPortal(clave))}
        ${anterior?.nombre && anterior.nombre !== despues.nombre ? `<div class="esp-pasado esp-pasado--hondo">${figura(anterior.nombre)}</div>` : ''}
        <div class="esp-carta-viaje esp-carta-viaje--del-pasado">${reverso()}</div>
        <div class="esp-aparicion esp-aparicion--tarde">${despues.nombre ? figura(despues.nombre) : reverso('esp-carta--en-portal')}</div>
      </div>
      <div class="esp-leyenda-tiempo"><span>Pasado</span><span>Presente</span></div>
      ${rotulo('Cronomante', `${jugadora} trae del pasado al presente${despues.nombre ? `: ${despues.nombre}` : ''}`)}`,
  };
}

function escenaCronista({ jugadora, ownerIdx, claveOrigen, cambios }) {
  const c = cambios.find(x => x.despues.len === x.antes.len - 1);
  if (!c) return escenaGenerica({ name: 'Cronista', jugadora, claveOrigen, cambios });
  return {
    tipo: 'cronista',
    duracion: 3000,
    html: `
      <div class="esp-fondo" style="${vars('Cronista')}"></div>
      ${claveOrigen && claveOrigen !== c.clave ? ranura({ clave: claveOrigen, nombre: 'Cronista', x: 24, clase: 'esp-ranura--lado' }) : ''}
      <div class="esp-ranura esp-ranura--objetivo" style="--x:${claveOrigen && claveOrigen !== c.clave ? 68 : 50}%;${vars(c.antes.nombre || 'Cronista')}">
        ${portal(etiquetaPortal(c.clave))}
        <div class="esp-aparicion esp-aparicion--se-va">${c.antes.nombre ? figura(c.antes.nombre) : reverso('esp-carta--en-portal')}</div>
        <div class="esp-carta-viaje esp-carta-viaje--a-la-mano">${reverso()}</div>
        ${c.despues.nombre ? `<div class="esp-aparicion esp-aparicion--tarde esp-aparicion--tenue">${figura(c.despues.nombre)}</div>` : ''}
      </div>
      <div class="esp-mano esp-mano--fija">Mano de ${esc(jugadora)}</div>
      ${rotulo('Cronista', `${jugadora} recoge en su mano la carta ${del(frasePortal(c.clave, ownerIdx))}`)}`,
  };
}

function escenaOcultista({ jugadora, ownerIdx, claveOrigen, cambios }) {
  const c = cambios.find(x => x.antes.publica !== x.despues.publica);
  if (!c) return escenaGenerica({ name: 'Ocultista', jugadora, claveOrigen, cambios });
  const oculta = !c.despues.publica;
  const visible = oculta ? c.antes.nombre : c.despues.nombre;
  return {
    tipo: 'ocultista',
    duracion: 3000,
    html: `
      <div class="esp-fondo" style="${vars('Ocultista')}"></div>
      ${claveOrigen && claveOrigen !== c.clave ? ranura({ clave: claveOrigen, nombre: 'Ocultista', x: 24, clase: 'esp-ranura--lado' }) : ''}
      <div class="esp-ranura esp-ranura--objetivo ${oculta ? 'esp-se-oculta' : 'esp-se-revela'}" style="--x:${claveOrigen && claveOrigen !== c.clave ? 68 : 50}%;${vars(visible)}">
        ${portal(etiquetaPortal(c.clave))}
        <div class="esp-aparicion esp-aparicion--cara">${visible ? figura(visible) : ''}</div>
        <div class="esp-aparicion esp-aparicion--dorso">${reverso('esp-carta--en-portal')}</div>
        <div class="esp-velo" aria-hidden="true"></div>
      </div>
      ${rotulo('Ocultista', `${jugadora} ${oculta ? 'oculta' : 'revela'} la carta ${del(frasePortal(c.clave, ownerIdx))}${!oculta && visible ? `: ${visible}` : ''}`)}`,
  };
}

function escenaEstratega({ jugadora, ownerIdx, claveOrigen, cambios, antes }) {
  if (cambios.length < 1) return escenaGenerica({ name: 'Estratega', jugadora, claveOrigen, cambios });
  const [c1, c2] = cambios.length >= 2 ? cambios : [cambios[0], cambios[0]];
  const a1 = antes.portales[c1.clave], a2 = antes.portales[c2.clave];
  const pieza = (estado) => estado?.nombre ? figura(estado.nombre) : (estado?.len ? reverso('esp-carta--en-portal') : '');
  return {
    tipo: 'estratega',
    duracion: 3200,
    html: `
      <div class="esp-fondo" style="${vars('Estratega')}"></div>
      <div class="esp-ranura esp-ranura--par" style="--x:26%;${vars(a1?.nombre)}">
        ${portal(etiquetaPortal(c1.clave))}
        <div class="esp-aparicion esp-cruza esp-cruza--der">${pieza(a1)}</div>
      </div>
      <div class="esp-ranura esp-ranura--par" style="--x:74%;${vars(a2?.nombre)}">
        ${portal(etiquetaPortal(c2.clave))}
        <div class="esp-aparicion esp-cruza esp-cruza--izq">${pieza(a2)}</div>
      </div>
      <div class="esp-arco-gemas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="esp-estratega-centro">${figura('Estratega')}</div>
      ${rotulo('Estratega', `${jugadora} intercambia ${frasePortal(c1.clave, ownerIdx)} y ${frasePortal(c2.clave, ownerIdx)}`)}`,
  };
}

function escenaAprendiz({ jugadora, antes, despues }) {
  // Las manos no salen en la foto pública (son privadas): la escena muestra
  // solo dos manos de reversos intercambiándose, sin desvelar nada.
  void antes; void despues;
  return {
    tipo: 'aprendiz',
    duracion: 2800,
    html: `
      <div class="esp-fondo" style="${vars('Aprendiz')}"></div>
      <div class="esp-aprendiz-centro">${figura('Aprendiz')}</div>
      <div class="esp-manos-cruzan" aria-hidden="true">
        <div class="esp-mano-cartas esp-mano-cartas--1">${reverso()}${reverso()}</div>
        <div class="esp-mano-cartas esp-mano-cartas--2">${reverso()}${reverso()}</div>
      </div>
      <div class="esp-paginas" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i></div>
      ${rotulo('Aprendiz', `${jugadora} hace que dos jugadoras intercambien sus manos`)}`,
  };
}

function escenaGenerica({ name, jugadora, claveOrigen }) {
  return {
    tipo: 'generica',
    duracion: 2200,
    html: `
      <div class="esp-fondo" style="${vars(name)}"></div>
      ${ranura({ clave: claveOrigen, nombre: name, x: 50, clase: 'esp-ranura--sola' })}
      ${chispas()}
      ${cabecera(name, jugadora)}`,
  };
}

// ---------- Invocación completada ----------

export function anunciarInvocacion({ nivel, nombre, need, recompensas, gemasAutomata = 0, entusiastas = [] }) {
  if (!espectaculoActivo()) return false;
  const posiciones = need.length > 3 ? [[50, 14], [14, 52], [86, 52], [50, 80]] : [[50, 18], [16, 64], [84, 64]];
  const figuras = need.map((n, i) => {
    const [x, y] = posiciones[i % posiciones.length];
    return `<div class="esp-convergen" style="--x:${x}%;--y:${y}%;${vars(n)}">${figura(n)}</div>`;
  }).join('');
  const lista = recompensas.filter(r => r.gemas > 0)
    .map(r => `<li>${esc(r.jugadora)} <b>+${r.gemas}</b> ${r.gemas === 1 ? 'Gema' : 'Gemas'}</li>`).join('')
    + (gemasAutomata > 0 ? `<li>🤖 Autómata central <b>+${gemasAutomata}</b> ${gemasAutomata === 1 ? 'Gema' : 'Gemas'}</li>` : '')
    + entusiastas.filter(e => e.perdida).map(e => `<li>🎉 ${esc(e.jugadora)} <b>−1</b> (Entusiasta)</li>`).join('');
  const resumenGemas = recompensas.filter(r => r.gemas > 0).map(r => `${r.jugadora} +${r.gemas}`).join(' · ');
  encolar({
    tipo: 'invocacion',
    tres: { tipo: 'invocacion', criatura: nombre, nivel, need },
    titulo: nombre,
    subtitulo: `Invocación ${nivel === '*' ? 'final' : nivel} completada${resumenGemas ? ` · ${resumenGemas}` : ''}`,
    duracion: 5200,
    html: `
      <div class="esp-fondo esp-fondo--invocacion" style="--c1:${COLOR_NIVEL[nivel] || '#c9b8ff'};--c2:#1a1033;"></div>
      <div class="esp-circulo" aria-hidden="true" style="--c1:${COLOR_NIVEL[nivel] || '#c9b8ff'}"></div>
      ${figuras}
      <div class="esp-destello" aria-hidden="true"></div>
      ${CRIATURAS_CON_ARTE.has(nombre) ? `<div class="esp-criatura" style="--c1:${COLOR_NIVEL[nivel] || '#c9b8ff'}"><img src="assets/invocaciones/${esc(nombre.toLowerCase())}.webp" alt="${esc(nombre)}" draggable="false"></div>` : ''}
      <div class="esp-titulo-invocacion ${CRIATURAS_CON_ARTE.has(nombre) ? 'esp-titulo-invocacion--abajo' : ''}" style="--c1:${COLOR_NIVEL[nivel] || '#c9b8ff'}">
        <small>Invocación ${nivel === '*' ? 'final' : esc(nivel)} completada</small>
        <strong>${esc(nombre)}</strong>
        ${lista ? `<ul>${lista}</ul>` : ''}
      </div>
      ${chispas(30)}`,
  });
  return true;
}
