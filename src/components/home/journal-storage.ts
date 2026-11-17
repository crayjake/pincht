import type { Day, JournalRecord } from './journal-data';
import { mergeWorkoutDays } from '../../workouts/storage';
import { dataKey } from '../../data/mode.ts';
export const JOURNAL_KEY = 'pincht.journal.live';
export const JOURNAL_RESOURCES_KEY = 'pincht.journal.resources';
export function loadResources(key = dataKey(JOURNAL_RESOURCES_KEY)): JournalRecord[] {
  const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]');
  if (Array.isArray(saved) && saved.every(record => record && typeof record.id === 'string' && typeof record.title === 'string' && ['climb', 'training', 'rehab', 'goal', 'habit', 'sleep'].includes(record.kind))) return saved;
  throw new Error('Journal data could not be read. Stored data has not been replaced.');
}
export function saveResources(records: JournalRecord[], key = dataKey(JOURNAL_RESOURCES_KEY)) {
  loadResources(key);
  localStorage.setItem(key, JSON.stringify(records));
}
function readDays(key: string): Day[] {
  const saved: unknown = JSON.parse(localStorage.getItem(key) || '[]');
  if (Array.isArray(saved) && saved.every(day => day && typeof day.date === 'string' && Array.isArray(day.types) && Array.isArray(day.records) && Array.isArray(day.visibleMetrics) && day.metrics && (!day.entry || (typeof day.entry.title === 'string' && day.entry.body?.type === 'doc' && Array.isArray(day.entry.body.content))))) return saved;
  throw new Error('Journal data could not be read. Stored data has not been replaced.');
}
export function loadDays(key = dataKey(JOURNAL_KEY)): Day[] {
  try {
    return mergeWorkoutDays(readDays(key));
  } catch { /* No sample records are substituted for missing or unreadable data. */ }
  return mergeWorkoutDays([]);
}
export function saveDays(days: Day[], key = dataKey(JOURNAL_KEY)) {
  // Never replace unreadable writing with the empty display fallback.
  try { readDays(key); }
  catch { throw new Error('Journal data could not be read. Stored data has not been replaced.'); }
  localStorage.setItem(key, JSON.stringify(days));
}
