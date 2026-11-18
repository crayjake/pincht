import { readStoredStrict, type Validator } from './storage';

export interface StoredChange<T = any> { key: string; value: T; fallback: T; valid: Validator<T> }
/** All values are checked before writing; a failed multi-store save restores its previous values. */
export function commitStored(changes: StoredChange[], store: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> = localStorage) {
  const before = changes.map(change => {
    readStoredStrict(change.key, change.fallback, change.valid, store);
    if (!change.valid(change.value)) throw new Error('The changes contain invalid data.');
    return store.getItem(change.key);
  });
  let written = 0;
  try {
    for (const change of changes) { store.setItem(change.key, JSON.stringify(change.value)); written++; }
  } catch (error) {
    for (let i = written - 1; i >= 0; i--) {
      if (before[i] === null) store.removeItem(changes[i].key); else store.setItem(changes[i].key, before[i]!);
    }
    throw error;
  }
}
