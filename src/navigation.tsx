import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type AnchorHTMLAttributes, type ReactNode, type SetStateAction } from 'react';
import { getDataMode } from './data/mode';
import { lastJournalView } from './components/home/journal-views';

const readPath = () => location.hash.slice(1) || '/journal';
const routeKey = (path: string) => `${getDataMode()}:${path === '/journal' || path === '/' ? `/view/${lastJournalView().id}` : path}`;
type Position = { x: number; y: number; anchor?: string; offset?: number };
type Visit = { id: string; path: string; from?: string };
const Navigation = createContext<{ path: string; memory: Map<string, unknown>; key: string } | null>(null);

function capturePosition(): Position {
  const anchors = [...document.querySelectorAll<HTMLElement>('[data-navigation-anchor]')];
  const anchor = anchors.find(element => element.getBoundingClientRect().bottom > 100);
  return { x: window.scrollX, y: window.scrollY, anchor: anchor?.dataset.navigationAnchor, offset: anchor?.getBoundingClientRect().top };
}

// Own scroll restoration: fragment navigation otherwise races the editor mounting
// and Safari's keyboard dismissal. Keep a position per visit and per dock/view.
export function NavigationProvider({ children }: { children: ReactNode }) {
  const [visit, setVisit] = useState<Visit>(() => {
    const path = readPath();
    const previous = history.state?.pinchtNavigation as Visit | undefined;
    const initial = previous?.path === path ? previous : { id: crypto.randomUUID(), path };
    history.replaceState({ ...history.state, pinchtNavigation: initial }, '');
    return initial;
  });
  const active = useRef(visit);
  const positions = useRef(new Map<string, Position>());
  const routes = useRef(new Map<string, Position>());
  const [memory] = useState(() => new Map<string, unknown>());
  const key = routeKey(visit.path);
  const activeKey = useRef(key);
  useEffect(() => {
    const previousRestoration = history.scrollRestoration;
    history.scrollRestoration = 'manual';
    const capture = () => {
      if (readPath() !== active.current.path) return;
      const position = capturePosition();
      positions.current.set(active.current.id, position);
      routes.current.set(activeKey.current, position);
    };
    const update = () => {
      const path = readPath();
      const saved = history.state?.pinchtNavigation as Visit | undefined;
      if (saved?.id === active.current.id && path === active.current.path) return;
      const next = saved?.path === path && saved.id !== active.current.id
        ? saved : { id: crypto.randomUUID(), path, from: active.current.path };
      history.replaceState({ ...history.state, pinchtNavigation: next }, '');
      active.current = next;
      activeKey.current = routeKey(path);
      setVisit(next);
    };
    document.addEventListener('pointerdown', capture, true);
    document.addEventListener('click', capture, true);
    window.addEventListener('scroll', capture, { passive: true });
    window.addEventListener('hashchange', update);
    return () => {
      history.scrollRestoration = previousRestoration;
      document.removeEventListener('pointerdown', capture, true);
      document.removeEventListener('click', capture, true);
      window.removeEventListener('scroll', capture);
      window.removeEventListener('hashchange', update);
    };
  }, []);
  useLayoutEffect(() => {
    active.current = visit;
    activeKey.current = key;
    const position = positions.current.get(visit.id) ?? routes.current.get(key);
    let cancelled = false;
    const restore = () => {
      if (cancelled) return;
      const anchor = position?.anchor && [...document.querySelectorAll<HTMLElement>('[data-navigation-anchor]')].find(element => element.dataset.navigationAnchor === position.anchor);
      const y = anchor && position.offset !== undefined ? window.scrollY + anchor.getBoundingClientRect().top - position.offset : position?.y ?? 0;
      window.scrollTo(position?.x ?? 0, y);
    };
    restore();
    const frame = requestAnimationFrame(restore);
    void document.fonts?.ready.then(restore);
    const cancel = () => { cancelled = true; };
    // iOS may finish closing the keyboard after the destination has mounted.
    window.visualViewport?.addEventListener('resize', restore);
    document.addEventListener('pointerdown', cancel, true);
    document.addEventListener('touchmove', cancel, { passive: true });
    document.addEventListener('wheel', cancel, { passive: true });
    const timeout = window.setTimeout(cancel, 700);
    return () => {
      cancel(); cancelAnimationFrame(frame); clearTimeout(timeout);
      window.visualViewport?.removeEventListener('resize', restore);
      document.removeEventListener('pointerdown', cancel, true);
      document.removeEventListener('touchmove', cancel);
      document.removeEventListener('wheel', cancel);
    };
  }, [visit, key]);
  return <Navigation.Provider value={{ path: visit.path, memory, key }}>{children}</Navigation.Provider>;
}

export function usePath() { return useContext(Navigation)!.path; }

export function useRememberedState<T,>(name: string, initial: () => T) {
  const navigation = useContext(Navigation);
  const key = `${navigation?.key}:${name}`;
  const [value, setValue] = useState<T>(() => navigation?.memory.has(key) ? navigation.memory.get(key) as T : initial());
  function update(next: SetStateAction<T>) {
    setValue(previous => {
      const value = typeof next === 'function' ? (next as (previous: T) => T)(previous) : next;
      navigation?.memory.set(key, value);
      return value;
    });
  }
  return [value, update] as const;
}

// Keep the existing back affordance, but return to the actual caller (a journal
// mention, search result, or Library list) instead of always opening a category.
export function BackLink({ href, onClick, ...props }: AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a {...props} href={href} onClick={event => {
    onClick?.(event);
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (history.state?.pinchtNavigation?.from) { event.preventDefault(); history.back(); }
  }} />;
}
