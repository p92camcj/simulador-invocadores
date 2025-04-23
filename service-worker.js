const CACHE_NAME = 'invocadores-v1.1.0';
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
  './js/version-check.js'
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
