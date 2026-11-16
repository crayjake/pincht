import { useId, useState } from 'react';
import { localDate, shortDate } from '../components/home/journal-data';
import { Icon } from '../components/home/journal-icons';
import type { Session } from '../workouts/session';
import { planPresets, prescriptionLabel, workoutPlans } from '../workouts/fixtures';
import { addDays, bookPage, checkIn, freeStreak, putCheckIn, rehabDone, routineWorkoutPlanIds, scheduled, unlogged, weeklyDrinks, weeklyWorkouts, type CheckIn, type Routine, type RoutineData, type RoutineKind } from './data';

export function DueToday({ data, recentSkips, sessions, onChange, onOpen, kinds, variant = 'card' }: { data: RoutineData; recentSkips: CheckIn[]; sessions: Session[]; onChange: (data: RoutineData) => void; onOpen: (routine: Routine, date: string) => void; kinds?: readonly RoutineKind[]; variant?: 'card' | 'journal' | 'compact' }) {
  const today = localDate();
  const itemsId = useId();
  const workoutsId = useId();
  const [trainingExpanded, setTrainingExpanded] = useState(false);
  const includes = (routine: Routine) => !kinds || kinds.includes(routine.kind);
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const daily = data.routines.filter(r => includes(r) && scheduled(r, today));
  const done = (r: Routine) => r.kind === 'rehab' ? rehabDone(sessions, today) : !!checkIn(data, r.id, today);
  const completed = daily.filter(done).length;
  const train = data.routines.find(r => includes(r) && r.active && r.kind === 'training' && r.start <= today);
  const plans = (routineWorkoutPlanIds[train?.id ?? ''] ?? []).flatMap(id => workoutPlans.filter(plan => plan.id === id));
  const count = weeklyWorkouts(sessions, today);
  const open = expanded ?? (completed < daily.length || (variant === 'compact' && !!train && count < train.target) || (variant === 'journal' && recentSkips.some(skip => skip.date === today)));
  const recentSkip = recentSkips.findLast(skip => skip.date < today && skip.date >= addDays(today, -7) && data.routines.some(r => r.id === skip.routineId && includes(r)));
  const skippedRoutine = recentSkip && data.routines.find(routine => routine.id === recentSkip.routineId);
  const missing = recentSkip && skippedRoutine ? { routine: skippedRoutine, date: recentSkip.date } : unlogged(data, addDays(today, -7), addDays(today, -1)).filter(item => includes(item.routine)).at(-1);
  const next = Array.from({ length: 366 }, (_, i) => addDays(today, i + 1)).flatMap(date => data.routines.filter(r => includes(r) && r.kind === 'rehab' && scheduled(r, date)).map(routine => ({ date, routine })))[0];
  const book = data.books.find(b => b.id === data.currentBookId)!;
  function quick(routine: Routine) {
    if (done(routine)) { onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== routine.id || c.date !== today) }); return; }
    onChange(putCheckIn(data, { routineId: routine.id, date: today, status: 'done', ...(routine.kind === 'reading' ? { minutes: routine.target, bookId: book.id } : { drinks: 0 }) }));
  }
  const title = variant === 'journal' ? 'Today’s tasks' : 'Due today';
  return <section className={`due-today due-${variant}`} aria-label={title}>
    <button className="due-heading" aria-expanded={open} aria-controls={itemsId} onClick={() => setExpanded(!open)}><strong>{title}</strong><span>{variant === 'card' && <>{shortDate(today, { weekday: 'short', day: 'numeric', month: 'short' })} · </>}{daily.length ? `${completed} of ${daily.length}` : train ? 'This week' : 'Nothing due'}</span><Icon name="chevron" size={16} /></button>
    {open && <div id={itemsId}>
      {variant === 'journal' && <HabitRows data={data} date={today} recentSkips={recentSkips} onOpen={onOpen} onChange={onChange} />}
      {daily.filter(routine => variant !== 'journal' || routine.kind === 'rehab').map(routine => <div className="due-row" key={routine.id}>
        {routine.kind === 'rehab' ? <a className="routine-ring rehab-ring" href="#/train/pulley-rehab" aria-label="Open finger rehab"><Icon name={done(routine) ? 'check' : 'train'} size={18} /></a> : <button className="routine-ring" aria-label={`${done(routine) ? 'Clear' : 'Complete'} ${routine.name} for today`} aria-pressed={done(routine)} onClick={() => quick(routine)}><span>{done(routine) && <Icon name="check" size={16} />}</span></button>}
        <button className="due-body" onClick={() => onOpen(routine, today)}><strong>{routine.name}</strong><small>{routine.kind === 'reading' ? <>daily · <span className="book-pill">{book.title}</span> p.{bookPage(data, book.id)}</> : routine.kind === 'alcohol' ? `day ${freeStreak(data, routine, today)} · ${weeklyDrinks(data, today)} of ${routine.target} drinks this week` : `every ${routine.interval} days · ${done(routine) ? 'logged' : 'due today'}`}</small></button>
        <button className="icon-button due-chevron" aria-label={`Open ${routine.name}`} onClick={() => onOpen(routine, today)}><Icon name="chevron" size={16} /></button>
      </div>)}
      {train && <>
        <div className="due-row weekly-training"><span className="weekly-ring" role="img" aria-label={`${count} of ${train.target} workouts`}><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="13" fill="none" stroke="var(--color-track)" strokeWidth="3" strokeDasharray={`${Math.max(1, 81.68 / train.target - 3)} 3`} /><circle cx="18" cy="18" r="13" fill="none" stroke="var(--color-training-fg)" strokeWidth="3" pathLength="100" strokeDasharray={`${Math.min(count / train.target, 1) * 100} 100`} transform="rotate(-90 18 18)" /></svg></span><a className="due-body" href="#/train"><strong>Train</strong><small>{count} of {train.target} this week · at least {train.target}</small></a><button className="icon-button due-chevron" aria-label="Required workout" aria-expanded={trainingExpanded} aria-controls={workoutsId} onClick={() => setTrainingExpanded(!trainingExpanded)}><Icon name="chevron" size={16} /></button></div>
        {trainingExpanded && <section className="weekly-breakdown" id={workoutsId} aria-label="Required workout">
          {plans.length ? <ul>{plans.map(plan => <li key={plan.id}>
            <a href={`#/train/${plan.id}`}>{plan.name}{' '}<span>Open workout</span></a>
            <ul>{planPresets(plan).map(preset => <li key={preset.id}><strong>{preset.name}</strong><small>{preset.locked ? preset.locked.label : prescriptionLabel(preset.prescription)}</small></li>)}</ul>
          </li>)}</ul> : <p>No workout linked to Train.</p>}
        </section>}
      </>}
      {variant !== 'journal' && missing && <div className="due-missing-divider"><div className="unlogged-row"><div><strong>{missing.routine.name} · {shortDate(missing.date, { weekday: 'short', day: 'numeric' })}</strong><small>earlier · {recentSkip && skippedRoutine ? 'skipped' : 'unlogged'}</small></div>{recentSkip && skippedRoutine
        ? <button className="text-action" aria-label={`Undo skipping ${missing.routine.name}`} onClick={() => onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== missing.routine.id || c.date !== missing.date) })}>Undo</button>
        : <><button className="log-button" onClick={() => onOpen(missing.routine, missing.date)}>Log</button><button className="text-action" onClick={() => onChange(putCheckIn(data, { routineId: missing.routine.id, date: missing.date, status: 'skipped' }))}>Skip</button></>}</div></div>}
      {variant !== 'journal' && next && <footer className="due-footer"><span><span className="hold" data-category="rehab" /><span>Coming up · {next.routine.name} · {shortDate(next.date, { weekday: 'short', day: 'numeric' })}</span></span></footer>}
    </div>}
  </section>;
}

export function HabitRows({ data, date, recentSkips, onOpen, onChange }: { data: RoutineData; date: string; recentSkips: CheckIn[]; onOpen: (routine: Routine, date: string) => void; onChange: (data: RoutineData) => void }) {
  if (date > localDate()) return null;
  return <>{data.routines.filter(r => ['reading', 'alcohol'].includes(r.kind) && scheduled(r, date)).map(routine => {
    const value = checkIn(data, routine.id, date);
    const skipped = value?.status === 'skipped' && recentSkips.some(skip => skip.routineId === routine.id && skip.date === date);
    if (value && !skipped) return null;
    return <div className={`feed-habit${skipped ? ' skipped-habit' : ''}`} key={routine.id}><span className="habit-status-marker" aria-hidden="true">{skipped ? '–' : ''}</span><span className="feed-habit-label">{routine.kind === 'reading' ? 'read' : routine.name.toLowerCase()} · {skipped ? 'skipped' : 'unlogged'}</span>{skipped
      ? <button className="skip-habit" aria-label={`Undo skipping ${routine.name}`} onClick={() => onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== routine.id || c.date !== date) })}>Undo</button>
      : <><button onClick={() => onOpen(routine, date)}>Log</button><button className="skip-habit" onClick={() => onChange(putCheckIn(data, { routineId: routine.id, date, status: 'skipped' }))}>Skip</button></>}</div>;
  })}</>;
}
