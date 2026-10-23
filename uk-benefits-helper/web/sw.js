// Offline support so the app installs on phones and works with a poor signal.
const CACHE = 'claimright-v1';
const FILES = [
  './', './index.html', './styles.css', './app.js', './icon.svg', './manifest.webmanifest',
  '../rules/engine.js', '../rules/derive.js', '../rules/benefits.js', '../rules/questions.js', '../rules/rates-2026-27.js',
];
self.addEventListener('install', (e) => e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES))));
self.addEventListener('activate', (e) =>
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))));
self.addEventListener('fetch', (e) => {
  // Network first so rate updates arrive quickly; cache when offline.
  e.respondWith(fetch(e.request).then((res) => {
    const copy = res.clone();
    caches.open(CACHE).then((c) => c.put(e.request, copy));
    return res;
  }).catch(() => caches.match(e.request)));
});
