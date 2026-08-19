/**
 * GeoTimeline Service Worker (Feature 5: Offline-First PWA)
 * Caches App Shell (Cache-First), Map Tiles (Stale-While-Revalidate),
 * and Recent Photos (Bounded LRU Cache).
 */

const CACHE_VERSION = 'geotimeline-v2.3';
const APP_SHELL_CACHE = `${CACHE_VERSION}-shell`;
const MAP_TILES_CACHE = `${CACHE_VERSION}-map-tiles`;
const PHOTO_LRU_CACHE = `${CACHE_VERSION}-photo-lru`;
const MAX_PHOTO_CACHE_ITEMS = 50;

const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/main.css',
  './js/app.js',
  './js/config.js',
  './js/services/storageService.js',
  './js/services/exifService.js',
  './js/services/geoService.js',
  './js/services/googleDriveService.js',
  './js/services/memoryResurfaceService.js',
  './js/services/tripDetectionService.js',
  './js/services/shareService.js',
  './js/components/navbar.js',
  './js/components/dashboardView.js',
  './js/components/timelineView.js',
  './js/components/mapView.js',
  './js/components/tripsView.js',
  './js/components/folderExplorerView.js',
  './js/components/uploadModal.js',
  './js/components/lightbox.js',
  './js/components/storageSettingsModal.js',
  './js/components/onThisDayWidget.js'
];

// 1. Install Event: Pre-cache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) => {
      console.log('📦 [SW] Pre-caching App Shell assets');
      return cache.addAll(APP_SHELL_ASSETS).catch((err) => {
        console.warn('⚠️ [SW] Some assets failed to pre-cache:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

// 2. Activate Event: Clean up outdated caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (!key.startsWith(CACHE_VERSION)) {
            console.log('🗑️ [SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. Fetch Event: Multi-tiered Caching Strategy
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Skip non-GET requests and chrome-extension / non-http schemes
  if (event.request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Strategy A: Map Tiles (Stale-While-Revalidate)
  if (url.hostname.includes('cartocdn.com') || url.hostname.includes('tile.openstreetmap.org')) {
    event.respondWith(
      caches.open(MAP_TILES_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => cachedResponse);

          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // Strategy B: External CDN scripts & fonts (Cache-First with Network fallback)
  if (url.hostname.includes('unpkg.com') ||
      url.hostname.includes('cdn.tailwindcss.com') ||
      url.hostname.includes('code.iconify.design') ||
      url.hostname.includes('fonts.googleapis.com') ||
      url.hostname.includes('fonts.gstatic.com') ||
      url.hostname.includes('cdnjs.cloudflare.com') ||
      url.hostname.includes('cdn.jsdelivr.net')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, clone));
          }
          return response;
        }).catch(() => {
          return new Response('/* Offline fallback for CDN asset */', { headers: { 'Content-Type': 'text/javascript' } });
        });
      })
    );
    return;
  }

  // Strategy C: External Image URLs / Unsplash (Bounded LRU Cache)
  if (url.hostname.includes('images.unsplash.com') || url.hostname.includes('framerusercontent.com')) {
    event.respondWith(
      caches.open(PHOTO_LRU_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;

          return fetch(event.request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              // Maintain LRU limit
              cache.put(event.request, networkResponse.clone());
              trimCache(PHOTO_LRU_CACHE, MAX_PHOTO_CACHE_ITEMS);
            }
            return networkResponse;
          }).catch(() => {
            // Return placeholder if completely offline and not in cache
            return new Response(
              '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><rect width="200" height="200" fill="#111"/><text x="50%" y="50%" fill="#777" dominant-baseline="middle" text-anchor="middle" font-family="sans-serif" font-size="14">Offline Image</text></svg>',
              { headers: { 'Content-Type': 'image/svg+xml' } }
            );
          });
        });
      })
    );
    return;
  }

  // Strategy D: Local App Shell Assets (Cache-First, Fallback to Network)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch in background to update cache (Stale-While-Revalidate for app shell)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, networkResponse));
          }
        }).catch(() => {});
        return cachedResponse;
      }

      return fetch(event.request).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const clone = networkResponse.clone();
          caches.open(APP_SHELL_CACHE).then((cache) => cache.put(event.request, clone));
        }
        return networkResponse;
      }).catch(() => {
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});

/**
 * Trim cache to max items (LRU eviction)
 */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
    trimCache(cacheName, maxItems);
  }
}
