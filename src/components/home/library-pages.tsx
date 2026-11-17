import { useEffect, useState } from 'react';
import { useRoutines } from '../../routines/use-routines';
import { bookPage, withRoutineDays } from '../../routines/data';
import { BookSelector } from '../../routines/routine-sheets';
import { dragLoads } from '../../routines/rehab-loads';
import { loadSessions } from '../../workouts/storage';
import { loadWorkoutPlans, saveWorkoutPlan } from '../../workouts/catalog';
import { planPresets, prescriptionLabel, resolvePreset, workoutPresets } from '../../workouts/fixtures';
import { InDevelopment, PrimaryNav } from '../app-navigation';
import { entryRecords, localDate, shortDate } from './journal-data';
import { RecordItem } from './journal-records';
import { Sheet } from './journal-sheet';
import { RehabChart, SleepChart } from './journal-widgets';
import { getNights } from './journal-data';
import { loadDays, loadResources, saveResources } from './journal-storage';
import { categoryName, libraryCategories, libraryResources, recordHistory, recordHref, type LibraryCategory } from './library-data';
import { loadViews } from './journal-views';
import { getDataMode, type DataMode } from '../../data/mode';
import { Icon } from './journal-icons';
import { allRoutines } from '../../routines/tasks';
import { WorkoutProgress } from './workout-progress';
import './home.scss';

export default function LibraryPage({ category, id, onDataMode }: { category?: string; id?: string; onDataMode: (mode: DataMode) => void }) {
  const routines = useRoutines(false);
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
  if (book) for (const value of data.checkIns.filter(value => value.bookId === book.id && value.status === 'done')) {
    if (!history.some(item => item.date === value.date)) history.push({ date: value.date, record: { id: `book-${book.id}`, kind: 'habit', title: book.title, metric: `${value.minutes ?? 0} min`, meta: value.page !== undefined ? `Page ${value.page}` : '' }, logged: true });
  }
  const list = (kind: LibraryCategory) => kind === 'routines' ? allRoutines(data).map(item => ({ id: item.id, title: item.name, subtitle: item.active ? 'Active routine' : 'Paused', href: `#/library/routines/${item.id}` }))
    : kind === 'views' ? views.map(item => ({ id: item.id, title: item.name, subtitle: item.isDefault ? 'Default view' : item.tags.join(' · ') || 'All data', href: `#/library/views/${item.id}` }))
    : resources.filter(item => kind === 'climbs' ? item.kind === 'climb' : kind === 'goals' ? item.kind === 'goal' : kind === 'books' ? item.kind === 'habit' : (item.kind === 'training' || item.kind === 'rehab') && (item.id.startsWith('plan-') || savedResources.has(item.id))).map(item => ({ id: item.id, title: item.title, subtitle: item.meta || item.metric, href: recordHref(item) }));
  function newItem(kind: LibraryCategory) {
    if (kind === 'routines') location.hash = '/routines/new';
    else if (kind === 'views') location.hash = '/views/edit/new';
    else location.hash = `/library/${kind}/new`;
  }
  const categoryIcon = { climbs: 'climbs', workouts: 'train', books: 'book', goals: 'goal', routines: 'today', views: 'library' } as const;
  const categoryColor = { climbs: 'climb', workouts: 'training', books: 'habit', goals: 'goal', routines: 'rest', views: 'rest' } as const;
  const categoryMeta = (kind: LibraryCategory) => {
    const count = list(kind).length;
    if (kind === 'workouts') return `${count} · ${new Set(plans.filter(plan => plan.id.includes('rehab')).flatMap(plan => planPresets(plan).filter(preset => !preset.locked).map(preset => preset.id))).size} exercises in rehab`;
    if (kind === 'books') return `${count}${data.currentBookId && data.books.some(book => book.id === data.currentBookId) ? ' · 1 reading' : ''}`;
    if (kind === 'routines') return `${count} · ${allRoutines(data).filter(routine => routine.active).length} active`;
    if (kind === 'views') return `${count} · ${(views.find(view => view.isDefault) ?? views[0])?.name ?? 'All'} is the default`;
    return String(count);
  };
  const recent = [...days].sort((a,b) => b.date.localeCompare(a.date)).flatMap(day => entryRecords(day, resources)).filter(record => record.kind !== 'chart' && record.kind !== 'sleep').filter((record, index, records) => records.findIndex(item => recordHref(item) === recordHref(record)) === index).slice(0, 5);
  const sections = category && libraryCategories.includes(category as LibraryCategory) ? [category as LibraryCategory] : libraryCategories;
  const endCreation = () => { setCreating(false); location.hash = `/library/${category}`; };
  const historyRows = history.sort((a, b) => b.date.localeCompare(a.date));
  const climbLogs = history.filter(item => item.logged && item.record.kind === 'climb');
  return <><main className="today-page library-page configuration-page">{category && <InDevelopment />}
    <header className="screen-heading"><div>{category && <a className="text-action" href={isDetail || creating ? `#/library/${category}` : '#/library'}>‹ {isDetail || creating ? title : 'Library'}</a>}<h1>{isDetail ? record?.title ?? routine?.name ?? view?.name ?? categoryName(id!) : title}</h1></div>{!category && <button className="icon-button" aria-label="Create new" onClick={() => setCreatePicker(true)}><Icon name="plus" size={22} /></button>}</header>
    {!isDetail && <label className="library-search"><Icon name="search" size={20} /><span className="sr-only">Search Library</span><input type="search" placeholder={category ? `Search ${title.toLowerCase()}…` : 'Search climbs, workouts, books…'} value={query} onChange={event => setQuery(event.target.value)} /></label>}
    {isDetail ? <>
      {category === 'metrics' ? <MetricDetail id={id!} days={days} /> : record || routine || view ? <>
        {plan && <><p className="muted">{plan.description}</p><a className="primary-button full-width" href={`#/train/${plan.id}`}>Start workout</a><section className="settings-section"><h2>Exercises</h2>{planPresets(plan).map(preset => <div className="settings-row library-exercise" key={preset.id}><strong>{preset.name}</strong><small>{preset.locked?.label ?? prescriptionLabel(preset.prescription)}{preset.optional ? ' · optional' : ''}</small></div>)}</section></>}
        {plan && <WorkoutProgress sessions={loadSessions().filter(session => (session.workout?.plan.id ?? session.preset.id) === plan.id)} />}
        {book && <p>{book.author} · {bookPage(data, book.id)} / {book.pages} pages</p>}
        {routine && <><a className="text-action" href={`#/routines/${routine.id}`}>Edit routine</a><p className="muted">{routine.active ? 'Active' : 'Paused'} · from {routine.start}</p><div className="settings-list">{data.checkIns.filter(value => value.routineId === routine.id && value.status === 'done').sort((a,b) => b.date.localeCompare(a.date)).map(value => <a className="settings-row" key={value.date} href={`#/journal/${value.date}`}><strong>{value.date}</strong><small>{value.minutes !== undefined ? `${value.minutes} min` : value.drinks !== undefined ? `${value.drinks} drinks` : 'Completed'}</small></a>)}</div></>}
        {view && <div className="settings-list"><a className="settings-row" href={`#/view/${view.id}`}>Open view</a><a className="settings-row" href={`#/views/edit/${view.id}`}>Edit view</a></div>}
        {climbLogs.length > 0 && <p className="mono">{climbLogs.reduce((sum,item) => sum + (item.record.kind !== 'chart' ? item.record.climb?.goes ?? 0 : 0),0)} goes · {climbLogs.filter(item => item.record.kind !== 'chart' && item.record.climb?.sendGo).length} sends</p>}
        {record?.progress && <p>{record.progress.completed} / {record.progress.total}</p>}
        {record && <section className="settings-section"><h2>History</h2>{historyRows.length ? historyRows.map(item => <section key={`${item.date}-${item.record.id}`} className="library-history"><a className="eyebrow text-action" href={`#/journal/${item.date}`}>{shortDate(item.date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · {item.logged ? 'logged' : 'referenced'}</a><RecordItem record={item.record} onOpen={record => { location.hash = recordHref(record); }} /></section>) : <p className="muted">No logs or references yet.</p>}</section>}
      </> : <p className="muted">This item could not be found.</p>}
    </> : !category && !query ? <>
      <div className="home-list library-categories">{libraryCategories.map(kind => <a className="home-row" key={kind} href={`#/library/${kind}`}><span className="home-lead"><span data-category={categoryColor[kind]}><Icon name={categoryIcon[kind]} size={18} /></span></span><span className="home-row-body"><strong>{categoryName(kind)}</strong><small>{categoryMeta(kind)}</small></span><Icon name="back" size={16} /></a>)}</div>
      <section className="home-section"><h2 className="eyebrow">Recent</h2><div className="recent-things">{recent.map(record => <a className="record-pill" data-category={record.kind} key={recordHref(record)} href={recordHref(record)}>{record.title}</a>)}{!recent.length && <p className="muted">No recent items yet.</p>}</div></section>
    </> : sections.map(kind => {
      const items = list(kind).filter(item => `${item.title} ${item.subtitle}`.toLowerCase().includes(query.toLowerCase()));
      return <section className="settings-section" key={kind}><header className="library-section-heading"><h2><a href={`#/library/${kind}`}>{categoryName(kind)}</a></h2><button className="text-action" onClick={() => newItem(kind)}>+ New<span className="sr-only"> {kind}</span></button></header><div className="settings-list">{items.map(item => <a className="settings-row" key={item.id} href={item.href}><strong>{item.title}</strong><small>{item.subtitle}</small></a>)}{!items.length && <p className="muted">{query ? 'No matches.' : `No ${kind} yet.`}</p>}</div></section>;
    })}
    {!category && <section className="settings-section data-mode-switch"><label className="form-label">Stored data<select aria-label="Stored data mode" value={getDataMode()} onChange={event => onDataMode(event.target.value as DataMode)}><option value="real">My real setup</option><option value="demo">Testing / dummy data</option></select></label><p className="settings-caption">Each mode keeps its own saved data.</p></section>}
    {routines.error && <p role="alert">{routines.error}</p>}
  </main><PrimaryNav active="library" />
  {createPicker && <Sheet title="Create new" onClose={() => setCreatePicker(false)}><div className="settings-list">{libraryCategories.map(kind => <button className="settings-row" key={kind} onClick={() => { setCreatePicker(false); newItem(kind); }}>+ New {categoryName(kind).toLowerCase()}</button>)}</div></Sheet>}
  {creating && category === 'books' && <BookSelector data={data} onChange={routines.update} onClose={endCreation} onSelect={endCreation} />}
  {creating && ['climbs','goals','workouts'].includes(category ?? '') && <CreateThing category={category as LibraryCategory} onClose={endCreation} />}
  </>;
}
function CreateThing({ category, onClose }: { category: LibraryCategory; onClose: () => void }) {
  const [title, setTitle] = useState(''), [description, setDescription] = useState(''), [grade, setGrade] = useState('');
  const [total, setTotal] = useState(1), [presets, setPresets] = useState<string[]>([]), [error, setError] = useState('');
  return <Sheet title={`New ${category === 'climbs' ? 'climb' : category === 'goals' ? 'goal' : 'workout'}`} onClose={onClose}><form className="entry-form" onSubmit={event => { event.preventDefault(); try {
    if (!title.trim()) throw new Error('Enter a name.');
    const id = crypto.randomUUID();
    if (category === 'workouts') saveWorkoutPlan({ id, name: title, description, presetIds: presets });
    else saveResources([...loadResources(), { id, kind: category === 'climbs' ? 'climb' : 'goal', title: title.trim(), metric: grade, meta: description, ...(category === 'goals' ? { progress: { completed: 0, total } } : {}) }]);
    onClose();
  } catch(error) { setError((error as Error).message); } }}><label>Name<input autoFocus required value={title} onChange={event => setTitle(event.target.value)} /></label><label>{category === 'climbs' ? 'Location / details' : 'Description'}<textarea value={description} onChange={event => setDescription(event.target.value)} /></label>
    {category === 'climbs' && <label>Grade<input value={grade} onChange={event => setGrade(event.target.value)} /></label>}
    {category === 'goals' && <label>Target count<input required type="number" min="1" step="1" value={total} onChange={event => setTotal(Number(event.target.value))} /></label>}
    {category === 'workouts' && <fieldset><legend>Exercises</legend>{workoutPresets.filter(preset => preset.id !== 'finger-rehab').map(preset => resolvePreset(preset)).map(preset => <label className="metric-choice" key={preset.id}><span>{preset.name}<small className="muted"> · {prescriptionLabel(preset.prescription)}</small></span><input type="checkbox" checked={presets.includes(preset.id)} onChange={event => setPresets(current => event.target.checked ? [...current,preset.id] : current.filter(id => id !== preset.id))} /></label>)}</fieldset>}
    {error && <p role="alert">{error}</p>}<button type="submit" className="primary-button">Create {category === 'climbs' ? 'climb' : category === 'goals' ? 'goal' : 'workout'}</button></form></Sheet>;
}
function MetricDetail({ id, days }: { id: string; days: ReturnType<typeof loadDays> }) {
  const loads = dragLoads(loadSessions());
  const values = days.filter(day => id === 'weight' ? day.metrics.weight !== undefined : day.metrics.sleep !== undefined);
  return <section className="settings-section">{id === 'rehab' ? <RehabChart loads={loads} /> : id === 'sleep' ? <SleepChart nights={getNights(days)} /> : null}
    {id === 'weight' && values.length > 1 && <svg className="metric-chart" viewBox="0 0 320 100" role="img" aria-label="Weight history"><polyline fill="none" stroke="currentColor" strokeWidth="2" points={[...values].reverse().map((day,i) => `${10+i/(values.length-1)*300},${90-(day.metrics.weight!-Math.min(...values.map(day=>day.metrics.weight!)))/Math.max(1,Math.max(...values.map(day=>day.metrics.weight!))-Math.min(...values.map(day=>day.metrics.weight!)))*80}`).join(' ')} /></svg>}
    {id !== 'rehab' && <div className="settings-list">{values.length ? values.map(day => <a key={day.date} href={`#/journal/${day.date}`} className="settings-row"><strong>{day.date === localDate() ? 'Today' : day.date}</strong><small>{id === 'weight' ? `${day.metrics.weight} kg` : `${Math.floor(day.metrics.sleep!/60)}h ${day.metrics.sleep!%60}m`}</small></a>) : <p className="muted">No measurements yet.</p>}</div>}
    {id === 'rehab' && loads.map((load,i) => <p className="mono" key={`${load.date}-${i}`}>{load.date} · {load.kg} kg</p>)}
    {!['rehab','sleep','weight'].includes(id) && days.flatMap(day => entryRecords(day, []).filter(record => record.id === id).map(record => <RecordItem key={day.date} record={record} onOpen={() => {}} />))}
  </section>;
}
