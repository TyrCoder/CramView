/* Cramview — service worker
   Makes the app work offline.

   HOW UPDATES WORK
   - Files are served from the cache first (fast + offline), and refreshed
     from the network in the background, so edits show up on the next launch.
   - When you change app files, also bump CACHE_VERSION below. The app will
     then show an "Update" button so the new version loads right away.
*/
const CACHE_VERSION = 'v1.7.1';
const CACHE_NAME = `cramview-${CACHE_VERSION}`;

const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './config.js',
  './app.js',
  './vendor/pdfjs/pdf.min.js',
  './vendor/pdfjs/pdf.worker.min.js',
  './manifest.json',
  './icons/icon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // cache: 'reload' skips the browser's HTTP cache so we store fresh files
      cache.addAll(APP_SHELL.map((url) => new Request(url, { cache: 'reload' })))
    )
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key.startsWith('cramview-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// The page sends this when you tap "Update"
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Every page navigation is the same single-page app
  const isPage = req.mode === 'navigate';
  const cacheKey = isPage ? './index.html' : url.href;
  const networkUrl = isPage ? './index.html' : url.href;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(cacheKey, { ignoreSearch: true });

    const network = fetch(networkUrl, { cache: 'no-cache' })
      .then((res) => {
        if (res && res.ok && res.type === 'basic') cache.put(cacheKey, res.clone());
        return res;
      })
      .catch(() => null);

    if (cached) {
      event.waitUntil(network); // refresh in the background
      return cached;
    }
    const res = await network;
    if (res) return res;
    if (isPage) return cache.match('./index.html');
    return Response.error();
  })());
});
