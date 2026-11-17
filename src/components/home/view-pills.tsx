import { useEffect, useRef } from 'react';
import { Icon } from './journal-icons';
import type { JournalView } from './journal-views';

function ViewPill({ view, selected }: { view: JournalView; selected: boolean }) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const held = useRef(false);
  const start = useRef({ x: 0, y: 0 });
  const clear = () => { clearTimeout(timer.current); };
  useEffect(() => clear, []);
  const edit = () => { clear(); held.current = true; location.hash = `/views/edit/${view.id}`; };
  return <a className="view-pill" href={`#/view/${view.id}`} aria-current={selected ? 'page' : undefined}
    onPointerDown={event => { held.current = false; start.current = { x: event.clientX, y: event.clientY }; timer.current = setTimeout(edit, 550); }}
    onPointerMove={event => { if (Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 8) clear(); }}
    onPointerUp={clear} onPointerCancel={clear} onPointerLeave={clear}
    onClick={event => { if (held.current) event.preventDefault(); }}
    onContextMenu={event => { event.preventDefault(); edit(); }}
    onKeyDown={event => { if (event.key === 'F2' || event.key === 'ContextMenu') { event.preventDefault(); edit(); } }} title={`${view.name} · hold to edit`}>{view.name}</a>;
}

export function ViewPills({ views, selected, onSearch }: { views: JournalView[]; selected: string; onSearch: () => void }) {
  return <div className="journal-view-bar"><nav className="view-pills" aria-label="Journal views">{views.map(view => <ViewPill key={view.id} view={view} selected={selected === view.id} />)}<a className="view-pill view-add" href="#/views/edit/new" aria-label="New view"><Icon name="plus" size={16} /></a></nav><button className="icon-button" aria-label="Search journal" onClick={onSearch}><Icon name="search" /></button></div>;
}
