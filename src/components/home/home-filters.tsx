import { categories, categoryLabels, emptyFilter, type TimelineFilter } from './journal-data';
import { Icon } from './journal-icons';
import { Sheet } from './journal-sheet';
export function HomeFilters({ filter, onChange, onClose }: { filter: TimelineFilter; onChange: (filter: TimelineFilter) => void; onClose: () => void }) {
  const invalidRange = !!filter.from && !!filter.to && filter.from > filter.to;
  return <Sheet title="Filter journal" onClose={onClose}>
    <fieldset><legend>Categories</legend><div className="category-choices">{categories.map(category => <button type="button" className="category-choice" data-category={category} key={category} aria-pressed={filter.categories.includes(category)} onClick={() => onChange({ ...filter, categories: filter.categories.includes(category) ? filter.categories.filter(c => c !== category) : [...filter.categories, category] })}>{categoryLabels[category]}</button>)}</div></fieldset>
    <fieldset><legend>Date range</legend><div className="date-fields"><label>From<input type="date" value={filter.from} max={filter.to || undefined} onChange={event => onChange({ ...filter, from: event.target.value })} /></label><label>To<input type="date" value={filter.to} min={filter.from || undefined} onChange={event => onChange({ ...filter, to: event.target.value })} /></label></div></fieldset>
    {invalidRange && <p role="alert">Choose an end date on or after the start date.</p>}
    <div className="sheet-actions"><button type="button" className="secondary-button" onClick={() => onChange(emptyFilter)}>Reset filters</button><button type="button" className="primary-button" disabled={invalidRange} onClick={onClose}>Show results</button></div>
  </Sheet>;
}
export function JournalDock({ query, searchOpen, setSearchOpen, onQuery, onFilter, onNew, filtered }: {
  query: string; searchOpen: boolean; setSearchOpen: (open: boolean) => void; onQuery: (query: string) => void; onFilter: () => void; onNew: () => void; filtered: boolean;
}) {
  return <><div className="dock-fade" aria-hidden="true" /><nav className="journal-dock" aria-label="Journal actions">
    {searchOpen ? <form className="dock-search" role="search" onSubmit={event => { event.preventDefault(); (document.activeElement as HTMLElement)?.blur(); }}><Icon name="search" /><input autoFocus type="search" aria-label="Search journal" placeholder="Search journal" value={query} onChange={event => onQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') { onQuery(''); setSearchOpen(false); } }} /><button type="button" className="icon-button" aria-label="Close search" onClick={() => { onQuery(''); setSearchOpen(false); }}><Icon name="close" size={18} /></button></form>
      : <button className="dock-search-trigger" aria-label="Search journal" onClick={() => setSearchOpen(true)}><Icon name="search" />Search journal</button>}
    <button className="dock-filter icon-button" aria-label="Filter by category and date" aria-pressed={filtered} onClick={onFilter}><Icon name="filter" /></button>
    <button className="dock-new icon-button" aria-label="New entry" onClick={onNew}><Icon name="plus" /></button>
  </nav></>;
}
