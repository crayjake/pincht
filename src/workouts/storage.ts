import type { Day, JournalRecord } from '../components/home/journal-data.ts';
import type { Session } from './session.ts';
import { exerciseSummary, prescribedSets, sessionName } from './workout.ts';
import { dataKey } from '../data/mode.ts';
import { readStored, readStoredStrict, writeStored } from '../data/storage.ts';
import { isSessions } from '../data/validation.ts';
import { planCategory } from './fixtures.ts';

export const SESSION_KEY = 'pincht.workouts.v1';
export const SIMULATOR_KEY = 'pincht.workout-simulations.v1';
type Store = Pick<Storage, 'getItem' | 'setItem'>;
function read(store: Store, key: string): Session[] {
  return readStoredStrict(key, [], isSessions, store);
}
export function loadSessions(store: Store = localStorage, simulated = false): Session[] {
  return readStored(dataKey(simulated ? SIMULATOR_KEY : SESSION_KEY, store), [], isSessions, store);
}
export function saveSession(session: Session, note: string, now: number, store: Store = localStorage): Session {
  if (!session.sets.length || session.phase !== 'review') throw new Error('Complete and keep at least one set before saving.');
  const simulated = session.source === 'simulator' || session.sets.some(s => s.source === 'simulator');
  const key = dataKey(simulated ? SIMULATOR_KEY : SESSION_KEY, store);
  const saved: Session = { ...session, symptomNote: note.trim() || undefined, finishedAt: new Date(now).toISOString() };
  const sessions = read(store, key);
  writeStored(key, [saved, ...sessions.filter(s => s.id !== session.id)], [], isSessions, store);
  return saved;
}
/** Correct saved history without creating a new completion. UI comes later. */
export function replaceSession(session: Session, store: Store = localStorage) {
  const key = dataKey(session.source === 'simulator' ? SIMULATOR_KEY : SESSION_KEY, store);
  const sessions = read(store, key);
  const previous = sessions.find(item => item.id === session.id);
  if (!previous || !session.finishedAt || !session.sets.length || session.phase !== 'review' || session.source !== previous.source) throw new Error('Choose a saved workout to update.');
  if (session.source !== 'simulator' && (session.workout?.sessions ?? [session]).some(exercise => exercise.source === 'simulator' || exercise.sets.some(set => set.source === 'simulator'))) throw new Error('Simulator results cannot replace real workout history.');
  writeStored(key, sessions.map(item => item.id === session.id ? session : item), [], isSessions, store);
  return session;
}
export function deleteSession(id: string, store: Store = localStorage, simulated = false) {
  const key = dataKey(simulated ? SIMULATOR_KEY : SESSION_KEY, store);
  writeStored(key, read(store, key).filter(session => session.id !== id), [], isSessions, store);
}
export function workoutRecord(session: Session): JournalRecord {
  const p = session.preset.prescription;
  return { id: `workout-${session.id}`, kind: session.workout ? planCategory(session.workout.plan) : session.exercise.category, title: sessionName(session),
    metric: `${session.sets.length} / ${prescribedSets(session)} sets`,
    meta: session.workout ? session.workout.sessions.map(s => `${s.preset.name}: ${exerciseSummary(s)}`).join(' · ') : `${session.source === 'tindeq' ? 'Tindeq Progressor' : 'Manual entry'} · ${p.kind === 'hold' ? `${p.hand} · ${p.edgeMm} mm · ${p.grip}` : p.kind === 'timed' ? exerciseSummary(session) : session.sets.map(s => `${s.reps} reps${s.addedLoadKg !== undefined ? `, +${s.addedLoadKg} kg` : ''}`).join(' / ')}`,
    note: session.symptomNote };
}
// Project saved workouts into the existing journal without a second storage transaction.
export function mergeWorkoutDays(days: Day[], sessions = loadSessions()): Day[] {
  const merged = structuredClone(days).map(day => {
    const removed = day.records.filter(record => record.id.startsWith('workout-'));
    const records = day.records.filter(record => !record.id.startsWith('workout-'));
    return { ...day, records, types: day.types.filter(type => !removed.some(record => record.kind === type) || records.some(record => record.kind === type)) };
  });
  for (const session of sessions.filter(s => s.source !== 'simulator' && !s.sets.some(set => set.source === 'simulator') && s.finishedAt)) {
    const d = new Date(session.startedAt);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    let day = merged.find(item => item.date === date);
    if (!day) { day = { date, types: [], metrics: {}, visibleMetrics: [], records: [] }; merged.push(day); }
    const record = workoutRecord(session);
    if (!day.records.some(r => r.id === record.id)) day.records.push(record);
    day.types = [...new Set([...day.types.filter(t => t !== 'rest'), record.kind])];
  }
  return merged.sort((a, b) => b.date.localeCompare(a.date));
}
