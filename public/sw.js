/* Service Worker: shell/assets cache para tablets. Las comandas offline se
 * gestionan en el cliente (lib/offline-queue.ts) y se reintentan al volver online. */

const VERSION = "v1";
const SHELL_CACHE = `gr-shell-${VERSION}`;
const ASSET_CACHE = `gr-assets-${VERSION}`;
const SHELL_URLS = [
  "/offline",
  "/login",
  "/manifest.json",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
];
const PUBLIC_PREFIXES = ["/login", "/cliente", "/reservar", "/offline"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS))
      .catch(() => undefined)
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== ASSET_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.json" ||
    /\.(css|js|mjs|woff2?|ttf|otf|png|jpe?g|svg|webp|avif|ico|mp3)$/.test(url.pathname)
  );
}

function isPublicPage(url) {
  return PUBLIC_PREFIXES.some(
    (prefix) => url.pathname === prefix || url.pathname.startsWith(`${prefix}/`)
  );
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navegación: network-first con fallback al shell/offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && isPublicPage(url)) {
            const copy = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          return (
            (await caches.match(request)) ||
            (await caches.match("/offline")) ||
            (await caches.match("/login"))
          );
        })
    );
    return;
  }

  // Assets estáticos: cache-first con actualización en segundo plano.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(ASSET_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);

        return cached || network;
      })
    );
  }
});
