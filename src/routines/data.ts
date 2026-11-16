import { dateValue, localDate, shortDate, type Day, type JournalRecord } from '../components/home/journal-data.ts';
import type { Session } from '../workouts/session.ts';

export type RoutineKind = 'reading' | 'alcohol' | 'training' | 'rehab';
// Workout plans assigned to each routine, alongside the editable workout fixtures.
export const routineWorkoutPlanIds: Record<string, readonly string[]> = {
  train: ['pull-ups-3x5', 'mobility'],
};
export interface Routine {
  id: string; name: string; kind: RoutineKind; active: boolean; start: string;
  schedule: 'daily' | 'interval' | 'weekly'; interval: number; target: number;
}
export interface Book { id: string; title: string; author: string; pages: number; initialPage: number }
export interface CheckIn {
  routineId: string; date: string; status: 'done' | 'skipped'; reason?: string;
  minutes?: number; bookId?: string; page?: number; drinks?: number;
}
export interface RoutineData {
  routines: Routine[]; books: Book[]; currentBookId: string; checkIns: CheckIn[]; lastVisit: string;
  widgets: { rehab: boolean; sleep: boolean };
}
export const ROUTINES_KEY = 'pincht.routines';
export function addDays(date: string, count: number) {
  const value = dateValue(date); value.setUTCDate(value.getUTCDate() + count); return value.toISOString().slice(0, 10);
}
export function weekStart(date: string) { return addDays(date, -(dateValue(date).getUTCDay() + 6) % 7); }
export function scheduled(routine: Routine, date: string) {
  if (!routine.active || date < routine.start || routine.schedule === 'weekly') return false;
  return routine.schedule === 'daily' || Math.round((dateValue(date).getTime() - dateValue(routine.start).getTime()) / 86400000) % routine.interval === 0;
}
export function daysBetween(from: string, to: string) {
  const days: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) days.push(date);
  return days;
}
export function seedRoutines(today = localDate()): RoutineData {
  const checkIns: CheckIn[] = [];
  for (const date of daysBetween('2026-11-02', '2026-11-15')) {
    checkIns.push({ routineId: 'alcohol', date, status: 'done', drinks: 0 });
    if (!['2026-11-12', '2026-11-15'].includes(date)) checkIns.push({ routineId: 'read', date,
      status: date === '2026-11-10' ? 'skipped' : 'done',
      ...(date === '2026-11-10' ? { reason: 'travelling' } : { minutes: 20, bookId: 'piranesi' }) });
  }
  return {
    routines: [
      { id: 'read', name: 'Read', kind: 'reading', active: true, start: '2026-11-02', schedule: 'daily', interval: 1, target: 20 },
      { id: 'alcohol', name: 'Alcohol-free day', kind: 'alcohol', active: true, start: '2026-11-02', schedule: 'daily', interval: 1, target: 3 },
      { id: 'train', name: 'Train', kind: 'training', active: true, start: '2026-11-02', schedule: 'weekly', interval: 1, target: 3 },
      { id: 'rehab', name: 'Finger rehab', kind: 'rehab', active: true, start: '2026-11-03', schedule: 'interval', interval: 2, target: 1 },
    ], books: [{ id: 'piranesi', title: 'Piranesi', author: 'Susanna Clarke', pages: 272, initialPage: 112 }],
    currentBookId: 'piranesi', checkIns, lastVisit: today, widgets: { rehab: true, sleep: true },
  };
}
export function checkIn(data: RoutineData, routineId: string, date: string) { return data.checkIns.find(c => c.routineId === routineId && c.date === date); }
export function putCheckIn(data: RoutineData, value: CheckIn): RoutineData {
  const routine = data.routines.find(r => r.id === value.routineId);
  if (!routine || !scheduled(routine, value.date)) throw new Error('This routine is not scheduled for that day.');
  if (value.date > localDate()) throw new Error('Choose today or an earlier day.');
  if (value.status === 'done' && routine.kind === 'reading') {
    const book = data.books.find(b => b.id === value.bookId);
    if (!book || !Number.isInteger(value.minutes) || value.minutes! < 1 || (value.page !== undefined && (!Number.isInteger(value.page) || value.page < 0 || value.page > book.pages))) throw new Error('Check the book, reading time, and page number.');
  }
  if (value.status === 'done' && routine.kind === 'alcohol' && (!Number.isInteger(value.drinks) || value.drinks! < 0)) throw new Error('Enter a whole number of drinks, zero or more.');
  return { ...data, checkIns: [...data.checkIns.filter(c => c.routineId !== value.routineId || c.date !== value.date), value] };
}
export function bookPage(data: RoutineData, bookId: string, before?: string) {
  const book = data.books.find(b => b.id === bookId);
  return Math.max(book?.initialPage ?? 0, ...data.checkIns.filter(c => c.status === 'done' && c.bookId === bookId && (!before || c.date < before)).map(c => c.page ?? 0));
}
export function unlogged(data: RoutineData, from: string, through: string) {
  return daysBetween(from, through).flatMap(date => data.routines.flatMap(routine =>
    routine.kind !== 'rehab' && scheduled(routine, date) && !checkIn(data, routine.id, date) ? [{ routine, date }] : []));
}
export function weeklyDrinks(data: RoutineData, date: string) {
  const from = weekStart(date), to = addDays(from, 6);
  return data.checkIns.filter(c => c.date >= from && c.date <= to && c.status === 'done').reduce((sum, c) => sum + (c.drinks ?? 0), 0);
}
export function freeStreak(data: RoutineData, routine: Routine, date: string) {
  let count = 0;
  for (let day = checkIn(data, routine.id, date) ? date : addDays(date, -1); day >= routine.start; day = addDays(day, -1)) {
    if (!scheduled(routine, day)) continue;
    const c = checkIn(data, routine.id, day);
    if (c?.status !== 'done' || c.drinks !== 0) break;
    count++;
  }
  return count;
}
export function realSessions(sessions: Session[]) { return sessions.filter(s => s.finishedAt && s.source !== 'simulator' && s.sets.length && !s.sets.some(set => set.source === 'simulator')); }
export function sessionDate(session: Session) {
  const d = new Date(session.startedAt);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function weeklyWorkouts(sessions: Session[], date: string) {
  const from = weekStart(date), to = addDays(from, 6);
  return new Set(realSessions(sessions).filter(s => sessionDate(s) >= from && sessionDate(s) <= to).map(s => s.id)).size;
}
export function rehabDone(sessions: Session[], date: string) {
  return realSessions(sessions).some(s => sessionDate(s) === date && (s.exercise.category === 'rehab' || s.workout?.sessions.some(ex => ex.exercise.category === 'rehab')));
}
export function adherence(data: RoutineData, dates: string[]) {
  return data.routines.filter(r => r.active && ['reading', 'alcohol'].includes(r.kind)).map(r => {
    const due = dates.filter(date => scheduled(r, date));
    const done = due.filter(date => { const c = checkIn(data, r.id, date); return c?.status === 'done' && (r.kind !== 'alcohol' || c.drinks === 0); }).length;
    return `${r.kind === 'reading' ? 'read' : 'alcohol-free'} ${done}/${due.length}`;
  }).join(' · ');
}
export function routineRecords(data: RoutineData, date: string): JournalRecord[] {
  return data.checkIns.filter(c => c.date === date && c.status === 'done').map(c => {
    const routine = data.routines.find(r => r.id === c.routineId)!;
    const book = data.books.find(b => b.id === c.bookId);
    return { id: `routine-${c.routineId}-${date}`, kind: 'habit', title: book?.title ?? routine.name,
      metric: routine.kind === 'reading' ? `${c.minutes} min` : c.drinks === 0 ? 'alcohol-free' : `${c.drinks} drinks`,
      meta: routine.kind === 'reading' ? [book?.author, c.page !== undefined ? `p.${c.page} / ${book?.pages}` : ''].filter(Boolean).join(' · ') : `Week of ${shortDate(weekStart(date), { day: 'numeric', month: 'short' })}`, note: c.reason };
  });
}
export function withRoutineDays(days: Day[], data: RoutineData, today: string) {
  const byDate = new Map(days.map(day => [day.date, { ...day, records: day.records.filter(r => !r.id.startsWith('routine-')) }]));
  const active = data.routines.filter(r => r.active && ['reading', 'alcohol'].includes(r.kind));
  if (active.length) for (const date of daysBetween(active.map(r => r.start).sort()[0], addDays(today, -1))) {
    if (active.some(r => scheduled(r, date)) && !byDate.has(date)) byDate.set(date, { date, types: [], records: [], visibleMetrics: [], metrics: {} });
  }
  for (const date of new Set(data.checkIns.map(c => c.date))) {
    let day = byDate.get(date);
    if (!day) { day = { date, types: [], records: [], visibleMetrics: [], metrics: {} }; byDate.set(date, day); }
    day.records = [...day.records, ...routineRecords(data, date)];
  }
  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date));
}
