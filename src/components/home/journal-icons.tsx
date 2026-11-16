export function Icon({ name, size = 20 }: { name: 'search' | 'filter' | 'plus' | 'close' | 'note' | 'chevron' | 'more' | 'today' | 'train' | 'climbs' | 'metrics' | 'back' | 'check' | 'minus' | 'book'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'plus' ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
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
    {name === 'book' && <><path d="M4 4h6a3 3 0 0 1 3 3v14a4 4 0 0 0-4-2H4zm16 0h-4a3 3 0 0 0-3 3v14a4 4 0 0 1 4-2h3z" /></>}
  </svg>;
}
