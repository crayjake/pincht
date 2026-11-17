import { elapsedDays, loadRehab, pulleyPhase, wristPhase, type RehabData } from '../rehab/data.ts';
// Edit exercises and workout prescriptions here. Runtime sessions snapshot these values.
export interface RepPrescription {
  kind: 'reps'; sets: number; reps: number; addedLoadKg: number; restSeconds: number;
}
export interface HoldPrescription {
  kind: 'hold'; sets: number; hand: 'left' | 'right'; edgeMm: number; grip: string;
  targetKg: number; toleranceKg: number; holdSeconds: number; restSeconds: number;
}
export interface TimedPrescription { kind: 'timed'; sets: number; holdSeconds: number; restSeconds: number; selfPacedRest?: boolean }
export interface PacedPrescription {
  kind: 'paced'; sets: number; reps: number; restSeconds: number; addedLoadKg?: number; manualReset?: boolean;
  steps: { label: string; seconds: number }[];
}
export type Prescription = RepPrescription | HoldPrescription | TimedPrescription | PacedPrescription;
export interface Exercise { id: string; name: string; category: 'training' | 'rehab'; description: string; cue?: string }
export interface WorkoutPreset {
  id: string; exerciseId: string; name: string; prescription: Prescription;
  optional?: boolean; locked?: { label: string; note: string };
}
export interface WorkoutPlan { id: string; name: string; description: string; presetIds: string[]; featured?: boolean }
export const exercises: Exercise[] = [
  { id: 'pull-ups', name: 'Pull-ups', category: 'training', description: 'Bodyweight pulling. Record the reps you actually do.' },
  { id: 'finger-drag', name: 'Finger rehab', category: 'rehab', description: 'Steady, controlled force on the edge.' },
  { id: 'glides', name: 'Tendon glides', category: 'rehab', description: 'Ring on · pain-free range', cue: 'Ring on. Stay inside a pain-free range.' },
  { id: 'squeeze', name: 'Isometric mug grips', category: 'rehab', description: 'Solid mug, bottle, ball or opposite palm', cue: 'Use a solid, larger-diameter object. No movement; keep it non-aggravating. Rest as needed.' },
  { id: 'wrist-extension', name: 'Wrist extension', category: 'rehab', description: 'Left wrist · supported forearm, palm down', cue: 'Stay comfortable, at most 3/10 discomfort. Stop if painful. Support the forearm on a table or towel.' },
  { id: 'half-crimp', name: 'Half crimp', category: 'rehab', description: 'Left hand · 20 mm half crimp' },
];
export const workoutPresets: WorkoutPreset[] = [
  { id: 'pull-ups-3x5', exerciseId: 'pull-ups', name: 'Pull-ups', prescription: { kind: 'reps', sets: 3, reps: 5, addedLoadKg: 0, restSeconds: 90 } },
  { id: 'finger-rehab', exerciseId: 'finger-drag', name: 'Finger rehab', prescription: { kind: 'hold', sets: 6, hand: 'left', edgeMm: 20, grip: 'three-finger drag', targetKg: 10, toleranceKg: 1, holdSeconds: 15, restSeconds: 60 } },
  // Starting choices within the supplied ranges; loads and wrist reps are configured separately.
  { id: 'tendon-glides', exerciseId: 'glides', name: 'Tendon glides', prescription: { kind: 'paced', sets: 1, reps: 6, restSeconds: 0, steps: [
    { label: 'Fingers straight', seconds: 2 }, { label: 'Hook fist', seconds: 2 },
    { label: 'Table top', seconds: 2 }, { label: 'Straight fist', seconds: 2 }, { label: 'Full fist', seconds: 2 },
  ] } },
  { id: 'isometric-squeeze', exerciseId: 'squeeze', name: 'Isometric mug grips', prescription: { kind: 'timed', sets: 6, holdSeconds: 10, restSeconds: 0, selfPacedRest: true } },
  { id: 'three-finger-drag', exerciseId: 'finger-drag', name: '3-finger drag', prescription: { kind: 'hold', sets: 6, hand: 'left', edgeMm: 20, grip: 'open hand · three-finger drag', targetKg: 10, toleranceKg: 1, holdSeconds: 15, restSeconds: 60 } },
  { id: 'half-crimp', exerciseId: 'half-crimp', name: 'Half crimp', locked: { label: 'After four weeks', note: 'Unlocks after 28 days; set a confirmed load before starting.' }, prescription: { kind: 'hold', sets: 6, hand: 'left', edgeMm: 20, grip: 'half crimp', targetKg: 10, toleranceKg: 1, holdSeconds: 15, restSeconds: 60 } },
  { id: 'wrist-isometric', exerciseId: 'wrist-extension', name: 'Wrist isometrics', prescription: { kind: 'paced', sets: 5, reps: 0, restSeconds: 180, steps: [{ label: 'Hold in comfortable midrange', seconds: 3 }, { label: 'Release · support with other hand', seconds: 3 }] } },
  { id: 'wrist-eccentric', exerciseId: 'wrist-extension', name: 'Wrist eccentrics', prescription: { kind: 'paced', sets: 4, reps: 8, restSeconds: 180, manualReset: true, steps: [{ label: 'Lower slowly', seconds: 3 }] } },
  { id: 'wrist-full', exerciseId: 'wrist-extension', name: 'Full-range wrist extension', prescription: { kind: 'paced', sets: 4, reps: 5, restSeconds: 180, steps: [{ label: 'Raise', seconds: 1 }, { label: 'Hold', seconds: 1 }, { label: 'Lower', seconds: 2 }] } },
];
export const workoutPlans: WorkoutPlan[] = [
  { id: 'pulley-rehab', name: 'Pulley rehab', description: 'Glides and grips first two weeks; then alternate-day loading', presetIds: ['tendon-glides', 'isometric-squeeze', 'three-finger-drag', 'half-crimp'], featured: true },
  { id: 'wrist-rehab', name: 'Wrist rehab', description: 'Current phase only · 2–3 sessions per week', presetIds: ['wrist-isometric', 'wrist-eccentric', 'wrist-full'] },
  { id: 'mobility', name: 'Mobility', description: 'Glides and mug grips · optional after two weeks', presetIds: ['tendon-glides', 'isometric-squeeze'] },
  { id: 'pull-ups-3x5', name: 'Pull-ups', description: 'Strength', presetIds: ['pull-ups-3x5'] },
];
export function resolvePreset(base: WorkoutPreset, data = loadRehab(), today?: string): WorkoutPreset {
  const preset = structuredClone(base);
  delete preset.locked;
  const p = preset.prescription;
  const phase = pulleyPhase(data, today);
  const lock = (label: string, note: string) => { preset.locked = { label, note }; };
  if (['glides', 'squeeze', 'finger-drag', 'half-crimp'].includes(preset.exerciseId)) {
    if (!phase) lock('Set start date', 'The pulley plan has not started yet.');
    else if (['glides', 'squeeze'].includes(preset.exerciseId)) preset.optional = phase >= 2;
    else if (preset.exerciseId === 'finger-drag' && phase < 2) lock('After two weeks', 'No climbing or forced gripping during the first 14 days.');
    else if (preset.exerciseId === 'half-crimp' && phase < 3) lock('After four weeks', 'Unlocks after 28 full days.');
    else if (preset.exerciseId === 'half-crimp' && data.halfCrimpKg === null) lock('Set load', 'Half-crimp load has not been confirmed.');
    if (p.kind === 'hold') {
      p.targetKg = preset.exerciseId === 'half-crimp' ? data.halfCrimpKg ?? 0 : data.dragKg;
      p.holdSeconds = data.dragSeconds;
    }
  }
  if (preset.exerciseId === 'pull-ups' && phase === 1) lock('Rest from gripping', 'Your pulley plan excludes forced gripping for the first two weeks.');
  if (preset.exerciseId === 'wrist-extension') {
    const current = wristPhase(data, today);
    const expected = ['wrist-isometric', 'wrist-eccentric', 'wrist-full'].indexOf(preset.id) + 1;
    if (!current) lock('Set start date', 'The wrist plan has not started yet.');
    else if (current !== expected) lock(`Phase ${expected}`, 'Only the current wrist phase is active; do not do all three exercises together.');
    else if (expected === 1 && !data.wristIsometricReps) lock('Confirm repetitions', 'Repetitions per set have not been confirmed.');
    if (p.kind === 'paced') {
      p.addedLoadKg = data.wristKg ?? undefined;
      p.reps = expected === 1 ? data.wristIsometricReps ?? 0 : expected === 2 ? data.wristEccentricReps : data.wristFullReps;
    }
  }
  return preset;
}
export const planPresets = (plan: WorkoutPlan, data?: RehabData, today?: string) => plan.presetIds.map(id => resolvePreset(workoutPresets.find(preset => preset.id === id)!, data, today));
export function rehabPlanNote(plan: WorkoutPlan, data = loadRehab(), today?: string) {
  if (plan.id === 'wrist-rehab') return `Phase ${wristPhase(data, today) || 'not set'} · 2–3 sessions per week · one exercise at a time`;
  if (plan.id !== 'pulley-rehab') return plan.description;
  const day = elapsedDays(data.pulleyStart, today);
  return day === null || day < 0 ? plan.description : day < 14 ? `Day ${day + 1} · glides and mug grips, 2–3 times daily` : `Day ${day + 1} · alternate-day loading · glides and grips optional`;
}
export function workSeconds(p: Prescription) {
  return p.kind === 'paced' ? p.reps * p.steps.reduce((sum, step) => sum + step.seconds, 0) : p.kind === 'reps' ? p.reps * 4 : p.holdSeconds;
}
export function workoutMinutes(plan: WorkoutPlan, presets = planPresets(plan)) {
  return Math.round(presets.filter(preset => !preset.locked && !preset.optional).reduce((sum, { prescription: p }) => sum + 5 + p.sets * workSeconds(p) + (p.sets - 1) * p.restSeconds, 0) / 60);
}
export function prescriptionLabel(p: Prescription) {
  if (p.kind === 'reps') return `${p.sets} × ${p.reps} reps · ${p.addedLoadKg ? `+${p.addedLoadKg} kg` : 'bodyweight'}`;
  if (p.kind === 'paced') return `${p.sets === 1 ? `${p.reps} reps` : `${p.sets} × ${p.reps || '?'} reps`}${p.addedLoadKg !== undefined ? ` · ${p.addedLoadKg} kg` : ''}`;
  return `${p.sets} × ${p.holdSeconds} s${p.kind === 'hold' ? ` · ~${p.targetKg} kg` : ''}`;
}
