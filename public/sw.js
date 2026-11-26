// Perícias — cópia das telas do app no aparelho, para ele abrir rápido e mostrar um aviso claro sem internet.
// Os dados (processos, prazos, valores) nunca ficam guardados aqui: vêm sempre do servidor.
// Os avisos de prazo entram neste arquivo na Etapa 4.

const APP = 'lm-app-v1';
const ESSENCIAIS = ['/', '/app.js', '/estilo.css', '/vendor/preact-htm.js', '/manifest.webmanifest',
  '/icone.svg', '/icone-192.png', '/logo.png'];

self.addEventListener('install', (e) => e.waitUntil((async () => {
  try { await (await caches.open(APP)).addAll(ESSENCIAIS); } catch { /* sem internet agora: guarda depois */ }
  await self.skipWaiting();
})()));

self.addEventListener('activate', (e) => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== APP) await caches.delete(k);
  await self.clients.claim();
})()));

// Telas: busca no servidor primeiro (versão mais nova); sem resposta em 4 segundos, usa a cópia.
async function daRede(e, req, chave) {
  const cache = await caches.open(APP);
  const rede = fetch(req).then((r) => {
    if (r.ok) e.waitUntil(cache.put(chave, r.clone()).catch(() => {}));
    return r;
  });
  const espera = new Promise((_, falhar) => { setTimeout(() => falhar(new Error('demora')), 4000); });
  try {
    return await Promise.race([rede, espera]);
  } catch {
    const copia = await cache.match(chave);
    return copia || rede;
  }
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  if (req.mode === 'navigate') {
    e.respondWith(daRede(e, req, '/').catch(async () => (await caches.match('/')) || Response.error()));
    return;
  }
  if (ESSENCIAIS.includes(url.pathname) || url.pathname.startsWith('/vendor/')) {
    e.respondWith(daRede(e, req, url.pathname));
  }
});
