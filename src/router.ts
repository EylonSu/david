import { useEffect, useState } from 'react';

/**
 * Minimal hash router. Routes are '#/'-prefixed paths split into segments:
 *   #/                         -> []                          child Home
 *   #/play/grid/<lessonId>     -> ['play','grid',id]          Grid mode
 *   #/play/single/<lessonId>   -> ['play','single',id]        One-by-one mode
 *   #/admin                    -> ['admin']                   panel (defaults to pictures)
 *   #/admin/pictures           -> picture bank
 *   #/admin/pictures/new       -> picture editor (new)
 *   #/admin/pictures/<id>      -> picture editor (edit)
 *   #/admin/lessons | praises | settings | backup
 */
export type Route = string[];

export const parseHash = (hash: string): Route =>
  hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);

/** Navigate to a path like '/admin/lessons' or '/play/grid/abc'. */
export function navigate(path: string, replace = false): void {
  const hash = '#' + (path.startsWith('/') ? path : '/' + path);
  if (replace) history.replaceState(null, '', hash);
  else location.hash = hash;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

/** Build a hash href for <a href>. */
export const href = (path: string): string => '#' + (path.startsWith('/') ? path : '/' + path);

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
