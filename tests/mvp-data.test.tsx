import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { DATA_MODE_KEY } from '../src/data/mode';
import { exportBackup, restoreBackup } from '../src/data/backup';
import { deleteDailyMeasurement, deleteJournalEntry, setDailyMeasurement } from '../src/data/history';
import { clearStorageErrors, storageError } from '../src/data/storage';
import { JOURNAL_KEY, loadDays, saveDays, loadResources, saveResources, JOURNAL_RESOURCES_KEY } from '../src/components/home/journal-storage';
import { loadViews, saveView } from '../src/components/home/journal-views';
import { createRoutines, ROUTINES_KEY } from '../src/routines/data';
import { routineCount } from '../src/routines/tasks';
import { loadRoutines, saveRoutines } from '../src/routines/storage';
import { loadRehab, pulleyPhase, wristPhase } from '../src/rehab/data';
import { exercises, workoutPlans, workoutPresets, resolvePreset, type WorkoutPreset } from '../src/workouts/fixtures';
import { isWorkoutComplete } from '../src/workouts/completion';
import { createSession, type Session } from '../src/workouts/session';
import { summariseWorkout } from '../src/workouts/workout';
import { deleteSession, loadSessions, replaceSession, saveSession, SESSION_KEY } from '../src/workouts/storage';
import { loadWorkoutDraft, saveWorkoutDraft } from '../src/workouts/draft';
import { loadWorkoutPlans, saveWorkoutPlan } from '../src/workouts/catalog';
import { directDragSeriesId, loadSeries, seriesMeasurements } from '../src/workouts/measurements';
import type { Day } from '../src/components/home/journal-data';

const today = '2026-11-17';
const now = Date.parse(`${today}T12:00:00Z`);
const blankDay = (): Day => ({ date: today, types: [], metrics: {}, visibleMetrics: [], records: [], entry: { title: 'Keep my writing', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'text', text: 'My day' }] }] } } });
function complete(id = 'pull-ups-3x5', patch: Partial<WorkoutPreset> = {}): Session {
  const preset = { ...resolvePreset(workoutPresets.find(p => p.id === id)!, loadRehab(), '2027-01-01'), ...patch };
  const s = createSession(preset, exercises.find(e => e.id === preset.exerciseId)!, 'manual', now);
  const p = preset.prescription;
  return { ...s, phase: 'review', finishedAt: new Date(now + 60_000).toISOString(), sets: Array.from({ length: p.sets }, (_, i) => ({ set: i + 1, source: 'manual', status: 'completed', trace: [], ...(p.kind === 'reps' || p.kind === 'paced' ? { reps: p.reps, addedLoadKg: p.addedLoadKg } : { durationSeconds: p.holdSeconds, meanKg: 10 }) })) };
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(now)); localStorage.clear(); localStorage.setItem(DATA_MODE_KEY, 'real'); clearStorageErrors(); });
afterEach(() => { vi.useRealTimers(); clearStorageErrors(); });

it('credits only full prescribed workouts, saves partial history, and excludes optional exercises', () => {
  const full = complete(), partial = { ...full, id: 'partial', sets: full.sets.slice(1) };
  const data = createRoutines(today), routine = data.routines.find(r => r.id === 'train')!;
  saveSession(partial, '', now);
  expect(loadDays()[0].records).toHaveLength(1);
  expect(routineCount(routine, data, loadSessions(), today)).toBe(0);
  expect(routineCount(routine, data, [full, full, partial], today)).toBe(1);
  expect(isWorkoutComplete({ ...full, sets: full.sets.map(s => ({ ...s, reps: 1 })) })).toBe(false);
  expect(isWorkoutComplete({ ...full, sets: full.sets.map(s => ({ ...s, set: 1 })) })).toBe(false);
  expect(isWorkoutComplete({ ...full, source: 'simulator' })).toBe(false);
  const optional = { ...complete('tendon-glides').preset, optional: true };
  const plan = { id: 'snapshot', name: 'Snapshot', description: '', presetIds: [full.preset.id, optional.id] };
  const aggregate = { ...summariseWorkout(plan, [full.preset, optional], [full], 'manual', 'aggregate', full.startedAt), finishedAt: full.finishedAt };
  expect(isWorkoutComplete(aggregate)).toBe(true);
  aggregate.workout!.prescriptions[1].optional = false;
  expect(isWorkoutComplete(aggregate)).toBe(false);
});

it('uses the agreed rehab phases and the start dates saved by the existing routine editor', () => {
  const rehab = loadRehab();
  expect(rehab.wristIsometricReps).toBe(10);
  expect(wristPhase(rehab, '2026-11-29')).toBe(1);
  expect(wristPhase(rehab, '2026-11-30')).toBe(2);
  expect(wristPhase(rehab, '2026-12-14')).toBe(3);
  expect(pulleyPhase(rehab, '2026-11-27')).toBe(2);
  const half = resolvePreset(workoutPresets.find(p => p.id === 'half-crimp')!, rehab, '2026-12-11');
  expect(half.locked).toBeUndefined();
  expect(half.prescription).toMatchObject({ targetKg: rehab.dragKg });
  const data = createRoutines(today);
  data.routines.push({ id: 'pulley', name: 'Pulley', kind: 'rehab', active: true, start: '2026-11-01', schedule: 'daily', target: 2, interval: 1, planSchedule: 'pulley' });
  saveRoutines(data);
  expect(loadRehab().pulleyStart).toBe('2026-11-01');
  expect(pulleyPhase(loadRehab(), today)).toBe(2);
});

it('reprojects corrected and deleted workouts without stale journal records or routine credit', () => {
  saveDays([blankDay()]);
  const full = saveSession(complete(), 'Original', now);
  // Simulate a day saved while the projected record was visible.
  saveDays(loadDays());
  const replacement = { ...full, symptomNote: 'Corrected', sets: full.sets.slice(1) };
  replaceSession(replacement);
  expect(loadDays()[0].records[0].note).toBe('Corrected');
  expect(loadDays()[0].records[0].metric).toBe('2 / 3 sets');
  const data = createRoutines(today);
  expect(routineCount(data.routines.find(r => r.id === 'train')!, data, loadSessions(), today)).toBe(0);
  deleteSession(full.id);
  expect(loadDays()[0].records).toEqual([]);
  expect(loadDays()[0].types).toEqual([]);
  expect(loadDays()[0].entry?.title).toBe('Keep my writing');
});

it('corrects daily measurements, removes stale sleep stages, and keeps data modes independent', () => {
  saveDays([blankDay()]);
  setDailyMeasurement(today, 'sleep', 420, [{ stage: 'deep', minutes: 100 }, { stage: 'light', minutes: 320 }]);
  setDailyMeasurement(today, 'sleep', 450);
  expect(loadDays()[0].metrics.sleep).toBe(450);
  expect(loadDays()[0].records.some(record => record.sleep)).toBe(false);
  expect(() => setDailyMeasurement(today, 'sleep', 450, [{ stage: 'deep', minutes: 10 }])).toThrow();
  setDailyMeasurement(today, 'finger', 20);
  expect(seriesMeasurements(loadDays(), [])).toHaveLength(1);
  localStorage.setItem(DATA_MODE_KEY, 'demo'); setDailyMeasurement(today, 'finger', 30);
  expect(seriesMeasurements(loadDays(), [])[0].kg).toBe(30);
  deleteJournalEntry(today);
  expect(loadDays()[0].measurements?.fingerStrengthKg).toBe(30);
  localStorage.setItem(DATA_MODE_KEY, 'real');
  deleteDailyMeasurement(today, 'finger'); deleteDailyMeasurement(today, 'sleep');
  expect(loadDays()[0].metrics.sleep).toBeUndefined();
  expect(loadDays()[0].visibleMetrics).toEqual([]);
  expect(loadDays()[0].records).toEqual([]);
  expect(loadDays()[0].entry?.title).toBe('Keep my writing');
});

it('keeps grip, edge, hand and protocol series separate without mixing explicit loads or simulator data', () => {
  const drag = complete('three-finger-drag');
  const hold = drag.preset.prescription;
  if (hold.kind !== 'hold') throw new Error('Expected hold');
  const sameProtocol = complete('three-finger-drag', { prescription: { ...hold, targetKg: 20 } });
  const half = complete('half-crimp');
  const edge = complete('three-finger-drag', { prescription: { ...hold, edgeMm: 15 } });
  const hand = complete('three-finger-drag', { prescription: { ...hold, hand: 'right' } });
  const protocol = complete('three-finger-drag', { prescription: { ...hold, holdSeconds: 5 } });
  const days = [{ ...blankDay(), measurements: { fingerStrengthKg: 25 } }];
  const series = loadSeries(days, [drag, drag, sameProtocol, half, edge, hand, protocol, { ...drag, id: 'sim', source: 'simulator' }]);
  expect(series).toHaveLength(6);
  expect(series.find(s => s.id === directDragSeriesId)?.points.map(p => p.kg)).toEqual([25]);
  const working = series.find(s => s.id !== directDragSeriesId && s.exerciseId === drag.exercise.id && s.points.length === drag.sets.length * 2)!;
  expect(working.points.map(p => p.kg)).toEqual(Array(drag.sets.length * 2).fill(10));
});

it('preserves unreadable stores and blocks overwrites across the existing storage boundaries', () => {
  const bad = '{"unexpected":"data"}';
  const cases = [
    [JOURNAL_KEY, loadDays, () => saveDays([])],
    [JOURNAL_RESOURCES_KEY, loadResources, () => saveResources([])],
    [ROUTINES_KEY, loadRoutines, () => saveRoutines(createRoutines(today))],
    [SESSION_KEY, loadSessions, () => saveSession(complete(), '', now)],
    ['pincht.views', loadViews, () => saveView(loadViews()[0])],
    ['pincht.workout-draft', loadWorkoutDraft, () => saveWorkoutDraft({ route: '/train', title: 'Draft' })],
    ['pincht.workout-plans', loadWorkoutPlans, () => saveWorkoutPlan(workoutPlans[0])],
  ] as const;
  for (const [key, read, write] of cases) {
    localStorage.setItem(key, bad);
    expect(() => read()).not.toThrow();
    expect(() => write()).toThrow();
    expect(localStorage.getItem(key)).toBe(bad);
    localStorage.removeItem(key);
  }
  expect(storageError()).toContain('has not been replaced');
});

it('round-trips both modes and validates an entire backup before applying it', () => {
  saveDays([blankDay()]); saveSession(complete(), '', now); saveRoutines(createRoutines(today));
  localStorage.setItem(DATA_MODE_KEY, 'demo'); setDailyMeasurement(today, 'weight', 73);
  const backup = exportBackup();
  localStorage.clear(); restoreBackup(backup);
  expect(localStorage.getItem(DATA_MODE_KEY)).toBe('demo'); expect(loadDays()[0].metrics.weight).toBe(73);
  localStorage.setItem(DATA_MODE_KEY, 'real');
  expect(loadDays()[0].entry?.title).toBe('Keep my writing'); expect(loadSessions()).toHaveLength(1);
  const prior = exportBackup(), bad = JSON.parse(prior);
  bad.values['pincht.journal.live'] = '[]'; bad.values['pincht.views.demo'] = '{}';
  expect(() => restoreBackup(JSON.stringify(bad))).toThrow();
  expect(exportBackup()).toBe(prior);
  const raw = 'damaged writing'; localStorage.setItem(JOURNAL_KEY, raw);
  expect(JSON.parse(exportBackup()).values[JOURNAL_KEY]).toBe(raw);
});

it('rolls back a restore if storage fails part way through writing', () => {
  saveDays([blankDay()]); const backup = exportBackup();
  setDailyMeasurement(today, 'weight', 73); const prior = exportBackup();
  let writes = 0;
  const store = { getItem: (key: string) => localStorage.getItem(key), removeItem: (key: string) => localStorage.removeItem(key), setItem: (key: string, value: string) => { if (++writes === 2) throw new Error('Storage full'); localStorage.setItem(key, value); } };
  expect(() => restoreBackup(backup, store)).toThrow('Previous data has been restored');
  expect(exportBackup()).toBe(prior);
});
