import { useEffect, useState } from 'react';
import { PrimaryNav } from '../app-navigation';
import { useRoutines } from '../../routines/use-routines';
import { AlcoholSheet, ReadingSheet } from '../../routines/routine-sheets';
import { localDate, shortDate } from './journal-data';
import { loadWorkoutPlans } from '../../workouts/catalog';
import { loadSessions } from '../../workouts/storage';
import { clearWorkoutDraft, loadWorkoutDraft } from '../../workouts/draft';
import { planPresets, prescriptionLabel, type WorkoutPlan } from '../../workouts/fixtures';
import { QuickLog } from './quick-log';
import { Sheet } from './journal-sheet';
import { Icon } from './journal-icons';
import { addDays, realSessions, sessionDate, weekStart } from '../../routines/data';
import { allRoutines, routineCount, routineDone, routineDue, routinePlans } from '../../routines/tasks';
import './home.scss';

export default function DoPage() {
  useEffect(() => { document.title = 'Do · pincht'; }, []);
  const routines = useRoutines(false);
  const [log, setLog] = useState<'reading' | 'alcohol' | 'weight' | 'climb' | 'sleep' | null>(null);
  const [more, setMore] = useState(false);
  const [draft, setDraft] = useState(loadWorkoutDraft);
  const [discard, setDiscard] = useState(false);
  const plans = loadWorkoutPlans();
  const sessions = realSessions(loadSessions());
  const today = localDate();
  const candidates = allRoutines(routines.data).filter(routine => routine.active && routine.start && ['training', 'rehab'].includes(routine.kind)).flatMap(routine => {
    const date = routine.schedule === 'weekly'
      ? routine.start > today ? routine.start : routineCount(routine, routines.data, sessions, today) < routine.target ? today : addDays(weekStart(today), 7)
      : Array.from({ length: 366 }, (_, i) => addDays(today, i)).find(date => routineDue(routine, routines.data, sessions, date) && !routineDone(routine, routines.data, sessions, date));
    const plan = routinePlans(routine).flatMap(id => plans.filter(plan => plan.id === id))[0];
    return date && plan ? [{ date, plan, weekly: routine.schedule === 'weekly' }] : [];
  }).sort((a, b) => a.date.localeCompare(b.date) || Number(a.weekly) - Number(b.weekly));
  const next = candidates[0];
  const routine = routines.data.routines.find(routine => routine.kind === log && routine.active && routine.start <= today);
  const planCategory = (plan: WorkoutPlan) => plan.id.includes('rehab') ? 'rehab' : plan.id === 'mobility' ? 'sleep' : 'training';
  const quickLogs = [
    { kind: 'climb', label: 'Climb', icon: 'climbs' },
    { kind: 'reading', label: 'Read', icon: 'book' },
    { kind: 'alcohol', label: 'Drink', icon: 'drink' },
    { kind: 'weight', label: 'Weight', icon: 'weight' },
    { kind: 'sleep', label: 'Sleep', icon: 'sleep' },
  ] as const;
  return <><main className="today-page configuration-page do-page"><header className="screen-heading"><h1>Do</h1></header>
    {(draft || next) && <section className="next-workout" data-category={planCategory(plans.find(plan => draft?.route === `/train/${plan.id}`) ?? next?.plan ?? plans[0])}>
      <div className="next-eyebrow">{draft ? 'In progress' : `Next up · ${next.weekly && next.date === today ? 'due this week' : next.date === today ? 'due today' : `due ${shortDate(next.date, { weekday: 'short', day: 'numeric' })}`}`}</div>
      <h2>{draft?.title ?? next.plan.name}</h2>
      {!draft && <p>{planPresets(next.plan).filter(preset => !preset.locked && !preset.optional).map(preset => preset.name).join(' · ')}</p>}
      <a className="open-workout" href={draft ? `#${draft.route}` : `#/train/${next.plan.id}`}>{draft ? 'Resume workout' : 'Open workout'}</a>
      {draft && <button className="text-action" onClick={() => setDiscard(true)}>Discard progress</button>}
    </section>}
    <section className="home-section"><h2 className="eyebrow">Workouts</h2><div className="home-list">{plans.map(plan => {
      const allPresets = planPresets(plan);
      const presets = allPresets.filter(preset => !preset.locked);
      const last = sessions.filter(session => (session.workout?.plan.id ?? session.preset.id) === plan.id).sort((a,b) => b.startedAt.localeCompare(a.startedAt))[0];
      const description = !presets.length ? allPresets[0]?.locked?.label ?? 'No exercises' : presets.length === 1 ? prescriptionLabel(presets[0].prescription) : `${presets.length} exercises`;
      return <a className="home-row" href={`#/train/${plan.id}`} key={plan.id}><span className="home-lead"><span data-category={planCategory(plan)}><Icon name="train" size={18} /></span></span><span className="home-row-body"><strong>{plan.name}</strong><small>{description}{last ? ` · last ${shortDate(sessionDate(last), { weekday:'short' })}` : ''}</small></span><Icon name="back" size={16} /></a>;
    })}</div></section>
    <section className="home-section"><h2 className="eyebrow">Quick log</h2><div className="quick-log-grid">{quickLogs.map(item => <button key={item.kind} onClick={() => setLog(item.kind)}><Icon name={item.icon} size={22} /><span>{item.label}</span></button>)}<button onClick={() => setMore(true)}><Icon name="more" size={22} />More</button></div></section>
    {routines.error && <p role="alert">{routines.error}</p>}
  </main><PrimaryNav active="do" />
    {more && <Sheet title="More" onClose={() => setMore(false)}><div className="settings-list"><a className="settings-row" href="#/train">Start workout</a>{allRoutines(routines.data).filter(routine => routine.active).map(routine => ['rehab','training'].includes(routine.kind) ? <a className="settings-row" key={routine.id} href={`#/train/${routinePlans(routine)[0] ?? ''}`}>{routine.name}</a> : <button className="settings-row" key={routine.id} onClick={() => { setMore(false); setLog(routine.kind as 'reading' | 'alcohol'); }}>{routine.name}</button>)}</div></Sheet>}
    {log === 'reading' && routine && <ReadingSheet data={routines.data} routine={routine} date={localDate()} onChange={routines.update} onClose={() => setLog(null)} />}
    {log === 'alcohol' && routine && <AlcoholSheet data={routines.data} routine={routine} date={localDate()} onChange={routines.update} onClose={() => setLog(null)} />}
    {(log === 'reading' || log === 'alcohol') && !routine && <Sheet title={`Log ${log === 'reading' ? 'reading' : 'drinks'}`} onClose={() => setLog(null)}><p>Set up an active {log === 'reading' ? 'reading' : 'alcohol'} routine to use this log.</p><a className="primary-button" href="#/routines/new">Create routine</a></Sheet>}
    {(log === 'weight' || log === 'climb' || log === 'sleep') && <QuickLog kind={log} onClose={() => setLog(null)} />}
    {discard && <Sheet title="Discard workout progress?" onClose={() => setDiscard(false)}><p>This removes the unfinished workout. Saved workouts stay in your journal.</p><button className="primary-button" onClick={() => { clearWorkoutDraft(); setDraft(null); setDiscard(false); }}>Discard progress</button></Sheet>}
  </>;
}
