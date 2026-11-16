import assert from 'node:assert/strict';
import test, { beforeEach } from 'node:test';
import { addDays, adherence, bookPage, checkIn, freeStreak, putCheckIn, rehabDone, scheduled, seedRoutines, unlogged, weeklyDrinks, weeklyWorkouts, weekStart, withRoutineDays } from '../src/routines/data.ts';
import { dragLoads, sampleDragLoads } from '../src/routines/rehab-loads.ts';
import { emptyFilter, seedDays } from '../src/components/home/journal-data.ts';
import { searchJournal } from '../src/components/home/journal-search-data.ts';
import { exercises, workoutPresets } from '../src/workouts/fixtures.ts';
import { createSession } from '../src/workouts/session.ts';
import { mergeWorkoutDays } from '../src/workouts/storage.ts';

const today = '2026-11-16';
beforeEach(t => t.mock.timers.enable({ apis: ['Date'], now: Date.parse(`${today}T12:00:00Z`) }));
const fresh = () => ({ ...seedRoutines(today), checkIns: [] });
function saved(date = today, source = 'tindeq', presetId = 'finger-rehab', meanKg = 12) {
  const preset = workoutPresets.find(p => p.id === presetId);
  const session = createSession(preset, exercises.find(e => e.id === preset.exerciseId), source, Date.parse(`${date}T12:00:00Z`));
  return { ...session, phase: 'review', finishedAt: `${date}T12:02:00Z`, sets: [{ set: 1, source, meanKg, durationSeconds: 15, trace: [], status: 'completed' }] };
}

test('calendar schedules cross month/leap boundaries and weekly goals are not daily checkboxes', () => {
  const data = fresh();
  const rehab = { ...data.routines.find(r => r.id === 'rehab'), start: '2024-02-28' };
  assert.equal(addDays('2024-02-28', 1), '2024-02-29');
  assert.equal(scheduled(rehab, '2024-02-29'), false);
  assert.equal(scheduled(rehab, '2024-03-01'), true);
  assert.equal(scheduled({ ...rehab, active: false }, '2024-03-01'), false);
  assert.equal(scheduled(rehab, '2024-02-26'), false);
  assert.equal(scheduled(data.routines.find(r => r.id === 'train'), today), false);
  assert.equal(weekStart('2026-11-15'), '2026-11-09');
  assert.equal(weekStart(today), today);
});

test('missing days stay unlogged until explicitly logged or skipped; skip never counts as adherence', () => {
  let data = fresh();
  assert.equal(unlogged(data, '2026-11-15', '2026-11-15').length, 2);
  data = putCheckIn(data, { routineId: 'read', date: '2026-11-15', status: 'skipped', reason: 'travelling' });
  assert.deepEqual(unlogged(data, '2026-11-15', '2026-11-15').map(v => v.routine.id), ['alcohol']);
  assert.equal(checkIn(data, 'read', '2026-11-14'), undefined);
  assert.equal(checkIn(data, 'read', '2026-11-15').reason, 'travelling');
  assert.match(adherence(data, ['2026-11-15']), /read 0\/1/);
});

test('reading edits replace one day, preserve book progress, and reject invalid or future logs', () => {
  let data = fresh();
  const value = { routineId: 'read', date: today, status: 'done', minutes: 20, bookId: 'piranesi', page: 128 };
  data = putCheckIn(data, value);
  data = putCheckIn(data, { ...value, minutes: 30 });
  data = putCheckIn(data, { ...value, date: '2026-11-15', page: 120 });
  assert.equal(data.checkIns.length, 2);
  assert.equal(checkIn(data, 'read', today).minutes, 30);
  assert.equal(bookPage(data, 'piranesi'), 128);
  assert.equal(bookPage(data, 'piranesi', today), 120);
  for (const change of [{ minutes: 0 }, { minutes: 1.5 }, { page: 273 }, { page: -1 }, { bookId: 'missing' }, { date: '2026-11-17' }]) {
    assert.throws(() => putCheckIn(data, { ...value, ...change }));
  }
  data = putCheckIn(data, { ...value, page: undefined });
  assert.equal(bookPage(data, 'piranesi'), 120, 'quick completion does not invent page progress');
});

test('drinks reset on Monday and alcohol-free streaks break at missing, skipped, or drinking days', () => {
  let data = fresh();
  const alcohol = data.routines.find(r => r.id === 'alcohol');
  for (const date of ['2026-11-14', '2026-11-15']) data = putCheckIn(data, { routineId: 'alcohol', date, status: 'done', drinks: 0 });
  assert.equal(freeStreak(data, alcohol, today), 2);
  data = putCheckIn(data, { routineId: 'alcohol', date: '2026-11-15', status: 'done', drinks: 2 });
  data = putCheckIn(data, { routineId: 'alcohol', date: today, status: 'done', drinks: 1 });
  assert.equal(weeklyDrinks(data, '2026-11-15'), 2);
  assert.equal(weeklyDrinks(data, today), 1);
  assert.equal(freeStreak(data, alcohol, today), 0);
  data = putCheckIn(data, { routineId: 'alcohol', date: today, status: 'skipped' });
  assert.equal(freeStreak(data, alcohol, today), 0);
  assert.throws(() => putCheckIn(data, { routineId: 'alcohol', date: today, status: 'done', drinks: -1 }));
});

test('weekly workouts count saved real sessions once and rehab completion follows the saved date', () => {
  const session = saved();
  const sessions = [session, session, saved('2026-11-15'), saved(today, 'simulator'), { ...saved(), finishedAt: undefined }, { ...saved(), sets: [] }];
  assert.equal(weeklyWorkouts(sessions, today), 1);
  assert.equal(rehabDone(sessions, today), true);
  assert.equal(rehabDone([saved(today, 'simulator')], today), false);
  assert.equal(rehabDone([saved(today, 'manual', 'pull-ups-3x5')], today), false);
});

test('rehab chart accepts only saved 20 mm drag results and retains the dummy measurements', () => {
  const drag = saved();
  const crimp = saved(today, 'tindeq', 'half-crimp', 99);
  const wrongEdge = saved(); wrongEdge.preset.prescription.edgeMm = 10;
  const output = dragLoads([drag, crimp, wrongEdge, saved(today, 'simulator', 'finger-rehab', 99)]);
  assert.equal(output.length, 8);
  assert.equal(output.at(-1).kg, 12);
  assert.ok(output.some(point => point.kg === 10.2));
  assert.deepEqual(dragLoads([]), sampleDragLoads);
});

test('routine projection retains dummy journal/workout records and never duplicates or mutates them', () => {
  const base = mergeWorkoutDays(seedDays, [saved('2026-11-15')]);
  const before = structuredClone(base);
  const first = withRoutineDays(base, seedRoutines(today), today);
  const second = withRoutineDays(first, seedRoutines(today), today);
  assert.deepEqual(second, first);
  assert.deepEqual(base, before);
  const day = first.find(d => d.date === '2026-11-15');
  assert.ok(day.records.some(r => r.id.startsWith('workout-')));
  assert.ok(day.records.some(r => r.id === 'sidepull'));
  assert.equal(day.records.filter(r => r.id === 'routine-alcohol-2026-11-15').length, 1);
  assert.ok(first.some(d => d.date === '2026-11-12'));
});

test('search returns individual matching records/entries with category, date, and unlogged filters', () => {
  const data = seedRoutines(today);
  const days = withRoutineDays(seedDays, data, today);
  const results = searchJournal(days, data, 'sidepull', { ...emptyFilter, categories: ['climb'] });
  assert.deepEqual(results.map(r => r.kind).sort(), ['entry', 'record']);
  assert.ok(results.every(r => r.date === '2026-11-15'));
  const sleepResults = searchJournal(days, data, 'sidepull', { ...emptyFilter, categories: ['sleep'] });
  assert.ok(sleepResults.every(r => r.kind === 'entry'), 'category filters exclude unrelated records while retaining matching entries from that day');
  const missing = searchJournal(days, data, '', { ...emptyFilter, unlogged: true, from: '2026-11-10', to: '2026-11-15' });
  assert.deepEqual(missing.map(r => r.date), ['2026-11-15', '2026-11-12']);
  assert.ok(missing.every(r => r.kind === 'routine' && !r.skipped));
  assert.equal(searchJournal([{ date: '2026-11-17', types: [], metrics: {}, visibleMetrics: [], records: [] }], data, '', { ...emptyFilter, unlogged: true }).length, 0);
  const entries = searchJournal(days, data, 'sidepull', { ...emptyFilter, entriesOnly: true, categories: ['climb'], from: '2026-11-15', to: '2026-11-15' });
  assert.deepEqual(entries.map(r => r.kind), ['entry']);
  assert.equal(searchJournal(days, data, '', { ...emptyFilter, entriesOnly: true, from: '2026-11-14', to: '2026-11-14' }).length, 0, 'a day with records but no written entry is excluded');
});
