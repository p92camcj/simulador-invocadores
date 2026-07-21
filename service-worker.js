// service-worker.js
//
// Tarea 4 (ver CHANGELOG.md): el contador de cartas del mazo (`#lblTurn`,
// actualizado en cada `nextTurn()` de `js/game.js`) se reportó "congelado"
// en partidas de 2 jugadoras ambas autómatas. Verificado en `js/game.js`
// que el código real SÍ recalcula y pinta `window.deck.length` en CADA
// turno, sea humano o bot (mismo camino de código, sin rama distinta para
// autómatas) — el bug no estaba ahí. La causa real estaba aquí:
// 1. `CACHE_NAME` era una cadena fija (`invocadores-v1.5.0`) que nunca
//    cambiaba con cada despliegue, y la estrategia de `fetch` era
//    cache-first para TODO, incluidos los módulos de lógica de juego
//    (`js/game.js`, `js/actions.js`...). Un Service Worker solo repite el
//    paso `install` (que es lo único que repuebla la caché) cuando el
//    propio contenido en bytes de ESTE archivo cambia — cambiar solo
//    `version.json` o los módulos de `js/` nunca lo dispara. Resultado:
//    cualquier jugadora con la PWA instalada desde hace tiempo podía
//    seguir ejecutando `js/game.js` de una versión antigua indefinidamente,
//    sin ninguna forma de refrescarse sola — indistinguible desde fuera de
//    "bugs" que en el código actual ya estaban corregidos.
// 2. `js/bot.js` (añadido tras la última vez que se tocó esta lista) ni
//    siquiera estaba en `urlsToCache`, así que dependía de que el `fetch`
//    en vivo funcionase sin más red de seguridad.
//
// Arreglo con dos partes independientes (la primera es la que de verdad
// soluciona el problema; la segunda es higiene adicional para el modo
// offline):
// - **Estrategia network-first** para documento/JS/CSS/JSON (el "app
//   shell": lo que cambia en cada versión) — intenta red primero y
//   actualiza la caché con la respuesta fresca; solo cae a la caché si no
//   hay red. Así, con conexión, SIEMPRE se ejecuta el código real del
//   servidor, sin depender de que el propio Service Worker se reinstale.
//   Los assets de cartas (`assets/cards/*.png`, que no cambian entre
//   versiones) mantienen cache-first, más rápido y sin coste de red
//   repetido.
// - `CACHE_NAME` derivado de `version.json` (que `CLAUDE.md` ya obliga a
//   subir en cada cambio shippeado) + purga de cachés antiguas en
//   `activate` + `skipWaiting()`/`clients.claim()`: mantiene el modo
//   offline (la única vía que sigue usando la caché) razonablemente al
//   día cada vez que el Service Worker sí se reinstale, sin necesitar
//   cerrar todas las pestañas para tomar el control.
const CACHE_PREFIX = 'invocadores-';
const APP_SHELL_EXTENSIONS = ['.html', '.js', '.css', '.json'];

async function resolveCacheName() {
  try {
    const res = await fetch('./version.json', { cache: 'no-store' });
    const { version } = await res.json();
    return `${CACHE_PREFIX}${version}`;
  } catch {
    // Sin red en el install (raro, pero posible): usa un nombre fijo de
    // reserva en vez de fallar el registro del Service Worker entero.
    return `${CACHE_PREFIX}fallback`;
  }
}

const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './version.json',
  './js/index.js',
  './js/utils.js',
  './js/setup.js',
  './js/game.js',
  './js/bot.js',
  './js/abilities.js',
  './js/actions.js',
  './js/render.js',
  './js/version-check.js',
  './js/pwa-install.js',
  './assets/cards/maestro.png',
  './assets/cards/clarividente.png',
  './assets/cards/ocultista.png',
  './assets/cards/cronomante.png',
  './assets/cards/estratega.png',
  './assets/cards/cronista.png',
  './assets/cards/aprendiz.png',
  './assets/cards/centinela.png',
  './assets/cards/picaro.png',
  './assets/cards/metamorfo.png',
  './assets/cards/entusiasta.png',
  './assets/cards/reena.png',
  './assets/cards/sora.png',
  './assets/cards/lumo.png',
  './assets/cards/carta-oculta-reverso.png',
  './assets/cards/ayuda-anverso.png',
  './assets/cards/ayuda-reverso.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    (async () => {
      const cacheName = await resolveCacheName();
      const cache = await caches.open(cacheName);
      await cache.addAll(urlsToCache);
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    (async () => {
      const cacheName = await resolveCacheName();
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key.startsWith(CACHE_PREFIX) && key !== cacheName)
          .map(key => caches.delete(key))
      );
      await self.clients.claim();
    })()
  );
});

/** ¿Es esta petición parte del "app shell" (documento/JS/CSS/JSON) que
 * cambia con cada versión, en vez de un asset estático (imágenes de
 * cartas)? Se decide por la extensión de la URL — `'./'` (raíz, sirve
 * `index.html`) cuenta como documento. */
function esAppShell(request) {
  if (request.mode === 'navigate') return true;
  const { pathname } = new URL(request.url);
  return APP_SHELL_EXTENSIONS.some(ext => pathname.endsWith(ext)) || pathname.endsWith('/');
}

async function networkFirst(event) {
  const { request } = event;
  try {
    const fresh = await fetch(request);
    // `waitUntil`, no `await` directo: no tiene sentido retrasar la
    // respuesta a la página hasta que termine de escribirse en caché, pero
    // sí hace falta mantener al Service Worker vivo hasta que termine, o el
    // navegador podría matarlo a mitad de la escritura.
    event.waitUntil(
      resolveCacheName().then(cacheName => caches.open(cacheName)).then(cache => cache.put(request, fresh.clone()))
    );
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    throw new Error('Sin red y sin caché para ' + request.url);
  }
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  return cached || fetch(request);
}

self.addEventListener('fetch', event => {
  event.respondWith(
    esAppShell(event.request) ? networkFirst(event) : cacheFirst(event.request)
  );
});
