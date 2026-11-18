import { emptyRehab } from '../src/rehab/data.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { exercises, workoutPlans, workoutPresets, planPresets, workoutMinutes } from '../src/workouts/fixtures.ts';
import { createSession, sessionReducer as reduce, remainingSeconds } from '../src/workouts/session.ts';
import { summariseWorkout, prescribedSets } from '../src/workouts/workout.ts';
import { saveSession, mergeWorkoutDays, SIMULATOR_KEY, SESSION_KEY } from '../src/workouts/storage.ts';
const make = id => {
  const preset = workoutPresets.find(p => p.id === id);
  return createSession(preset, exercises.find(e => e.id === preset.exerciseId), 'manual', 0);
};

test('dated rehab plan makes early exercises optional after two weeks', () => {
  const plan = workoutPlans.find(plan => plan.id === 'pulley-rehab');
  const config = { ...emptyRehab(), pulleyStart: '2026-11-01' };
  const presets = planPresets(plan, config, '2026-11-15');
  assert.deepEqual(presets.map(p => p.id), ['tendon-glides', 'isometric-squeeze', 'three-finger-drag', 'half-crimp']);
  assert.equal(presets.filter(p => !p.locked).length, 3);
  assert.equal(presets[0].prescription.steps.length, 5);
  assert.equal(presets[0].prescription.reps, 6);
  assert.deepEqual(presets[1].prescription, { kind: 'timed', sets: 6, holdSeconds: 10, restSeconds: 0, selfPacedRest: true });
  assert.equal(presets[2].prescription.targetKg, 10);
  assert.equal(workoutMinutes(plan, presets), 7);
  assert.equal(presets[0].optional, true);
  assert.equal(presets[1].optional, true);
  assert.deepEqual(planPresets(workoutPlans.find(p => p.id === 'mobility')).map(p => p.id), ['tendon-glides', 'isometric-squeeze']);
});

test('guided preparation, rest deadlines, pause, and completion preserve actual work time', () => {
  const base = make('isometric-squeeze');
  base.preset.prescription.restSeconds = 30;
  base.preset.prescription.selfPacedRest = false;
  let s = reduce(base, { type: 'prepare', now: 0 });
  assert.equal(remainingSeconds(s, 2999), 1);
  s = reduce(s, { type: 'tick', now: 3000 });
  assert.equal(s.phase, 'holding');
  s = reduce(s, { type: 'pause', now: 6000 });
  s = reduce(s, { type: 'tick', now: 100000 });
  assert.equal(s.phase, 'holding'); assert.equal(remainingSeconds(s, 100000), 7);
  s = reduce(s, { type: 'resume', now: 100000 });
  s = reduce(s, { type: 'tick', now: 107000 });
  assert.equal(s.phase, 'rest'); assert.equal(s.sets[0].durationSeconds, 10);
  s = reduce(s, { type: 'extend-rest', seconds: 15 });
  assert.equal(remainingSeconds(s, 107000), 45);
  s = reduce(s, { type: 'tick', now: 152000 });
  assert.equal(s.phase, 'preparing'); assert.equal(s.currentSet, 2);
  s = reduce(s, { type: 'tick', now: 155000 });
  assert.equal(s.phase, 'holding');
});

test('backgrounding during preparation cancels automatic start; interrupted paced work cannot be kept', () => {
  let s = reduce(make('tendon-glides'), { type: 'prepare', now: 0 });
  s = reduce(s, { type: 'interrupt', now: 1000, reason: 'Background' });
  s = reduce(s, { type: 'tick', now: 100000 }); assert.equal(s.phase, 'ready');
  s = reduce(s, { type: 'start', now: 100000 });
  s = reduce(s, { type: 'pause', now: 112000 });
  s = reduce(s, { type: 'interrupt', now: 150000, reason: 'Background' });
  assert.equal(s.candidate.durationSeconds, 12);
  assert.equal(s.candidate.reps, 1);
  assert.equal(reduce(s, { type: 'keep', now: 150000 }), s);
  s = reduce(s, { type: 'retry' }); assert.equal(s.currentSet, 1);
  s = reduce(s, { type: 'start', now: 150000 });
  s = reduce(s, { type: 'tick', now: 210000 });
  assert.equal(s.phase, 'review'); assert.equal(s.sets[0].reps, 6);
});

test('aggregate sessions snapshot the complete plan and isolate simulated exercises even with manual selection', () => {
  let glides = reduce(make('tendon-glides'), { type: 'start', now: 0 });
  glides = reduce(glides, { type: 'tick', now: 60000 });
  const drag = make('three-finger-drag');
  drag.source = 'simulator'; drag.phase = 'review';
  drag.sets = [{ set: 1, source: 'simulator', status: 'completed', durationSeconds: 15, meanKg: 10, trace: [] }];
  const plan = structuredClone(workoutPlans.find(plan => plan.id === 'pulley-rehab'));
  const prescriptions = structuredClone(planPresets(plan, { ...emptyRehab(), pulleyStart: '2026-11-01' }, '2026-11-15'));
  const workout = summariseWorkout(plan, prescriptions, [glides, drag], 'manual', 'whole-workout', new Date(0).toISOString());
  assert.equal(prescribedSets(workout), 13); assert.equal(workout.source, 'simulator');
  assert.equal(workout.sets[1].exerciseId, 'finger-drag');
  plan.name = 'Changed'; prescriptions[2].prescription.targetKg = 99;
  assert.equal(workout.workout.plan.name, 'Pulley rehab');
  assert.equal(workout.workout.prescriptions[2].prescription.targetKg, 10);
  const data = new Map(); const store = { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  const saved = saveSession(workout, 'Test', 100000, store);
  assert.equal(data.has(SESSION_KEY), false); assert.equal(data.has(SIMULATOR_KEY), true);
  assert.deepEqual(mergeWorkoutDays([], [saved]), []);
});
