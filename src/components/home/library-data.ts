import { loadWorkoutPlans } from '../../workouts/catalog';
import { loadSessions } from '../../workouts/storage';
import { entryRecords, type Day, type JournalRecord, type PillResource } from './journal-data';
import { loadDays, loadResources } from './journal-storage';
import type { RoutineData } from '../../routines/data';
import { planCategory } from '../../workouts/fixtures';
import { directDragSeriesId } from '../../workouts/measurements';
import { projectGoalProgress } from '../../goals/progress';
import { isClimbResource } from '../../climbs/data';

export type LibraryCategory = 'climbs' | 'workouts' | 'books' | 'goals' | 'routines' | 'views';
export const libraryCategories: LibraryCategory[] = ['climbs', 'workouts', 'books', 'goals', 'routines', 'views'];
export const categoryName = (category: string) => category[0].toUpperCase() + category.slice(1);
export function recordHref(record: PillResource, seriesId = directDragSeriesId): string {
  const id = encodeURIComponent(record.id);
  if (record.id.startsWith('measurement-finger-')) return `#/library/metrics/rehab?series=${encodeURIComponent(seriesId)}`;
  if (record.kind === 'sleep') return '#/library/metrics/sleep';
  if (record.kind === 'chart') return `#/library/metrics/${record.category}`;
  if (record.id.startsWith('plan-')) return `#/library/workouts/${id}`;
  if (record.id.startsWith('book-')) return `#/library/books/${id}`;
  if (record.id.startsWith('routine-')) {
    const routineId = record.id.slice(8, -11);
    return `#/library/routines/${encodeURIComponent(routineId)}`;
  }
  if (record.id.startsWith('workout-')) {
    const session = loadSessions().find(s => `workout-${s.id}` === record.id);
    const planId = session?.workout?.plan.id ?? session?.preset.id;
    if (planId && loadWorkoutPlans().some(plan => plan.id === planId)) return `#/library/workouts/plan-${encodeURIComponent(planId)}`;
  }
  return `#/library/${record.kind === 'climb' ? 'climbs' : record.kind === 'goal' ? 'goals' : record.kind === 'habit' ? 'books' : 'workouts'}/${id}`;
}
export function libraryResources(data: RoutineData): JournalRecord[] {
  const records = new Map([...loadDays().flatMap(day => day.records), ...loadResources()].filter(record => !record.id.startsWith('routine-') && (record.kind !== 'climb' || isClimbResource(record))).map(record => [record.id, record]));
  for (const plan of loadWorkoutPlans()) records.set(`plan-${plan.id}`, { id: `plan-${plan.id}`, title: plan.name, kind: planCategory(plan), metric: 'Workout', meta: plan.description });
  for (const book of data.books) records.set(`book-${book.id}`, { id: `book-${book.id}`, title: book.title, kind: 'habit', metric: 'Book', meta: book.author });
  return projectGoalProgress([...records.values()], loadDays());
}
export function recordHistory(record: JournalRecord, days: Day[], resources: JournalRecord[]) {
  const planId = record.id.startsWith('plan-') ? record.id.slice(5) : undefined;
  const sessionIds = planId ? new Set(loadSessions().filter(session => (session.workout?.plan.id ?? session.preset.id) === planId).map(session => `workout-${session.id}`)) : undefined;
  return days.flatMap(day => entryRecords(day, resources).filter(r => r.id === record.id || sessionIds?.has(r.id)).map(r => ({ date: day.date, record: r, logged: day.records.some(log => log.id === r.id) })));
}
