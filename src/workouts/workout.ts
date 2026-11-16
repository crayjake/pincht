import type { WorkoutPlan, WorkoutPreset } from './fixtures.ts';
import type { MeasurementSource, Session } from './session.ts';

// Keep each exercise's prescription and results intact in one saved workout.
export function summariseWorkout(plan: WorkoutPlan, prescriptions: WorkoutPreset[], sessions: Session[], source: MeasurementSource, id: string, startedAt: string): Session {
  if (!sessions.length) throw new Error('Complete an exercise before reviewing this workout.');
  return {
    ...sessions[0], id, startedAt, phase: 'review', source: sessions.some(session => session.source === 'simulator' || session.sets.some(set => set.source === 'simulator')) ? 'simulator' : source,
    sets: sessions.flatMap(session => session.sets.map(set => ({ ...set, exerciseId: session.exercise.id }))),
    attempts: sessions.flatMap(session => session.attempts), candidate: undefined, trace: [],
    workout: structuredClone({ plan, prescriptions, sessions }),
  };
}
export const sessionName = (session: Session) => session.workout?.plan.name ?? session.preset.name;
export const prescribedSets = (session: Session) => session.workout
  ? session.workout.prescriptions.filter(preset => !preset.locked).reduce((sum, preset) => sum + preset.prescription.sets, 0)
  : session.preset.prescription.sets;
export function exerciseSummary(session: Session) {
  const p = session.preset.prescription;
  if (p.kind === 'reps' || p.kind === 'paced') return `${session.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0)} reps${p.kind === 'reps' ? ` · ${session.sets.length} sets` : ''}`;
  const duration = session.sets.reduce((sum, set) => sum + (set.durationSeconds ?? 0), 0);
  if (p.kind === 'timed') return `${session.sets.length} sets · ${duration.toFixed(0)} s held`;
  const mean = session.sets.reduce((sum, set) => sum + (set.meanKg ?? 0) * (set.durationSeconds ?? 0), 0) / (duration || 1);
  return `${session.sets.length} sets · ${mean.toFixed(1)} kg mean`;
}
