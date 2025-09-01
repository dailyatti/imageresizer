// ImageFlow Pro Service Worker - Advanced Caching & Offline Support
const CACHE_NAME = 'imageflow-pro-v1.0.0';
const STATIC_CACHE_NAME = 'imageflow-static-v1.0.0';
const DYNAMIC_CACHE_NAME = 'imageflow-dynamic-v1.0.0';

const STATIC_FILES = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.js',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js',
  'https://cdn.jsdelivr.net/npm/file-saver@2.0.5/dist/FileSaver.min.js',
  'https://cdn.jsdelivr.net/npm/pica@9.0.1/dist/pica.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode@1.5.3/build/qrcode.min.js',
  'https://cdn.jsdelivr.net/npm/qrcode-reader@1.0.4/dist/index.min.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://unpkg.com/peerjs@1.4.7/dist/peerjs.min.js'
];

// Install event - cache static resources
self.addEventListener('install', (event) => {
  console.log('[SW] Installing...');
  
  event.waitUntil(
    Promise.all([
      // Cache static files
      caches.open(STATIC_CACHE_NAME).then((cache) => {
        console.log('[SW] Caching static files...');
        return cache.addAll(STATIC_FILES.filter(file => !file.startsWith('https://')));
      }),
      
      // Cache external resources with error handling
      caches.open(STATIC_CACHE_NAME).then(async (cache) => {
        const externalFiles = STATIC_FILES.filter(file => file.startsWith('https://'));
        for (const file of externalFiles) {
          try {
            await cache.add(file);
            console.log(`[SW] Cached external file: ${file}`);
          } catch (error) {
            console.warn(`[SW] Failed to cache external file: ${file}`, error);
          }
        }
      })
    ]).then(() => {
      console.log('[SW] Installation complete');
      return self.skipWaiting();
    })
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating...');
  
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME && 
              cacheName !== DYNAMIC_CACHE_NAME && 
              cacheName !== CACHE_NAME) {
            console.log(`[SW] Deleting old cache: ${cacheName}`);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Activation complete');
      return self.clients.claim();
    })
  );
});

// Fetch event - serve cached content and implement caching strategies
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // Skip non-GET requests and chrome-extension requests
  if (request.method !== 'GET' || url.protocol === 'chrome-extension:') {
    return;
  }
  
  // Handle different types of requests with appropriate caching strategies
  if (isStaticAsset(request)) {
    // Cache First strategy for static assets
    event.respondWith(cacheFirst(request));
  } else if (isAPIRequest(request)) {
    // Network First strategy for API requests
    event.respondWith(networkFirst(request));
  } else if (isImageRequest(request)) {
    // Cache First with long expiration for images
    event.respondWith(cacheFirstWithExpiration(request, 86400000)); // 24 hours
  } else {
    // Stale While Revalidate for other requests
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Caching Strategies
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    
    return networkResponse;
  } catch (error) {
    console.error('[SW] Cache First failed:', error);
    return new Response('Offline - Resource not available', { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, trying cache:', error);
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    return new Response('Offline - Network and cache unavailable', { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cachedResponse = await caches.match(request);
  
  const networkResponse = fetch(request).then((response) => {
    if (response.ok) {
      const cache = caches.open(DYNAMIC_CACHE_NAME);
      cache.then((c) => c.put(request, response.clone()));
    }
    return response;
  }).catch(() => null);
  
  return cachedResponse || networkResponse;
}

async function cacheFirstWithExpiration(request, maxAge) {
  const cachedResponse = await caches.match(request);
  
  if (cachedResponse) {
    const dateHeader = cachedResponse.headers.get('date');
    if (dateHeader) {
      const cachedTime = new Date(dateHeader).getTime();
      const now = Date.now();
      if (now - cachedTime < maxAge) {
        return cachedResponse;
      }
    }
  }
  
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(DYNAMIC_CACHE_NAME);
      const responseToCache = new Response(networkResponse.body, {
        status: networkResponse.status,
        statusText: networkResponse.statusText,
        headers: {
          ...Object.fromEntries(networkResponse.headers.entries()),
          'date': new Date().toUTCString()
        }
      });
      cache.put(request, responseToCache.clone());
      return responseToCache;
    }
    return networkResponse;
  } catch (error) {
    console.log('[SW] Network failed, returning stale cache:', error);
    return cachedResponse || new Response('Offline - Image not available', { status: 503 });
  }
}

// Helper functions
function isStaticAsset(request) {
  return request.url.includes('.css') || 
         request.url.includes('.js') || 
         request.url.includes('.woff') || 
         request.url.includes('.ttf') ||
         request.url.includes('fonts.googleapis.com') ||
         request.url.includes('cdn.tailwindcss.com');
}

function isAPIRequest(request) {
  return request.url.includes('/api/') || 
         request.url.includes('/ws/') ||
         request.headers.get('content-type')?.includes('application/json');
}

function isImageRequest(request) {
  return request.headers.get('accept')?.includes('image/') ||
         /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(new URL(request.url).pathname);
}

// Handle background sync for file uploads
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-upload') {
    event.waitUntil(handleBackgroundUpload());
  }
  
  if (event.tag === 'background-sync') {
    event.waitUntil(handleBackgroundSync());
  }
});

async function handleBackgroundUpload() {
  try {
    // Get queued uploads from IndexedDB
    const queuedUploads = await getQueuedUploads();
    
    for (const upload of queuedUploads) {
      try {
        await processQueuedUpload(upload);
        await removeFromQueue(upload.id);
      } catch (error) {
        console.error('[SW] Failed to process queued upload:', error);
      }
    }
  } catch (error) {
    console.error('[SW] Background upload failed:', error);
  }
}

async function handleBackgroundSync() {
  try {
    // Sync processed images to connected devices
    const clients = await self.clients.matchAll();
    clients.forEach(client => {
      client.postMessage({
        type: 'BACKGROUND_SYNC',
        action: 'sync-devices'
      });
    });
  } catch (error) {
    console.error('[SW] Background sync failed:', error);
  }
}

// Handle push notifications
self.addEventListener('push', (event) => {
  if (event.data) {
    const data = event.data.json();
    
    const options = {
      body: data.body || 'New notification from ImageFlow Pro',
      icon: '/icon-192x192.png',
      badge: '/icon-96x96.png',
      tag: data.tag || 'general',
      data: data.data || {},
      actions: [
        {
          action: 'open',
          title: 'Open App'
        },
        {
          action: 'dismiss',
          title: 'Dismiss'
        }
      ],
      requireInteraction: true,
      silent: false
    };
    
    event.waitUntil(
      self.registration.showNotification(data.title || 'ImageFlow Pro', options)
    );
  }
});

// Handle notification clicks
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    return;
  } else {
    // Default action - open app
    event.waitUntil(
      clients.openWindow('/')
    );
  }
});

// Handle share target
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SHARE_TARGET') {
    event.waitUntil(
      handleShareTarget(event.data)
    );
  }
  
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function handleShareTarget(data) {
  const clients = await self.clients.matchAll();
  if (clients.length > 0) {
    clients[0].postMessage({
      type: 'SHARED_FILES',
      files: data.files
    });
  }
}

// Storage helpers for IndexedDB
async function getQueuedUploads() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageFlowDB', 1);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['uploads'], 'readonly');
      const store = transaction.objectStore('uploads');
      const getAllRequest = store.getAll();
      
      getAllRequest.onsuccess = () => resolve(getAllRequest.result);
      getAllRequest.onerror = () => reject(getAllRequest.error);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains('uploads')) {
        db.createObjectStore('uploads', { keyPath: 'id' });
      }
    };
  });
}

async function processQueuedUpload(upload) {
  // Process the queued upload
  const response = await fetch('/api/process-upload', {
    method: 'POST',
    body: upload.data
  });
  
  if (!response.ok) {
    throw new Error(`Upload failed: ${response.status}`);
  }
  
  return response.json();
}

async function removeFromQueue(uploadId) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('ImageFlowDB', 1);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['uploads'], 'readwrite');
      const store = transaction.objectStore('uploads');
      const deleteRequest = store.delete(uploadId);
      
      deleteRequest.onsuccess = () => resolve();
      deleteRequest.onerror = () => reject(deleteRequest.error);
    };
  });
}

// Cache size management
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'GET_CACHE_SIZE') {
    getCacheSize().then(size => {
      event.ports[0].postMessage({ cacheSize: size });
    });
  }
  
  if (event.data && event.data.type === 'CLEAR_CACHE') {
    clearCache().then(() => {
      event.ports[0].postMessage({ success: true });
    });
  }
});

async function getCacheSize() {
  const cacheNames = await caches.keys();
  let totalSize = 0;
  
  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    
    for (const key of keys) {
      const response = await cache.match(key);
      if (response) {
        const blob = await response.blob();
        totalSize += blob.size;
      }
    }
  }
  
  return totalSize;
}

async function clearCache() {
  const cacheNames = await caches.keys();
  return Promise.all(
    cacheNames.map(cacheName => caches.delete(cacheName))
  );
}

console.log('[SW] Service Worker loaded successfully');
