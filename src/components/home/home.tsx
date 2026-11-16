import { useEffect, useMemo, useRef, useState } from 'react';
import { loadSessions, mergeWorkoutDays } from '../../workouts/storage';
import './home.scss';
import { HomeFilters } from './home-filters';
import { JournalBody } from './journal-body';
import { chartResources, duration, emptyFilter, entryRecords, groupDays, getNights, hasJournalContent, localDate, rangeLabel, seedDays, shortDate, type Day, type DayType, type Entry, type PillResource, type RichBody } from './journal-data';
import { Icon } from './journal-icons';
import { DayRecords, RecordItem } from './journal-records';
import { Sheet } from './journal-sheet';
import { ClimbingWidgets, JournalWidgets, RehabChart, SleepChart, WeeklyActivityWidget } from './journal-widgets';
import { InDevelopment, PrimaryNav } from '../app-navigation';
import { DueToday, HabitRows } from '../../routines/due-today';
import { addDays, adherence, withRoutineDays, type Routine } from '../../routines/data';
import { useRoutines } from '../../routines/use-routines';
import { AlcoholSheet, ReadingSheet, WelcomeSheet } from '../../routines/routine-sheets';
import { dragLoads } from '../../routines/rehab-loads';
import { JournalSearch } from './journal-search';
import { daySummary, type SummaryCategory } from './journal-summary';
import { climbingView, isClimbingDay } from './journal-views';

const storageKey = 'pincht.journal.v1';
const sampleEntriesKey = 'pincht.journal.sample-entries';
const emptyBody: RichBody = { type: 'doc', content: [{ type: 'paragraph' }] };
const summaryRoutes: Partial<Record<SummaryCategory, string>> = {
  climb: '#/climbing', rehab: '#/train/pulley-rehab', training: '#/train', sleep: '#/metrics', weight: '#/metrics',
};
function loadDays(): Day[] {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(storageKey) || 'null');
    if (Array.isArray(saved) && saved.length && saved.every(day => typeof day.date === 'string' && Array.isArray(day.types) && Array.isArray(day.records) && Array.isArray(day.visibleMetrics) && day.metrics && (!day.entry || (typeof day.entry.title === 'string' && day.entry.body?.type === 'doc' && Array.isArray(day.entry.body.content))))) {
      // Add the new sample writing once, preserving saved writing and records.
      const addSamples = !localStorage.getItem(sampleEntriesKey);
      return mergeWorkoutDays((saved as Day[]).map(day => {
        const sample = addSamples ? seedDays.find(seed => seed.date === day.date)?.entry : undefined;
        return { ...day, entry: hasJournalContent(day.entry) ? day.entry : sample };
      }));
    }
  } catch { /* A damaged or unavailable store falls back to the sample journal. */ }
  return mergeWorkoutDays(seedDays);
}
function TypeWords({ types }: { types: DayType[] }) {
  return <>{types.map((type, i) => <span key={type}>{i > 0 && <span className="type-join"> + </span>}<span data-category={type}>{type}</span></span>)}</>;
}
export default function Home({ entryDate, screen = 'journal' }: { entryDate?: string; screen?: 'today' | 'journal' | 'climbing' }) {
  const [baseDays, setDays] = useState(loadDays);
  const routines = useRoutines(!entryDate);
  const { data, update, recentSkips } = routines;
  const [sessions] = useState(() => loadSessions());
  const today = localDate();
  const days = useMemo(() => {
    const withToday = baseDays.some(day => day.date === today) ? baseDays : [...baseDays, { date: today, types: [], records: [], metrics: {}, visibleMetrics: [] }];
    return withRoutineDays(withToday, data, today);
  }, [baseDays, data, today]);
  const loads = useMemo(() => dragLoads(sessions), [sessions]);
  const [storageError, setStorageError] = useState(false);
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState(emptyFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<PillResource | null>(null);
  const [routineDetail, setRoutineDetail] = useState<{ routine: Routine; date: string } | null>(null);
  const [widgetsOpen, setWidgetsOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [scrolled, setScrolled] = useState(false);
  const journalHeading = useRef<HTMLElement>(null);
  useEffect(() => {
    let failed = false;
    try { localStorage.setItem(storageKey, JSON.stringify(baseDays)); localStorage.setItem(sampleEntriesKey, 'true'); } catch { failed = true; }
    queueMicrotask(() => setStorageError(failed));
  }, [baseDays]);
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
  const screenTitle = screen === 'today' ? 'Today' : screen === 'climbing' ? 'Climbing' : 'Journal';
  useEffect(() => { document.title = `${entryDate ? days.find(d => d.date === entryDate)?.entry?.title || 'Journal' : searchOpen ? 'Search' : screenTitle} · pincht`; }, [entryDate, searchOpen, days, screenTitle]);
  const resources = useMemo(() => [...chartResources, ...days.flatMap(day => day.records)], [days]);
  const viewDays = useMemo(() => screen === 'climbing' && !entryDate ? days.filter(isClimbingDay) : days, [days, screen, entryDate]);
  const groups = useMemo(() => {
    // Empty composers are a display state, never a saved journal entry.
    const visible = entryDate ? days.filter(day => day.date === entryDate) : viewDays;
    return groupDays(visible.map(day => day.date === today || entryDate ? { ...day, entry: day.entry ?? { title: '', body: emptyBody } } : day));
  }, [days, viewDays, entryDate, today]);
  function updateDay(day: Day) {
    const clean = { ...day, entry: hasJournalContent(day.entry) ? day.entry : undefined, records: day.records.filter(record => record.kind !== 'habit') };
    setDays(current => current.some(d => d.date === day.date) ? current.map(d => d.date === day.date ? clean : d) : [...current, clean]);
  }
  function updateEntry(day: Day, entry: Entry) {
    updateDay({ ...day, entry });
  }
  function toggle(date: string) { setExpanded(current => { const next = new Set(current); if (next.has(date)) next.delete(date); else next.add(date); return next; }); }
  function openRoutine(routine: Routine, date: string) {
    if (routine.kind === 'rehab' || routine.kind === 'training') { location.hash = routine.kind === 'rehab' ? '/train/pulley-rehab' : '/train'; return; }
    setRoutineDetail({ routine, date });
  }
  function closeSearch() { setSearchOpen(false); setQuery(''); setFilter(emptyFilter); window.scrollTo(0, 0); }
  const focused = days.find(d => d.date === entryDate);
  const tasks = (variant: 'card' | 'journal' | 'compact') => <DueToday data={data} recentSkips={recentSkips} sessions={sessions} onChange={update} onOpen={openRoutine} kinds={screen === 'climbing' ? climbingView.routineKinds : undefined} variant={variant} />;
  const searchActions = <><button className="icon-button feed-search-trigger" aria-label="Search journal" onClick={() => { setSearchOpen(true); window.scrollTo(0, 0); }}><Icon name="search" size={20} /><span>Search journal</span></button><button className="icon-button feed-filter-trigger" aria-label="Filter journal" onClick={() => { setSearchOpen(true); setFilterOpen(true); window.scrollTo(0, 0); }}><Icon name="filter" size={20} /></button></>;
  return <>
    {searchOpen && !entryDate ? <JournalSearch days={viewDays} data={data} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} onAllFilters={() => setFilterOpen(true)} onClose={closeSearch} onOpen={setDetail} onRoutine={openRoutine} /> : <>
      {entryDate && <header className="expanded-header"><a className="icon-button" href="#/journal" aria-label="Back to Journal"><Icon name="back" /></a><span className="sticky-title">{scrolled ? focused?.entry?.title || 'Journal' : 'Journal'}</span>{scrolled && <span className="sticky-date">{shortDate(entryDate, { day: 'numeric', month: 'short' })}</span>}</header>}
      <main className={`today-page screen-${screen}${entryDate ? ' expanded-page' : ''}`} aria-label={entryDate ? 'Expanded journal entry' : screenTitle}>
        {!entryDate && screen === 'today' && <>
          <header className="screen-heading"><div><h1>Today</h1><p>{shortDate(today, { weekday: 'long', day: 'numeric', month: 'long' })}</p></div><a className="text-action" href="#/journal">Journal <Icon name="book" size={18} /></a></header>
          {tasks('card')}
          <JournalWidgets days={days} loads={loads} visible={data.widgets} onConfigure={() => setWidgetsOpen(true)} />
          <WeeklyActivityWidget days={days} data={data} />
        </>}
        {!entryDate && screen === 'climbing' && <>
          <InDevelopment /><header className="screen-heading"><div><h1>Climbing</h1><p>Climb · rehab · training</p></div></header>
          <ClimbingWidgets days={days} data={data} loads={loads} />
          {tasks('compact')}
        </>}
        {!entryDate && screen !== 'today' && <header ref={journalHeading} className={`journal-heading${scrolled ? ' is-pinned' : ''}`}><span className="eyebrow muted">{screen === 'climbing' ? 'Climbing journal' : 'Journal'}</span><div>{searchActions}</div></header>}
        {(storageError || routines.error) && <p role="status" className="storage-notice">{routines.error || 'Changes are available for this visit. Your browser could not save them.'}</p>}
        {(entryDate || screen !== 'today') && <div className="journal-timeline">
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
                    <DayRecords records={day.records} onOpen={setDetail} compact id={`day-records-${day.date}`} />
                    <a className="write-entry-action text-action" href={`#/journal/${day.date}`}>Write journal entry</a>
                  </div>}
                </div>)}</div>
              </section>;
            }
            const { day } = group;
            const summaryItems = daySummary(day, data);
            const records = entryRecords(day, resources);
            return <article className="written-entry" key={day.date}>
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
              {!entryDate && screen === 'journal' && day.date === today && tasks('journal')}
              {entryDate || day.date === today ? <input className="entry-title-input" aria-label="Journal title" placeholder="Journal title" value={day.entry!.title} onChange={event => updateEntry(day, { ...day.entry!, title: event.target.value })} /> : <h1><a href={`#/journal/${day.date}`}>{day.entry!.title || 'Untitled entry'}</a></h1>}
              <JournalBody body={day.entry!.body} resources={resources} placeholder={day.date === today || entryDate ? 'Write about your day…' : undefined} onChange={body => updateEntry(day, { ...day.entry!, body })} onOpen={setDetail} />
              {(entryDate || (screen === 'journal' && day.date !== today)) && <HabitRows data={data} date={day.date} recentSkips={recentSkips} onOpen={openRoutine} onChange={update} />}
              {entryDate ? <DayRecords records={records} onOpen={setDetail} id={`records-${day.date}`} /> : <>
                <button type="button" className="records-toggle" aria-expanded={expanded.has(day.date)} aria-controls={`records-${day.date}`} onClick={() => toggle(day.date)}><span className="records-toggle-inner"><span>{records.length} records</span><Icon name="chevron" size={16} /></span></button>
                {expanded.has(day.date) && <DayRecords records={records} onOpen={setDetail} id={`records-${day.date}`} />}
              </>}
            </article>;
          })}
          {!groups.length && <p className="empty-timeline" role="status">{entryDate ? 'There is no written entry for this day.' : screen === 'climbing' ? 'No climbing, rehab, or training days logged yet.' : 'Your journal is empty.'}</p>}
        </div>}
      </main>
      {!entryDate && <PrimaryNav active={screen} />}
    </>}
    {filterOpen && <HomeFilters filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />}
    {widgetsOpen && <Sheet title="Today widgets" development onClose={() => setWidgetsOpen(false)}>{(['rehab', 'sleep'] as const).map(widget => <label className="metric-choice" key={widget}><span>{widget === 'rehab' ? 'Finger rehab · 20 mm drag' : 'Sleep'}</span><input type="checkbox" checked={data.widgets[widget]} onChange={e => update({ ...data, widgets: { ...data.widgets, [widget]: e.target.checked } })} /></label>)}<p className="sheet-hint">Rehab combines the sample drag measurements with your saved 20 mm drag holds. Simulator results are excluded.</p><button className="primary-button full-width" onClick={() => setWidgetsOpen(false)}>Done</button></Sheet>}
    {routineDetail && (routineDetail.routine.kind === 'reading' ? <ReadingSheet key={`${routineDetail.routine.id}-${routineDetail.date}`} data={data} routine={routineDetail.routine} date={routineDetail.date} onChange={update} onClose={() => setRoutineDetail(null)} /> : <AlcoholSheet key={`${routineDetail.routine.id}-${routineDetail.date}`} data={data} routine={routineDetail.routine} date={routineDetail.date} onChange={update} onClose={() => setRoutineDetail(null)} />)}
    {!entryDate && routines.welcome && !routineDetail && <WelcomeSheet data={data} away={routines.away} onChange={update} onReview={openRoutine} onClose={routines.closeWelcome} />}
    {detail && <Sheet title={detail.title} development onClose={() => setDetail(null)}>{detail.kind === 'chart' ? detail.id === 'chart-rehab' ? <RehabChart loads={loads} /> : <SleepChart nights={getNights(days)} /> : <RecordItem record={detail} onOpen={() => {}} />}</Sheet>}
  </>;
}
