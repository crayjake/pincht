import { Icon } from './home/journal-icons';
import { useLayoutEffect, useRef } from 'react';

// Screens own their docks, so retain the last position across screen remounts.
let previousTab: string | undefined;
const tabIds = ['journal', 'do', 'library'];
export function PrimaryNav({ active }: { active?: string }) {
  const indicator = useRef<HTMLSpanElement>(null);
  const transition = useRef({ from: previousTab, to: active });
  useLayoutEffect(() => {
    if (transition.current.to !== active) transition.current = { from: previousTab, to: active };
    const from = tabIds.indexOf(transition.current.from ?? '');
    const to = tabIds.indexOf(active ?? '');
    previousTab = active;
    if (from < 0 || to < 0 || from === to || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const offset = from - to;
    const animation = indicator.current?.animate?.([
      { transform: `translateX(calc(${offset * 100}% + ${offset * 4}px))` },
      { transform: 'translateX(0)' },
    ], { duration: 260, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    return () => animation?.cancel();
  }, [active]);
  const tabs = [{ id: 'journal', label: 'Journal', path: '/journal', icon: 'book' }, { id: 'do', label: 'Do', path: '/do', icon: 'bolt' }, { id: 'library', label: 'Library', path: '/library', icon: 'library' }] as const;
  return <nav className="primary-nav" aria-label="Primary">{tabs.map(tab => <a key={tab.id} href={`#${tab.path}`} aria-label={tab.label} title={tab.label} aria-current={active === tab.id ? 'page' : undefined}>{active === tab.id && <span ref={indicator} className="primary-nav-indicator" aria-hidden="true" />}<span className="primary-nav-icon"><Icon name={tab.icon} size={24} /></span></a>)}</nav>;
}
export function InDevelopment() {
  return <div className="indev-banner" role="note"><strong>In development</strong><span>Awaiting UI/UX pass</span></div>;
}
