export function Icon({ name, size = 20 }: { name: 'search' | 'filter' | 'plus' | 'close' | 'note' | 'chevron' | 'more'; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={name === 'plus' ? 2 : 1.75} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {name === 'search' && <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>}
    {name === 'filter' && <><path d="M4 7h9M19 7h1M4 17h1M11 17h9" /><circle cx="16" cy="7" r="2.2" /><circle cx="8" cy="17" r="2.2" /></>}
    {name === 'plus' && <path d="M12 5v14M5 12h14" />}
    {name === 'close' && <path d="m6 6 12 12M6 18 18 6" />}
    {name === 'note' && <path d="M5 7h14M5 12h14M5 17h9" />}
    {name === 'chevron' && <path d="m6 9 6 6 6-6" />}
    {name === 'more' && <g fill="currentColor" stroke="none"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></g>}
  </svg>;
}
