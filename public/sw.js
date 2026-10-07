/* Meridian Agency OS — app-shell service worker.
   Strategy:
   - app shell (/, index.html, icons, manifest): cache-first
   - hashed static assets: cache-first (they are immutable)
   - navigation requests: network-first with offline fallback to cached index.html
   - Supabase / API / data requests: NEVER cached (all data lives in Dexie / IndexedDB)
*/
const VERSION = "v1.0.0";
const SHELL_CACHE = `meridian-shell-${VERSION}`;
const STATIC_CACHE = `meridian-static-${VERSION}`;
const OFFLINE_URL = "/index.html";

const SHELL_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/maskable-512.png",
];

const NEVER_CACHE = [/supabase\.co/, /\/auth\/v1\//, /\/rest\/v1\//, /\/storage\/v1\//, /googleapis\.com/];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_ASSETS.map((u) => new Request(u, { cache: "reload" })).slice(1)))
      .catch(() => caches.open(SHELL_CACHE).then((c) => c.add(OFFLINE_URL)))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !k.startsWith(SHELL_CACHE) && !k.startsWith(STATIC_CACHE)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

function isDataRequest(url) {
  return NEVER_CACHE.some((re) => re.test(url.href) || re.test(url.pathname));
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isDataRequest(url)) return;

  // Navigations: network first, fall back to cached shell
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(OFFLINE_URL, copy));
          return res;
        })
        .catch(async () => {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match(OFFLINE_URL)) || (await cache.match("/")) || Response.error();
        }),
    );
    return;
  }

  // Static assets: cache-first
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) {
        // opportunistic revalidate for non-immutable shell files
        if (url.pathname === "/index.html" || url.pathname === "/manifest.webmanifest") {
          fetch(req)
            .then((res) => {
              if (res && res.ok) caches.open(SHELL_CACHE).then((c) => c.put(req, res.clone()));
            })
            .catch(() => {});
        }
        return cached;
      }
      return fetch(req)
        .then((res) => {
          if (res && res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() =>
          req.mode === "navigate" ? caches.match(OFFLINE_URL).then((r) => r || Response.error()) : Response.error(),
        );
    }),
  );
});

// Background sync hook (optional — Dexie queue is the durable source of truth)
self.addEventListener("sync", (event) => {
  if (event.tag === "meridian-sync") {
    event.waitUntil(
      self.clients.matchAll().then((clients) => {
        clients.forEach((client) => client.postMessage({ type: "MERIDIAN_SYNC" }));
      }),
    );
  }
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});
