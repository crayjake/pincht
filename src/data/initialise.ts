import { JOURNAL_KEY } from '../components/home/journal-storage.ts';
import { ROUTINES_KEY } from '../routines/data.ts';
import { SESSION_KEY } from '../workouts/storage.ts';
import { createDemoData } from './demo.ts';
import { DATA_MODE_KEY, dataKey, getDataMode, type DataMode, type DataStore } from './mode.ts';

export function prepareDataMode(mode: DataMode, store: DataStore = localStorage, today?: string) {
  if (mode !== 'demo') return;
  const values = createDemoData(today);
  for (const [key, value] of [[JOURNAL_KEY, values.days], [ROUTINES_KEY, values.routines], [SESSION_KEY, values.sessions]] as const) {
    const keyForMode = dataKey(key, store, mode);
    if (store.getItem(keyForMode) === null) store.setItem(keyForMode, JSON.stringify(value));
  }
}

export function selectDataMode(mode: DataMode, store: DataStore = localStorage) {
  prepareDataMode(mode, store);
  store.setItem(DATA_MODE_KEY, mode);
}

export function initialiseDataMode(store: DataStore = localStorage) {
  // Start this UI-testing build in demo mode; remember subsequent choices.
  const mode = store.getItem(DATA_MODE_KEY) === null ? 'demo' : getDataMode(store);
  prepareDataMode(mode, store);
  store.setItem(DATA_MODE_KEY, mode);
}
