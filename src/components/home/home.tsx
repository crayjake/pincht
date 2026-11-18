import { useEffect, useMemo, useRef, useState } from 'react';
import { DayPicker, EntryMenu, EntryTags, moveEntry } from './entry-tools';
import { loadSessions } from '../../workouts/storage';
import './home.scss';
import { HomeFilters } from './home-filters';
import { JournalBody, type CreatableRecordKind } from './journal-body';
import { chartResources, duration, emptyFilter, entryRecords, groupDays, getNights, hasJournalContent, localDate, rangeLabel, shortDate, type Day, type DayType, type Entry, type JournalRecord, type PillResource, type RichBody } from './journal-data';
import { Icon } from './journal-icons';
import { DayRecords, RecordItem } from './journal-records';
import { Sheet } from './journal-sheet';
import { RehabChart, SleepChart } from './journal-widgets';
import { ViewWidgets } from './view-widgets';
import { PrimaryNav } from '../app-navigation';
import { DueToday, HabitRows } from '../../routines/due-today';
import { addDays, adherence, withRoutineDays, type Routine } from '../../routines/data';
import { useRoutines } from '../../routines/use-routines';
import { AlcoholSheet, BookSelector, ReadingSheet, WelcomeSheet } from '../../routines/routine-sheets';
import { CreateThing } from './library-pages';
import { planCategory } from '../../workouts/fixtures';
import { dragLoads } from '../../routines/rehab-loads';
import { JournalSearch } from './journal-search';
import { daySummary, type SummaryCategory } from './journal-summary';
import { climbingView, defaultView, isViewDay, loadViews, rememberJournalView } from './journal-views';
import { withMentionedClimbs } from './journal-climbs';
import { routineLink } from '../../routines/tasks';
import { loadWorkoutPlans } from '../../workouts/catalog';
import { ViewPills } from './view-pills';
import { recordHref } from './library-data';

import { JOURNAL_KEY, JOURNAL_RESOURCES_KEY, loadDays, loadResources, saveDays, saveResources } from './journal-storage';
import { dataKey, type DataMode } from '../../data/mode';
import { BackLink, useRememberedState } from '../../navigation';
const emptyBody: RichBody = { type: 'doc', content: [{ type: 'paragraph' }] };
const summaryRoutes: Partial<Record<SummaryCategory, string>> = {
  climb: '#/library/climbs', rehab: '#/library/workouts', training: '#/library/workouts', sleep: '#/library/metrics/sleep', weight: '#/library/metrics/weight', goal: '#/library/goals',
};
function TypeWords({ types }: { types: DayType[] }) {
  return <>{types.map((type, i) => <span key={type}>{i > 0 && <span className="type-join"> + </span>}<span data-category={type}>{type}</span></span>)}</>;
}
export default function Home({ entryDate, screen = 'journal', viewId }: { viewId?: string; entryDate?: string; screen?: 'today' | 'journal' | 'climbing'; onDataMode?: (mode: DataMode) => void }) {
  const [storageKey] = useState(() => dataKey(JOURNAL_KEY));
  const [resourcesKey] = useState(() => dataKey(JOURNAL_RESOURCES_KEY));
  const [createdResources, setCreatedResources] = useState(() => {
    try { return loadResources(resourcesKey); } catch { return []; }
  });
  const [baseDays, setDays] = useState(() => loadDays(storageKey));
  const routines = useRoutines(!entryDate && screen !== 'today');
  const { data, update, recentSkips } = routines;
  const [sessions] = useState(() => loadSessions());
  const today = localDate();
  const days = useMemo(() => {
    const withToday = baseDays.some(day => day.date === today) ? baseDays : [...baseDays, { date: today, types: [], records: [], metrics: {}, visibleMetrics: [] }];
    return withRoutineDays(withToday, data, today);
  }, [baseDays, data, today]);
  const loads = useMemo(() => dragLoads(sessions), [sessions]);
  const [storageError, setStorageError] = useState('');
  const [calendar, setCalendar] = useState<string | null>(null);
  const [menuDay, setMenuDay] = useState<Day | null>(null);
  const [tagDay, setTagDay] = useState<Day | null>(null);
  const [undoEntry, setUndoEntry] = useState<{date:string;entry:Entry} | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const [query, setQuery] = useRememberedState('query', () => '');
  const [searchOpen, setSearchOpen] = useRememberedState('searchOpen', () => false);
  const [filter, setFilter] = useRememberedState('filter', () => emptyFilter);
  const [filterOpen, setFilterOpen] = useState(false);
  const [detail, setDetail] = useState<PillResource | null>(null);
  const [routineDetail, setRoutineDetail] = useState<{ routine: Routine; date: string } | null>(null);
  const [creation, setCreation] = useState<{ day: Day; title: string; kind: CreatableRecordKind; resolve: (record?: PillResource) => void } | null>(null);
  const createdBook = useRef<JournalRecord | undefined>(undefined);
  const views = useMemo(() => loadViews(), []);
  const view = useMemo(() => screen === 'today' ? undefined : views.find(view => view.id === (viewId ?? (screen === 'climbing' ? 'climbing' : defaultView().id))) ?? climbingView, [screen, viewId, views]);
  useEffect(() => {
    if (!view || entryDate) return;
    try { rememberJournalView(view.id); } catch { /* View selection stays available for this visit. */ }
  }, [view, entryDate]);
  const [expanded, setExpanded] = useRememberedState<Set<string>>('expanded', () => new Set());
  const [openComposers, setOpenComposers] = useRememberedState<Set<string>>('composers', () => new Set());
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
      const pinTop = heading ? parseFloat(getComputedStyle(heading).top) || 0 : 0;
      setScrolled(entryDate ? y > 120 : !!bounds?.height && bounds.top <= pinTop);
    }
    scroll();
    window.addEventListener('scroll', scroll, { passive: true });
    window.addEventListener('resize', scroll);
    return () => { window.removeEventListener('scroll', scroll); window.removeEventListener('resize', scroll); };
  }, [entryDate, searchOpen, screen]);
  const screenTitle = screen === 'today' ? 'To-do' : view?.id === 'all' ? 'Journal' : view?.name ?? 'Journal';
  useEffect(() => { document.title = `${entryDate ? days.find(d => d.date === entryDate)?.entry?.title || 'Journal' : searchOpen ? 'Search' : screenTitle} · pincht`; }, [entryDate, searchOpen, days, screenTitle]);
  const resources = useMemo<PillResource[]>(() => [...new Map([...chartResources,
    ...loadWorkoutPlans().map(plan => ({ id: `plan-${plan.id}`, kind: planCategory(plan), title: plan.name, metric: 'Workout', meta: '' } as JournalRecord)),
    ...data.books.map(book => ({ id: `book-${book.id}`, kind: 'habit', title: book.title, metric: 'Book', meta: book.author } as JournalRecord)),
    ...createdResources, ...days.flatMap(day => day.records)].map(record => [record.id, record])).values()], [days, data.books, createdResources]);
  const viewDays = useMemo(() => view && !entryDate ? days.filter(day => day.date === today || isViewDay(day, view)) : days, [days, view, entryDate, today]);
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
    createdBook.current = undefined;
    return new Promise<PillResource | undefined>(resolve => setCreation({ day, title, kind, resolve }));
  }
  function finishCreation(record?: JournalRecord) {
    if (!creation) return;
    if (record) {
      setCreatedResources(loadResources(resourcesKey));
      // Only climbs log activity through a mention. Other categories remain references.
      if (record.kind === 'climb') updateRecord(creation.day, { ...record, climb: { goes: 0 } });
      setExpanded(current => new Set([...current, creation.day.date]));
    }
    creation.resolve(record);
    setCreation(null);
  }
  function toggle(date: string) { setExpanded(current => { const next = new Set(current); if (next.has(date)) next.delete(date); else next.add(date); return next; }); }
  function openRoutine(routine: Routine, date: string) {
    if (routine.kind === 'rehab' || routine.kind === 'training') { location.hash = routineLink(routine).slice(1); return; }
    setRoutineDetail({ routine, date });
  }
  function closeSearch() { setSearchOpen(false); setQuery(''); setFilter(emptyFilter); window.scrollTo(0, 0); }
  const focused = days.find(d => d.date === entryDate);
  const tasks = (variant: 'card' | 'journal' | 'compact' | 'todo') => <DueToday data={data} recentSkips={recentSkips} sessions={sessions} onChange={update} onOpen={openRoutine} tags={view?.tags} variant={variant} />;
  function openRecord(record: PillResource) {
    if (record.kind === 'chart') setDetail(record);
    else location.hash = recordHref(record).slice(1);
  }
  const timeline = <div className="journal-timeline">
          {groups.map(group => {
            if (group.kind === 'routine') {
              const id = group.days[0].date;
              return <section className="routine-run" key={`routine-${id}`}>
                <header className="routine-range"><span>{rangeLabel(group.days)}</span><span>{group.days.length} {group.days.length === 1 ? 'day' : 'days'}</span></header>
                {screen !== 'climbing' && <p className="run-adherence">{adherence(data, group.days.map(d => d.date))}</p>}
                <div className="routine-card">{group.days.map(day => <div className={`routine-day${expanded.has(day.date) ? ' is-expanded' : ''}`} data-navigation-anchor={`day-${day.date}`} key={day.date}>
                  <button type="button" className="routine-row" aria-label={`${shortDate(day.date, { weekday: 'long', day: 'numeric', month: 'long' })}, ${day.types.join(' and ')}, ${day.records.length} records`} aria-expanded={expanded.has(day.date)} aria-controls={`records-${day.date}`} onClick={() => toggle(day.date)}>
                    <span className="routine-date">{shortDate(day.date, { weekday: 'short' })} {shortDate(day.date, { day: 'numeric' })}</span><span className="routine-types"><TypeWords types={day.types} /></span><span className="routine-sleep">{day.metrics.sleep !== undefined ? duration(day.metrics.sleep, true) : '—'}</span><span className="routine-weight">{day.metrics.weight !== undefined ? `${day.metrics.weight.toFixed(1)} kg` : '—'}</span>
                  </button>
                  {screen !== 'climbing' && <HabitRows data={data} date={day.date} recentSkips={recentSkips} onOpen={openRoutine} onChange={update} />}
                  {expanded.has(day.date) && <div id={`records-${day.date}`}>
                    <DayRecords records={day.records} onOpen={openRecord} editableIds={day.records.map(record => record.id)} onUpdate={record => updateRecord(day, record)} compact id={`day-records-${day.date}`} />
                    <a className="write-entry-action text-action" href={`#/journal/${day.date}`}>Write journal entry</a>
                  </div>}
                </div>)}</div>
              </section>;
            }
            const { day } = group;
            const summaryItems = daySummary(day, data);
            const records = entryRecords(day, resources);
            return <article className={`written-entry${!hasJournalContent(day.entry) ? ' empty-entry' : ''}${openComposers.has(day.date) ? ' composer-open' : ''}`} data-navigation-anchor={`day-${day.date}`} key={day.date} onContextMenu={event => {
              if ((event.target as HTMLElement).closest('input, textarea, [contenteditable], button, a')) return;
              event.preventDefault();
              setMenuDay(day);
            }} onFocusCapture={event => {
              if (!(event.target as HTMLElement).closest('.entry-title-input, .journal-body')) return;
              // Keep the composer open for this visit, so focusing a task or record
              // cannot move that control between pointer-down and click.
              setOpenComposers(current => current.has(day.date) ? current : new Set([...current, day.date]));
            }}>
              <div className="entry-date"><span>{day.date === localDate() ? <><strong>Today</strong> · </> : day.date === addDays(localDate(), -1) ? <>Yesterday · </> : ''}{shortDate(day.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              {summaryItems.length > 0 && <div className="entry-summary" aria-label="Day summary">
                {summaryItems.map(item => {
                  const reading = data.routines.find(routine => routine.id === item.id)?.kind === 'reading';
                  const readingLog = data.checkIns.find(log => log.routineId === item.id && log.date === day.date);
                  const href = reading && readingLog?.bookId ? `#/library/books/book-${readingLog.bookId}` : summaryRoutes[item.category] ?? (item.category === 'habit' ? `#/library/routines/${item.id}` : undefined);
                  const routine = item.category === 'habit' ? data.routines.find(routine => routine.id === item.id) : undefined;
                  return href
                    ? <a className="summary-item" data-category={item.category} key={item.id} href={href}>{item.label}</a>
                    : routine
                      ? <button type="button" className="summary-item" data-category={item.category} key={item.id} onClick={() => openRoutine(routine, day.date)}>{item.label}</button>
                      : <span className="summary-item" data-category={item.category} key={item.id}>{item.label}</span>;
                })}
              </div>}
              {entryDate || day.date === today ? <input className="entry-title-input" aria-label="Journal title" placeholder="Journal title" value={day.entry!.title} onChange={event => updateEntry(day, { ...day.entry!, title: event.target.value })} /> : <h1><a href={`#/journal/${day.date}`}>{day.entry!.title || 'Untitled entry'}</a></h1>}
              <JournalBody key={`${day.date}-${editorVersion}`} body={day.entry!.body} resources={resources} placeholder={day.date === today || entryDate ? 'Write about your day…' : undefined} onChange={body => updateEntry(day, { ...day.entry!, body })} onCreateRecord={(title, kind) => createRecord(day, title, kind)} onOpen={openRecord} />
              {(entryDate || (screen === 'journal' && day.date !== today)) && <HabitRows data={data} date={day.date} recentSkips={recentSkips} onOpen={openRoutine} onChange={update} />}
              {entryDate ? <DayRecords records={records} onOpen={openRecord} editableIds={day.records.map(record => record.id)} onUpdate={record => updateRecord(day, record)} id={`records-${day.date}`} /> : <>
                <button type="button" className="records-toggle" aria-expanded={expanded.has(day.date)} aria-controls={`records-${day.date}`} onClick={() => toggle(day.date)}><span className={`records-toggle-inner${!records.length ? ' records-empty' : ''}`}><span>{records.length} records</span><Icon name="chevron" size={16} /></span></button>
                {expanded.has(day.date) && <DayRecords records={records} onOpen={openRecord} editableIds={day.records.map(record => record.id)} onUpdate={record => updateRecord(day, record)} id={`records-${day.date}`} />}
              </>}
              {!entryDate && day.date === today && tasks('journal')}
            </article>;
          })}
          {!groups.length && <p className="empty-timeline" role="status">{entryDate ? 'There is no written entry for this day.' : screen === 'climbing' ? 'No climbing, rehab, or training days logged yet.' : 'Your journal is empty.'}</p>}
        </div>;
  return <>
    {searchOpen && !entryDate ? <JournalSearch days={viewDays} data={data} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} onAllFilters={() => setFilterOpen(true)} onClose={closeSearch} onOpen={openRecord} onRoutine={openRoutine} /> : <>
      {entryDate && <header className="expanded-header"><BackLink className="icon-button" href="#/journal" aria-label="Back to Journal"><Icon name="back" /></BackLink><span className="sticky-title">{scrolled ? focused?.entry?.title || 'Journal' : 'Journal'}</span>{scrolled && <span className="sticky-date">{shortDate(entryDate, { day: 'numeric', month: 'short' })}</span>}</header>}
      <main className={`today-page screen-${screen}${entryDate ? ' expanded-page' : ''}`} aria-label={entryDate ? 'Expanded journal entry' : screenTitle}>
        {!entryDate && screen === 'today' && <>
          <header className="screen-heading todo-heading"><BackLink className="icon-button" href="#/journal" aria-label="Back to Journal"><Icon name="back" size={22} /></BackLink><h1>To-do</h1><a className="text-action" href="#/routines">Routines ›</a></header>
          {tasks('todo')}

        </>}
        {!entryDate && view && <header ref={journalHeading} className={`journal-heading view-heading${scrolled ? ' is-pinned' : ''}`}><ViewPills views={views} selected={view.id} onSearch={() => { setSearchOpen(true); window.scrollTo(0, 0); }} /></header>}
        {(storageError || routines.error) && <p role="status" className="storage-notice">{routines.error || storageError}</p>}
        {entryDate && timeline}
        {!entryDate && view && view.blocks.filter(block => block.enabled).map(block => <div className={`custom-view-block block-${block.type}`} key={block.id}>{block.type === 'widgets' ? <ViewWidgets widgets={block.widgets ?? []} days={days} data={data} loads={loads} goalId={block.goalId} /> : block.type === 'todo' ? tasks('compact') : block.type === 'chart' ? <ViewWidgets widgets={[block.chart === 'rehab' ? 'strength' : block.chart === 'sleep' ? 'stages' : block.chart ?? 'strength']} days={days} data={data} loads={loads} goalId={block.goalId} /> : timeline}</div>)}
      </main>
      {!entryDate && <PrimaryNav active="journal" />}
    </>}
    {calendar !== null && <DayPicker days={days} initial={calendar || today} moving={!!calendar} onClose={() => setCalendar(null)} onChoose={date => {
      if (!calendar) { setCalendar(null); location.hash = `/journal/${date}`; return; }
      try { const next = moveEntry(baseDays, calendar, date); saveDays(next, storageKey); setDays(next); setCalendar(null); setEditorVersion(v=>v+1); location.hash = `/journal/${date}`; } catch(error) { setStorageError((error as Error).message); }
    }} />}
    {menuDay && <EntryMenu day={menuDay} onClose={()=>setMenuDay(null)} onEdit={()=>{const date=menuDay.date;setMenuDay(null);location.hash=`/journal/${date}`;}} onMove={()=>{setCalendar(menuDay.date);setMenuDay(null);}} onTags={()=>{setTagDay(menuDay);setMenuDay(null);}} onDelete={()=>{const entry=menuDay.entry;const date=menuDay.date;if(!entry)return;const next=baseDays.map(day=>day.date===date?{...day,entry:undefined}:day);try{saveDays(next,storageKey);setDays(next);setUndoEntry({date,entry});setMenuDay(null);setEditorVersion(v=>v+1);}catch(error){setStorageError((error as Error).message);}}} />}
    {tagDay && <EntryTags entry={tagDay.entry ?? {title:'',body:emptyBody}} onClose={()=>setTagDay(null)} onSave={tags=>{updateEntry(tagDay,{...(tagDay.entry ?? {title:'',body:emptyBody}),tags});setTagDay(null);}} />}
    {undoEntry && <div className="journal-toast" role="status">Entry deleted <button className="text-action" onClick={()=>{setDays(current=>current.map(day=>day.date===undoEntry.date?{...day,entry:undoEntry.entry}:day));setUndoEntry(null);setEditorVersion(v=>v+1);}}>Undo</button><button className="icon-button" aria-label="Dismiss" onClick={()=>setUndoEntry(null)}>×</button></div>}
    {filterOpen && <HomeFilters filter={filter} onChange={setFilter} onClose={() => setFilterOpen(false)} />}
    {creation && (creation.kind === 'habit' ? <BookSelector initialTitle={creation.title} data={data} onClose={() => finishCreation()} onChange={next => {
      if (!update(next)) return false;
      const book = next.books.find(book => book.id === next.currentBookId);
      createdBook.current = book ? { id: `book-${book.id}`, kind: 'habit', title: book.title, metric: 'Book', meta: book.author } : undefined;
      return true;
    }} onSelect={() => finishCreation(createdBook.current)} /> : <CreateThing fromEntry category={creation.kind === 'training' ? 'workouts' : creation.kind === 'climb' ? 'climbs' : 'goals'} initialTitle={creation.title} onCreated={finishCreation} onClose={() => finishCreation()} />)}
    {routineDetail && (routineDetail.routine.kind === 'reading' ? <ReadingSheet key={`${routineDetail.routine.id}-${routineDetail.date}`} data={data} routine={routineDetail.routine} date={routineDetail.date} onChange={update} onClose={() => setRoutineDetail(null)} /> : <AlcoholSheet key={`${routineDetail.routine.id}-${routineDetail.date}`} data={data} routine={routineDetail.routine} date={routineDetail.date} onChange={update} onClose={() => setRoutineDetail(null)} />)}
    {!entryDate && screen !== 'today' && routines.welcome && !routineDetail && <WelcomeSheet data={data} away={routines.away} onChange={update} onReview={openRoutine} onClose={routines.closeWelcome} />}
    {detail && <Sheet title={detail.title} development onClose={() => setDetail(null)}>{detail.kind === 'chart' ? detail.id === 'chart-rehab' ? <RehabChart loads={loads} /> : <SleepChart nights={getNights(days)} /> : <RecordItem record={detail} onOpen={() => {}} />}</Sheet>}
  </>;
}
