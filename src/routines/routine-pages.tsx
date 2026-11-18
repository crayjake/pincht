import { loadWorkoutPlans } from '../workouts/catalog';
import { useState } from 'react';
import { Icon } from '../components/home/journal-icons';
import { localDate } from '../components/home/journal-data';
import { loadSessions } from '../workouts/storage';
import { type Routine, type RoutineData } from './data';
import { allRoutines, comparatorLabel, routineCount, routinePlans, routineTags, saveRoutine, viewTags } from './tasks';
import { useRoutines } from './use-routines';
import '../components/home/home.scss';

const scheduleNames = { daily: 'Fixed days', interval: 'After completion', weekly: 'Weekly target' };
export function RoutinePages({ id }: { id?: string }) {
  const { data, update, error } = useRoutines(false);
  const routines = allRoutines(data);
  const [sessions] = useState(loadSessions);
  const routine = id === 'new' ? { id: crypto.randomUUID(), name: '', kind: 'training', active: true, start: localDate(), schedule: 'weekly', interval: 2, target: 3 } as Routine : routines.find(r => r.id === id);
  if (id) return routine ? <RoutineEditor key={id} routine={routine} data={data} onSave={next => { if (update(next)) location.hash = '/routines'; }} error={error} /> : <main className="today-page"><a href="#/routines">Back to routines</a><p>Routine not found.</p></main>;
  return <><main className="today-page configuration-page"><header className="screen-heading"><div><h1>Routines</h1><p>{routines.filter(r => r.active).length} active · {routines.filter(r => !r.active).length} paused</p></div><a className="text-action" href="#/routines/new">Add routine</a></header>
    {error && <p role="alert">{error}</p>}
    {(['daily', 'interval', 'weekly', 'paused'] as const).map(schedule => {
      const items = routines.filter(r => schedule === 'paused' ? !r.active : r.active && r.schedule === schedule);
      return items.length > 0 && <section className="settings-section" key={schedule}><h2 className="eyebrow muted">{schedule === 'paused' ? 'Paused' : scheduleNames[schedule]}</h2><div className="settings-list">{items.map(r => <div className="settings-row" key={r.id}><a href={`#/routines/${r.id}`}><strong>{r.name}</strong><small>{r.schedule === 'weekly' ? `${comparatorLabel(r)} ${r.target} a week · ${routineCount(r, data, sessions)} so far` : r.schedule === 'interval' ? `${r.interval - 1} rest ${r.interval === 2 ? 'day' : 'days'} between` : r.planSchedule ? 'Current workout plan schedule' : r.days ? r.days.map(day => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]).join(' · ') : 'Daily'}</small></a>{!r.active ? <button className="text-action" onClick={() => update(saveRoutine(data, { ...r, active: true }))}>Resume</button> : <a className="icon-button" aria-label={`Edit ${r.name}`} href={`#/routines/${r.id}`}><Icon name="chevron" size={16} /></a>}</div>)}</div></section>;
    })}<a className="text-action" href="#/todo">Back to To-do</a></main></>;
}
function RoutineEditor({ routine, data, onSave, error }: { routine: Routine; data: RoutineData; onSave: (data: RoutineData) => void; error: string }) {
  const [value, setValue] = useState<Routine>(() => structuredClone(routine));
  const [validation, setValidation] = useState('');
  const [specific, setSpecific] = useState(routinePlans(routine).length > 0);
  const patch = (change: Partial<Routine>) => setValue(current => ({ ...current, ...change }));
  function save(active = value.active) {
    try { if (specific && ['training', 'rehab'].includes(value.kind) && !routinePlans(value).length) throw new Error('Choose at least one workout.'); onSave(saveRoutine(data, { ...value, active, workoutPlanIds: specific ? routinePlans(value) : [] })); }
    catch (cause) { setValidation((cause as Error).message); }
  }
  return <><main className="today-page configuration-page"><header className="editor-heading"><a className="text-action" href="#/routines">Cancel</a><h1>{routine.name ? 'Edit routine' : 'New routine'}</h1><button className="save-action" onClick={() => save()}>Save</button></header>
    {(validation || error) && <p role="alert">{validation || error}</p>}
    <label className="settings-field"><span className="eyebrow muted">Name</span><input aria-label="Routine name" value={value.name} onChange={e => patch({ name: e.target.value })} /></label>
    {!routine.name && <label className="settings-field"><span className="eyebrow muted">Tracks</span><select value={value.kind} onChange={e => patch({ kind: e.target.value as Routine['kind'] })}><option value="training">Training</option><option value="rehab">Rehab</option><option value="reading">Reading</option><option value="alcohol">Alcohol</option></select></label>}
    <section className="settings-section"><h2 className="eyebrow muted">Schedule</h2><div className="settings-segment" role="group" aria-label="Schedule type">{(['daily', 'interval', 'weekly'] as const).map(schedule => <button key={schedule} aria-pressed={value.schedule === schedule} onClick={() => patch({ schedule, planSchedule: undefined, afterCompletion: schedule === 'interval' })}>{schedule === 'interval' ? 'After done' : scheduleNames[schedule]}</button>)}</div>
      <p className="settings-caption">{value.planSchedule ? 'Following the current workout plan schedule. Changing the schedule overrides when this routine is due; exercise phases remain in the workout.' : value.schedule === 'weekly' ? 'Any day can count. The next week starts fresh on Monday.' : value.schedule === 'interval' ? 'The next due date moves with your last completion. It stays due until completed.' : 'Repeats on the selected days.'}</p>
      {value.schedule === 'daily' && !value.planSchedule && <div className="settings-chips" aria-label="Days of the week">{[1, 2, 3, 4, 5, 6, 0].map(day => <button key={day} aria-label={['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][day]} aria-pressed={!value.days || value.days.includes(day)} onClick={() => patch({ days: (value.days ?? [0, 1, 2, 3, 4, 5, 6]).includes(day) ? (value.days ?? [0, 1, 2, 3, 4, 5, 6]).filter(d => d !== day) : [...value.days!, day], planSchedule: undefined })}>{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][day]}</button>)}</div>}
      {value.schedule === 'interval' && <label className="settings-number">Rest days between<input type="number" min="0" max="365" aria-label="Rest days between" value={value.interval - 1} onChange={e => patch({ interval: Number(e.target.value) + 1, planSchedule: undefined })} /></label>}
      {value.schedule !== 'weekly' && <label className="settings-field"><span className="eyebrow muted">Start date</span><input type="date" aria-label="Routine start date" value={value.start} onChange={e => patch({ start: e.target.value })} /></label>}
    </section>
    {value.schedule === 'weekly' && <section className="settings-section"><h2 className="eyebrow muted">Target</h2><div className="settings-card"><div className="settings-segment" role="group" aria-label="Comparator">{(['at-least', 'exactly', 'at-most'] as const).map(comparator => <button key={comparator} aria-pressed={(value.comparator ?? 'at-least') === comparator} onClick={() => patch({ comparator })}>{comparatorLabel({ ...value, comparator })}</button>)}</div><label className="settings-number">{value.kind === 'alcohol' ? 'Drinks per week' : 'Sessions per week'}<span className="target-stepper"><button type="button" aria-label="Fewer" disabled={value.target <= 1} onClick={() => patch({ target: value.target - 1 })}>−</button><input type="number" min="1" max="100" aria-label="Weekly target" value={value.target} onChange={e => patch({ target: Number(e.target.value) })} /><button type="button" aria-label="More" disabled={value.target >= 100} onClick={() => patch({ target: value.target + 1 })}>+</button></span></label></div></section>}
    {['training', 'rehab'].includes(value.kind) && <section className="settings-section"><h2 className="eyebrow muted">What counts</h2><div className="settings-chips"><button aria-pressed={!specific} onClick={() => { setSpecific(false); patch({ workoutPlanIds: [] }); }}>Any workout</button><button aria-pressed={specific} onClick={() => setSpecific(true)}>Specific workouts</button></div>{specific && <div className="settings-chips">{loadWorkoutPlans().map(plan => <button key={plan.id} data-category={value.kind} aria-pressed={routinePlans(value).includes(plan.id)} onClick={() => patch({ workoutPlanIds: routinePlans(value).includes(plan.id) ? routinePlans(value).filter(id => id !== plan.id) : [...routinePlans(value), plan.id] })}>{plan.name}</button>)}</div>}</section>}
    <section className="settings-section"><h2 className="eyebrow muted">Shows in views tagged</h2><div className="settings-chips">{viewTags.map(tag => <button key={tag} data-category={tag === 'reading' ? 'habit' : tag} aria-pressed={routineTags(value).includes(tag)} onClick={() => patch({ tags: routineTags(value).includes(tag) ? routineTags(value).filter(t => t !== tag) : [...routineTags(value), tag] })}>{tag}</button>)}</div></section>
    <button className="text-action full-width" onClick={() => save(!value.active)}>{value.active ? 'Pause routine' : 'Resume routine'}</button>
  </main></>;
}
