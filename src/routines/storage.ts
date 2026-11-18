import { dataKey, type DataStore } from '../data/mode.ts';
import { readStored, writeStored } from '../data/storage.ts';
import { isRoutineData } from '../data/validation.ts';
import { createRoutines, ROUTINES_KEY, type RoutineData } from './data.ts';

export function loadRoutines(store: DataStore = localStorage) {
  return readStored(dataKey(ROUTINES_KEY, store), createRoutines(), isRoutineData, store);
}
export function saveRoutines(data: RoutineData, store: DataStore = localStorage, key = dataKey(ROUTINES_KEY, store)) {
  writeStored(key, data, createRoutines(), isRoutineData, store);
}
