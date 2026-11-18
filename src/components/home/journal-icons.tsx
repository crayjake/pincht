export function Icon({ name, size = 20 }: { name: 'edit' | 'settings' | 'barcode' | 'search' | 'filter' | 'plus' | 'close' | 'note' | 'chevron' | 'more' | 'today' | 'train' | 'climbs' | 'metrics' | 'back' | 'check' | 'minus' | 'book' | 'play' | 'library' | 'bolt' | 'sleep' | 'drink' | 'weight' | 'goal'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'plus' ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'settings' && <><path d="M9.7 4.3 10.2 2h3.6l.5 2.3 2.3 1.3 2.2-.7 1.8 3.2-1.7 1.6v2.6l1.7 1.6-1.8 3.2-2.2-.7-2.3 1.3-.5 2.3h-3.6l-.5-2.3-2.3-1.3-2.2.7-1.8-3.2 1.7-1.6V9.7L3.4 8.1l1.8-3.2 2.2.7z" transform="translate(0 1)" /><circle cx="12" cy="12" r="3" /></>}
    {name === 'edit' && <><path d="m14.5 4.5 5 5M4 20l4.5-1L20 7.5a2.1 2.1 0 0 0-3-3L5.5 16z" /></>}
    {name === 'barcode' && <path d="M4 7V4h3m10 0h3v3M4 17v3h3m10 0h3v-3M8 8v8m3-8v8m3-8v8m3-8v8" />}
    {name === 'search' && <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>}
    {name === 'filter' && <><path d="M4 7h9M19 7h1M4 17h1M11 17h9" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></>}
    {name === 'plus' && <path d="M12 5v14M5 12h14" />}
    {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
    {name === 'note' && <path d="M5 7h14M5 12h14M5 17h9" />}
    {name === 'chevron' && <path d="m6 9 6 6 6-6" />}
    {name === 'more' && <g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></g>}
    {name === 'today' && <><rect x="4" y="5" width="16" height="16" rx="4" /><path d="M8 3v4m8-4v4M4 10h16m-12 5h3" /></>}
    {name === 'train' && <path d="M3 9v6M6.5 6.5v11M17.5 6.5v11M21 9v6M6.5 12h11" />}
    {name === 'climbs' && <path d="M3 19 9.5 8l4 6.5 2.5-3.5L21 19z" />}
    {name === 'metrics' && <path d="M5 20v-8M12 20V5m7 15v-5" />}
    {name === 'back' && <path d="m14 6-6 6 6 6" />}
    {name === 'check' && <path d="m5 12 4 4L19 6" />}
    {name === 'minus' && <path d="M5 12h14" />}
    {name === 'play' && <path d="m9 5 11 7-11 7z" />}
    {name === 'library' && <>{[[4,4],[13,4],[4,13],[13,13]].map(([x,y]) => <rect key={`${x}-${y}`} x={x} y={y} width="7" height="7" rx="2" />)}</>}
    {name === 'book' && <path d="M12 6c-2-1.5-5-2-8-1.5v13c3-.5 6 0 8 1.5 2-1.5 5-2 8-1.5v-13C17 4 14 4.5 12 6zM12 6v13" />}
    {name === 'bolt' && <path d="M13 3 5.5 13.5H11L10 21l7.5-10.5H12z" />}
    {name === 'sleep' && <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" />}
    {name === 'drink' && <path d="M7 4h10l-1 8a4 4 0 0 1-8 0zM12 16v4M9 20h6" />}
    {name === 'weight' && <><rect x="4" y="4" width="16" height="16" rx="4" /><path d="M8 10a4 4 0 0 1 8 0M12 10l2-2" /></>}
    {name === 'goal' && <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><path d="m12 12 8-8" /></>}
  </svg>;
}
