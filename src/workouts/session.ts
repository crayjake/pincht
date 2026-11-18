import { workSeconds, type Exercise, type WorkoutPlan, type WorkoutPreset } from './fixtures.ts';

export type MeasurementSource = 'manual' | 'tindeq' | 'simulator';
export interface ForceSample { kg: number; deviceTimeUs: number }
export interface TracePoint { seconds: number; kg: number }
export interface SetResult {
  set: number; source: MeasurementSource; reps?: number; addedLoadKg?: number;
  meanKg?: number; peakKg?: number; durationSeconds?: number; trace: TracePoint[];
  status: 'completed' | 'stopped' | 'interrupted'; reason?: string; exerciseId?: string;
}
export interface Session {
  id: string; startedAt: string; finishedAt?: string; preset: WorkoutPreset; exercise: Exercise;
  source: MeasurementSource; sets: SetResult[]; attempts: SetResult[];
  phase: 'ready' | 'preparing' | 'holding' | 'result' | 'rest' | 'review';
  currentSet: number; readyUntil?: number; restUntil?: number; holdStartedAt?: number; requestedAt?: number;
  lastSampleAt?: number; firstDeviceUs?: number; lastDeviceUs?: number; trace: TracePoint[];
  candidate?: SetResult; symptomNote?: string; rpe?: number;
  completedCycles?: number; pausedAt?: number; awaitingReset?: boolean; symptomFeeling?: 'No pain' | 'Familiar, settled' | 'Worse';
  workout?: { plan: WorkoutPlan; prescriptions: WorkoutPreset[]; sessions: Session[] };
}
export type SessionEvent =
  | { type: 'start'; now: number } | { type: 'prepare'; now: number }
  | { type: 'sample'; now: number; sample: ForceSample }
  | { type: 'tick'; now: number }
  | { type: 'stop'; now: number }
  | { type: 'interrupt'; now: number; reason: string }
  | { type: 'keep'; now: number; manualMeanKg?: number }
  | { type: 'restart' } | { type: 'redo'; set: number } | { type: 'mark-done'; set: number; now: number }
  | { type: 'retry' } | { type: 'skip-rest' } | { type: 'finish'; now: number }
  | { type: 'pause'; now: number } | { type: 'resume'; now: number } | { type: 'extend-rest'; seconds: number }
  | { type: 'complete-reps'; now: number; reps: number; addedLoadKg: number };
export const STALE_MS = 1500;
export function createSession(preset: WorkoutPreset, exercise: Exercise, source: MeasurementSource, now: number): Session {
  return { id: crypto.randomUUID(), startedAt: new Date(now).toISOString(), preset: structuredClone(preset), exercise: structuredClone(exercise), source, sets: [], attempts: [], phase: 'ready', currentSet: 1, trace: [] };
}
export function remainingSeconds(state: Session, now: number) {
  if (state.phase === 'preparing') return Math.max(0, Math.ceil(((state.readyUntil ?? now) - (state.pausedAt ?? now)) / 1000));
  if (state.phase === 'rest') return Math.max(0, Math.ceil(((state.restUntil ?? now) - (state.pausedAt ?? now)) / 1000));
  const p = state.preset.prescription;
  if (state.phase === 'ready') return p.kind === 'reps' ? 0 : workSeconds(p);
  return p.kind !== 'reps' ? Math.max(0, Math.ceil(workSeconds(p) - (state.holdStartedAt === undefined ? 0 : ((state.pausedAt ?? now) - state.holdStartedAt) / 1000))) : 0;
}
function endHold(state: Session, now: number, status: SetResult['status'], reason?: string): Session {
  const manual = state.source === 'manual';
  const durationSeconds = manual ? Math.max(0, ((state.pausedAt ?? now) - (state.holdStartedAt ?? now)) / 1000) : (state.trace.at(-1)?.seconds ?? 0);
  const candidate: SetResult = {
    set: state.currentSet, source: state.source, status, reason, trace: state.trace,
    durationSeconds: Math.min(durationSeconds, workSeconds(state.preset.prescription)),
    ...(state.preset.prescription.kind === 'paced' ? { addedLoadKg: state.preset.prescription.addedLoadKg, reps: Math.min(state.preset.prescription.reps, Math.floor(durationSeconds / (workSeconds(state.preset.prescription) / state.preset.prescription.reps))) } : {}),
    peakKg: state.trace.length ? Math.max(0, ...state.trace.map(point => point.kg)) : undefined,
    meanKg: state.trace.length ? state.trace.reduce((sum, point) => sum + point.kg, 0) / state.trace.length : undefined,
  };
  return { ...state, phase: 'result', candidate, attempts: [...state.attempts, candidate] };
}
function accept(state: Session, result: SetResult, now: number): Session {
  const sets = [...state.sets.filter(set => set.set !== result.set), result].sort((a,b) => a.set-b.set);
  return { ...state, sets, candidate: undefined, trace: [], phase: sets.length >= state.preset.prescription.sets ? 'review' : 'rest', restUntil: now + state.preset.prescription.restSeconds * 1000 };
}
export function sessionReducer(state: Session, event: SessionEvent): Session {
  const p = state.preset.prescription;
  switch (event.type) {
    case 'prepare': return state.phase === 'ready' && (p.kind === 'paced' || p.kind === 'timed') ? { ...state, phase: 'preparing', readyUntil: event.now + 3000 } : state;
    case 'start':
      return (state.phase === 'ready' || state.phase === 'preparing') && p.kind !== 'reps' ? { ...state, phase: 'holding', completedCycles: 0, pausedAt: undefined, awaitingReset: false, trace: [], candidate: undefined, requestedAt: event.now, holdStartedAt: state.source === 'manual' ? event.now : undefined, lastSampleAt: undefined, firstDeviceUs: undefined, lastDeviceUs: undefined } : state;
    case 'sample': {
      if (state.phase !== 'holding' || state.source === 'manual' || !Number.isFinite(event.sample.kg)) return state;
      if (event.now - (state.lastSampleAt ?? state.requestedAt!) >= STALE_MS) return endHold(state, event.now, 'interrupted', 'Force samples stopped. Reconnect or tare, then retry.');
      if (state.lastDeviceUs !== undefined) {
        const delta = (event.sample.deviceTimeUs - state.lastDeviceUs) >>> 0;
        if (delta === 0 || delta > 0x80000000) return state;
        if (delta >= STALE_MS * 1000) return endHold(state, event.now, 'interrupted', 'Gap in recorded force samples. Tare and retry.');
      }
      const first = state.firstDeviceUs ?? event.sample.deviceTimeUs;
      const seconds = ((event.sample.deviceTimeUs - first) >>> 0) / 1_000_000;
      if (p.kind !== 'hold') return state;
      const next = { ...state, holdStartedAt: state.holdStartedAt ?? event.now, lastSampleAt: event.now, firstDeviceUs: first, lastDeviceUs: event.sample.deviceTimeUs, trace: [...state.trace, { seconds: Math.min(seconds, p.holdSeconds), kg: event.sample.kg }] };
      return seconds >= p.holdSeconds ? endHold(next, event.now, 'completed') : next;
    }
    case 'tick':
      if (state.pausedAt !== undefined) return state;
      if (state.phase === 'preparing' && event.now >= state.readyUntil!) return sessionReducer(state, { type: 'start', now: event.now });
      if (state.phase === 'rest' && !(p.kind === 'timed' && p.selfPacedRest) && event.now >= state.restUntil!) {
        const ready = sessionReducer(state, { type: 'skip-rest' });
        return p.kind === 'timed' || p.kind === 'paced' ? sessionReducer(ready, { type: 'prepare', now: event.now }) : ready;
      }
      if (state.phase !== 'holding' || state.pausedAt !== undefined) return state;
      if (state.source !== 'manual' && event.now - (state.lastSampleAt ?? state.requestedAt!) >= STALE_MS) return endHold(state, event.now, 'interrupted', 'Force samples stopped. Reconnect or tare, then retry.');
      if (state.source === 'manual' && p.kind === 'paced' && p.manualReset) {
        const cycleMs = workSeconds(p) / p.reps * 1000;
        const completed = state.completedCycles ?? 0;
        const boundary = state.holdStartedAt! + (completed + 1) * cycleMs;
        if (completed < p.reps - 1 && event.now >= boundary) return { ...state, completedCycles: completed + 1, pausedAt: boundary, awaitingReset: true };
      }
      if (state.source === 'manual' && remainingSeconds(state, event.now) === 0) {
        const ended = endHold(state, event.now, 'completed');
        return p.kind === 'timed' || p.kind === 'paced' ? accept(ended, ended.candidate!, event.now) : ended;
      }
      return state;
    case 'stop': return state.phase === 'holding' ? endHold(state, state.pausedAt ?? event.now, 'stopped') : state;
    case 'interrupt': return state.phase === 'holding' ? endHold(state, event.now, 'interrupted', event.reason) : state.phase === 'preparing' ? { ...state, phase: 'ready', readyUntil: undefined } : state;
    case 'keep': {
      const result = state.candidate;
      if (state.phase !== 'result' || !result || result.status === 'interrupted' || !result.durationSeconds) return state;
      if (p.kind === 'paced' && !result.reps) return state;
      if (p.kind === 'hold' && state.source === 'manual' && (!Number.isFinite(event.manualMeanKg) || event.manualMeanKg! < 0)) return state;
      return accept(state, { ...result, meanKg: state.source === 'manual' ? event.manualMeanKg : result.meanKg, ...(p.kind === 'hold' && p.mode === 'max' && state.source === 'manual' ? { peakKg: event.manualMeanKg } : {}) }, event.now);
    }
    case 'retry': return state.phase === 'result' ? sessionReducer(state, { type: 'restart' }) : state;
    case 'pause': return ['holding', 'preparing', 'rest'].includes(state.phase) && (state.source === 'manual' || state.phase !== 'holding') && state.pausedAt === undefined ? { ...state, pausedAt: event.now } : state;
    case 'resume': {
      if (state.pausedAt === undefined) return state;
      const delta = event.now - state.pausedAt;
      return { ...state, holdStartedAt: state.holdStartedAt === undefined ? undefined : state.holdStartedAt + delta, readyUntil: state.readyUntil === undefined ? undefined : state.readyUntil + delta, restUntil: state.restUntil === undefined ? undefined : state.restUntil + delta, pausedAt: undefined, awaitingReset: false };
    }
    case 'restart': return { ...state, phase: 'ready', trace: [], candidate: undefined, pausedAt: undefined, awaitingReset: false, readyUntil: undefined, holdStartedAt: undefined, requestedAt: undefined };
    case 'redo': return Number.isInteger(event.set) && event.set > 0 && event.set <= p.sets ? { ...sessionReducer(state, { type: 'restart' }), currentSet: event.set, sets: state.sets.filter(set => set.set !== event.set) } : state;
    case 'mark-done': {
      if (p.kind !== 'timed' || state.source !== 'manual' || !Number.isInteger(event.set) || event.set < 1 || event.set > p.sets) return state;
      return accept({ ...state, currentSet: event.set, pausedAt: undefined }, { set: event.set, source: 'manual', durationSeconds: p.holdSeconds, trace: [], status: 'completed' }, event.now);
    }
    case 'extend-rest': return state.phase === 'rest' && Number.isFinite(event.seconds) && event.seconds > 0 ? { ...state, restUntil: state.restUntil! + event.seconds * 1000 } : state;
    case 'skip-rest': return state.phase === 'rest' ? { ...state, phase: 'ready', currentSet: Array.from({ length: p.sets }, (_,i) => i+1).find(set => !state.sets.some(result => result.set === set)) ?? p.sets, trace: [], restUntil: undefined, pausedAt: undefined } : state;
    case 'complete-reps':
      return state.phase === 'ready' && p.kind === 'reps' && Number.isInteger(event.reps) && event.reps >= 0 && Number.isFinite(event.addedLoadKg) && event.addedLoadKg >= 0 ? accept(state, { set: state.currentSet, source: 'manual', reps: event.reps, addedLoadKg: event.addedLoadKg, trace: [], status: 'completed' }, event.now) : state;
    case 'finish': {
      const next = state.phase === 'holding' ? endHold(state, event.now, 'interrupted', 'Session finished during a hold.') : state;
      return { ...next, phase: 'review' };
    }
  }
}
