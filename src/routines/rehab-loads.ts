import type { Session } from '../workouts/session.ts';
import { realSessions, sessionDate } from './data.ts';

export function dragLoads(sessions: Session[]) {
  const measured = realSessions(sessions).flatMap(workout => (workout.workout?.sessions ?? [workout]).flatMap(session => {
    const p = session.preset.prescription;
    if (session.exercise.category !== 'rehab' || p.kind !== 'hold' || p.edgeMm !== 20 || !p.grip.toLowerCase().includes('drag')) return [];
    const set = session.sets.filter(s => s.source !== 'simulator' && s.meanKg !== undefined && Number.isFinite(s.meanKg)).at(-1);
    return set ? [{ date: sessionDate(session), kg: set.meanKg!, edgeMm: p.edgeMm }] : [];
  }));
  return measured.sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
}
