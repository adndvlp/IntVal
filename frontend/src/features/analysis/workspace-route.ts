import { useEffect, useState } from 'react';
export type WorkspaceRoute = {
  screen: 'selection' | 'results' | 'history';
  ticker?: string;
};
export function parseWorkspaceRoute(hash: string): WorkspaceRoute {
  if (hash === '#resultados') return { screen: 'results' };
  if (hash === '#historial') return { screen: 'history' };
  if (hash.startsWith('#empresa/')) {
    try {
      const ticker = decodeURIComponent(hash.slice(9));
      if (/^[A-Z0-9][A-Z0-9&.-]{0,31}$/.test(ticker) && !ticker.includes('..'))
        return { screen: 'results', ticker };
    } catch {
      /* Un fragmento mal codificado no rompe la vista. */
    }
  }
  return { screen: 'selection' };
}
export function useWorkspaceRoute() {
  const [route, setRoute] = useState<WorkspaceRoute>(() =>
    typeof window === 'undefined'
      ? { screen: 'selection' }
      : parseWorkspaceRoute(location.hash),
  );
  useEffect(() => {
    const changed = () => setRoute(parseWorkspaceRoute(location.hash));
    const skip = document.querySelector<HTMLAnchorElement>(
      '.skip-link[href="#contenido"]',
    );
    const skipContent = (event: MouseEvent) => {
      event.preventDefault();
      document.getElementById('contenido')?.focus();
    };
    skip?.addEventListener('click', skipContent);
    window.addEventListener('hashchange', changed);
    window.addEventListener('popstate', changed);
    return () => {
      skip?.removeEventListener('click', skipContent);
      window.removeEventListener('hashchange', changed);
      window.removeEventListener('popstate', changed);
    };
  }, []);
  function navigate(hash: string, replace = false) {
    history[replace ? 'replaceState' : 'pushState'](
      { intvalDetail: hash.startsWith('#empresa/') },
      '',
      hash,
    );
    setRoute(parseWorkspaceRoute(hash));
  }
  function closeDetail() {
    if (history.state?.intvalDetail) {
      history.back();
      setRoute({ screen: 'results' });
    } else navigate('#resultados', true);
  }
  return { route, navigate, closeDetail };
}
