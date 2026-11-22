/* Service worker: salva l'app sul telefono così funziona anche offline.
   Quando aggiorni i file su GitHub, cambia il numero di VERSIONE qui sotto. */
const VERSIONE = 'studio-v1';
const FILE = [
  './',
  './index.html',
  './app.css',
  './app.js',
  './icons.js',
  './manifest.json',
  './icons/icon-32.png',
  './icons/icon-180.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './fonts/bricolage.woff2',
  './fonts/plex-400.woff2',
  './fonts/plex-500.woff2',
  './fonts/plex-600.woff2',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSIONE).then(c => c.addAll(FILE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSIONE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Pagina e codice: prima la rete (così arrivano gli aggiornamenti), poi la copia salvata.
// Font e icone: prima la copia salvata.
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  const codice = req.mode === 'navigate' || /\.(html|js|css|json)$/.test(url.pathname) || url.pathname.endsWith('/');
  if (codice) {
    e.respondWith(
      Promise.race([
        fetch(req).then(res => {
          if (res && res.ok) { const copia = res.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); }
          return res;
        }),
        new Promise((_, no) => setTimeout(() => no(new Error('lento')), 3500)),
      ]).catch(() => caches.match(req, { ignoreSearch: true }).then(r => r || caches.match('./index.html')))
    );
  } else {
    e.respondWith(
      caches.match(req).then(r => r || fetch(req).then(res => {
        if (res && res.ok) { const copia = res.clone(); caches.open(VERSIONE).then(c => c.put(req, copia)); }
        return res;
      }))
    );
  }
});
