/* Service Worker – שגרת צמיחה */
const VERSION = 'hrc-v1.0.1';
const SHELL = ['./', 'index.html', 'styles.css', 'content.js', 'app.js', 'manifest.webmanifest',
  'fonts/fonts.css', 'fonts/heebo-hebrew.woff2', 'fonts/heebo-latin.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/icon-96.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('hrc-') && k !== VERSION).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  // stale-while-revalidate; navigations fall back to the cached shell
  e.respondWith((async () => {
    const cache = await caches.open(VERSION);
    const cached = await cache.match(req, { ignoreSearch: true });
    const net = fetch(req).then(r => { if (r && r.ok) cache.put(req, r.clone()); return r; }).catch(() => null);
    if (cached) { e.waitUntil(net); return cached; }
    const r = await net;
    if (r) return r;
    if (req.mode === 'navigate') return (await cache.match('index.html')) || Response.error();
    return Response.error();
  })());
});

/* ---------- notifications ---------- */
self.addEventListener('message', e => {
  const d = e.data || {};
  if (d.type === 'notify') {
    e.waitUntil(self.registration.showNotification(d.title, {
      body: d.body, tag: d.tag, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png',
      lang: 'he', dir: 'rtl', vibrate: [60, 40, 60], data: { url: d.url || './index.html' }
    }));
  }
  if (d.type === 'skipWaiting') self.skipWaiting();
});
self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil((async () => {
    const all = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of all) { if ('focus' in c) return c.focus(); }
    return clients.openWindow((e.notification.data && e.notification.data.url) || './index.html');
  })());
});

/* periodic background check (Chrome installed PWAs; best-effort) */
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('hrc', 1);
    r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('photos')) db.createObjectStore('photos'); if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta'); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function readMirror() {
  const db = await idb();
  return new Promise(res => { const q = db.transaction('meta').objectStore('meta').get('mirror'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
}
const SLOTS = { morning: ['בוקר טוב ☀️', 'זמן לקצף המינוקסידיל – על קרקפת נקייה ויבשה.'], lunch: ['צהריים 🌿', 'כמוסת דקל ננסי 320mg – עם ארוחה.'], evening: ['ערב טוב 🌙', 'קצף מינוקסידיל ערב – קרקפת נקייה ויבשה, בלי שמן.'] };
const pad = n => String(n).padStart(2, '0');
self.addEventListener('periodicsync', e => {
  if (e.tag !== 'hrc-reminders') return;
  e.waitUntil((async () => {
    const m = await readMirror();
    if (!m || !m.notif) return;
    const now = new Date();
    const key = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    const day = (m.log && m.log[key]) || {};
    for (const slot of Object.keys(SLOTS)) {
      const [h, mi] = (m.times[slot] || '').split(':').map(Number);
      const diff = (now.getHours() * 60 + now.getMinutes()) - (h * 60 + mi);
      if (diff >= 0 && diff <= 90 && !day[slot]) {
        await self.registration.showNotification(SLOTS[slot][0], { body: SLOTS[slot][1], tag: `hrc-${key}-${slot}`, icon: 'icons/icon-192.png', badge: 'icons/icon-96.png', lang: 'he', dir: 'rtl', data: { url: './index.html' } });
      }
    }
  })());
});
