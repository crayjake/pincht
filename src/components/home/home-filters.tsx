import { categories, categoryLabels, emptyFilter, type TimelineFilter } from './journal-data';
import { Sheet } from './journal-sheet';
export function HomeFilters({ filter, onChange, onClose }: { filter: TimelineFilter; onChange: (filter: TimelineFilter) => void; onClose: () => void }) {
  const invalidRange = !!filter.from && !!filter.to && filter.from > filter.to;
  return <Sheet title="Filter journal" development onClose={onClose}>
    <fieldset><legend>Results</legend><label className="metric-choice"><span>Journal entries only</span><input type="checkbox" checked={filter.entriesOnly} onChange={e => onChange({ ...filter, entriesOnly: e.target.checked, unlogged: e.target.checked ? false : filter.unlogged })} /></label></fieldset>
    <fieldset><legend>Categories</legend><div className="category-choices">{categories.map(category => <button type="button" className="category-choice" data-category={category} key={category} aria-pressed={filter.categories.includes(category)} onClick={() => onChange({ ...filter, categories: filter.categories.includes(category) ? filter.categories.filter(c => c !== category) : [...filter.categories, category] })}>{categoryLabels[category]}</button>)}</div></fieldset>
    <fieldset><legend>Date range</legend><div className="date-fields"><label>From<input type="date" value={filter.from} max={filter.to || undefined} onChange={event => onChange({ ...filter, from: event.target.value })} /></label><label>To<input type="date" value={filter.to} min={filter.from || undefined} onChange={event => onChange({ ...filter, to: event.target.value })} /></label></div></fieldset>
    <fieldset><legend>Routines</legend><label className="metric-choice"><span>Routine check-ins</span><input type="checkbox" checked={filter.routines} onChange={e => onChange({ ...filter, routines: e.target.checked })} /></label><label className="metric-choice"><span>Unlogged only</span><input type="checkbox" checked={filter.unlogged} onChange={e => onChange({ ...filter, unlogged: e.target.checked, entriesOnly: e.target.checked ? false : filter.entriesOnly })} /></label></fieldset>
    {invalidRange && <p role="alert">Choose an end date on or after the start date.</p>}
    <div className="sheet-actions"><button type="button" className="secondary-button" onClick={() => onChange(emptyFilter)}>Reset filters</button><button type="button" className="primary-button" disabled={invalidRange} onClick={onClose}>Show results</button></div>
  </Sheet>;
}
