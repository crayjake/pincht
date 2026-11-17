export type DataMode = 'real' | 'demo';
export const DATA_MODE_KEY = 'pincht.data-mode';
export type DataStore = Pick<Storage, 'getItem' | 'setItem'>;

export function getDataMode(store: Pick<Storage, 'getItem'> = localStorage): DataMode {
  return store.getItem(DATA_MODE_KEY) === 'demo' ? 'demo' : 'real';
}

// Keep the existing real stores in place. Demo records never share their keys.
export function dataKey(key: string, store: Pick<Storage, 'getItem'> = localStorage, mode = getDataMode(store)) {
  return mode === 'demo' ? `${key}.demo` : key;
}
