import type { ReactNode } from 'react';
import type { Routine, RoutineData } from '../../routines/data';
import { categories, categoryLabels, shortDate, type Day, type PillResource, type TimelineFilter } from './journal-data';
import { Icon } from './journal-icons';
import { searchJournal } from './journal-search-data';

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return text;
  const parts: ReactNode[] = []; let cursor = 0, found: number;
  while ((found = text.toLocaleLowerCase().indexOf(needle, cursor)) >= 0) {
    parts.push(text.slice(cursor, found), <mark key={found}>{text.slice(found, found + needle.length)}</mark>); cursor = found + needle.length;
  }
  return <>{parts}{text.slice(cursor)}</>;
}
export function JournalSearch({ days, data, query, onQuery, filter, onFilter, onAllFilters, onClose, onOpen, onRoutine }: { days: Day[]; data: RoutineData; query: string; onQuery: (query: string) => void; filter: TimelineFilter; onFilter: (filter: TimelineFilter) => void; onAllFilters: () => void; onClose: () => void; onOpen: (resource: PillResource) => void; onRoutine: (routine: Routine, date: string) => void }) {
  const results = searchJournal(days, data, query, filter);
  const count = filter.categories.length + Number(filter.routines) + Number(!!(filter.from || filter.to)) + Number(filter.unlogged) + Number(filter.entriesOnly);
  return <main className="search-page" aria-label="Search journal">
    <header className="search-header"><form role="search" onSubmit={event => { event.preventDefault(); (document.activeElement as HTMLElement)?.blur(); }}><Icon name="search" /><input autoFocus type="search" aria-label="Search journal" value={query} onChange={event => onQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Escape') onClose(); }} placeholder="Search journal" />{query && <button type="button" aria-label="Clear search" onClick={() => onQuery('')}><Icon name="close" size={16} /></button>}</form><button className="text-action" onClick={onClose}>Cancel</button></header>
    <div className="search-chips"><button className="chip" onClick={onAllFilters} aria-label={`All filters, ${count} active`}><Icon name="filter" size={18} />{count > 0 && <span className="filter-count">{count}</span>}</button>{categories.map(category => <button className="chip" data-category={category} aria-pressed={filter.categories.includes(category)} key={category} onClick={() => onFilter({ ...filter, categories: filter.categories.includes(category) ? filter.categories.filter(c => c !== category) : [...filter.categories, category] })}>{categoryLabels[category]}</button>)}</div>
    <div className="search-chips secondary-chips"><button className="chip" aria-pressed={filter.entriesOnly} onClick={() => onFilter({ ...filter, entriesOnly: !filter.entriesOnly, unlogged: false })}>Journal entries only</button><button className="chip" aria-pressed={filter.routines} onClick={() => onFilter({ ...filter, routines: !filter.routines })}>Routines</button><button className="chip" aria-pressed={!!(filter.from || filter.to)} onClick={onAllFilters}>Date <Icon name="chevron" size={14} /></button><button className="chip unlogged-chip" aria-pressed={filter.unlogged} onClick={() => onFilter({ ...filter, unlogged: !filter.unlogged, entriesOnly: false })}>Unlogged only</button></div>
    <p className="search-count mono muted" role="status">{results.length} {results.length === 1 ? 'result' : 'results'} · {filter.entriesOnly ? 'journal entries' : filter.unlogged ? 'unlogged routines' : filter.categories.length === 1 && !filter.routines ? `${categoryLabels[filter.categories[0]].toLowerCase()} records and entries` : 'records and entries'}</p>
    <div className="search-results">{results.map(result => <article className="search-result" key={result.id}>
      <div className="search-result-top">{result.kind === 'record' ? <button className="result-pill" data-category={result.record.kind} onClick={() => onOpen(result.record)}><Highlight text={result.record.title} query={query} /></button> : <span className="eyebrow muted">{result.kind === 'entry' ? 'Journal' : 'Routine'}</span>}<span className="mono muted">{shortDate(result.date, { weekday: 'short', day: 'numeric', month: 'short' })}</span></div>
      {result.kind === 'record' && <><div className="record-meta"><Highlight text={[result.record.metric, result.record.meta].filter(Boolean).join(' · ')} query={query} /></div>{result.record.note && <p><Highlight text={result.record.note} query={query} /></p>}</>}
      {result.kind === 'entry' && <><a className="result-entry-title" href={`#/journal/${result.date}`}><Highlight text={result.entry.title || 'Untitled entry'} query={query} /></a><p><Highlight text={result.excerpt} query={query} /></p></>}
      {result.kind === 'routine' && <div className="result-routine"><div><strong><Highlight text={result.routine.name} query={query} /></strong><p>{result.skipped ? 'skipped' : 'unlogged'}</p></div><button className="log-button" onClick={() => onRoutine(result.routine, result.date)}>{result.skipped ? 'Edit' : 'Log'}</button></div>}
    </article>)}</div>
    {!results.length && <p className="empty-timeline">No matches. Try another search or adjust your filters.</p>}
  </main>;
}
