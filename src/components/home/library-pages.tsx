import { useEffect, useState } from 'react';
import { useRoutines } from '../../routines/use-routines';
import { withRoutineDays, type Book } from '../../routines/data';
import { BookSelector, ReadingSheet } from '../../routines/routine-sheets';
import { BookPage, BooksList } from '../../books/book-page';
import { dragLoads } from '../../routines/rehab-loads';
import { loadSessions } from '../../workouts/storage';
import { deleteWorkoutPlan, loadWorkoutPlans, loadPresets } from '../../workouts/catalog';
import { planCategory, planPresets, prescriptionLabel } from '../../workouts/fixtures';
import { InDevelopment, PrimaryNav } from '../app-navigation';
import { entryRecords, localDate, shortDate, type JournalRecord } from './journal-data';
import { RecordItem } from './journal-records';
import { Sheet } from './journal-sheet';
import { RehabChart, SleepChart } from './journal-widgets';
import { getNights } from './journal-data';
import { loadDays, loadResources } from './journal-storage';
import { categoryName, libraryCategories, libraryResources, recordHistory, recordHref, type LibraryCategory } from './library-data';
import { loadViews } from './journal-views';
import { viewEditorHref } from './view-navigation';
import { Icon } from './journal-icons';
import { allRoutines } from '../../routines/tasks';
import { QuickLog } from './quick-log';
import { loadSeries, seriesMeasurements, directDragSeriesId, presetSeriesId } from '../../workouts/measurements';
import { ViewWidgets } from './view-widgets';
import { WorkoutProgress } from './workout-progress';
import { ClimbHeader, ClimbPage, ClimbsList, ClimbSheet } from '../../climbs/climb-pages';
import { GoalChecklist, GoalSheet } from '../../goals/goal-sheet';
import { WorkoutsList, WorkoutSheet } from '../../workouts/workout-editor';
import './home.scss';

export default function LibraryPage({ category, id, seriesId }: { category?: string; id?: string; seriesId?: string }) {
  const routines = useRoutines(false);
  const [measurement, setMeasurement] = useState(false);
  const [editingGoal, setEditingGoal] = useState(false);
  const [editingWorkout, setEditingWorkout] = useState(false), [deleteWorkout, setDeleteWorkout] = useState(false), [workoutError, setWorkoutError] = useState('');
  const [readingBook, setReadingBook] = useState<Book>();
  const [, refreshMeasurements] = useState(0);
  const [query, setQuery] = useState('');
  const [createPicker, setCreatePicker] = useState(false);
  const [creating, setCreating] = useState(id === 'new');
  const data = routines.data;
  const days = withRoutineDays(loadDays(), data, localDate());
  const resources = libraryResources(data);
  const savedResources = new Set(loadResources().map(record => record.id));
  const plans = loadWorkoutPlans();
  const views = loadViews();
  const title = category ? categoryName(category) : 'Library';
  const record = resources.find(record => record.id === id);
  const routine = allRoutines(data).find(routine => routine.id === id);
  const view = views.find(view => view.id === id);
  const plan = plans.find(plan => `plan-${plan.id}` === id);
  const book = data.books.find(book => `book-${book.id}` === id);
  const isDetail = !!id && id !== 'new';
  useEffect(() => { document.title = `${isDetail ? record?.title ?? routine?.name ?? view?.name ?? title : title} · pincht`; }, [isDetail, record?.title, routine?.name, view?.name, title]);
  const history = record ? recordHistory(record, days, resources) : [];
  const measurementPreset = record?.goal?.seriesId ? loadPresets().find(preset => presetSeriesId(preset) === record.goal!.seriesId) : undefined;
  const goalSeries = record?.goal ? loadSeries(days, loadSessions()).find(series => series.id === (record.goal!.seriesId ?? directDragSeriesId)) : undefined;
  if (goalSeries) for (const value of goalSeries.points.filter(value => value.date <= localDate())) {
    history.push({ date: value.date, record: { id: `measurement-finger-${value.id}`, kind: 'rehab', title: goalSeries.name, metric: `${value.kg} kg`, meta: goalSeries.statistic }, logged: true });
  }
  if (book) for (const value of data.checkIns.filter(value => value.bookId === book.id && value.status === 'done')) {
    if (!history.some(item => item.date === value.date)) history.push({ date: value.date, record: { id: `book-${book.id}`, kind: 'habit', title: book.title, metric: `${value.minutes ?? 0} min`, meta: value.page !== undefined ? `Page ${value.page}` : '' }, logged: true });
  }
  const list = (kind: LibraryCategory) => kind === 'routines' ? allRoutines(data).map(item => ({ id: item.id, title: item.name, subtitle: item.active ? 'Active routine' : 'Paused', href: `#/library/routines/${item.id}` }))
    : kind === 'views' ? views.map(item => ({ id: item.id, title: item.name, subtitle: item.isDefault ? 'Default view' : item.tags.join(' · ') || 'All data', href: `#/library/views/${item.id}` }))
    : resources.filter(item => kind === 'climbs' ? item.kind === 'climb' : kind === 'goals' ? item.kind === 'goal' : kind === 'books' ? item.kind === 'habit' : (item.kind === 'training' || item.kind === 'rehab') && (item.id.startsWith('plan-') || savedResources.has(item.id))).map(item => ({ id: item.id, title: item.title, subtitle: item.meta || item.metric, href: recordHref(item) }));
  function newItem(kind: LibraryCategory) {
    if (kind === 'routines') location.hash = '/routines/new';
    else if (kind === 'views') location.hash = viewEditorHref('new');
    else location.hash = `/library/${kind}/new`;
  }
  const categoryIcon = { climbs: 'climbs', workouts: 'train', books: 'book', goals: 'goal', routines: 'today', views: 'library' } as const;
  const categoryColor = { climbs: 'climb', workouts: 'training', books: 'habit', goals: 'goal', routines: 'rest', views: 'rest' } as const;
  const categoryMeta = (kind: LibraryCategory) => {
    const count = list(kind).length;
    if (kind === 'workouts') return `${count} · ${new Set(plans.filter(plan => planCategory(plan) === 'rehab').flatMap(plan => planPresets(plan).filter(preset => !preset.locked).map(preset => preset.id))).size} exercises in rehab`;
    if (kind === 'books') return `${count}${data.currentBookId && data.books.some(book => book.id === data.currentBookId) ? ' · 1 reading' : ''}`;
    if (kind === 'routines') return `${count} · ${allRoutines(data).filter(routine => routine.active).length} active`;
    if (kind === 'views') return `${count} · ${(views.find(view => view.isDefault) ?? views[0])?.name ?? 'All'} is the default`;
    return String(count);
  };
  const recent = [...days].sort((a,b) => b.date.localeCompare(a.date)).flatMap(day => entryRecords(day, resources)).filter(record => record.kind !== 'chart' && record.kind !== 'sleep').filter((record, index, records) => records.findIndex(item => recordHref(item) === recordHref(record)) === index).slice(0, 5);
  const sections = category && libraryCategories.includes(category as LibraryCategory) ? [category as LibraryCategory] : libraryCategories;
  const endCreation = () => { setCreating(false); location.hash = `/library/${category}`; };
  const historyRows = history.sort((a, b) => b.date.localeCompare(a.date));
  return <><main className="today-page library-page configuration-page">{category === 'metrics' && <InDevelopment />}
    {book ? null : isDetail && record?.kind === 'goal' ? <ClimbHeader title="Goal" back="#/library/goals"><button className="option" onClick={() => setEditingGoal(true)}>Edit</button></ClimbHeader> : category === 'climbs' ? (!isDetail && <ClimbHeader title="Climbs" back="#/library"><a className="icon-button" href="#/library/climbs/new" aria-label="New climb"><Icon name="plus" size={22} /></a></ClimbHeader>) : <header className="screen-heading"><div>{category && <a className="text-action" href={isDetail || creating ? `#/library/${category}` : '#/library'}>‹ {isDetail || creating ? title : 'Library'}</a>}<h1>{isDetail ? record?.title ?? routine?.name ?? view?.name ?? categoryName(id!) : title}</h1></div>{!category && <><a className="icon-button" aria-label="Settings" href="#/settings"><Icon name="settings" size={22} /></a><button className="icon-button" aria-label="Create new" onClick={() => setCreatePicker(true)}><Icon name="plus" size={22} /></button></>}</header>}
    {!isDetail && category !== 'climbs' && <label className="library-search"><Icon name="search" size={20} /><span className="sr-only">Search Library</span><input type="search" placeholder={category ? `Search ${title.toLowerCase()}…` : 'Search climbs, workouts, books…'} value={query} onChange={event => setQuery(event.target.value)} /></label>}
    {isDetail ? <>
      {category === 'metrics' ? <MetricDetail id={id!} days={days} seriesId={seriesId} /> : record || routine || view ? <>
        {plan && <><button className="text-action" onClick={() => setEditingWorkout(true)}>Edit</button><p className="muted">{plan.description}</p><a className="primary-button full-width" href={`#/train/${plan.id}`}>Start workout</a><section className="settings-section"><h2>Exercises</h2>{planPresets(plan).map(preset => <div className="settings-row library-exercise" key={preset.id}><strong>{preset.name}</strong><small>{preset.locked?.label ?? prescriptionLabel(preset.prescription)}{preset.optional ? ' · optional' : ''}</small></div>)}</section></>}
        {plan && <><section className="settings-section"><h2>Routine</h2>{allRoutines(data).filter(r => r.workoutPlanIds?.includes(plan.id)).map(r => <a className="settings-row" key={r.id} href={`#/routines/${r.id}`}><strong>{r.name}</strong><small>{r.schedule} · {r.active ? 'active' : 'paused'}</small></a>)}</section><button className="text-action danger" onClick={() => setDeleteWorkout(true)}>Delete workout</button></>}{plan && <WorkoutProgress sessions={loadSessions().filter(session => (session.workout?.plan.id ?? session.preset.id) === plan.id)} />}
        {book && <BookPage book={book} data={data} onChange={routines.update} />}
        {routine && <><a className="text-action" href={`#/routines/${routine.id}`}>Edit routine</a><p className="muted">{routine.active ? 'Active' : 'Paused'} · from {routine.start}</p><div className="settings-list">{data.checkIns.filter(value => value.routineId === routine.id && value.status === 'done').sort((a,b) => b.date.localeCompare(a.date)).map(value => <a className="settings-row" key={value.date} href={`#/journal/${value.date}`}><strong>{value.date}</strong><small>{value.minutes !== undefined ? `${value.minutes} min` : value.drinks !== undefined ? `${value.drinks} drinks` : 'Completed'}</small></a>)}</div></>}
        {view && <div className="settings-list"><a className="settings-row" href={`#/view/${view.id}`}>Open view</a><a className="settings-row" href={viewEditorHref(view.id)}>Edit view</a></div>}
        {record?.kind === 'climb' && <ClimbPage record={record} onChanged={() => refreshMeasurements(value => value + 1)} />}
        {record?.kind === 'goal' && <h2>{record.title}</h2>}
        {record?.goal && <><ViewWidgets widgets={['strength']} days={days} data={data} loads={dragLoads(loadSessions())} goalId={record.id} /><button className="primary-button" onClick={() => { if (measurementPreset) location.hash = `/train/${measurementPreset.id}`; else if (!record.goal?.seriesId || record.goal.seriesId === directDragSeriesId) setMeasurement(true); }} disabled={!!record.goal?.seriesId && record.goal.seriesId !== directDragSeriesId && !measurementPreset}>Log measurement</button></>}
        {record?.climbGoal && <><GoalChecklist goal={record} days={days} resources={resources} onEdit={() => setEditingGoal(true)} /></>}{record?.progress && !record.climbGoal && <p>{record.progress.completed} / {record.progress.total}</p>}
        {record && !book && record.kind !== 'climb' && <section className="settings-section"><h2>History</h2>{historyRows.length ? historyRows.map(item => <section key={`${item.date}-${item.record.id}`} className="library-history"><a className="eyebrow text-action" href={`#/journal/${item.date}`}>{shortDate(item.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {item.logged ? 'logged' : 'referenced'}</a><RecordItem record={item.record} onOpen={record => { location.hash = recordHref(record, goalSeries?.id); }} /></section>) : <p className="muted">No logs or references yet.</p>}</section>}
      </> : <p className="muted">This item could not be found.</p>}
    </> : !category && !query ? <>
      <div className="home-list library-categories">{libraryCategories.map(kind => <a className="home-row" key={kind} href={`#/library/${kind}`}><span className="home-lead"><span data-category={categoryColor[kind]}><Icon name={categoryIcon[kind]} size={18} /></span></span><span className="home-row-body"><strong>{categoryName(kind)}</strong><small>{categoryMeta(kind)}</small></span><Icon name="back" size={16} /></a>)}</div>
      <section className="home-section"><h2 className="eyebrow">Recent</h2><div className="recent-things">{recent.map(record => <a className="record-pill" data-category={record.kind} key={recordHref(record)} href={recordHref(record)}>{record.title}</a>)}{!recent.length && <p className="muted">No recent items yet.</p>}</div></section>
    </> : category === 'workouts' ? <WorkoutsList query={query} onNew={() => newItem('workouts')} /> : category === 'climbs' ? <ClimbsList query={query} onQuery={setQuery} /> : category === 'books' ? <><BooksList data={data} query={query} onLog={book => { if (data.routines.some(item => item.kind === 'reading' && item.active)) setReadingBook(book); else location.hash = `/library/books/book-${book.id}`; }} />{data.books.length > 0 && <button className="dashed-add" onClick={() => newItem('books')}>+ Add a book</button>}</> : sections.map(kind => {
      const items = list(kind).filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase()));
      return <section className="settings-section" key={kind}><header className="library-section-heading"><h2><a href={`#/library/${kind}`}>{categoryName(kind)}</a></h2><button className="text-action" onClick={() => newItem(kind)}>+ New<span className="sr-only"> {kind}</span></button></header><div className="settings-list">{items.map(item => <a className="settings-row" key={item.id} href={item.href}><strong>{item.title}</strong><small>{item.subtitle}</small></a>)}{!items.length && <p className="muted">{query ? 'No matches.' : `No ${kind} yet.`}</p>}</div></section>;
    })}
    {routines.error && <p role="alert">{routines.error}</p>}
  </main><PrimaryNav active="library" />
  {editingWorkout && plan && <WorkoutSheet initial={plan} onClose={() => setEditingWorkout(false)} onSaved={() => refreshMeasurements(v => v + 1)} />}
  {deleteWorkout && plan && <Sheet title={`Delete ${plan.name}?`} onClose={() => setDeleteWorkout(false)}><p>Past sessions stay in your journal. The routine stops showing as due.</p><button className="secondary-button" onClick={() => setDeleteWorkout(false)}>Cancel</button><button className="primary-button" onClick={() => { try { deleteWorkoutPlan(plan.id); location.hash='/library/workouts'; } catch(e) { setWorkoutError((e as Error).message); } }}>Delete</button>{workoutError && <p role="alert">{workoutError}</p>}</Sheet>}
  {readingBook && <ReadingSheet data={{...data,currentBookId:readingBook.id}} routine={data.routines.find(item => item.kind === 'reading')!} date={localDate()} onChange={next => routines.update({...next,currentBookId:data.currentBookId})} onClose={() => setReadingBook(undefined)} />}
  {measurement && <QuickLog kind="finger" onClose={() => setMeasurement(false)} onSaved={() => refreshMeasurements(value => value + 1)} />}
  {createPicker && <Sheet title="Create new" onClose={() => setCreatePicker(false)}><div className="settings-list">{libraryCategories.map(kind => <button className="settings-row" key={kind} onClick={() => { setCreatePicker(false); newItem(kind); }}>+ New {categoryName(kind).toLowerCase()}</button>)}</div></Sheet>}
  {creating && category === 'books' && <BookSelector data={data} onChange={routines.update} onClose={endCreation} onSelect={endCreation} />}
  {editingGoal && record && <GoalSheet initial={record} onClose={() => setEditingGoal(false)} />}
  {creating && ['climbs','goals','workouts'].includes(category ?? '') && <CreateThing category={category as LibraryCategory} onClose={endCreation} />}
  </>;
}
type CreateThingProps = { category: LibraryCategory; onClose: () => void; initialTitle?: string; fromEntry?: boolean; onCreated?: (record: JournalRecord) => void };
export function CreateThing(props: CreateThingProps) {
  return props.category === 'goals' ? <GoalSheet {...props} /> : props.category === 'climbs' ? <ClimbSheet {...props} /> : <CreateOtherThing {...props} />;
}
function CreateOtherThing({ onClose, initialTitle = '', onCreated }: CreateThingProps) {
  return <WorkoutSheet initialTitle={initialTitle} onClose={onClose} onSaved={plan => onCreated?.({id:`plan-${plan.id}`,kind:planCategory(plan),title:plan.name,metric:'Workout',meta:plan.description})} />;
}
function MetricDetail({ id, days, seriesId }: { id: string; days: ReturnType<typeof loadDays>; seriesId?: string }) {
  const loads = seriesId ? seriesMeasurements(days, loadSessions(), seriesId) : dragLoads(loadSessions());
  const seriesName = seriesId ? loadSeries(days, loadSessions()).find(series => series.id === seriesId)?.name : undefined;
  const values = days.filter(day => id === 'weight' ? day.metrics.weight !== undefined : day.metrics.sleep !== undefined);
  return <section className="settings-section">{id === 'rehab' ? <RehabChart loads={loads} label={seriesName} /> : id === 'sleep' ? <SleepChart nights={getNights(days)} /> : null}
    {id === 'weight' && values.length > 1 && <svg className="metric-chart" viewBox="0 0 320 100" role="img" aria-label="Weight history"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={[...values].reverse().map((day,i) => `${10+i/(values.length-1)*300},${90-(day.metrics.weight!-Math.min(...values.map(day=>day.metrics.weight!)))/Math.max(1,Math.max(...values.map(day=>day.metrics.weight!))-Math.min(...values.map(day=>day.metrics.weight!)))*80}`).join(' ')} /></svg>}
    {id !== 'rehab' && <div className="settings-list">{values.length ? values.map(day => <a key={day.date} href={`#/journal/${day.date}`} className="settings-row"><strong>{day.date === localDate() ? 'Today' : day.date}</strong><small>{id === 'weight' ? `${day.metrics.weight} kg` : `${Math.floor(day.metrics.sleep!/60)}h ${day.metrics.sleep!%60}m`}</small></a>) : <p className="muted">No measurements yet.</p>}</div>}
    {id === 'rehab' && loads.map((load,i) => <p className="mono" key={`${load.date}-${i}`}>{load.date} · {load.kg} kg</p>)}
    {!['rehab','sleep','weight'].includes(id) && days.flatMap(day => entryRecords(day, []).filter(record => record.id === id).map(record => <RecordItem key={day.date} record={record} onOpen={() => {}} />))}
  </section>;
}
