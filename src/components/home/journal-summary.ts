import { checkIn, type RoutineData } from '../../routines/data.ts';
import { duration, type Category, type Day } from './journal-data.ts';

export type SummaryCategory = Category | 'weight';
export interface SummaryItem { id: string; category: SummaryCategory; label: string }

// Summary pills are derived from logged activity, never manual day types.
export function daySummary(day: Day, data: RoutineData): SummaryItem[] {
  const items: SummaryItem[] = [];
  for (const category of new Set(day.records.filter(record => record.kind !== 'habit').map(record => record.kind))) {
    const sleep = day.records.find(record => record.kind === 'sleep');
    items.push({ id: category, category, label: category === 'sleep'
      ? `sleep ${day.metrics.sleep !== undefined ? duration(day.metrics.sleep, true) : sleep!.metric}`
      : category });
  }
  if (day.metrics.sleep !== undefined && !items.some(item => item.category === 'sleep')) {
    items.push({ id: 'sleep', category: 'sleep', label: `sleep ${duration(day.metrics.sleep, true)}` });
  }
  for (const routine of data.routines) {
    const value = checkIn(data, routine.id, day.date);
    if (value?.status !== 'done') continue;
    if (routine.kind === 'reading' || routine.kind === 'alcohol') {
      items.push({ id: routine.id, category: 'habit', label: routine.kind === 'reading'
        ? `read${value.minutes !== undefined ? ` ${value.minutes} min` : ''}`
        : value.drinks === 0 ? 'alcohol-free' : `${value.drinks} drinks` });
    } else if (!items.some(item => item.category === routine.kind)) {
      items.push({ id: routine.kind, category: routine.kind, label: routine.kind });
    }
  }
  if (day.metrics.weight !== undefined) {
    items.push({ id: 'weight', category: 'weight', label: `${day.metrics.weight.toFixed(1)} kg` });
  }
  return items;
}
