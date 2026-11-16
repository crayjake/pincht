// Edit exercises and workout prescriptions here. Runtime sessions snapshot these values.
export interface RepPrescription {
  kind: 'reps'; sets: number; reps: number; addedLoadKg: number; restSeconds: number;
}
export interface HoldPrescription {
  kind: 'hold'; sets: number; hand: 'left' | 'right'; edgeMm: number; grip: string;
  targetKg: number; toleranceKg: number; holdSeconds: number; restSeconds: number;
}
export interface TimedPrescription { kind: 'timed'; sets: number; holdSeconds: number; restSeconds: number }
export interface PacedPrescription {
  kind: 'paced'; sets: number; reps: number; restSeconds: number;
  steps: { label: string; seconds: number }[];
}
export type Prescription = RepPrescription | HoldPrescription | TimedPrescription | PacedPrescription;
export interface Exercise { id: string; name: string; category: 'training' | 'rehab'; description: string; cue?: string }
export interface WorkoutPreset {
  id: string; exerciseId: string; name: string; prescription: Prescription;
  locked?: { label: string; note: string };
}
export interface WorkoutPlan { id: string; name: string; description: string; presetIds: string[]; featured?: boolean }
export const exercises: Exercise[] = [
  { id: 'pull-ups', name: 'Pull-ups', category: 'training', description: 'Bodyweight pulling. Record the reps you actually do.' },
  { id: 'finger-drag', name: 'Finger rehab', category: 'rehab', description: 'Steady, controlled force on the edge.' },
  { id: 'glides', name: 'Tendon glides', category: 'rehab', description: 'Ring on · pain-free range', cue: 'Ring on. Stay inside a pain-free range.' },
  { id: 'squeeze', name: 'Isometric squeeze', category: 'rehab', description: 'Solid ball or palm pull', cue: 'No movement, just squeeze or pull. Keep it non-aggravating.' },
  { id: 'half-crimp', name: 'Half crimp', category: 'rehab', description: 'Left hand · 20 mm half crimp' },
];
export const workoutPresets: WorkoutPreset[] = [
  { id: 'pull-ups-3x5', exerciseId: 'pull-ups', name: 'Pull-ups', prescription: { kind: 'reps', sets: 3, reps: 5, addedLoadKg: 0, restSeconds: 90 } },
  { id: 'finger-rehab', exerciseId: 'finger-drag', name: 'Finger rehab', prescription: { kind: 'hold', sets: 6, hand: 'left', edgeMm: 20, grip: 'three-finger drag', targetKg: 10, toleranceKg: 1, holdSeconds: 15, restSeconds: 60 } },
  // Values reproduced from the supplied Train flow reference. Squeeze rest is assumed
  // in that reference; the half-crimp target is a placeholder and stays locked.
  { id: 'tendon-glides', exerciseId: 'glides', name: 'Tendon glides', prescription: { kind: 'paced', sets: 1, reps: 6, restSeconds: 0, steps: [
    { label: 'Fingers straight', seconds: 2 }, { label: 'Hook fist', seconds: 2 },
    { label: 'Table top', seconds: 2 }, { label: 'Straight fist', seconds: 2 }, { label: 'Full fist', seconds: 2 },
  ] } },
  { id: 'isometric-squeeze', exerciseId: 'squeeze', name: 'Isometric squeeze', prescription: { kind: 'timed', sets: 6, holdSeconds: 10, restSeconds: 30 } },
  { id: 'three-finger-drag', exerciseId: 'finger-drag', name: '3-finger drag', prescription: { kind: 'hold', sets: 6, hand: 'left', edgeMm: 20, grip: 'open hand · three-finger drag', targetKg: 10, toleranceKg: 1, holdSeconds: 15, restSeconds: 60 } },
  { id: 'half-crimp', exerciseId: 'half-crimp', name: 'Half crimp', locked: { label: 'From week 2', note: 'Starts 1 week after the open-hand drag' }, prescription: { kind: 'hold', sets: 6, hand: 'left', edgeMm: 20, grip: 'half crimp', targetKg: 10, toleranceKg: 1, holdSeconds: 15, restSeconds: 60 } },
];
export const workoutPlans: WorkoutPlan[] = [
  { id: 'pulley-rehab', name: 'Pulley rehab', description: 'Loading day · every other day', presetIds: ['tendon-glides', 'isometric-squeeze', 'three-finger-drag', 'half-crimp'], featured: true },
  { id: 'mobility', name: 'Mobility', description: 'Glides and squeeze · 2–3× a day', presetIds: ['tendon-glides', 'isometric-squeeze'] },
  { id: 'pull-ups-3x5', name: 'Pull-ups', description: 'Strength', presetIds: ['pull-ups-3x5'] },
];
export const planPresets = (plan: WorkoutPlan) => plan.presetIds.map(id => workoutPresets.find(preset => preset.id === id)!);
export function workSeconds(p: Prescription) {
  return p.kind === 'paced' ? p.reps * p.steps.reduce((sum, step) => sum + step.seconds, 0) : p.kind === 'reps' ? p.reps * 4 : p.holdSeconds;
}
export function workoutMinutes(plan: WorkoutPlan) {
  return Math.round(planPresets(plan).filter(preset => !preset.locked).reduce((sum, { prescription: p }) => sum + 5 + p.sets * workSeconds(p) + (p.sets - 1) * p.restSeconds, 0) / 60);
}
export function prescriptionLabel(p: Prescription) {
  if (p.kind === 'reps') return `${p.sets} × ${p.reps} reps · ${p.addedLoadKg ? `+${p.addedLoadKg} kg` : 'bodyweight'}`;
  if (p.kind === 'paced') return p.sets === 1 ? `${p.reps} reps` : `${p.sets} × ${p.reps} reps`;
  return `${p.sets} × ${p.holdSeconds} s${p.kind === 'hold' ? ` · ~${p.targetKg} kg` : ''}`;
}
