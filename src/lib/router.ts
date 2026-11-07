import { useSyncExternalStore } from 'react';

// Router mínimo por hash (#/ruta): funciona en GitHub Pages sin configurar el servidor.
function read(): string {
  const h = window.location.hash.replace(/^#\/?/, '');
  return h.split('?')[0];
}

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

export function useRoute(): string[] {
  const path = useSyncExternalStore(subscribe, read, () => '');
  return path.split('/').filter(Boolean).map(decodeURIComponent);
}

export function navigate(path: string, opts: { replace?: boolean } = {}) {
  const target = '#/' + path.replace(/^\/+/, '');
  if (opts.replace) window.location.replace(target);
  else window.location.hash = target;
  window.scrollTo({ top: 0 });
}

export function goBack(fallback = '') {
  if (window.history.length > 1) window.history.back();
  else navigate(fallback, { replace: true });
}
