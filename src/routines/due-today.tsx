import { useId, useState } from 'react';
import { useRehab } from '../rehab/use-rehab';
import { rehabTasks } from '../rehab/data';
import { localDate, shortDate } from '../components/home/journal-data';
import { Icon } from '../components/home/journal-icons';
import type { Session } from '../workouts/session';
import { planPresets, prescriptionLabel, workoutPlans } from '../workouts/fixtures';
import { addDays, bookPage, checkIn, freeStreak, putCheckIn, weeklyDrinks, type CheckIn, type Routine, type RoutineData, type RoutineKind } from './data';
import { allRoutines, comparatorLabel, routineCount, routineDone, routineDue, routineLink, routinePlans, routineTags, type ViewTag } from './tasks';

export function DueToday({ data, recentSkips, sessions, onChange, onOpen, kinds, tags, variant = 'card' }: { data: RoutineData; recentSkips: CheckIn[]; sessions: Session[]; onChange: (data: RoutineData) => void; onOpen: (routine: Routine, date: string) => void; kinds?: readonly RoutineKind[]; tags?: ViewTag[]; variant?: 'card' | 'journal' | 'compact' | 'todo' }) {
  const today = localDate();
  const rehab = useRehab();
  const rehabItems = rehabTasks(rehab.data, sessions, today);
  const itemsId = useId();
  const [expanded, setExpanded] = useState(true);
  const [workouts, setWorkouts] = useState<string[]>([]);
  const includes = (r: Routine) => (!kinds || kinds.includes(r.kind)) && (!tags?.length || routineTags(r).some(tag => tags.includes(tag)));
  const routines = allRoutines(data).filter(includes);
  const daily = routines.filter(r => routineDue(r, data, sessions, today) && (checkIn(data, r.id, today)?.status !== 'skipped' || recentSkips.some(skip => skip.routineId === r.id && skip.date === today)));
  const weekly = routines.filter(r => r.active && r.start <= today && r.schedule === 'weekly');
  const done = (r: Routine) => routineDone(r, data, sessions, today);
  const completed = daily.filter(done).length;
  const recentSkip = recentSkips.findLast(skip => skip.date < today && skip.date >= addDays(today, -7) && data.routines.some(r => r.id === skip.routineId && includes(r)));
  const skippedRoutine = recentSkip && data.routines.find(r => r.id === recentSkip.routineId);
  const missing = recentSkip && skippedRoutine ? { routine: skippedRoutine, date: recentSkip.date } : Array.from({ length: 7 }, (_, i) => addDays(today, i - 7)).flatMap(date => routines.filter(r => ['reading', 'alcohol'].includes(r.kind) && routineDue(r, data, sessions, date) && !checkIn(data, r.id, date)).map(routine => ({ routine, date }))).at(-1);
  const upcoming = routines.filter(r => r.active && r.schedule !== 'weekly').flatMap(routine => {
    const date = Array.from({ length: 366 }, (_, i) => addDays(today, i + 1)).find(date => routineDue(routine, data, sessions, date));
    return date ? [{ routine, date }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 3);
  const book = data.books.find(b => b.id === data.currentBookId);
  function quick(r: Routine) {
    if (r.kind === 'reading' && !book) { onOpen(r, today); return; }
    if (done(r) || checkIn(data, r.id, today)?.status === 'skipped') { onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== r.id || c.date !== today) }); return; }
    onChange(putCheckIn(data, { routineId: r.id, date: today, status: 'done', ...(r.kind === 'reading' ? { minutes: r.schedule === 'weekly' ? 20 : r.target, bookId: book?.id } : { drinks: 0 }) }));
  }
  function row(r: Routine, isWeekly = false) {
    const workout = r.kind === 'training' || r.kind === 'rehab';
    const count = isWeekly ? routineCount(r, data, sessions, today) : 0;
    const plans = routinePlans(r).flatMap(id => workoutPlans.filter(plan => plan.id === id));
    const open = workouts.includes(r.id);
    const detail = r.planSchedule ? rehabItems.find(item => item.id === r.id)?.detail : undefined;
    const meta = detail ?? (isWeekly ? `${count} of ${r.target} this week · ${comparatorLabel(r)} ${r.target}` : r.kind === 'reading' ? `daily · ${book ? `${book.title} p.${bookPage(data, book.id)}` : 'Add your book'}` : r.kind === 'alcohol' ? `day ${freeStreak(data, r, today)} · ${weeklyDrinks(data, today)} of ${r.target} drinks this week` : done(r) ? 'Logged today' : 'Due today');
    const breakdownId = `${itemsId}-${r.id}`;
    return <div key={r.id} className="due-item">
      <div className={`due-row${isWeekly ? ' weekly-training' : ''}`}>
        {workout ? <a className="routine-ring rehab-ring" href={routineLink(r)} aria-label={`Open ${r.name}`}><Icon name={done(r) ? 'check' : 'train'} size={18} /></a> : <button className="routine-ring" aria-label={checkIn(data, r.id, today)?.status === 'skipped' ? `Undo skipping ${r.name}` : `${done(r) ? 'Clear' : 'Complete'} ${r.name} for today`} aria-pressed={done(r)} onClick={() => quick(r)}><span>{done(r) && <Icon name="check" size={16} />}</span></button>}
        {workout ? <a className="due-body" href={routineLink(r)}><strong>{r.name}</strong><small>{meta}</small></a> : <button className="due-body" onClick={() => onOpen(r, today)}><strong>{r.name}</strong><small>{meta}</small></button>}
        {workout ? <button className="icon-button due-chevron" aria-label={r.id === 'train' ? 'Required workout' : `${r.name} workout breakdown`} aria-expanded={open} aria-controls={breakdownId} onClick={() => setWorkouts(current => open ? current.filter(id => id !== r.id) : [...current, r.id])}><Icon name="chevron" size={16} /></button> : <button className="icon-button due-chevron" aria-label={`Open ${r.name}`} onClick={() => onOpen(r, today)}><Icon name="chevron" size={16} /></button>}
      </div>
      {isWeekly && variant === 'todo' && <div className="weekly-target-track" role="meter" aria-label={`${r.name} this week`} aria-valuemin={0} aria-valuemax={Math.max(r.target, count)} aria-valuenow={count} aria-valuetext={`${count} of ${r.target} · ${comparatorLabel(r)}`} data-category={r.kind === 'training' ? 'training' : r.kind === 'rehab' ? 'rehab' : 'habit'}><i style={{ width: `${Math.min(100, count / r.target * 100)}%` }} /></div>}
      {workout && open && <section className="weekly-breakdown" id={breakdownId} aria-label={r.id === 'train' ? 'Required workout' : `${r.name} workout breakdown`}>{plans.length ? <ul>{plans.map(plan => <li key={plan.id}><a href={`#/train/${plan.id}`}>{plan.name} <span>Open workout</span></a><ul>{planPresets(plan).map(preset => <li key={preset.id}><strong>{preset.name}</strong><small>{preset.locked ? preset.locked.label : prescriptionLabel(preset.prescription)}</small></li>)}</ul></li>)}</ul> : <a href="#/train">Choose a workout</a>}</section>}
    </div>;
  }
  const earlier = missing && <div className="due-missing-divider"><div className="unlogged-row"><div><strong>{missing.routine.name} · {shortDate(missing.date, { weekday: 'short', day: 'numeric' })}</strong><small>earlier · {recentSkip && skippedRoutine ? 'skipped' : 'unlogged'}</small></div>{recentSkip && skippedRoutine ? <button className="text-action" aria-label={`Undo skipping ${missing.routine.name}`} onClick={() => onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== missing.routine.id || c.date !== missing.date) })}>Undo</button> : <><button className="log-button" onClick={() => onOpen(missing.routine, missing.date)}>Log</button><button className="text-action" onClick={() => onChange(putCheckIn(data, { routineId: missing.routine.id, date: missing.date, status: 'skipped' }))}>Skip</button></>}</div></div>;
  if (variant === 'todo') return <div className="todo-sections">
    <p className="todo-date mono muted">{shortDate(today, { weekday: 'short', day: 'numeric', month: 'short' })} · {completed} of {daily.length} done today</p>
    {earlier}
    <section aria-label="Today"><h2 className="eyebrow muted">Today</h2><div className="due-today">{daily.map(r => row(r))}{!daily.length && <p className="empty-records">Nothing due today.</p>}</div></section>
    {weekly.length > 0 && <section aria-label="This week"><h2 className="eyebrow muted">This week · resets Monday</h2><div className="due-today">{weekly.map(r => row(r, true))}</div></section>}
    {upcoming.length > 0 && <section aria-label="Coming up"><h2 className="eyebrow muted">Coming up</h2><div className="settings-list">{upcoming.map(({ routine, date }) => <div className="settings-row" key={routine.id}><a href={`#/routines/${routine.id}`}><strong>{routine.name}</strong></a><small>{shortDate(date, { weekday: 'short', day: 'numeric' })}</small></div>)}</div></section>}
  </div>;
  const title = variant === 'journal' ? 'Today’s tasks' : 'Due today';
  return <section className={`due-today due-${variant}`} aria-label={title}><button className="due-heading" aria-expanded={expanded} aria-controls={itemsId} onClick={() => setExpanded(!expanded)}><strong>{variant === 'journal' ? 'Due today' : title}</strong><span>{completed} of {daily.length}</span><Icon name="chevron" size={16} /></button>{expanded && <div id={itemsId}>{variant === 'journal' ? <><HabitRows data={data} date={today} recentSkips={recentSkips} onOpen={onOpen} onChange={onChange} />{daily.filter(r => r.kind === 'rehab' || r.kind === 'training').map(r => row(r))}</> : daily.map(r => row(r))}{weekly.map(r => row(r, true))}{variant === 'card' && earlier}</div>}</section>;
}

export function HabitRows({ data, date, recentSkips, onOpen, onChange }: { data: RoutineData; date: string; recentSkips: CheckIn[]; onOpen: (routine: Routine, date: string) => void; onChange: (data: RoutineData) => void }) {
  if (date > localDate()) return null;
  return <>{data.routines.filter(r => ['reading', 'alcohol'].includes(r.kind) && routineDue(r, data, [], date)).map(routine => {
    const value = checkIn(data, routine.id, date);
    const skipped = value?.status === 'skipped' && recentSkips.some(skip => skip.routineId === routine.id && skip.date === date);
    if (value && !skipped) return null;
    return <div className={`feed-habit${skipped ? ' skipped-habit' : ''}`} key={routine.id}><span className="habit-status-marker" aria-hidden="true">{skipped ? '–' : ''}</span><span className="feed-habit-label">{routine.kind === 'reading' ? 'read' : routine.name.toLowerCase()} · {skipped ? 'skipped' : 'unlogged'}</span>{skipped
      ? <button className="skip-habit" aria-label={`Undo skipping ${routine.name}`} onClick={() => onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== routine.id || c.date !== date) })}>Undo</button>
      : <><button onClick={() => onOpen(routine, date)}>Log</button><button className="skip-habit" onClick={() => onChange(putCheckIn(data, { routineId: routine.id, date, status: 'skipped' }))}>Skip</button></>}</div>;
  })}</>;
}
