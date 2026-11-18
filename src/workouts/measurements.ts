import type { Prescription } from './fixtures.ts';
import type { Session } from './session.ts';
import { localDate, type Day } from '../components/home/journal-data.ts';

/** The existing quick log specifies grip and edge, but does not specify a max test. */
export const directDragSeriesId = 'explicit-load:three-finger-drag:20mm';
export interface LoadPoint { id: string; date: string; kg: number; edgeMm?: number }
export interface LoadSeries {
  id: string; exerciseId: string; name: string;
  statistic: 'peak' | 'set-mean' | 'added-load' | 'explicit-load';
  prescription?: Prescription;
  points: LoadPoint[];
}

export function protocol(prescription: Prescription) {
  // Loads change over time; keep the exercise protocol (including tempo and rest)
  // in the identity so a max hang is never plotted as a repeater measurement.
  const p = prescription;
  if (p.kind === 'hold') return { kind: p.kind, ...(p.mode ? { mode: p.mode } : {}), sets: p.sets, hand: p.hand, edgeMm: p.edgeMm, grip: p.grip, holdSeconds: p.holdSeconds, restSeconds: p.restSeconds };
  if (p.kind === 'reps') return { kind: p.kind, sets: p.sets, reps: p.reps, restSeconds: p.restSeconds };
  if (p.kind === 'paced') return { kind: p.kind, sets: p.sets, reps: p.reps, restSeconds: p.restSeconds, steps: p.steps, manualReset: !!p.manualReset };
  return { kind: p.kind, sets: p.sets, holdSeconds: p.holdSeconds, restSeconds: p.restSeconds };
}
export function presetSeriesId(preset: import('./fixtures.ts').WorkoutPreset) {
  return JSON.stringify([preset.exerciseId, preset.prescription.kind === 'hold' ? preset.prescription.mode === 'max' ? 'peak' : 'set-mean' : 'added-load', protocol(preset.prescription)]);
}
export function loadSeries(days: Day[], sessions: Session[]): LoadSeries[] {
  const series = new Map<string, LoadSeries>();
  const explicit: LoadSeries = { id: directDragSeriesId, exerciseId: 'finger-drag', name: '20 mm three-finger drag · explicit load', statistic: 'explicit-load', points: days.flatMap(day => day.measurements?.fingerStrengthKg === undefined ? [] : [{ id: `measurement-finger-${day.date}`, date: day.date, kg: day.measurements.fingerStrengthKg, edgeMm: 20 }]) };
  series.set(explicit.id, explicit);
  for (const workout of new Map(sessions.map(session => [session.id, session])).values()) {
    if (!workout.finishedAt || workout.source === 'simulator' || workout.sets.some(set => set.source === 'simulator')) continue;
    for (const session of workout.workout?.sessions ?? [workout]) {
      const p = session.preset.prescription;
      const statistic = p.kind === 'hold' ? p.mode === 'max' ? 'peak' : 'set-mean' : 'added-load';
      const id = presetSeriesId(session.preset);
      const value = series.get(id) ?? { id, exerciseId: session.exercise.id, name: session.preset.name, statistic, prescription: structuredClone(p), points: [] };
      for (const set of session.sets) {
        const kg = p.kind === 'hold' ? p.mode === 'max' ? set.peakKg : set.meanKg : set.addedLoadKg;
        if (set.status !== 'completed' || set.source === 'simulator' || kg === undefined || !Number.isFinite(kg)) continue;
        value.points.push({ id: `${workout.id}:${session.preset.id}:${set.set}`, date: localDate(new Date(workout.startedAt)), kg, ...(p.kind === 'hold' ? { edgeMm: p.edgeMm } : {}) });
      }
      if (value.points.length) series.set(id, value);
    }
  }
  return [...series.values()].map(value => ({ ...value, points: value.points.sort((a, b) => a.date.localeCompare(b.date)) }));
}
export function seriesMeasurements(days: Day[], sessions: Session[], seriesId = directDragSeriesId) {
  return loadSeries(days, sessions).find(series => series.id === seriesId)?.points ?? [];
}

/** Offer a measurable protocol before its first result has been logged. */
export function availableLoadSeries(days: Day[], sessions: Session[], presets: import('./fixtures.ts').WorkoutPreset[]) {
  const values = new Map(loadSeries(days,sessions).map(value => [value.id,value]));
  for (const preset of presets) {
    const p = preset.prescription;
    if (p.kind !== 'hold' && p.kind !== 'reps') continue;
    const id=presetSeriesId(preset);
    if (!values.has(id)) values.set(id,{id,exerciseId:preset.exerciseId,name:preset.name,statistic:p.kind==='hold'?p.mode==='max'?'peak':'set-mean':'added-load',prescription:p,points:[]});
  }
  return [...values.values()];
}
