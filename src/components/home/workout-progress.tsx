import type { Session } from '../../workouts/session';
import { localDate } from './journal-data';

// Summarise recorded actuals, keeping each exercise and measurement separate.
export function WorkoutProgress({ sessions }: { sessions: Session[] }) {
  const exercises = new Map<string, { name: string; category: string; unit: string; values: { date: string; value: number }[] }>();
  for (const workout of sessions.filter(session => session.finishedAt && session.source !== 'simulator')) {
    for (const session of workout.workout?.sessions ?? [workout]) {
      const sets = session.sets.filter(set => set.status !== 'interrupted' && set.source !== 'simulator');
      const force = session.preset.prescription.kind === 'hold';
      const values = sets.flatMap(set => {
        const value = force ? set.meanKg : set.reps;
        return value !== undefined && Number.isFinite(value) ? [value] : [];
      });
      if (!values.length) continue;
      const key = session.preset.id;
      const exercise = exercises.get(key) ?? { name: session.preset.name, category: session.exercise.category, unit: force ? 'kg mean force' : 'reps in a set', values: [] };
      exercise.values.push({ date: localDate(new Date(workout.startedAt)), value: Math.max(...values) });
      exercises.set(key, exercise);
    }
  }
  if (!exercises.size) return null;
  return <section className="settings-section"><h2>Recorded progress</h2>{[...exercises].map(([id, exercise]) => {
    const values = exercise.values.sort((a, b) => a.date.localeCompare(b.date));
    const min = Math.min(...values.map(item => item.value)), max = Math.max(...values.map(item => item.value));
    return <div className="library-progress" key={id}><strong>{exercise.name}</strong><p className="mono">{exercise.category === 'training' ? 'Personal best' : 'Highest recorded'} · {Number(max.toFixed(1))} {exercise.unit}</p>
      {values.length > 1 && <><svg className="metric-chart" viewBox="0 0 320 100" role="img" aria-label={`${exercise.name} history · ${exercise.unit}`}><polyline fill="none" stroke="currentColor" strokeWidth="2" points={values.map((item, i) => `${10+i/(values.length-1)*300},${90-(item.value-min)/Math.max(1,max-min)*80}`).join(' ')} />{values.map((item, i) => <circle key={i} cx={10+i/(values.length-1)*300} cy={90-(item.value-min)/Math.max(1,max-min)*80} r="3" fill="currentColor"><title>{item.date} · {item.value} {exercise.unit}</title></circle>)}</svg><p className="settings-caption">{values[0].date} – {values.at(-1)!.date} · best set each session</p></>}
    </div>;
  })}</section>;
}
