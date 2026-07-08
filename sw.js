// ── DC Hub Service Worker — sempre fresco, nunca cache ────────────────────
// Intercepta navegação e JS/CSS, forçando busca na rede sem cache.
// Garante que o usuário NUNCA veja versão antiga sem precisar de Ctrl+Shift+R.

const SW_VER = '20260622c';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', async (event) => {
  event.waitUntil((async () => {
    // Limpa caches de versões antigas do CacheStorage
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Só intercepta requisições do mesmo domínio
  if (url.origin !== location.origin) return;

  // Navegação (HTML): sempre busca na rede, sem cache
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => fetch(req))
    );
    return;
  }

  // JS e CSS: sempre na rede (já têm ?v= para cache busting de qualquer forma)
  const dest = req.destination;
  if (dest === 'script' || dest === 'style') {
    event.respondWith(
      fetch(req, { cache: 'no-store' }).catch(() => fetch(req))
    );
    return;
  }
  // Demais recursos (imagens, fontes, ícones): comportamento padrão do browser
});
