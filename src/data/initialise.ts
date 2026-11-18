import { JOURNAL_KEY } from '../components/home/journal-storage.ts';
import { ROUTINES_KEY } from '../routines/data.ts';
import { SESSION_KEY } from '../workouts/storage.ts';
import { createDemoData, refreshDemoClimbs } from './demo.ts';
import { DATA_MODE_KEY, dataKey, getDataMode, type DataMode, type DataStore } from './mode.ts';
import { clearStorageErrors } from './storage.ts';
import { isDays } from './validation.ts';

export function prepareDataMode(mode: DataMode, store: DataStore = localStorage, today?: string) {
  if (mode !== 'demo') return;
  const values = createDemoData(today);
  for (const [key, value] of [[JOURNAL_KEY, values.days], [ROUTINES_KEY, values.routines], [SESSION_KEY, values.sessions]] as const) {
    const keyForMode = dataKey(key, store, mode);
    if (store.getItem(keyForMode) === null) store.setItem(keyForMode, JSON.stringify(value));
  }
  const journalKey = dataKey(JOURNAL_KEY, store, mode);
  let days: unknown;
  try { days = JSON.parse(store.getItem(journalKey)!); }
  catch { return; } // Leave unreadable stored writing intact.
  if (!isDays(days)) return;
  const updated = refreshDemoClimbs(days);
  if (updated !== days) store.setItem(journalKey, JSON.stringify(updated));
}

export function selectDataMode(mode: DataMode, store: DataStore = localStorage) {
  prepareDataMode(mode, store);
  store.setItem(DATA_MODE_KEY, mode);
  clearStorageErrors();
}

export function initialiseDataMode(store: DataStore = localStorage) {
  // Start this UI-testing build in demo mode; remember subsequent choices.
  const mode = store.getItem(DATA_MODE_KEY) === null ? 'demo' : getDataMode(store);
  prepareDataMode(mode, store);
  store.setItem(DATA_MODE_KEY, mode);
}
