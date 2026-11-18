import { useEffect, useState } from 'react';
import { localDate } from '../components/home/journal-data';
import { addDays, checkIn, ROUTINES_KEY, unlogged, type CheckIn, type RoutineData } from './data';
import { dataKey } from '../data/mode';
import { loadRoutines, saveRoutines } from './storage';

export function useRoutines(trackVisit = true) {
  const [storageKey] = useState(() => dataKey(ROUTINES_KEY));
  const [initial] = useState(loadRoutines);
  const [data, setData] = useState(initial);
  const [recentSkips, setRecentSkips] = useState<CheckIn[]>([]);
  const [error, setError] = useState('');
  const [away] = useState(() => initial.lastVisit < addDays(localDate(), -1)
    ? unlogged(initial, initial.lastVisit, addDays(localDate(), -1)) : []);
  const [welcome, setWelcome] = useState(away.length > 0);
  useEffect(() => {
    if (!trackVisit) return;
    try { saveRoutines({ ...initial, lastVisit: localDate() }, localStorage, storageKey); }
    catch (error) { queueMicrotask(() => setError((error as Error).message)); }
  }, [initial, trackVisit, storageKey]);
  function update(next: RoutineData) {
    const value = { ...next, lastVisit: localDate() };
    try { saveRoutines(value, localStorage, storageKey); setError(''); }
    catch (error) { setError((error as Error).message); return false; }
    // Undo rows last for this visit only; saved skips stay hidden on return.
    setRecentSkips(current => value.checkIns.filter(c => c.status === 'skipped' && (
      current.some(skip => skip.routineId === c.routineId && skip.date === c.date)
      || checkIn(data, c.routineId, c.date)?.status !== 'skipped'
    )));
    setData(value);
    return true;
  }
  function closeWelcome() { setWelcome(false); }
  return { data, update, recentSkips, error, away, welcome, closeWelcome };
}
