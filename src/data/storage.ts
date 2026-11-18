export type ReadStore = Pick<Storage, 'getItem'>;
export type WriteStore = Pick<Storage, 'getItem' | 'setItem'>;
export type Validator<T> = (value: unknown) => value is T;

const problems = new Map<string, string>();
const listeners = new Set<() => void>();
function report(key: string, message?: string) {
  if (problems.get(key) === message) return;
  if (message) problems.set(key, message); else problems.delete(key);
  queueMicrotask(() => listeners.forEach(listener => listener()));
}
export const subscribeStorageErrors = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export const storageError = () => [...new Set(problems.values())].join(' ');
export function clearStorageErrors() {
  problems.clear();
  queueMicrotask(() => listeners.forEach(listener => listener()));
}
export const unreadableMessage = 'Stored data could not be read. It has not been replaced.';

export function readStoredStrict<T>(key: string, fallback: T, valid: Validator<T>, store: ReadStore = localStorage): T {
  try {
    const raw = store.getItem(key);
    const value: unknown = raw === null ? structuredClone(fallback) : JSON.parse(raw);
    if (!valid(value)) throw new Error(unreadableMessage);
    report(key);
    return value;
  } catch {
    report(key, unreadableMessage);
    throw new Error(unreadableMessage);
  }
}
export function readStored<T>(key: string, fallback: T, valid: Validator<T>, store: ReadStore = localStorage): T {
  try { return readStoredStrict(key, fallback, valid, store); }
  catch { return structuredClone(fallback); }
}
export function writeStored<T>(key: string, value: T, fallback: T, valid: Validator<T>, store: WriteStore = localStorage) {
  readStoredStrict(key, fallback, valid, store);
  if (!valid(value)) throw new Error('The changes contain invalid data.');
  store.setItem(key, JSON.stringify(value));
  report(key);
}
