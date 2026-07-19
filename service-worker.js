const CACHE_NAME = 'invocadores-v1.5.0';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './version.json',
  './js/index.js',
  './js/utils.js',
  './js/setup.js',
  './js/game.js',
  './js/abilities.js',
  './js/actions.js',
  './js/render.js',
  './js/version-check.js',
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
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(urlsToCache);
    })
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
