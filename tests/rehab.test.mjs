import assert from 'node:assert/strict';
import test from 'node:test';
import { emptyRehab, elapsedDays, validateRehab, pulleyPhase, wristPhase, pulleyLoadingDay, completedExercise, rehabTasks } from '../src/rehab/data.ts';
import { exercises, workoutPresets, workoutPlans, resolvePreset, planPresets } from '../src/workouts/fixtures.ts';
import { createSession, sessionReducer as reduce, remainingSeconds } from '../src/workouts/session.ts';
import { summariseWorkout } from '../src/workouts/workout.ts';

const config = () => ({ ...emptyRehab(), pulleyStart: '2026-11-01', wristStart: '2026-11-01', wristKg: 1, wristIsometricReps: 5, wristEccentricWeeks: 2 });
const preset = (id, data = config(), date = '2026-11-01') => resolvePreset(workoutPresets.find(p => p.id === id), data, date);
const session = (id, date = '2026-11-01', data = config()) => {
  const p = preset(id, data, date);
  return createSession(p, exercises.find(e => e.id === p.exerciseId), 'manual', Date.parse(`${date}T12:00:00Z`));
};
const complete = (id, date = '2026-11-01') => {
  const s = session(id, date);
  return { ...s, phase: 'review', finishedAt: s.startedAt, sets: Array.from({ length: s.preset.prescription.sets }, (_, i) => ({ set: i + 1, status: 'completed', source: 'manual', trace: [] })) };
};

test('rehab validates real calendar dates and counts complete days across DST', () => {
  assert.equal(validateRehab(emptyRehab()), true);
  assert.equal(validateRehab({ ...emptyRehab(), wristStart: '2026-02-30' }), false);
  assert.equal(validateRehab({ ...emptyRehab(), wristKg: -1 }), false);
  assert.equal(validateRehab({ ...emptyRehab(), wristEccentricReps: 7 }), false);
  assert.equal(elapsedDays('2026-10-24', '2026-10-26'), 2);
  assert.equal(pulleyPhase(emptyRehab(), '2026-11-01'), 0);
  assert.equal(pulleyPhase(config(), '2026-10-31'), 0);
  assert.equal(pulleyPhase(config(), '2026-11-14'), 1);
  assert.equal(pulleyPhase(config(), '2026-11-15'), 2);
  assert.equal(pulleyPhase(config(), '2026-11-28'), 2);
  assert.equal(pulleyPhase(config(), '2026-11-29'), 3);
});

test('pulley loading unlocks after 14 days, half crimp after 28 and a configured load', () => {
  assert.ok(preset('three-finger-drag', config(), '2026-11-14').locked);
  assert.equal(preset('three-finger-drag', config(), '2026-11-15').locked, undefined);
  assert.equal(preset('tendon-glides', config(), '2026-11-14').optional, false);
  assert.equal(preset('tendon-glides', config(), '2026-11-15').optional, true);
  assert.ok(preset('pull-ups-3x5').locked);
  assert.equal(preset('pull-ups-3x5', config(), '2026-11-15').locked, undefined);
  assert.equal(preset('half-crimp', config(), '2026-11-29').locked.label, 'Set load');
  const half = preset('half-crimp', { ...config(), halfCrimpKg: 6 }, '2026-11-29');
  assert.equal(half.locked, undefined);
  assert.equal(half.prescription.targetKg, 6);
  assert.equal(pulleyLoadingDay(config(), '2026-11-14'), false);
  assert.equal(pulleyLoadingDay(config(), '2026-11-15'), true);
  assert.equal(pulleyLoadingDay(config(), '2026-11-16'), false);
  assert.equal(pulleyLoadingDay(config(), '2026-11-17'), true);
});

test('wrist exposes only the current phase and needs the omitted values explicitly entered', () => {
  const plan = workoutPlans.find(p => p.id === 'wrist-rehab');
  for (const [date, id] of [['2026-11-14', 'wrist-isometric'], ['2026-11-15', 'wrist-eccentric'], ['2026-11-29', 'wrist-full']]) {
    assert.deepEqual(planPresets(plan, config(), date).filter(p => !p.locked).map(p => p.id), [id]);
  }
  assert.equal(wristPhase({ ...config(), wristEccentricWeeks: 3 }, '2026-11-29'), 2);
  assert.equal(wristPhase({ ...config(), wristEccentricWeeks: 3 }, '2026-12-06'), 3);
  assert.equal(wristPhase({ ...config(), wristEccentricWeeks: null }, '2027-01-01'), 2);
  assert.equal(preset('wrist-isometric', { ...config(), wristKg: null }).prescription.addedLoadKg, undefined);
  assert.equal(preset('wrist-isometric', { ...config(), wristIsometricReps: null }).locked.label, 'Confirm repetitions');
  assert.equal(preset('wrist-isometric', { ...config(), wristKg: 0 }).locked, undefined);
});

test('rehab counts complete real exercises once, including aggregate workouts, excluding partial and simulated results', () => {
  const full = complete('isometric-squeeze');
  const partial = { ...full, id: 'partial', sets: full.sets.slice(1) };
  const stopped = { ...full, id: 'stopped', sets: full.sets.map(set => ({ ...set, status: 'stopped' })) };
  const simulated = { ...full, id: 'simulated', source: 'simulator' };
  const unsaved = { ...full, id: 'unsaved', finishedAt: undefined };
  assert.equal(completedExercise([full, full, partial, stopped, simulated, unsaved], 'isometric-squeeze', '2026-11-01'), 1);
  const glides = complete('tendon-glides');
  const plan = workoutPlans.find(p => p.id === 'pulley-rehab');
  const grouped = summariseWorkout(plan, planPresets(plan, config(), '2026-11-01'), [glides, full], 'manual', 'grouped', full.startedAt);
  grouped.finishedAt = full.finishedAt;
  const another = structuredClone(grouped); another.id = 'another';
  const tasks = rehabTasks(config(), [grouped, grouped, another], '2026-11-01');
  assert.equal(tasks.find(t => t.id === 'pulley').done, true);
  assert.equal(rehabTasks(config(), [partial], '2026-11-01').find(t => t.id === 'pulley').done, false);
  assert.equal(rehabTasks(config(), [], '2026-11-16').some(t => t.id === 'pulley'), false);
});

test('wrist eccentric timer waits for assisted returns and saves only active lowering time and actual weight', () => {
  let s = session('wrist-eccentric', '2026-11-15');
  let now = 0;
  s = reduce(s, { type: 'start', now });
  s = reduce(s, { type: 'pause', now: 1000 });
  assert.equal(s.awaitingReset, false);
  s = reduce(s, { type: 'resume', now: 2000 });
  now = 1000;
  for (let rep = 1; rep <= 8; rep++) {
    now += 3000;
    s = reduce(s, { type: 'tick', now });
    if (rep < 8) {
      assert.equal(s.awaitingReset, true);
      const remaining = remainingSeconds(s, now);
      s = reduce(s, { type: 'tick', now: now + 60_000 });
      assert.equal(remainingSeconds(s, now + 60_000), remaining);
      now += 60_000;
      s = reduce(s, { type: 'resume', now });
    }
  }
  assert.equal(s.phase, 'rest');
  assert.deepEqual({ reps: s.sets[0].reps, kg: s.sets[0].addedLoadKg, seconds: s.sets[0].durationSeconds }, { reps: 8, kg: 1, seconds: 24 });
  assert.equal(remainingSeconds(s, now), 180);
  s = reduce(s, { type: 'tick', now: now + 179_999 });
  assert.equal(s.phase, 'rest');
  s = reduce(s, { type: 'tick', now: now + 180_000 });
  assert.equal(s.phase, 'preparing');
});

test('mug grips wait for explicit next-set action during self-paced rest', () => {
  let s = reduce(session('isometric-squeeze'), { type: 'start', now: 0 });
  s = reduce(s, { type: 'tick', now: 10_000 });
  assert.equal(s.phase, 'rest');
  s = reduce(s, { type: 'tick', now: 100_000 });
  assert.equal(s.phase, 'rest');
  s = reduce(s, { type: 'skip-rest' });
  assert.equal(s.phase, 'ready'); assert.equal(s.currentSet, 2);
});

test('wrist isometric and full-range sets follow their supplied tempo, repetitions and three-minute rests', () => {
  for (const [id, date, sets, reps, steps] of [
    ['wrist-isometric', '2026-11-01', 5, 5, [3, 3]],
    ['wrist-full', '2026-11-29', 4, 5, [1, 1, 2]],
  ]) {
    let s = session(id, date);
    assert.equal(s.preset.prescription.sets, sets);
    assert.deepEqual(s.preset.prescription.steps.map(step => step.seconds), steps);
    let now = 0;
    for (let set = 1; set <= sets; set++) {
      s = reduce(s, { type: 'start', now });
      now += reps * steps.reduce((sum, seconds) => sum + seconds, 0) * 1000;
      s = reduce(s, { type: 'tick', now });
      assert.equal(s.sets.length, set);
      assert.equal(s.sets.at(-1).reps, reps);
      assert.equal(s.sets.at(-1).addedLoadKg, 1);
      if (set < sets) {
        assert.equal(s.phase, 'rest');
        assert.equal(remainingSeconds(s, now), 180);
        s = reduce(s, { type: 'skip-rest' });
      }
    }
    assert.equal(s.phase, 'review');
  }
});
