import type { RehabLoad } from '../components/home/journal-data.ts';
import type { Session } from '../workouts/session.ts';
import { realSessions, sessionDate } from './data.ts';

// Sample drag measurements accompany the existing sample journal; max hangs remain separate.
export const sampleDragLoads: RehabLoad[] = [7.8, 8.3, 8.1, 8.8, 9.2, 9.5, 9.8, 10.2].map((kg, i) => ({ date: `2026-11-${String(i * 2 + 1).padStart(2, '0')}`, kg, edgeMm: 20 }));
export function dragLoads(sessions: Session[]) {
  const measured = realSessions(sessions).flatMap(workout => (workout.workout?.sessions ?? [workout]).flatMap(session => {
    const p = session.preset.prescription;
    if (session.exercise.category !== 'rehab' || p.kind !== 'hold' || p.edgeMm !== 20 || !p.grip.toLowerCase().includes('drag')) return [];
    const set = session.sets.filter(s => s.source !== 'simulator' && s.meanKg !== undefined && Number.isFinite(s.meanKg)).at(-1);
    return set ? [{ date: sessionDate(session), kg: set.meanKg!, edgeMm: p.edgeMm }] : [];
  }));
  return [...sampleDragLoads, ...measured].sort((a, b) => a.date.localeCompare(b.date)).slice(-8);
}
