import { useEffect, useMemo, useState } from 'react';
import './home.scss';
import { HomeFilters, JournalDock } from './home-filters';
import { JournalBody } from './journal-body';
import { categories, chartResources, dayMatches, duration, emptyFilter, groupDays, getNights, localDate, rangeLabel, seedDays, shortDate, type Category, type Day, type DayType, type Entry, type PillResource, type RichBody } from './journal-data';
import { Icon } from './journal-icons';
import { DayRecords, RecordItem } from './journal-records';
import { Sheet } from './journal-sheet';
import { Holds, JournalWidgets, RehabChart, SleepChart } from './journal-widgets';

const storageKey = 'pincht.journal.v1';
const emptyBody: RichBody = { type: 'doc', content: [{ type: 'paragraph' }] };
function loadDays(): Day[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved) && saved.length && saved.every(day => typeof day.date === 'string' && Array.isArray(day.types) && Array.isArray(day.records) && Array.isArray(day.visibleMetrics) && day.metrics && (!day.entry || (typeof day.entry.title === 'string' && day.entry.body?.type === 'doc' && Array.isArray(day.entry.body.content))))) return saved as Day[];
  } catch { /* A damaged or unavailable store falls back to the sample journal. */ }
  return seedDays;
}
function TypeWords({ types }: { types: DayType[] }) {
  return <>{types.map((type, i) => <span key={type}>{i > 0 && <span className="type-join"> + </span>}<span data-category={type}>{type}</span></span>)}</>;
}
function SummaryEditor({ day, onChange, onClose }: { day: Day; onChange: (day: Day) => void; onClose: () => void }) {
  const types: DayType[] = ['climb', 'rehab', 'training', 'rest'];
  return <Sheet title="Day summary" onClose={onClose}>
    <fieldset><legend>Day types</legend><div className="category-choices">{types.map(type => <button type="button" className="category-choice" data-category={type} aria-pressed={day.types.includes(type)} key={type} onClick={() => {
      const next = day.types.includes(type) ? day.types.filter(t => t !== type) : type === 'rest' ? ['rest'] as DayType[] : [...day.types.filter(t => t !== 'rest'), type];
      onChange({ ...day, types: next });
    }}>{type}</button>)}</div></fieldset>
    <fieldset><legend>Show metrics</legend>{(['sleep', 'weight'] as const).map(metric => <label className="metric-choice" key={metric}><span>{metric === 'sleep' ? 'Sleep duration' : 'Body weight'}</span><input type="checkbox" checked={day.visibleMetrics.includes(metric)} onChange={() => onChange({ ...day, visibleMetrics: day.visibleMetrics.includes(metric) ? day.visibleMetrics.filter(m => m !== metric) : [...day.visibleMetrics, metric] })} /></label>)}</fieldset>
    <button className="primary-button full-width" type="button" onClick={onClose}>Done</button>
  </Sheet>;
}
function NewEntry({ days, resources, onSave, onClose, onOpen }: { days: Day[]; resources: PillResource[]; onOpen: (record: PillResource) => void; onSave: (date: string, entry: Entry) => void; onClose: () => void }) {
  const [date, setDate] = useState(localDate);
  const existing = days.find(day => day.date === date)?.entry;
  const [title, setTitle] = useState(existing?.title ?? '');
  const [body, setBody] = useState<RichBody>(existing?.body ?? emptyBody);
  function changeDate(next: string) {
    setDate(next);
    const entry = days.find(day => day.date === next)?.entry;
    setTitle(entry?.title ?? ''); setBody(entry?.body ?? emptyBody);
  }
  return <Sheet title={existing ? 'Edit entry' : 'New entry'} onClose={onClose}>
    <form className="entry-form" onSubmit={event => { event.preventDefault(); if (date && title.trim()) onSave(date, { title: title.trim(), body }); }}>
      <label>Date<input type="date" value={date} required onChange={event => changeDate(event.target.value)} /></label>
      <label>Title<input type="text" value={title} placeholder="Give the day a title" required onChange={event => setTitle(event.target.value)} /></label>
      <p className="composer-hint">Write about your day. Type @ to link a record or chart.</p>
      <JournalBody key={date} body={body} resources={resources} onChange={setBody} onOpen={onOpen} label="New entry body" />
      <button type="submit" className="primary-button full-width" disabled={!date || !title.trim()}>Save entry</button>
    </form>
  </Sheet>;
}
export default function Home() {
  const [days, setDays] = useState(loadDays);
  const [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState(emptyFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [summaryDate, setSummaryDate] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [detail, setDetail] = useState<PillResource | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [sticky, setSticky] = useState<{ title: string; date?: string; types?: Category[] } | null>(null);
  useEffect(() => {
    let failed = false;
    try { localStorage.setItem(storageKey, JSON.stringify(days)); }
    catch { failed = true; }
    queueMicrotask(() => setStorageError(failed));
  }, [days]);
  const resources = useMemo(() => [...chartResources, ...days.flatMap(day => day.records)], [days]);
  // Group before filtering so a written day or a calendar boundary always breaks a routine run.
  const groups = useMemo(() => groupDays(days).flatMap(group => {
    if (group.kind === 'entry') return dayMatches(group.day, query, filter.categories, filter.from, filter.to) ? [group] : [];
    return groupDays(group.days.filter(day => dayMatches(day, query, filter.categories, filter.from, filter.to)));
  }), [days, query, filter]);
  useEffect(() => {
    let frame = 0;
    function update() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const top = parseFloat(getComputedStyle(document.querySelector('.today-page')!).paddingTop) + 36;
        const sections = [...document.querySelectorAll<HTMLElement>('[data-timeline-group]')];
        const active = sections.reverse().find(section => {
          const rect = section.getBoundingClientRect();
          const trigger = section.querySelector('h1')?.getBoundingClientRect().top ?? rect.top;
          return trigger < top + (section.classList.contains('routine-run') ? 20 : 0) && rect.bottom > top;
        });
        setSticky(active ? { title: active.dataset.stickyTitle!, date: active.dataset.stickyDate, types: active.dataset.stickyTypes?.split(',').filter(Boolean) as Category[] | undefined } : null);
      });
    }
    window.addEventListener('scroll', update, { passive: true }); window.addEventListener('resize', update); update();
    return () => { cancelAnimationFrame(frame); window.removeEventListener('scroll', update); window.removeEventListener('resize', update); };
  }, [groups, expanded]);
  function updateDay(day: Day) { setDays(current => current.map(d => d.date === day.date ? day : d)); }
  function toggle(date: string) { setExpanded(current => { const next = new Set(current); if (next.has(date)) next.delete(date); else next.add(date); return next; }); }
  const summaryDay = days.find(day => day.date === summaryDate);
  const filtered = !!(filter.categories.length || filter.from || filter.to);
  return <>
    {sticky && <header className={`sticky-journal-header${sticky.date ? ' sticky-entry-header' : ''}`} aria-hidden="true">{sticky.date ? <><Holds categories={sticky.types ?? []} overlap /><span className="sticky-title">{sticky.title}</span><span className="sticky-date">{sticky.date}</span></> : <span>{sticky.title}</span>}</header>}
    <main className="today-page" aria-label="Today’s climbing journal">
      <JournalWidgets days={days} />
      {storageError && <p role="status" className="storage-notice">Changes are available for this visit. Your browser could not save them.</p>}
      <div className="journal-timeline">
        {groups.map(group => {
          if (group.kind === 'routine') {
            const id = group.days[0].date;
            return <section className="routine-run" data-timeline-group key={`routine-${id}`} data-sticky-title={shortDate(id, { month: 'long', year: 'numeric' })}>
              <header className="routine-range"><span>{rangeLabel(group.days)}</span><span>{group.days.length} {group.days.length === 1 ? 'day' : 'days'}</span></header>
              <div className="routine-card">{group.days.map(day => <div className={`routine-day${expanded.has(day.date) ? ' is-expanded' : ''}`} key={day.date}>
                <button type="button" className="routine-row" aria-label={`${shortDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${day.types.join(' and ')}, ${day.records.length} records`} aria-expanded={expanded.has(day.date)} aria-controls={`records-${day.date}`} onClick={() => toggle(day.date)}>
                  <span className="routine-date">{shortDate(day.date, { weekday: 'short' })} {shortDate(day.date, { day: 'numeric' })}</span><span className="routine-types"><TypeWords types={day.types} /></span><span className="routine-sleep">{day.metrics.sleep !== undefined ? duration(day.metrics.sleep, true) : '—'}</span><span className="routine-weight">{day.metrics.weight !== undefined ? `${day.metrics.weight.toFixed(1)} kg` : '—'}</span>
                </button>
                {expanded.has(day.date) && <DayRecords records={day.records} onOpen={setDetail} compact id={`records-${day.date}`} />}
              </div>)}</div>
            </section>;
          }
          const { day } = group;
          const dayCategories = day.types.filter((type): type is Category => categories.includes(type as Category));
          return <article className="written-entry" key={day.date} data-timeline-group data-sticky-title={day.entry!.title} data-sticky-date={shortDate(day.date, { day: 'numeric', month: 'short' })} data-sticky-types={dayCategories.join(',')}>
            <div className="entry-date"><Holds categories={dayCategories} overlap /><span>{day.date === localDate() && <><strong>Today</strong> · </>}{shortDate(day.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
            <h1>{day.entry!.title}</h1>
            <button type="button" className="entry-summary" aria-label={`Edit summary for ${shortDate(day.date, { day: 'numeric', month: 'long' })}`} onClick={() => setSummaryDate(day.date)}>
              <span><TypeWords types={day.types} /></span>{day.visibleMetrics.filter(metric => day.metrics[metric] !== undefined).map(metric => <span className="summary-metric" key={metric}><span aria-hidden="true"> · </span><span data-category={metric === 'sleep' ? 'sleep' : undefined}>{metric === 'sleep' ? duration(day.metrics.sleep!, true) : `${day.metrics.weight!.toFixed(1)} kg`}</span></span>)}
            </button>
            <JournalBody body={day.entry!.body} resources={resources} onChange={body => updateDay({ ...day, entry: { ...day.entry!, body } })} onOpen={setDetail} />
            <button type="button" className="records-toggle" aria-expanded={expanded.has(day.date)} aria-controls={`records-${day.date}`} onClick={() => toggle(day.date)}><span className="records-toggle-inner"><Holds categories={day.records.map(record => record.kind)} /><span>{day.records.length} records</span><Icon name="chevron" size={16} /></span></button>
            {expanded.has(day.date) && <DayRecords records={day.records} onOpen={setDetail} id={`records-${day.date}`} />}
          </article>;
        })}
        {!groups.length && <p className="empty-timeline" role="status">No days match your search and filters.</p>}
      </div>
    </main>
    <JournalDock query={query} searchOpen={searchOpen} setSearchOpen={setSearchOpen} onQuery={setQuery} onFilter={() => setFilterOpen(true)} onNew={() => setNewOpen(true)} filtered={filtered} />
    {filterOpen && <HomeFilters filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />}
    {summaryDay && <SummaryEditor day={summaryDay} onChange={updateDay} onClose={() => setSummaryDate(null)} />}
    {newOpen && <NewEntry days={days} resources={resources} onOpen={setDetail} onClose={() => setNewOpen(false)} onSave={(date, entry) => {
      setDays(current => current.some(day => day.date === date) ? current.map(day => day.date === date ? { ...day, entry } : day) : [...current, { date, types: [], metrics: {}, visibleMetrics: ['sleep', 'weight'], entry, records: [] }]);
      setNewOpen(false); setQuery(''); setFilter(emptyFilter); window.scrollTo({ top: 0 });
    }} />}
    {detail && <Sheet title={detail.title} onClose={() => setDetail(null)}>
      {/* TODO: Replace this preview with the designed record detail sheet. */}
      <p className="detail-preview-label">Record preview</p>
      {detail.kind === 'chart' ? detail.id === 'chart-rehab' ? <RehabChart /> : <SleepChart nights={getNights(days)} /> : <RecordItem record={detail} onOpen={() => {}} />}
    </Sheet>}
  </>;
}
