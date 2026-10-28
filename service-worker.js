// ================================================================
// Craftenstein 3D — Service Worker
// ================================================================
// ВАЖНО: при изменении файлов игры меняйте CACHE_NAME (v1 -> v2 ...)
const CACHE_NAME = 'craftenstein-v1';

// Всё, что нужно для офлайн-запуска
const PRECACHE = [
  './',
  './index.html',
  './manifest.json',
  './cobblestone.png',
  './dirt.png',
  './planks.png',
  './creeper.png',
  './zombie.png',
  './sword.png',
  './heart.png',
  './door.png',
  './diamond.png',
  './music_loop.wav',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// ----------------------------------------------------------------
// INSTALL — кладём всё в кэш и активируемся сразу
// ----------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

// ----------------------------------------------------------------
// ACTIVATE — чистим старые кэши и берём контроль над клиентами
// ----------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

// ----------------------------------------------------------------
// MESSAGE — ручное обновление (SKIP_WAITING от страницы)
// ----------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ----------------------------------------------------------------
// FETCH — cache-first, network-fallback
// ----------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Кэшируем/отдаём только GET
  if (req.method !== 'GET') return;

  // Только same-origin (внешние CDN не трогаем)
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Навигационные запросы (переход на страницу) — отдаём index.html из кэша,
  // чтобы игра запускалась офлайн с любого URL внутри scope
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html').then((cached) => {
        return cached || fetch(req).catch(() => caches.match('./index.html'));
      })
    );
    return;
  }

  // Остальные ассеты — cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;

      return fetch(req).then((res) => {
        // Кэшируем успешные same-origin ответы «на лету»
        if (res && res.ok && res.type === 'basic') {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => {
        // Офлайн + нет в кэше — для картинок отдаём прозрачный пиксель,
        // для всего остального — ничего (пусть игра сама обработает null)
        if (req.destination === 'image') {
          return new Response(
            Uint8Array.from([
              0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
              0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
              0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
              0x08,0x06,0x00,0x00,0x00,0x1F,0x15,0xC4,
              0x89,0x00,0x00,0x00,0x0D,0x49,0x44,0x41,
              0x54,0x78,0x9C,0x63,0x00,0x01,0x00,0x00,
              0x05,0x00,0x01,0x0D,0x0A,0x2D,0xB4,0x00,
              0x00,0x00,0x00,0x49,0x45,0x4E,0x44,0xAE,
              0x42,0x60,0x82
            ]),
            { headers: { 'Content-Type': 'image/png' } }
          );
        }
        return new Response('', { status: 504, statusText: 'Offline' });
      });
    })
  );
});
