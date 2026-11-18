import { isPreferences, PREFERENCES_KEY } from './preferences.ts';
import { DATA_MODE_KEY } from './mode.ts';
import { clearStorageErrors } from './storage.ts';
import { isDays, isDraft, isExercises, isPresets, isPlans, isResources, isRoutineData, isSessions, isViews } from './validation.ts';

type BackupStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const stores: Record<string, (value: unknown) => boolean> = {
  'pincht.journal.live': isDays,
  'pincht.journal.resources': isResources,
  'pincht.routines.live': isRoutineData,
  'pincht.workouts.v1': isSessions,
  'pincht.workout-simulations.v1': isSessions,
  'pincht.workout-plans': isPlans,
  'pincht.exercises': isExercises,
  'pincht.exercise-presets': isPresets,
  'pincht.deleted-workouts': value => Array.isArray(value) && value.every(item=>typeof item==='string'),
  'pincht.workout-draft': isDraft,
  'pincht.views': isViews,
};
const keys = [DATA_MODE_KEY, PREFERENCES_KEY, ...Object.keys(stores).flatMap(key => [key, `${key}.demo`])];
interface Backup { format: 'pincht.backup'; version: 1; values: Record<string, string | null> }

/** Raw values are exported even if damaged, so recovery never discards writing. */
export function exportBackup(store: Pick<Storage, 'getItem'> = localStorage): string {
  const backup: Backup = { format: 'pincht.backup', version: 1, values: Object.fromEntries(keys.map(key => [key, store.getItem(key)])) };
  return JSON.stringify(backup, null, 2);
}

/** Validate the entire backup before replacing anything. Includes both data modes. */
export function restoreBackup(json: string, store: BackupStore = localStorage) {
  const backup = JSON.parse(json) as Backup;
  if (!backup || backup.format !== 'pincht.backup' || backup.version !== 1 || !backup.values || typeof backup.values !== 'object'
    || Object.keys(backup.values).length !== keys.length || !keys.every(key => Object.hasOwn(backup.values, key))) throw new Error('This is not a complete pincht backup.');
  for (const key of keys) {
    const raw = backup.values[key];
    if (raw === null) continue;
    if (typeof raw !== 'string') throw new Error(`Invalid backup data: ${key}.`);
    if (key === DATA_MODE_KEY) {
      if (raw !== 'real' && raw !== 'demo') throw new Error('Invalid data mode.');
    } else if (key === PREFERENCES_KEY) {
      if (!isPreferences(JSON.parse(raw))) throw new Error('Invalid preferences.');
    } else if (!stores[key.replace(/\.demo$/, '')](JSON.parse(raw))) throw new Error(`Invalid backup data: ${key}.`);
  }
  const previous = new Map(keys.map(key => [key, store.getItem(key)]));
  const written: string[] = [];
  const put = (key: string, value: string | null) => value === null ? store.removeItem(key) : store.setItem(key, value);
  try {
    for (const key of keys) { put(key, backup.values[key]); written.push(key); }
  } catch {
    try { for (const key of written.reverse()) put(key, previous.get(key)!); }
    catch { throw new Error('Restore and rollback could not finish. Keep your backup before retrying.'); }
    throw new Error('Backup could not be restored. Previous data has been restored.');
  }
  clearStorageErrors();
}

/** One row per stored object, with structured fields retained in the data column. */
export function exportCSV(store: Pick<Storage, 'getItem'> = localStorage) {
  const rows: unknown[][] = [['store','collection','id','date','title','data']];
  const add=(key:string,collection:string,item:unknown)=>{ const value=item && typeof item==='object' ? item as Record<string,unknown> : {}; rows.push([key,collection,value.id??'',value.date??value.startedAt??'',value.title??value.name??'',JSON.stringify(item)]); };
  for (const key of keys) {
    const raw=store.getItem(key); if(raw===null) continue;
    let value:unknown; try { value=JSON.parse(raw); } catch { add(key,'raw',raw); continue; }
    if(Array.isArray(value)) value.forEach(item=>add(key,'items',item));
    else if(value && typeof value==='object') { for(const [collection,items] of Object.entries(value)) { if(Array.isArray(items)) items.forEach(item=>add(key,collection,item)); else add(key,collection,items); } }
    else add(key,'value',value);
  }
  return rows.map(row=>row.map(value=>`"${String(value??'').replaceAll('"','""')}"`).join(',')).join('\r\n');
}
