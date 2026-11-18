import { duration, localDate, type Day, type JournalRecord, type SleepNight } from '../components/home/journal-data';
import { loadDays, saveDays } from '../components/home/journal-storage';
import { validDate } from '../rehab/data';

export type DailyMeasurement = 'weight' | 'sleep' | 'finger' | 'climbingMinutes';
type SleepSegment = SleepNight['segments'][number];

/** Mutations use the same dated day records as quick logs. Controls are deferred. */
function changeDay(date: string, change: (day: Day) => void) {
  if (!validDate(date) || date > localDate()) throw new Error('Choose today or an earlier day.');
  const days = loadDays();
  const day: Day = structuredClone(days.find(day => day.date === date) ?? { date, types: [], records: [], metrics: {}, visibleMetrics: [] });
  change(day);
  saveDays([...days.filter(day => day.date !== date), day].sort((a, b) => b.date.localeCompare(a.date)));
  return day;
}

export function setDailyMeasurement(date: string, kind: DailyMeasurement, value: number, segments?: SleepSegment[]) {
  if (!Number.isFinite(value) || value <= 0 || (['sleep', 'climbingMinutes'].includes(kind) && !Number.isInteger(value))) throw new Error('Enter a positive measurement.');
  if (kind === 'sleep' && (value > 1440 || segments && (segments.some(segment => !Number.isInteger(segment.minutes) || segment.minutes < 0) || segments.filter(segment => segment.stage !== 'awake').reduce((sum, segment) => sum + segment.minutes, 0) !== value))) throw new Error('Sleep stages must match the sleep duration.');
  return changeDay(date, day => {
    if (kind === 'weight' || kind === 'sleep') {
      day.metrics[kind] = value;
      day.visibleMetrics = [...new Set([...day.visibleMetrics, kind])];
      if (kind === 'sleep') {
        const previous = day.records.find(record => record.sleep);
        day.records = day.records.filter(record => record.kind !== 'sleep');
        if (segments) day.records.push({ id: previous?.id ?? `sleep-${date}`, kind: 'sleep', title: 'Sleep', metric: duration(value), meta: 'Sleep stages', sleep: { date, segments: structuredClone(segments) } });
      }
    } else {
      day.measurements = { ...day.measurements, [kind === 'finger' ? 'fingerStrengthKg' : kind]: value };
      if (kind === 'finger') {
        const id = `measurement-finger-${date}`;
        day.records = [...day.records.filter(record => record.id !== id), { id, kind: 'rehab', title: '20 mm drag', metric: `${value} kg`, meta: 'Finger strength' }];
      }
    }
  });
}

export function deleteDailyMeasurement(date: string, kind: DailyMeasurement) {
  return changeDay(date, day => {
    if (kind === 'weight' || kind === 'sleep') {
      delete day.metrics[kind];
      day.visibleMetrics = day.visibleMetrics.filter(metric => metric !== kind);
      if (kind === 'sleep') day.records = day.records.filter(record => record.kind !== 'sleep');
    } else {
      if (day.measurements) delete day.measurements[kind === 'finger' ? 'fingerStrengthKg' : kind];
      if (kind === 'finger') day.records = day.records.filter(record => record.id !== `measurement-finger-${date}`);
    }
  });
}

function directRecord(id: string) {
  if (/^(workout-|routine-|measurement-finger-)/.test(id)) throw new Error('Update the underlying workout, check-in, or measurement.');
}
export function replaceDayRecord(date: string, record: JournalRecord) {
  directRecord(record.id);
  return changeDay(date, day => {
    const previous = day.records.find(item => item.id === record.id);
    if (!previous || previous.kind !== record.kind) throw new Error('Choose an existing record to update.');
    if (record.kind === 'sleep') throw new Error('Update sleep through its daily measurement.');
    day.records = day.records.map(item => item.id === record.id ? structuredClone(record) : item);
  });
}
export function deleteDayRecord(date: string, id: string) {
  if (id === `measurement-finger-${date}`) return deleteDailyMeasurement(date, 'finger');
  directRecord(id);
  return changeDay(date, day => {
    const previous = day.records.find(record => record.id === id);
    day.records = day.records.filter(record => record.id !== id);
    if (previous?.kind === 'sleep') {
      delete day.metrics.sleep;
      day.visibleMetrics = day.visibleMetrics.filter(metric => metric !== 'sleep');
    }
    if (previous && !day.records.some(record => record.kind === previous.kind)) day.types = day.types.filter(type => type !== previous.kind);
  });
}

export function deleteJournalEntry(date: string) {
  return changeDay(date, day => { delete day.entry; });
}
