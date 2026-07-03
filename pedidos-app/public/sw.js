// Service worker de pedidos-app.
// Permite abrir la app sin conexión: cachea el shell de la página y los
// estáticos de Next. Los pedidos offline se manejan en el cliente
// (src/lib/offline-queue.ts), no aquí.

const CACHE_NAME = 'pedidos-app-v2';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(['/']))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Navegación (HTML): red primero, caché como respaldo para abrir offline
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) =>
              cached ||
              caches.match('/').then(
                (home) =>
                  home ||
                  new Response('<h1>Sin conexión</h1><p>Abre la app al menos una vez con internet.</p>', {
                    headers: { 'Content-Type': 'text/html; charset=utf-8' },
                  })
              )
          )
        )
    );
    return;
  }

  // Estáticos de Next, imágenes y fuentes: red primero con respaldo en caché.
  // (Red primero porque en desarrollo los chunks no llevan hash — caché-primero
  // serviría código viejo. Offline igual carga desde el caché.)
  if (
    url.pathname.startsWith('/_next/static/') ||
    /\.(png|jpg|jpeg|svg|webp|gif|ico|woff2?)$/.test(url.pathname)
  ) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Inventario: red primero con respaldo en caché (para búsquedas offline)
  if (url.pathname === '/api/inventory') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(
            (cached) =>
              cached ||
              new Response(JSON.stringify({ products: [] }), {
                headers: { 'Content-Type': 'application/json' },
              })
          )
        )
    );
    return;
  }

  // Resto de /api (pedidos, clientes, OCR...): solo red — datos transaccionales no se cachean
});
