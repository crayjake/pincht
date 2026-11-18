import type { Day, JournalRecord } from './journal-data';
import { mergeWorkoutDays } from '../../workouts/storage';
import { dataKey } from '../../data/mode.ts';
import { readStored, readStoredStrict, writeStored } from '../../data/storage.ts';
import { isDays, isResources } from '../../data/validation.ts';
export const JOURNAL_KEY = 'pincht.journal.live';
export const JOURNAL_RESOURCES_KEY = 'pincht.journal.resources';
export function loadResources(key = dataKey(JOURNAL_RESOURCES_KEY)): JournalRecord[] {
  return readStored(key, [], isResources);
}
export function saveResources(records: JournalRecord[], key = dataKey(JOURNAL_RESOURCES_KEY)) {
  writeStored(key, records, [], isResources);
}
function readDays(key: string): Day[] {
  return readStoredStrict(key, [], isDays);
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
  writeStored(key, days, [], isDays);
}
