// Service worker minimal — cukup untuk membuat aplikasi ini bisa "Diinstal"
// di Android/Chrome. Tidak menyimpan data transaksi (itu tetap dari Supabase),
// hanya menyimpan file tampilan (HTML/CSS/JS) agar pembukaan aplikasi lebih cepat.

const CACHE_NAME = "sikeudes-shell-v1";
const SHELL_FILES = [
  "./index.html",
  "./app.html",
  "./assets/css/style.css",
  "./assets/js/supabase-client.js",
  "./assets/js/auth.js",
  "./assets/js/app.js",
  "./manifest.json",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategi: coba jaringan dulu (supaya data selalu terbaru dari Supabase),
// kalau gagal (misalnya sinyal jelek), baru pakai salinan dari cache.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, resClone));
        return res;
      })
      .catch(() => caches.match(event.request))
  );
});
