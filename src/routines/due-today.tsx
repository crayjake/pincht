import { useState } from 'react';
import { localDate, shortDate } from '../components/home/journal-data';
import { Icon } from '../components/home/journal-icons';
import type { Session } from '../workouts/session';
import { addDays, bookPage, checkIn, freeStreak, putCheckIn, rehabDone, scheduled, unlogged, weeklyDrinks, weeklyWorkouts, type CheckIn, type Routine, type RoutineData } from './data';

export function DueToday({ data, recentSkips, sessions, onChange, onOpen, onSettings }: { data: RoutineData; recentSkips: CheckIn[]; sessions: Session[]; onChange: (data: RoutineData) => void; onOpen: (routine: Routine, date: string) => void; onSettings: () => void }) {
  const today = localDate();
  const [expanded, setExpanded] = useState<boolean | null>(null);
  const daily = data.routines.filter(r => scheduled(r, today));
  const done = (r: Routine) => r.kind === 'rehab' ? rehabDone(sessions, today) : !!checkIn(data, r.id, today);
  const completed = daily.filter(done).length;
  const open = expanded ?? (completed < daily.length);
  const train = data.routines.find(r => r.active && r.kind === 'training' && r.start <= today);
  const count = weeklyWorkouts(sessions, today);
  const recentSkip = recentSkips.findLast(skip => skip.date < today && skip.date >= addDays(today, -7));
  const skippedRoutine = recentSkip && data.routines.find(routine => routine.id === recentSkip.routineId);
  const missing = recentSkip && skippedRoutine ? { routine: skippedRoutine, date: recentSkip.date } : unlogged(data, addDays(today, -7), addDays(today, -1)).at(-1);
  const next = Array.from({ length: 366 }, (_, i) => addDays(today, i + 1)).flatMap(date => data.routines.filter(r => r.kind === 'rehab' && scheduled(r, date)).map(routine => ({ date, routine })))[0];
  const book = data.books.find(b => b.id === data.currentBookId)!;
  function quick(routine: Routine) {
    if (done(routine)) { onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== routine.id || c.date !== today) }); return; }
    onChange(putCheckIn(data, { routineId: routine.id, date: today, status: 'done', ...(routine.kind === 'reading' ? { minutes: routine.target, bookId: book.id } : { drinks: 0 }) }));
  }
  return <section className="due-today" aria-label="Due today">
    <button className="due-heading" aria-expanded={open} aria-controls="due-today-items" onClick={() => setExpanded(!open)}><strong>Due today</strong><span>{shortDate(today, { weekday: 'short', day: 'numeric', month: 'short' })} · {completed} of {daily.length}</span><Icon name="chevron" size={16} /></button>
    {open && <div id="due-today-items">
      {daily.map(routine => <div className="due-row" key={routine.id}>
        {routine.kind === 'rehab' ? <a className="routine-ring rehab-ring" href="#/train/pulley-rehab" aria-label="Open finger rehab"><Icon name={done(routine) ? 'check' : 'train'} size={18} /></a> : <button className="routine-ring" aria-label={`${done(routine) ? 'Clear' : 'Complete'} ${routine.name} for today`} aria-pressed={done(routine)} onClick={() => quick(routine)}><span>{done(routine) && <Icon name="check" size={16} />}</span></button>}
        <button className="due-body" onClick={() => onOpen(routine, today)}><strong>{routine.name}</strong><small>{routine.kind === 'reading' ? <>daily · <span className="book-pill">{book.title}</span> p.{bookPage(data, book.id)}</> : routine.kind === 'alcohol' ? `day ${freeStreak(data, routine, today)} · ${weeklyDrinks(data, today)} of ${routine.target} drinks this week` : `every ${routine.interval} days · ${done(routine) ? 'logged' : 'due today'}`}</small></button>
        <button className="icon-button due-chevron" aria-label={`Open ${routine.name}`} onClick={() => onOpen(routine, today)}><Icon name="chevron" size={16} /></button>
      </div>)}
      {train && <a className="due-row weekly-training" href="#/train"><span className="weekly-ring" role="img" aria-label={`${count} of ${train.target} workouts`}><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="13" fill="none" stroke="var(--color-track)" strokeWidth="3" strokeDasharray={`${Math.max(1, 81.68 / train.target - 3)} 3`} /><circle cx="18" cy="18" r="13" fill="none" stroke="var(--color-training-fg)" strokeWidth="3" pathLength="100" strokeDasharray={`${Math.min(count / train.target, 1) * 100} 100`} transform="rotate(-90 18 18)" /></svg></span><span className="due-body"><strong>Train</strong><small>{count} of {train.target} this week · at least {train.target}</small></span><Icon name="chevron" size={16} /></a>}
      {missing && <div className="due-missing-divider"><div className="unlogged-row"><div><strong>{missing.routine.name} · {shortDate(missing.date, { weekday: 'short', day: 'numeric' })}</strong><small>earlier · {recentSkip && skippedRoutine ? 'skipped' : 'unlogged'}</small></div>{recentSkip && skippedRoutine
        ? <button className="text-action" aria-label={`Undo skipping ${missing.routine.name}`} onClick={() => onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== missing.routine.id || c.date !== missing.date) })}>Undo</button>
        : <><button className="log-button" onClick={() => onOpen(missing.routine, missing.date)}>Log</button><button className="text-action" onClick={() => onChange(putCheckIn(data, { routineId: missing.routine.id, date: missing.date, status: 'skipped' }))}>Skip</button></>}</div></div>}
      <footer className="due-footer"><span>{next && <><span className="hold" data-category="rehab" /><span>Coming up · {next.routine.name} · {shortDate(next.date, { weekday: 'short', day: 'numeric' })}</span></>}</span><button className="text-action" onClick={onSettings}>Routines <Icon name="chevron" size={14} /></button></footer>
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
