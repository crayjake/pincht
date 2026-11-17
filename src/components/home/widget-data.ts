import { addDays, bookPage, checkIn, daysBetween, freeStreak, realSessions, sessionDate, weekStart, type RoutineData } from '../../routines/data';
import { allRoutines, routineCount, routineDone, routineDue } from '../../routines/tasks';
import { asleepMinutes, localDate, type Day, type JournalRecord, type RehabLoad } from './journal-data';
import type { Session } from '../../workouts/session';

export function strengthMeasurements(days: Day[], loads: RehabLoad[]) {
  // A direct log replaces the workout-derived measurement for that day.
  return [...new Map([...loads, ...days.flatMap(day => day.measurements?.fingerStrengthKg !== undefined ? [{ date: day.date, kg: day.measurements.fingerStrengthKg, edgeMm: 20 }] : [])].map(load => [load.date, load])).values()].sort((a,b) => a.date.localeCompare(b.date));
}
export const fontGrades = ['3','4','4+','5','5+','6A','6A+','6B','6B+','6C','6C+','7A','7A+','7B','7B+','7C','7C+','8A','8A+','8B','8B+','8C','8C+','9A'];
export function gradeRank(grade: string) {
  const value = grade.trim().toUpperCase();
  if (/^V\d+$/.test(value)) return Number(value.slice(1));
  return fontGrades.indexOf(value);
}
export function widgetData(days: Day[], data: RoutineData, inputSessions: Session[], today = localDate()) {
  const past = days.filter(day => day.date <= today);
  const sessions = [...new Map(realSessions(inputSessions).filter(session => sessionDate(session) <= today).map(session => [session.id, session])).values()];
  const dates = daysBetween(addDays(today, -6), today);
  const start = weekStart(today);
  const weekDates = daysBetween(start, addDays(start, 6));
  const logged = past.flatMap(day => day.records.filter(record => record.kind === 'climb' && record.climb && record.climb.goes > 0).map(record => ({ date: day.date, record })));
  const sends = logged.filter(item => item.record.climb?.sendGo);
  // Compare within the most recently logged grading system, without converting grades.
  const graded = sends.filter(item => gradeRank(item.record.metric) >= 0).sort((a,b) => b.date.localeCompare(a.date));
  const usesV = graded[0]?.record.metric.trim().toUpperCase().startsWith('V');
  const hardest = graded.filter(item => item.record.metric.trim().toUpperCase().startsWith('V') === usesV).sort((a,b) => gradeRank(b.record.metric) - gradeRank(a.record.metric) || b.date.localeCompare(a.date))[0];
  const projects = [...new Map(logged.map(item => [item.record.id, item.record])).values()].filter(record => !sends.some(item => item.record.id === record.id)).map(record => ({ record, goes: logged.filter(item => item.record.id === record.id).reduce((sum,item) => sum + item.record.climb!.goes,0) })).sort((a,b) => b.goes-a.goes);
  const sleep = past.flatMap(day => {
    const night = day.records.find(record => record.sleep)?.sleep;
    const minutes = day.metrics.sleep ?? (night ? asleepMinutes(night) : undefined);
    return minutes === undefined ? [] : [{ date: day.date, value: minutes }];
  }).sort((a,b) => a.date.localeCompare(b.date)).slice(-7);
  const weights = past.filter(day => day.metrics.weight !== undefined).sort((a,b) => a.date.localeCompare(b.date)).map(day => ({date:day.date,value:day.metrics.weight!}));
  const alcohol = data.routines.find(routine => routine.kind === 'alcohol' && routine.active);
  const train = data.routines.find(routine => routine.kind === 'training' && routine.active);
  const book = data.books.find(book => book.id === data.currentBookId);
  const page = book ? bookPage(data, book.id, addDays(today,1)) : 0;
  const readingLogs = book ? data.checkIns.filter(log => log.bookId === book.id && log.status === 'done' && log.page !== undefined && log.date <= today).sort((a,b) => a.date.localeCompare(b.date)) : [];
  const recentReading = readingLogs.filter(log => log.date >= addDays(today,-6));
  const firstReading = recentReading[0];
  const baseline = book && firstReading ? bookPage(data,book.id,firstReading.date) : page;
  const rate = firstReading ? (page-baseline) / daysBetween(firstReading.date,today).length : 0;
  let best = 0, run = 0;
  if (alcohol) for (const date of daysBetween(alcohol.start,today)) {
    if (!routineDue(alcohol,data,sessions,date)) continue;
    const log = checkIn(data,alcohol.id,date);
    run = log?.status === 'done' && log.drinks === 0 ? run + 1 : 0; best = Math.max(best,run);
  }
  const drinkLogs = alcohol ? data.checkIns.filter(log => log.routineId === alcohol.id && log.date >= start && log.date <= today && log.status === 'done') : [];
  const unlogged = alcohol ? weekDates.filter(date => date <= today && routineDue(alcohol,data,sessions,date) && !checkIn(data,alcohol.id,date)).length : 0;
  const pullups = sessions.flatMap(workout => {
    const exercises = (workout.workout?.sessions ?? [workout]).filter(session => /pull.?up/i.test(session.exercise.name));
    return exercises.length && sessionDate(workout) >= start ? [{date:sessionDate(workout), value:exercises.reduce((sum,session) => sum + session.sets.reduce((sum,set) => sum + (set.reps ?? 0),0),0), rpe:workout.rpe}] : [];
  }).sort((a,b) => a.date.localeCompare(b.date));
  const activity = (date: string) => {
    const day = past.find(day => day.date === date);
    const categories = new Set<string>(day?.records.filter(record => ['climb','training','rehab'].includes(record.kind) && !record.id.startsWith('workout-') && !record.id.startsWith('measurement-') && (record.kind !== 'climb' || (record.climb?.goes ?? 0) > 0)).map(record => record.kind));
    for (const session of sessions.filter(session => sessionDate(session) === date)) for (const exercise of session.workout?.sessions ?? [session]) categories.add(exercise.exercise.category);
    return [...categories];
  };
  const counts = (date: string) => {
    const result = { training: 0, climb: 0, rehab: 0 };
    const end = addDays(date,6);
    for (const session of sessions.filter(session => sessionDate(session) >= date && sessionDate(session) <= end)) {
      const categories = new Set((session.workout?.sessions ?? [session]).map(exercise => exercise.exercise.category));
      for (const category of categories) result[category]++;
    }
    for (const day of past.filter(day => day.date >= date && day.date <= end)) {
      if (day.records.some(record => record.kind === 'climb' && (record.climb?.goes ?? 0) > 0)) result.climb++;
      for (const category of ['training','rehab'] as const) if (!sessions.some(session => sessionDate(session) === day.date && (session.workout?.sessions ?? [session]).some(exercise => exercise.exercise.category === category)) && day.records.some(record => record.kind === category && !record.id.startsWith('workout-') && !record.id.startsWith('measurement-'))) result[category]++;
    }
    return result;
  };
  const habits = allRoutines(data).filter(routine => routine.active);
  const habitState = (id: string,date: string) => {
    const routine = habits.find(routine => routine.id === id)!;
    if (date < routine.start || date > today) return 'rest';
    const log = checkIn(data,id,date);
    if (log?.status === 'skipped') return 'rest';
    if (routine.kind === 'alcohol' && log?.status === 'done') return log.drinks === 0 ? 'done' : 'missed';
    if (routineDone(routine,data,sessions,date)) return 'done';
    return routineDue(routine,data,sessions,date) ? date === today ? 'due' : 'unlogged' : 'rest';
  };
  return {dates,weekDates,start,sessions,sends,hardest,projects,sleep,weights,alcohol,train,book,page,rate,best,streak:alcohol?freeStreak(data,alcohol,today):0,drinks:drinkLogs.reduce((sum,log)=>sum+(log.drinks??0),0),unlogged,pullups,activity,counts,habits,habitState,trainCount:train?routineCount(train,data,sessions,today):0};
}
export function strengthGoal(resources: JournalRecord[], goalId?: string) {
  return resources.find(record => record.id === goalId && record.goal?.metric === 'finger-strength');
}
