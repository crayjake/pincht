import { loadWorkoutPlans } from '../workouts/catalog';
import { localDate, type Category } from '../components/home/journal-data';
import { loadRehab, rehabTasks, validDate } from '../rehab/data';
import type { Session } from '../workouts/session';
import { isWorkoutComplete } from '../workouts/completion';
import { planPresets } from '../workouts/fixtures';
import { addDays, realSessions, routineWorkoutPlanIds, scheduled, sessionDate, weekStart, type Routine, type RoutineData } from './data';

export type ViewTag = Category | 'reading';
export const viewTags: ViewTag[] = ['climb', 'rehab', 'training', 'goal', 'sleep', 'habit', 'reading'];
export const comparatorLabel = (routine: Routine) => ({ 'at-least': 'at least', exactly: 'exactly', 'at-most': 'at most' }[routine.comparator ?? 'at-least']);
export function routineTags(routine: Routine): ViewTag[] {
  return routine.tags ?? (routine.kind === 'reading' ? ['reading', 'habit'] : routine.kind === 'alcohol' ? ['habit'] : routine.kind === 'rehab' ? ['rehab'] : ['training']);
}
export function routinePlans(routine: Routine) { return routine.workoutPlanIds ?? [...(routineWorkoutPlanIds[routine.id] ?? [])]; }
export function allRoutines(data: RoutineData): Routine[] {
  const rehab = loadRehab();
  const defaults: Routine[] = [
    { id: 'pulley', name: 'Pulley rehab', kind: 'rehab', active: true, start: rehab.pulleyStart, schedule: 'daily', interval: 2, target: 2, workoutPlanIds: ['pulley-rehab'], planSchedule: 'pulley' },
    { id: 'wrist', name: 'Wrist rehab', kind: 'rehab', active: true, start: rehab.wristStart, schedule: 'weekly', interval: 1, target: 2, workoutPlanIds: ['wrist-rehab'], planSchedule: 'wrist' },
  ];
  return [...data.routines, ...defaults.filter(r => !data.routines.some(saved => saved.id === r.id))];
}
function matchingSessions(routine: Routine, sessions: Session[]) {
  const plans = routinePlans(routine);
  const catalog = loadWorkoutPlans();
  return [...new Map(realSessions(sessions).map(session => [session.id, session])).values()].filter(session => {
    if (sessionDate(session) < routine.start || !isWorkoutComplete(session)) return false;
    if (!plans.length) return (session.workout?.sessions ?? [session]).some(ex => ex.exercise.category === routine.kind);
    return plans.some(id => {
      if (session.workout) return session.workout.plan.id === id;
      const plan = catalog.find(plan => plan.id === id);
      if (!plan) return session.preset.id === id;
      if (plan.presetIds.length === 1) return plan.presetIds[0] === session.preset.id;
      const rehab = loadRehab();
      if (routine.planSchedule === 'pulley') rehab.pulleyStart = routine.start;
      if (routine.planSchedule === 'wrist') rehab.wristStart = routine.start;
      const available = planPresets(plan, rehab, sessionDate(session)).filter(p => !p.locked);
      const required = available.filter(p => !p.optional);
      return required.length === 1 ? required[0].id === session.preset.id : !required.length && available.some(p => p.id === session.preset.id);
    });
  });
}
export function completionDates(routine: Routine, data: RoutineData, sessions: Session[]) {
  return [...data.checkIns.filter(c => c.routineId === routine.id && c.status === 'done' && !['rehab', 'training'].includes(routine.kind)).map(c => c.date),
    ...(['rehab', 'training'].includes(routine.kind) ? matchingSessions(routine, sessions).map(sessionDate) : [])].sort();
}
export function routineCount(routine: Routine, data: RoutineData, sessions: Session[], date = localDate()) {
  const from = weekStart(date), to = addDays(from, 6);
  if (routine.count === 'drinks' || routine.kind === 'alcohol' && routine.schedule === 'weekly') return data.checkIns.filter(c => c.routineId === routine.id && c.status === 'done' && c.date >= from && c.date <= to).reduce((sum, c) => sum + (c.drinks ?? 0), 0);
  if (routine.kind === 'training' || routine.kind === 'rehab') return matchingSessions(routine, sessions).filter(s => sessionDate(s) >= from && sessionDate(s) <= to).length;
  return data.checkIns.filter(c => c.routineId === routine.id && c.status === 'done' && c.date >= from && c.date <= to).length;
}
export function routineDue(routine: Routine, data: RoutineData, sessions: Session[], date = localDate()) {
  if (!routine.active || !routine.start || date < routine.start || routine.schedule === 'weekly') return false;
  if (routine.planSchedule === 'pulley') return rehabTasks({ ...loadRehab(), pulleyStart: routine.start }, sessions, date).some(item => item.id === 'pulley');
  return scheduled(routine, date, completionDates(routine, data, sessions));
}
export function routineDone(routine: Routine, data: RoutineData, sessions: Session[], date = localDate()) {
  if (routine.planSchedule === 'pulley') return rehabTasks({ ...loadRehab(), pulleyStart: routine.start }, sessions, date).find(item => item.id === 'pulley')?.done ?? false;
  return completionDates(routine, data, sessions).includes(date);
}
export function routineLink(routine: Routine) { return `#/train/${routinePlans(routine)[0] ?? ''}`; }
export function saveRoutine(data: RoutineData, routine: Routine): RoutineData {
  if (!routine.name.trim()) throw new Error('Enter a routine name.');
  if (!validDate(routine.start)) throw new Error('Choose a start date.');
  if (!Number.isInteger(routine.target) || routine.target < 1 || !Number.isInteger(routine.interval) || routine.interval < 1) throw new Error('Use a positive whole number for the target and interval.');
  if (routine.schedule === 'daily' && routine.days?.length === 0) throw new Error('Choose at least one day.');
  return { ...data, routines: [...data.routines.filter(r => r.id !== routine.id), { ...routine, name: routine.name.trim() }] };
}
