import type { Session } from './session.ts';

/** Completion is based on the prescription saved with the workout, not today's plan. */
export function isExerciseComplete(session: Session) {
  const p = session.preset.prescription;
  if (session.source === 'simulator' || session.preset.locked || p.sets < 1) return false;
  return Array.from({ length: p.sets }, (_, i) => i + 1).every(number =>
    session.sets.some(set => set.set === number && set.status === 'completed' && set.source !== 'simulator'
      && (p.kind === 'reps' || p.kind === 'paced' ? (set.reps ?? 0) >= p.reps : (set.durationSeconds ?? 0) >= p.holdSeconds)));
}

export function isWorkoutComplete(session: Session) {
  if (!session.finishedAt || session.source === 'simulator' || session.sets.some(set => set.source === 'simulator')) return false;
  if (!session.workout) return isExerciseComplete(session);
  const required = session.workout.prescriptions.filter(preset => !preset.locked && !preset.optional);
  // A plan consisting entirely of optional exercises still needs actual activity.
  if (!required.length) return session.workout.sessions.some(isExerciseComplete);
  return required.every(preset => session.workout!.sessions.some(exercise =>
    exercise.preset.id === preset.id && isExerciseComplete({ ...exercise, preset })));
}
