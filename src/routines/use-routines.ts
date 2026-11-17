import { useEffect, useState } from 'react';
import { localDate } from '../components/home/journal-data';
import { addDays, checkIn, ROUTINES_KEY, createRoutines, unlogged, type CheckIn, type RoutineData } from './data';
import { dataKey } from '../data/mode';

export function useRoutines(trackVisit = true) {
  const [storageKey] = useState(() => dataKey(ROUTINES_KEY));
  const [initial] = useState(() => {
    try { return JSON.parse(localStorage.getItem(storageKey) || 'null') as RoutineData || createRoutines(); }
    catch { return createRoutines(); }
  });
  const [data, setData] = useState(initial);
  const [recentSkips, setRecentSkips] = useState<CheckIn[]>([]);
  const [error, setError] = useState('');
  const [away] = useState(() => initial.lastVisit < addDays(localDate(), -1)
    ? unlogged(initial, initial.lastVisit, addDays(localDate(), -1)) : []);
  const [welcome, setWelcome] = useState(away.length > 0);
  useEffect(() => {
    if (!trackVisit) return;
    try { localStorage.setItem(storageKey, JSON.stringify({ ...initial, lastVisit: localDate() })); }
    catch { queueMicrotask(() => setError('Your changes are here, but could not be saved on this device.')); }
  }, [initial, trackVisit, storageKey]);
  function update(next: RoutineData) {
    const value = { ...next, lastVisit: localDate() };
    // Undo rows last for this visit only; saved skips stay hidden on return.
    setRecentSkips(current => value.checkIns.filter(c => c.status === 'skipped' && (
      current.some(skip => skip.routineId === c.routineId && skip.date === c.date)
      || checkIn(data, c.routineId, c.date)?.status !== 'skipped'
    )));
    let saved = true;
    try { localStorage.setItem(storageKey, JSON.stringify(value)); setError(''); }
    catch { saved = false; setError('Your changes are here, but could not be saved on this device.'); }
    setData(value);
    return saved;
  }
  function closeWelcome() { setWelcome(false); }
  return { data, update, recentSkips, error, away, welcome, closeWelcome };
}
