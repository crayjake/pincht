import { useEffect, useState } from 'react';
import { loadRehab } from './data';
import { localDate } from '../components/home/journal-data';
export function useRehab() {
  const data = loadRehab();
  const [, setDate] = useState(localDate);
  useEffect(() => {
    const checkDate = () => setDate(localDate());
    const interval = window.setInterval(checkDate, 60_000);
    window.addEventListener('focus', checkDate);
    document.addEventListener('visibilitychange', checkDate);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', checkDate);
      document.removeEventListener('visibilitychange', checkDate);
    };
  }, []);
  return { data };
}
