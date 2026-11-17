import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSessions } from '../../workouts/storage';
import './home.scss';
import { HomeFilters } from './home-filters';
import { JournalBody, type CreatableRecordKind } from './journal-body';
import { chartResources, duration, emptyFilter, entryRecords, groupDays, getNights, hasJournalContent, localDate, rangeLabel, shortDate, type Day, type DayType, type Entry, type JournalRecord, type PillResource, type RichBody } from './journal-data';
import { Icon } from './journal-icons';
import { DayRecords, RecordItem } from './journal-records';
import { Sheet } from './journal-sheet';
import { ViewWidgets, RehabChart, SleepChart } from './journal-widgets';
import { PrimaryNav } from '../app-navigation';
import { DueToday, HabitRows } from '../../routines/due-today';
import { addDays, adherence, withRoutineDays, type Routine } from '../../routines/data';
import { useRoutines } from '../../routines/use-routines';
import { AlcoholSheet, ReadingSheet, WelcomeSheet } from '../../routines/routine-sheets';
import { dragLoads } from '../../routines/rehab-loads';
import { JournalSearch } from './journal-search';
import { daySummary, type SummaryCategory } from './journal-summary';
import { climbingView, isViewDay, loadViews } from './journal-views';
import { withMentionedClimbs } from './journal-climbs';
import { routineLink } from '../../routines/tasks';
import { workoutPlans } from '../../workouts/fixtures';

import { JOURNAL_KEY, JOURNAL_RESOURCES_KEY, loadDays, loadResources, saveDays, saveResources } from './journal-storage';
import { dataKey, getDataMode, type DataMode } from '../../data/mode';
const emptyBody: RichBody = { type: 'doc', content: [{ type: 'paragraph' }] };
const summaryRoutes: Partial<Record<SummaryCategory, string>> = {
  climb: '#/climbing', rehab: '#/train/pulley-rehab', training: '#/train', sleep: '#/metrics', weight: '#/metrics',
};
function TypeWords({ types }: { types: DayType[] }) {
  return <>{types.map((type, i) => <span key={type}>{i > 0 && <span className="type-join"> + </span>}<span data-category={type}>{type}</span></span>)}</>;
}
export default function Home({ entryDate, screen = 'journal', onDataMode, viewId }: { viewId?: string; entryDate?: string; screen?: 'today' | 'journal' | 'climbing'; onDataMode?: (mode: DataMode) => void }) {
  const [storageKey] = useState(() => dataKey(JOURNAL_KEY));
  const [resourcesKey] = useState(() => dataKey(JOURNAL_RESOURCES_KEY));
  const [createdResources, setCreatedResources] = useState(() => {
    try { return loadResources(resourcesKey); } catch { return []; }
  });
  const [baseDays, setDays] = useState(() => loadDays(storageKey));
  const routines = useRoutines(!entryDate);
  const { data, update, recentSkips } = routines;
  const [sessions] = useState(() => loadSessions());
  const today = localDate();
  const days = useMemo(() => {
    const withToday = baseDays.some(day => day.date === today) ? baseDays : [...baseDays, { date: today, types: [], records: [], metrics: {}, visibleMetrics: [] }];
    return withRoutineDays(withToday, data, today);
  }, [baseDays, data, today]);
  const loads = useMemo(() => dragLoads(sessions), [sessions]);
  const [storageError, setStorageError] = useState('');
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState(emptyFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<PillResource | null>(null);
  const [routineDetail, setRoutineDetail] = useState<{ routine: Routine; date: string } | null>(null);
  const view = useMemo(() => screen === 'climbing' ? loadViews().find(view => view.id === (viewId ?? 'climbing')) ?? climbingView : undefined, [screen, viewId]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [openComposers, setOpenComposers] = useState<Set<string>>(() => new Set());
  const [scrolled, setScrolled] = useState(false);
  const journalHeading = useRef<HTMLElement>(null);
  useEffect(() => {
    let error = '';
    try { saveDays(baseDays, storageKey); saveResources(createdResources, resourcesKey); } catch (cause) { error = cause instanceof Error && cause.message.startsWith('Journal data') ? cause.message : 'Changes are available for this visit. Your browser could not save them.'; }
    queueMicrotask(() => setStorageError(error));
  }, [baseDays, storageKey, createdResources, resourcesKey]);
  useEffect(() => {
    function scroll() {
      const y = window.scrollY;
      const heading = journalHeading.current;
      const bounds = heading?.getBoundingClientRect();
      const pinTop = heading ? parseFloat(getComputedStyle(heading).top) || 50 : 50;
      setScrolled(entryDate ? y > 120 : !!bounds?.height && bounds.top <= pinTop);
    }
    scroll();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    return () => { window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); };
  }, [entryDate, searchOpen, screen]);
  const screenTitle = screen === 'today' ? 'To-do' : view?.name ?? 'Journal';
  useEffect(() => { document.title = `${entryDate ? days.find(d => d.date === entryDate)?.entry?.title || 'Journal' : searchOpen ? 'Search' : screenTitle} · pincht`; }, [entryDate, searchOpen, days, screenTitle]);
  const resources = useMemo<PillResource[]>(() => [...new Map([...chartResources,
    ...workoutPlans.map(plan => ({ id: `plan-${plan.id}`, kind: plan.id.includes('rehab') ? 'rehab' : 'training', title: plan.name, metric: 'Workout', meta: '' } as JournalRecord)),
    ...data.books.map(book => ({ id: `book-${book.id}`, kind: 'habit', title: book.title, metric: 'Book', meta: book.author } as JournalRecord)),
    ...createdResources, ...days.flatMap(day => day.records)].map(record => [record.id, record])).values()], [days, data.books, createdResources]);
  const viewDays = useMemo(() => view && !entryDate ? days.filter(day => isViewDay(day, view)) : days, [days, view, entryDate]);
  const groups = useMemo(() => {
    // Empty composers are a display state, never a saved journal entry.
    const visible = entryDate ? [days.find(day => day.date === entryDate) ?? { date: entryDate, types: [], records: [], metrics: {}, visibleMetrics: [] } as Day] : viewDays;
    return groupDays(visible.map(day => day.date === today || entryDate ? { ...day, entry: day.entry ?? { title: '', body: emptyBody } } : day));
  }, [days, viewDays, entryDate, today]);
  function updateEntry(day: Day, entry: Entry) {
    setDays(current => {
      const latest = current.find(d => d.date === day.date) ?? day;
      const next = { ...latest, entry: hasJournalContent(entry) ? entry : undefined, records: withMentionedClimbs(entry, latest.records.filter(record => !record.id.startsWith('routine-')), resources) };
      return current.some(d => d.date === day.date) ? current.map(d => d.date === day.date ? next : d) : [...current, next];
    });
  }
  function updateRecord(day: Day, record: JournalRecord) {
    setDays(current => {
      const latest = current.find(d => d.date === day.date) ?? day;
      const next = { ...latest, records: [...latest.records.filter(r => r.id !== record.id && !r.id.startsWith('routine-')), record] };
      return current.some(d => d.date === day.date) ? current.map(d => d.date === day.date ? next : d) : [...current, next];
    });
  }
  function createRecord(day: Day, title: string, kind: CreatableRecordKind) {
    const prefix = kind === 'habit' ? 'book' : kind;
    const record: JournalRecord = { id: `${prefix}-${crypto.randomUUID()}`, kind, title, metric: kind === 'habit' ? 'Book' : kind === 'training' ? 'Workout' : '', meta: '', ...(kind === 'climb' ? { climb: { goes: 0 } } : {}) };
    setCreatedResources(current => [...current, record]);
    // Only climbs log activity through a mention. Other categories remain references.
    if (kind === 'climb') updateRecord(day, record);
    setExpanded(current => new Set([...current, day.date]));
    return record;
  }
  function toggle(date: string) { setExpanded(current => { const next = new Set(current); if (next.has(date)) next.delete(date); else next.add(date); return next; }); }
  function openRoutine(routine: Routine, date: string) {
    if (routine.kind === 'rehab' || routine.kind === 'training') { location.hash = routineLink(routine).slice(1); return; }
    setRoutineDetail({ routine, date });
  }
  function closeSearch() { setSearchOpen(false); setQuery(''); setFilter(emptyFilter); window.scrollTo(0, 0); }
  const focused = days.find(d => d.date === entryDate);
  const tasks = (variant: 'card' | 'journal' | 'compact' | 'todo') => <DueToday data={data} recentSkips={recentSkips} sessions={sessions} onChange={update} onOpen={openRoutine} tags={view?.tags} variant={variant} />;
  const searchActions = <><button className="icon-button feed-search-trigger" aria-label="Search journal" onClick={() => { setSearchOpen(true); window.scrollTo(0, 0); }}><Icon name="search" size={20} /><span>Search journal</span></button><button className="icon-button feed-filter-trigger" aria-label="Filter journal" onClick={() => { setSearchOpen(true); setFilterOpen(true); window.scrollTo(0, 0); }}><Icon name="filter" size={20} /></button></>;
  const timeline = <div className="journal-timeline">
          {groups.map(group => {
            if (group.kind === 'routine') {
              const id = group.days[0].date;
              return <section className="routine-run" key={`routine-${id}`}>
                <header className="routine-range"><span>{rangeLabel(group.days)}</span><span>{group.days.length} {group.days.length === 1 ? 'day' : 'days'}</span></header>
                {screen !== 'climbing' && <p className="run-adherence">{adherence(data, group.days.map(d => d.date))}</p>}
                <div className="routine-card">{group.days.map(day => <div className={`routine-day${expanded.has(day.date) ? ' is-expanded' : ''}`} key={day.date}>
                  <button type="button" className="routine-row" aria-label={`${shortDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${day.types.join(' and ')}, ${day.records.length} records`} aria-expanded={expanded.has(day.date)} aria-controls={`records-${day.date}`} onClick={() => toggle(day.date)}>
                    <span className="routine-date">{shortDate(day.date, { weekday: 'short' })} {shortDate(day.date, { day: 'numeric' })}</span><span className="routine-types"><TypeWords types={day.types} /></span><span className="routine-sleep">{day.metrics.sleep !== undefined ? duration(day.metrics.sleep, true) : '—'}</span><span className="routine-weight">{day.metrics.weight !== undefined ? `${day.metrics.weight.toFixed(1)} kg` : '—'}</span>
                  </button>
                  {screen !== 'climbing' && <HabitRows data={data} date={day.date} recentSkips={recentSkips} onOpen={openRoutine} onChange={update} />}
                  {expanded.has(day.date) && <div id={`records-${day.date}`}>
                    <DayRecords records={day.records} onOpen={setDetail} editableIds={day.records.map(record => record.id)} onUpdate={record => updateRecord(day, record)} compact id={`day-records-${day.date}`} />
                    <a className="write-entry-action text-action" href={`#/journal/${day.date}`}>Write journal entry</a>
                  </div>}
                </div>)}</div>
              </section>;
            }
            const { day } = group;
            const summaryItems = daySummary(day, data);
            const records = entryRecords(day, resources);
            return <article className={`written-entry${!hasJournalContent(day.entry) ? ' empty-entry' : ''}${openComposers.has(day.date) ? ' composer-open' : ''}`} key={day.date} onFocusCapture={event => {
              if (!(event.target as HTMLElement).closest('.entry-title-input, .journal-body')) return;
              // Keep the composer open for this visit, so focusing a task or record
              // cannot move that control between pointer-down and click.
              setOpenComposers(current => current.has(day.date) ? current : new Set([...current, day.date]));
            }}>
              <div className="entry-date"><span>{day.date === localDate() ? <><strong>Today</strong> · </> : day.date === addDays(localDate(), -1) ? <>Yesterday · </> : ''}{shortDate(day.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              {summaryItems.length > 0 && <div className="entry-summary" aria-label="Day summary">
                {summaryItems.map(item => {
                  const href = summaryRoutes[item.category];
                  const routine = item.category === 'habit' ? data.routines.find(routine => routine.id === item.id) : undefined;
                  return href
                    ? <a className="summary-item" data-category={item.category} key={item.id} href={href}>{item.label}</a>
                    : routine
                      ? <button type="button" className="summary-item" data-category={item.category} key={item.id} onClick={() => openRoutine(routine, day.date)}>{item.label}</button>
                      : <span className="summary-item" data-category={item.category} key={item.id}>{item.label}</span>;
                })}
              </div>}
              {entryDate || day.date === today ? <input className="entry-title-input" aria-label="Journal title" placeholder="Journal title" value={day.entry!.title} onChange={event => updateEntry(day, { ...day.entry!, title: event.target.value })} /> : <h1><a href={`#/journal/${day.date}`}>{day.entry!.title || 'Untitled entry'}</a></h1>}
              <JournalBody body={day.entry!.body} resources={resources} placeholder={day.date === today || entryDate ? 'Write about your day…' : undefined} onChange={body => updateEntry(day, { ...day.entry!, body })} onCreateRecord={(title, kind) => createRecord(day, title, kind)} onOpen={record => { if (record.kind === 'climb') setExpanded(current => new Set([...current, day.date])); else if (record.id.startsWith('plan-')) location.hash = `/train/${record.id.slice(5)}`; else setDetail(record); }} />
              {(entryDate || (screen === 'journal' && day.date !== today)) && <HabitRows data={data} date={day.date} recentSkips={recentSkips} onOpen={openRoutine} onChange={update} />}
              {entryDate ? <DayRecords records={records} onOpen={setDetail} editableIds={day.records.map(record => record.id)} onUpdate={record => updateRecord(day, record)} id={`records-${day.date}`} /> : <>
                <button type="button" className="records-toggle" aria-expanded={expanded.has(day.date)} aria-controls={`records-${day.date}`} onClick={() => toggle(day.date)}><span className={`records-toggle-inner${!records.length ? ' records-empty' : ''}`}><span>{records.length} records</span><Icon name="chevron" size={16} /></span></button>
                {expanded.has(day.date) && <DayRecords records={records} onOpen={setDetail} editableIds={day.records.map(record => record.id)} onUpdate={record => updateRecord(day, record)} id={`records-${day.date}`} />}
              </>}
              {!entryDate && screen === 'journal' && day.date === today && tasks('journal')}
            </article>;
          })}
          {!groups.length && <p className="empty-timeline" role="status">{entryDate ? 'There is no written entry for this day.' : screen === 'climbing' ? 'No climbing, rehab, or training days logged yet.' : 'Your journal is empty.'}</p>}
        </div>;
  return <>
    {searchOpen && !entryDate ? <JournalSearch days={viewDays} data={data} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} onAllFilters={() => setFilterOpen(true)} onClose={closeSearch} onOpen={setDetail} onRoutine={openRoutine} /> : <>
      {entryDate && <header className="expanded-header"><a className="icon-button" href="#/journal" aria-label="Back to Journal"><Icon name="back" /></a><span className="sticky-title">{scrolled ? focused?.entry?.title || 'Journal' : 'Journal'}</span>{scrolled && <span className="sticky-date">{shortDate(entryDate, { day: 'numeric', month: 'short' })}</span>}</header>}
      <main className={`today-page screen-${screen}${entryDate ? ' expanded-page' : ''}`} aria-label={entryDate ? 'Expanded journal entry' : screenTitle}>
        {!entryDate && screen === 'today' && <>
          <header className="screen-heading"><div><h1>To-do</h1></div><a className="text-action" href="#/routines">Routines ›</a></header>
          {tasks('todo')}
          {onDataMode && <label className="data-mode-switch">Stored data<select aria-label="Stored data mode" value={getDataMode()} onChange={event => onDataMode(event.target.value as DataMode)}><option value="real">Real</option><option value="demo">Demo / testing</option></select></label>}
        </>}
        {!entryDate && view && <><header className="screen-heading"><h1>{view.name}</h1><div><a className="text-action" href="#/views">Views</a><a className="text-action" href={`#/views/edit/${view.id}`}>Edit view</a></div></header><div className="view-tags">{view.tags.map(tag => <span key={tag} className="summary-item" data-category={tag === 'reading' ? 'habit' : tag}>{tag}</span>)}</div></>}
        {!entryDate && screen === 'journal' && <header ref={journalHeading} className={`journal-heading${scrolled ? ' is-pinned' : ''}`}><span className="eyebrow muted">Journal</span><div>{searchActions}</div></header>}
        {(storageError || routines.error) && <p role="status" className="storage-notice">{routines.error || storageError}</p>}
        {(entryDate || screen === 'journal') && timeline}
        {!entryDate && view && view.blocks.filter(block => block.enabled).map(block => <div className={`custom-view-block block-${block.type}`} key={block.id}>{block.type === 'widgets' ? <ViewWidgets widgets={block.widgets ?? []} days={days} data={data} loads={loads} /> : block.type === 'todo' ? tasks('compact') : block.type === 'chart' ? <section className="view-chart"><h2>{block.chart === 'sleep' ? 'Sleep' : 'Finger rehab'}</h2>{block.chart === 'sleep' ? <SleepChart nights={getNights(viewDays)} /> : <RehabChart loads={loads} />}</section> : <><header ref={journalHeading} className={`journal-heading${scrolled ? ' is-pinned' : ''}`}><span className="eyebrow muted">Journal</span><div>{searchActions}</div></header>{timeline}</>}</div>)}
      </main>
      {!entryDate && <PrimaryNav active={view?.id ?? screen} />}
    </>}
    {filterOpen && <HomeFilters filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />}
    {routineDetail && (routineDetail.routine.kind === 'reading' ? <ReadingSheet key={`${routineDetail.routine.id}-${routineDetail.date}`} data={data} routine={routineDetail.routine} date={routineDetail.date} onChange={update} onClose={() => setRoutineDetail(null)} /> : <AlcoholSheet key={`${routineDetail.routine.id}-${routineDetail.date}`} data={data} routine={routineDetail.routine} date={routineDetail.date} onChange={update} onClose={() => setRoutineDetail(null)} />)}
    {!entryDate && routines.welcome && !routineDetail && <WelcomeSheet data={data} away={routines.away} onChange={update} onReview={openRoutine} onClose={routines.closeWelcome} />}
    {detail && <Sheet title={detail.title} development onClose={() => setDetail(null)}>{detail.kind === 'chart' ? detail.id === 'chart-rehab' ? <RehabChart loads={loads} /> : <SleepChart nights={getNights(days)} /> : <RecordItem record={detail} onOpen={() => {}} />}</Sheet>}
  </>;
}
