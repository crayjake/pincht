import { useEffect, useState } from 'react';
import { PrimaryNav } from '../app-navigation';
import { useRoutines } from '../../routines/use-routines';
import { AlcoholSheet, ReadingSheet } from '../../routines/routine-sheets';
import { localDate, shortDate } from './journal-data';
import { loadWorkoutPlans } from '../../workouts/catalog';
import { loadSessions } from '../../workouts/storage';
import { planCategory as workoutCategory, planPresets, prescriptionLabel, type WorkoutPlan } from '../../workouts/fixtures';
import { QuickLog } from './quick-log';
import { Sheet } from './journal-sheet';
import { Icon } from './journal-icons';
import { realSessions, sessionDate } from '../../routines/data';
import { allRoutines, routinePlans } from '../../routines/tasks';
import './home.scss';
import { NextWorkout } from './next-workout';

export default function DoPage() {
  useEffect(() => { document.title = 'Do · pincht'; }, []);
  const routines = useRoutines(false);
  const [log, setLog] = useState<'reading' | 'alcohol' | 'weight' | 'climb' | 'sleep' | 'finger' | null>(null);
  const [more, setMore] = useState(false);
  const plans = loadWorkoutPlans();
  const sessions = realSessions(loadSessions());
  const today = localDate();
  const routine = routines.data.routines.find(routine => routine.kind === log && routine.active && routine.start <= today);
  const planCategory = (plan: WorkoutPlan) => plan.id === 'mobility' ? 'sleep' : workoutCategory(plan);
  const quickLogs = [
    { kind: 'climb', label: 'Climb', icon: 'climbs' },
    { kind: 'reading', label: 'Read', icon: 'book' },
    { kind: 'alcohol', label: 'Drink', icon: 'drink' },
    { kind: 'weight', label: 'Weight', icon: 'weight' },
    { kind: 'sleep', label: 'Sleep', icon: 'sleep' },
  ] as const;
  return <><main className="today-page configuration-page do-page"><header className="screen-heading"><h1>Do</h1></header>
    <NextWorkout data={routines.data} />
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
    {more && <Sheet title="More" onClose={() => setMore(false)}><div className="settings-list"><a className="settings-row" href="#/train">Start workout</a><a className="settings-row" href="#/train/max-pull-left">Max pull test</a><button className="settings-row" onClick={() => { setMore(false); setLog('finger'); }}>Finger strength · 20 mm drag</button>{allRoutines(routines.data).filter(routine => routine.active).map(routine => ['rehab','training'].includes(routine.kind) ? <a className="settings-row" key={routine.id} href={`#/train/${routinePlans(routine)[0] ?? ''}`}>{routine.name}</a> : <button className="settings-row" key={routine.id} onClick={() => { setMore(false); setLog(routine.kind as 'reading' | 'alcohol'); }}>{routine.name}</button>)}</div></Sheet>}
    {log === 'reading' && routine && <ReadingSheet data={routines.data} routine={routine} date={localDate()} onChange={routines.update} onClose={() => setLog(null)} />}
    {log === 'alcohol' && routine && <AlcoholSheet data={routines.data} routine={routine} date={localDate()} onChange={routines.update} onClose={() => setLog(null)} />}
    {(log === 'reading' || log === 'alcohol') && !routine && <Sheet title={`Log ${log === 'reading' ? 'reading' : 'drinks'}`} onClose={() => setLog(null)}><p>Set up an active {log === 'reading' ? 'reading' : 'alcohol'} routine to use this log.</p><a className="primary-button" href="#/routines/new">Create routine</a></Sheet>}
    {(log === 'weight' || log === 'climb' || log === 'sleep' || log === 'finger') && <QuickLog kind={log} onClose={() => setLog(null)} />}

  </>;
}
