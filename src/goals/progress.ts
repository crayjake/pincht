import { localDate, type Day, type JournalRecord } from '../components/home/journal-data';

/** A reference is not a send. Always derive checklist state from the actual dated logs. */
export function climbGoalProgress(goal: JournalRecord, days: Day[], through = localDate()) {
  const ids = [...new Set(goal.climbGoal?.climbIds ?? [])];
  const sends = new Map<string, string>();
  for (const day of days.filter(day => day.date <= through).sort((a,b) => a.date.localeCompare(b.date))) {
    for (const record of day.records) {
      if (record.kind === 'climb' && record.climb?.sendGo && !sends.has(record.id)) sends.set(record.id, day.date);
    }
  }
  return { completed: ids.filter(id => sends.has(id)).length, total: ids.length,
    climbs: ids.map(id => ({ id, sent: sends.has(id), sentAt: sends.get(id) })) };
}
export function projectGoalProgress(records: JournalRecord[], days: Day[]): JournalRecord[] {
  return records.map(record => {
    if (!record.climbGoal) return record;
    const { completed, total } = climbGoalProgress(record, days);
    return { ...record, progress: { completed, total } };
  });
}
