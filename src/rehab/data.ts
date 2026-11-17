import { localDate } from '../components/home/journal-data.ts';
import type { Session } from '../workouts/session.ts';

export interface RehabData {
  pulleyStart: string; wristStart: string; wristEccentricWeeks: 2 | 3 | null;
  wristIsometricReps: number | null; wristKg: number | null;
  wristEccentricReps: number; wristFullReps: number;
  dragKg: number; dragSeconds: number; halfCrimpKg: number | null;
}
export const emptyRehab = (): RehabData => ({ pulleyStart: '', wristStart: '', wristEccentricWeeks: null,
  wristIsometricReps: null, wristKg: null, wristEccentricReps: 8, wristFullReps: 5,
  dragKg: 10, dragSeconds: 15, halfCrimpKg: null });
export function validDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`)) && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value;
}
export function elapsedDays(start: string, today = localDate()): number | null {
  return validDate(start) ? Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) : null;
}
export function validateRehab(data: RehabData) {
  const optionalLoad = (n: number | null) => n === null || Number.isFinite(n) && n >= 0;
  return data && typeof data.pulleyStart === 'string' && (!data.pulleyStart || validDate(data.pulleyStart))
    && typeof data.wristStart === 'string' && (!data.wristStart || validDate(data.wristStart))
    && [null, 2, 3].includes(data.wristEccentricWeeks)
    && (data.wristIsometricReps === null || Number.isInteger(data.wristIsometricReps) && data.wristIsometricReps > 0)
    && optionalLoad(data.wristKg) && optionalLoad(data.halfCrimpKg)
    && Number.isInteger(data.wristEccentricReps) && data.wristEccentricReps >= 8 && data.wristEccentricReps <= 12
    && Number.isInteger(data.wristFullReps) && data.wristFullReps >= 5 && data.wristFullReps <= 8
    && Number.isFinite(data.dragKg) && data.dragKg >= 0 && [15, 20].includes(data.dragSeconds);
}
// Personal workout prescription dates, alongside the existing editable presets.
export const personalRehab: RehabData = { ...emptyRehab(), pulleyStart: '2026-11-13', wristStart: '2026-11-16', wristIsometricReps: 10 };
export function loadRehab(): RehabData { return structuredClone(personalRehab); }
export function pulleyPhase(data: RehabData, today = localDate()) {
  const day = elapsedDays(data.pulleyStart, today);
  return day === null || day < 0 ? 0 : day < 14 ? 1 : day < 28 ? 2 : 3;
}
export function wristPhase(data: RehabData, today = localDate()) {
  const day = elapsedDays(data.wristStart, today);
  return day === null || day < 0 ? 0 : day < 14 ? 1 : data.wristEccentricWeeks && day >= 14 + data.wristEccentricWeeks * 7 ? 3 : 2;
}
export const wristPresetId = (data: RehabData, today = localDate()) => ['', 'wrist-isometric', 'wrist-eccentric', 'wrist-full'][wristPhase(data, today)];
export function pulleyLoadingDay(data: RehabData, today = localDate()) {
  const day = elapsedDays(data.pulleyStart, today);
  return day !== null && day >= 14 && (day - 14) % 2 === 0;
}
function exercisesIn(sessions: Session[]) {
  return [...new Map(sessions.map(s => [s.id, s])).values()].filter(s => s.finishedAt && s.source !== 'simulator' && !s.sets.some(set => set.source === 'simulator'))
    .flatMap(s => (s.workout?.sessions ?? [s]).map(exercise => ({ ...exercise, startedAt: s.startedAt })));
}
export function completedExercise(sessions: Session[], id: string, from: string, through = from) {
  return exercisesIn(sessions).filter(s => {
    const date = localDate(new Date(s.startedAt));
    return date >= from && date <= through && s.preset.id === id && s.sets.length >= s.preset.prescription.sets
      && s.sets.every(set => set.status === 'completed');
  }).length;
}
export function rehabTasks(data: RehabData, sessions: Session[], today = localDate()) {
  const tasks: { id: string; title: string; detail: string; href: string; done: boolean }[] = [];
  const phase = pulleyPhase(data, today);
  if (phase === 1) {
    const count = Math.min(completedExercise(sessions, 'tendon-glides', today), completedExercise(sessions, 'isometric-squeeze', today));
    tasks.push({ id: 'pulley', title: 'Pulley rehab', detail: `${count} of 2–3 sessions today · glides and mug grips`, href: '#/train/pulley-rehab', done: count >= 2 });
  } else if (pulleyLoadingDay(data, today)) {
    const drag = completedExercise(sessions, 'three-finger-drag', today) + completedExercise(sessions, 'finger-rehab', today);
    tasks.push({ id: 'pulley', title: 'Pulley loading', detail: 'Alternate days · 3-finger drag' + (phase === 3 ? ' · half crimp available' : ''), href: '#/train/pulley-rehab', done: drag > 0 });
  }
  if (wristPhase(data, today)) {
    const d = new Date(`${today}T00:00:00Z`); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
    const from = d.toISOString().slice(0, 10);
    const count = ['wrist-isometric', 'wrist-eccentric', 'wrist-full'].reduce((sum, id) => sum + completedExercise(sessions, id, from, today), 0);
    tasks.push({ id: 'wrist', title: 'Wrist rehab', detail: `${count} of 2–3 sessions this week · phase ${wristPhase(data, today)}`, href: '#/train/wrist-rehab', done: count >= 2 });
  }
  return tasks;
}
