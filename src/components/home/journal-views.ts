import type { RoutineKind } from '../../routines/data';
import type { Category, Day } from './journal-data';

// The first preset view: the same days and tasks, scoped by existing categories.
// Keep its scope together so a later view editor can supply these choices.
export const climbingView = {
  categories: ['climb', 'rehab', 'training'] as readonly Category[],
  routineKinds: ['rehab', 'training'] as readonly RoutineKind[],
};
export function isClimbingDay(day: Day) {
  return day.records.some(record => climbingView.categories.includes(record.kind));
}
