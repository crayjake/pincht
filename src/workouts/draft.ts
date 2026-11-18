import { dataKey } from '../data/mode';
import type { MeasurementSource, Session } from './session';
import { sessionReducer } from './session';
import type { WorkoutPlan, WorkoutPreset } from './fixtures';
import { readStored, writeStored } from '../data/storage';
import { isDraft } from '../data/validation';
export interface WorkoutFlowDraft {
  snapshot: { plan: WorkoutPlan; presets: WorkoutPreset[] }; workoutId: string; startedAt: string;
  source: MeasurementSource; sessions: Session[]; running: WorkoutPreset | null; review: Session | null; optional: string[]; skipped?: string[]; runningSession?: Session;
}
export interface WorkoutDraft { route: string; title: string; updatedAt: number; session?: Session; flow?: WorkoutFlowDraft }
export const KEY = 'pincht.workout-draft';
export function loadWorkoutDraft(): WorkoutDraft | null {
  return readStored(dataKey(KEY), null, isDraft);
}
export function saveWorkoutDraft(draft: Omit<WorkoutDraft, 'updatedAt'>) { writeStored(dataKey(KEY), { ...draft, updatedAt: Date.now() }, null, isDraft); }
export function clearWorkoutDraft() { localStorage.removeItem(dataKey(KEY)); }
export function restoredSession(session: Session, updatedAt: number): Session {
  let next = sessionReducer(session, { type: 'interrupt', now: session.pausedAt ?? Math.min(updatedAt, Date.now()), reason: 'Session left during this set. Retry the interrupted set.' });
  // Resume between sets without automatically starting a timed exercise.
  if (next.phase === 'rest') next = sessionReducer(next, { type: 'skip-rest' });
  return next;
}
