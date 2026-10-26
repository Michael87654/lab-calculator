"use strict";

// При изменении файлов приложения увеличивайте версию, например до "v2".
const CACHE_VERSION = "v3";
// Область регистрации отделяет кэш от других приложений на том же сайте.
const CACHE_PREFIX = `physcalc-pwa-${self.registration.scope}-`;
const CACHE_NAME = CACHE_PREFIX + CACHE_VERSION;
const APP_FILES = [
  "./index.html",
  "./manifest.json",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Установка успешна только после кэширования всего набора файлов.
    await cache.addAll(APP_FILES.map(file => new Request(
      new URL(file, self.registration.scope).href,
      { cache: "reload" }
    )));
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith(CACHE_PREFIX) && name !== CACHE_NAME)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

async function findOfflineResponse(request) {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    // Поддержка открытия папки приложения и index.html с параметрами URL.
    if (request.mode === "navigate") {
      return await cache.match(new URL("./index.html", self.registration.scope).href);
    }
  } catch (error) { /* Если кэш недоступен, используем сетевой ответ ниже. */ }
  return undefined;
}

async function fetchWithOfflineFallback(request) {
  let networkResponse;
  try {
    networkResponse = await fetch(request);
    if (networkResponse.ok) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put(request, networkResponse.clone());
      } catch (error) { /* Ошибка записи кэша не мешает показать сетевой ответ. */ }
      return networkResponse;
    }
  } catch (error) { /* Без сети переходим к сохранённой копии. */ }
  return await findOfflineResponse(request) || networkResponse || Response.error();
}

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  event.respondWith(fetchWithOfflineFallback(event.request));
});
