import assert from 'node:assert/strict';
import test from 'node:test';
import { exercises, workoutPresets } from '../src/workouts/fixtures.ts';
import { createSession, remainingSeconds, sessionReducer as reduce, STALE_MS } from '../src/workouts/session.ts';
import { loadSessions, saveSession, mergeWorkoutDays, SESSION_KEY, SIMULATOR_KEY } from '../src/workouts/storage.ts';

const epoch = Date.parse('2026-11-15T12:00:00Z');
const make = (kind = 'hold', source = 'tindeq') => {
  const preset = workoutPresets.find(p => p.prescription.kind === kind);
  return createSession(preset, exercises.find(e => e.id === preset.exerciseId), source, epoch);
};
const start = s => reduce(s, { type: 'start', now: epoch });
const sample = (s, seconds, kg = 10, now = epoch + seconds * 1000) => reduce(s, { type: 'sample', now, sample: { kg, deviceTimeUs: seconds * 1e6 } });
const fullHold = s => {
  s = start(s);
  for (let i = 0; i <= 150; i++) s = sample(s, i / 10, i % 2 ? 11 : 9);
  return s;
};
const memoryStore = () => {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
};

test('pull-ups record actuals, rest on a deadline, skip rest, and go straight to review after set 3', () => {
  let s = make('reps', 'manual');
  s = reduce(s, { type: 'complete-reps', now: epoch, reps: 4, addedLoadKg: 2.5 });
  assert.equal(s.phase, 'rest');
  assert.deepEqual([s.sets[0].reps, s.sets[0].addedLoadKg], [4, 2.5]);
  assert.equal(remainingSeconds(s, epoch + 89_001), 1);
  s = reduce(s, { type: 'tick', now: epoch + 89_999 });
  assert.equal(s.phase, 'rest');
  s = reduce(s, { type: 'tick', now: epoch + 90_000 });
  assert.equal(s.phase, 'ready'); assert.equal(s.currentSet, 2);
  s = reduce(s, { type: 'complete-reps', now: epoch + 90_000, reps: 5, addedLoadKg: 0 });
  s = reduce(s, { type: 'skip-rest' });
  assert.equal(s.currentSet, 3);
  s = reduce(s, { type: 'complete-reps', now: epoch + 91_000, reps: 3, addedLoadKg: 0 });
  assert.equal(s.phase, 'review'); assert.equal(s.sets.length, 3);
  assert.equal(reduce(s, { type: 'skip-rest' }), s);
});

test('invalid rep/load actuals cannot complete a set', () => {
  const s = make('reps', 'manual');
  for (const [reps, addedLoadKg] of [[-1, 0], [1.5, 0], [5, -1], [NaN, 0]]) {
    assert.equal(reduce(s, { type: 'complete-reps', now: epoch, reps, addedLoadKg }), s);
  }
});

test('BLE timer begins on first sample; device time determines recorded duration and completion', () => {
  let s = start(make());
  assert.equal(remainingSeconds(s, epoch + 500), 15);
  s = sample(s, 0, 9, epoch + 500);
  assert.equal(remainingSeconds(s, epoch + 1500), 14);
  for (let i = 1; i <= 150; i++) s = sample(s, i / 10, 11, epoch + 500 + i * 100);
  assert.equal(s.phase, 'result'); assert.equal(s.candidate.status, 'completed');
  assert.equal(s.candidate.durationSeconds, 15);
  assert.ok(s.candidate.meanKg > 10.9 && s.candidate.meanKg < 11);
  s = reduce(s, { type: 'keep', now: epoch + 16_000 });
  assert.equal(s.phase, 'rest'); assert.equal(s.restUntil, epoch + 76_000);
  assert.equal(s.sets[0].trace.length, 151);
});

test('retry discards the unkept result and repeats the same set; the last kept hold goes to review', () => {
  let s = fullHold(make());
  s = reduce(s, { type: 'retry' });
  assert.equal(s.phase, 'ready'); assert.equal(s.currentSet, 1); assert.equal(s.sets.length, 0);
  assert.equal(s.candidate, undefined); assert.deepEqual(s.trace, []);
  for (let set = 1; set <= 6; set++) {
    s = fullHold(s);
    s = reduce(s, { type: 'keep', now: epoch + 16_000 });
    assert.equal(s.sets.length, set);
    if (set < 6) s = reduce(s, { type: 'skip-rest' });
  }
  assert.equal(s.phase, 'review'); assert.equal(s.attempts.length, 7);
});

test('stopped holds keep measured duration; finishing early includes only kept sets', () => {
  let s = start(make()); s = sample(s, 0); s = sample(s, 1, 12);
  s = reduce(s, { type: 'stop', now: epoch + 1200 });
  assert.equal(s.candidate.durationSeconds, 1); assert.equal(s.candidate.meanKg, 11);
  assert.equal(s.candidate.status, 'stopped');
  s = reduce(s, { type: 'keep', now: epoch + 1200 }); s = reduce(s, { type: 'skip-rest' });
  s = start(s); s = sample(s, 0); s = sample(s, .5);
  s = reduce(s, { type: 'finish', now: epoch + 600 });
  assert.equal(s.phase, 'review'); assert.equal(s.sets.length, 1);
  assert.equal(s.attempts.at(-1).status, 'interrupted');
});

test('no data, stale data, late packets, and missing device samples interrupt rather than silently complete', () => {
  let s = start(make());
  assert.equal(reduce(s, { type: 'tick', now: epoch + STALE_MS - 1 }).phase, 'holding');
  s = reduce(s, { type: 'tick', now: epoch + STALE_MS });
  assert.equal(s.candidate.status, 'interrupted');
  assert.equal(reduce(s, { type: 'keep', now: epoch + 2000 }), s);
  s = sample(start(make()), 0);
  assert.equal(sample(s, 2).candidate.status, 'interrupted');
  assert.equal(sample(s, 2, 10, epoch + 100).candidate.status, 'interrupted');
  s = start(make());
  for (let i = 0; i <= 140; i++) s = sample(s, i / 10);
  s = reduce(s, { type: 'tick', now: epoch + 15_000 });
  assert.equal(s.phase, 'holding'); // A wall timer alone cannot complete an unrecorded hold.
  s = reduce(s, { type: 'tick', now: epoch + 15_500 });
  assert.equal(s.candidate.status, 'interrupted');
});

test('disconnect and background interrupts cannot be kept; retry uses a fresh trace', () => {
  for (const reason of ['Progressor disconnected during the hold.', 'App left the foreground during the hold.']) {
    let s = sample(start(make()), 0);
    s = reduce(s, { type: 'interrupt', now: epoch + 500, reason });
    assert.equal(s.candidate.reason, reason); assert.equal(s.candidate.status, 'interrupted');
    assert.equal(reduce(s, { type: 'keep', now: epoch + 1000 }), s);
    s = reduce(s, { type: 'retry' }); s = start(s);
    assert.equal(s.currentSet, 1); assert.equal(s.firstDeviceUs, undefined);
    assert.deepEqual(s.trace, []);
  }
});

test('duplicate and out-of-order timestamps are ignored; uint32 microsecond rollover is handled', () => {
  let s = start(make());
  const add = (state, us) => reduce(state, { type: 'sample', now: epoch + 100, sample: { kg: 10, deviceTimeUs: us } });
  s = add(s, 0xfffffff0);
  assert.equal(add(s, 0xfffffff0), s); assert.equal(add(s, 0xffffff00), s);
  s = add(s, 100_000);
  assert.equal(s.trace.length, 2); assert.equal(s.trace[1].seconds, .100016);
});

test('manual holds use elapsed time and require a valid entered mean', () => {
  let s = start(make('hold', 'manual'));
  s = reduce(s, { type: 'tick', now: epoch + 15_050 });
  assert.equal(s.phase, 'result'); assert.equal(s.candidate.durationSeconds, 15);
  assert.equal(reduce(s, { type: 'keep', now: epoch + 15_050 }), s);
  s = reduce(s, { type: 'keep', now: epoch + 15_050, manualMeanKg: 9.8 });
  assert.equal(s.sets[0].meanKg, 9.8); assert.equal(s.sets[0].source, 'manual');
});

const review = (source = 'tindeq') => reduce(reduce(fullHold(make('hold', source)), { type: 'keep', now: epoch + 16_000, manualMeanKg: 10 }), { type: 'finish', now: epoch + 17_000 });

test('saving persists prescription snapshot, measurements, source, note, and finish time idempotently', () => {
  const store = memoryStore(); const s = review();
  const saved = saveSession(s, '  No symptoms.  ', epoch + 18_000, store);
  saveSession(s, 'No symptoms.', epoch + 18_000, store);
  const history = loadSessions(store);
  assert.equal(history.length, 1); assert.deepEqual(history[0], JSON.parse(JSON.stringify(saved)));
  assert.equal(history[0].symptomNote, 'No symptoms.');
  assert.equal(history[0].sets[0].source, 'tindeq'); assert.equal(history[0].sets[0].trace.length, 151);
  assert.notEqual(s.preset, workoutPresets[1]); assert.notEqual(s.preset.prescription, workoutPresets[1].prescription);
  const days = mergeWorkoutDays([], history);
  assert.equal(days[0].records.length, 1); assert.equal(days[0].records[0].note, 'No symptoms.');
  assert.equal(mergeWorkoutDays(days, history)[0].records.length, 1);
});

test('simulated results stay separate from real workout history and the journal', () => {
  const store = memoryStore();
  const s = saveSession(review('simulator'), '', epoch + 18_000, store);
  assert.equal(store.getItem(SESSION_KEY), null); assert.ok(store.getItem(SIMULATOR_KEY));
  assert.deepEqual(loadSessions(store), []); assert.equal(loadSessions(store, true).length, 1);
  assert.deepEqual(mergeWorkoutDays([], [s]), []);
});

test('save errors leave in-memory results intact and never overwrite corrupt storage', () => {
  const s = review(); const before = structuredClone(s);
  assert.throws(() => saveSession(s, '', epoch, { getItem: () => null, setItem: () => { throw new Error('Quota exceeded'); } }), /Quota/);
  assert.deepEqual(s, before);
  const store = memoryStore(); store.setItem(SESSION_KEY, '{');
  assert.throws(() => saveSession(s, '', epoch, store)); assert.equal(store.getItem(SESSION_KEY), '{');
  assert.deepEqual(loadSessions(store), []);
  assert.throws(() => saveSession(make(), '', epoch, store), /keep at least one/);
});
