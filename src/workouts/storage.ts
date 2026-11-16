import type { Day, JournalRecord } from '../components/home/journal-data.ts';
import type { Session } from './session.ts';
import { exerciseSummary, prescribedSets, sessionName } from './workout.ts';

export const SESSION_KEY = 'pincht.workouts.v1';
export const SIMULATOR_KEY = 'pincht.workout-simulations.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
function read(store: Store, key: string): Session[] {
  const raw: unknown = JSON.parse(store.getItem(key) || '[]');
  if (!Array.isArray(raw) || !raw.every(s => s && typeof s.id === 'string' && s.preset?.prescription && s.exercise && Array.isArray(s.sets))) throw new Error('Workout storage is damaged. Export or clear it before saving.');
  return raw;
}
export function loadSessions(store: Store = localStorage, simulated = false): Session[] {
  try { return read(store, simulated ? SIMULATOR_KEY : SESSION_KEY); } catch { return []; }
}
export function saveSession(session: Session, note: string, now: number, store: Store = localStorage): Session {
  if (!session.sets.length || session.phase !== 'review') throw new Error('Complete and keep at least one set before saving.');
  const simulated = session.source === 'simulator' || session.sets.some(s => s.source === 'simulator');
  const key = simulated ? SIMULATOR_KEY : SESSION_KEY;
  const saved: Session = { ...session, symptomNote: note.trim() || undefined, finishedAt: new Date(now).toISOString() };
  const sessions = read(store, key);
  store.setItem(key, JSON.stringify([saved, ...sessions.filter(s => s.id !== session.id)]));
  return saved;
}
export function workoutRecord(session: Session): JournalRecord {
  const p = session.preset.prescription;
  return { id: `workout-${session.id}`, kind: session.exercise.category, title: sessionName(session),
    metric: `${session.sets.length} / ${prescribedSets(session)} sets`,
    meta: session.workout ? session.workout.sessions.map(s => `${s.preset.name}: ${exerciseSummary(s)}`).join(' · ') : `${session.source === 'tindeq' ? 'Tindeq Progressor' : 'Manual entry'} · ${p.kind === 'hold' ? `${p.hand} · ${p.edgeMm} mm · ${p.grip}` : p.kind === 'timed' ? exerciseSummary(session) : session.sets.map(s => `${s.reps} reps${s.addedLoadKg !== undefined ? `, +${s.addedLoadKg} kg` : ''}`).join(' / ')}`,
    note: session.symptomNote };
}
// Project saved workouts into the existing journal without a second storage transaction.
export function mergeWorkoutDays(days: Day[], sessions = loadSessions()): Day[] {
  const merged = structuredClone(days);
  for (const session of sessions.filter(s => s.source !== 'simulator' && !s.sets.some(set => set.source === 'simulator') && s.finishedAt)) {
    const d = new Date(session.startedAt);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let day = merged.find(item => item.date === date);
    if (!day) { day = { date, types: [], metrics: {}, visibleMetrics: [], records: [] }; merged.push(day); }
    const record = workoutRecord(session);
    if (!day.records.some(r => r.id === record.id)) day.records.push(record);
    day.types = [...new Set([...day.types.filter(t => t !== 'rest'), session.exercise.category])];
  }
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}
