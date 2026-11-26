/* Game Shape service worker.
   RELEASE: bump VERSION to match APP_VERSION in index.html and version.json. */
const VERSION = "gs-2.7.2";
const FILES = ["./", "./index.html", "./intake.html", "./manifest.json", "./wordmark-on-light.png", "./icon-180.png", "./icon-192.png", "./icon-512.png", "./favicon.ico", "./cpe-logo.png", "./gs-mark.png", "./books.json", "./schedule-lib.js", "./profiles.js", "./manifest-mark.json", "./manifest-will.json", "./mark-badge.jpg", "./will-badge.jpg"];
self.addEventListener("install", e => { e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).catch(() => {}).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("message", e => { if (e.data === "SKIP_WAITING") self.skipWaiting(); });
/* Network first: online users always get the newest build. Offline falls back to cache.
   version.json is never cached so update checks are always fresh. */
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  if (url.pathname.endsWith("version.json") || url.pathname.includes("/.netlify/functions/")) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then(x => x.put(e.request, c)); } return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("./index.html"))));
});
