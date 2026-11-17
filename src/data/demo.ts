import { localDate, type Day } from '../components/home/journal-data.ts';
import { addDays, type RoutineData } from '../routines/data.ts';
import { exercises, workoutPresets } from '../workouts/fixtures.ts';
import { createSession, type Session } from '../workouts/session.ts';
import { rehabLoads, seedDays, seedRoutines } from './demo-fixtures.ts';

const olderTitles = [
  'Finding a steadier pace', 'Small improvements on the slabs', 'A short session after work',
  'Quiet feet and longer rests', 'A good day to take it easy', 'Back to the blue volumes',
  'Keeping the warm-up simple', 'Making time for mobility', 'One move closer', 'Finishing with something easy',
];

export function createDemoData(today = localDate()): { days: Day[]; routines: RoutineData; sessions: Session[] } {
  const offset = Math.round((Date.parse(today) - Date.parse('2026-11-16')) / 86400000);
  const shift = (date: string, block = 0) => addDays(date, offset - block * 14);
  const days = Array.from({ length: 3 }, (_, block) => seedDays.map(day => {
    const ids = new Map(day.records.map(record => [record.id, `${record.id}-demo-${block}`]));
    // Remap both logged records and inline references, including nested sleep dates.
    const shifted: Day = JSON.parse(JSON.stringify(day, (_key, value) => typeof value === 'string'
      ? /^\d{4}-\d{2}-\d{2}$/.test(value) ? shift(value, block) : ids.get(value) ?? value
      : value));
    if (block && shifted.entry) shifted.entry.title = olderTitles[(block - 1) * 5 + seedDays.filter(d => d.entry).findIndex(d => d.date === day.date)];
    return shifted;
  })).flat();
  const routines = seedRoutines(today);
  routines.routines = routines.routines.filter(r => r.kind !== 'rehab').map(r => ({ ...r, start: shift(r.start, 2) }));
  routines.checkIns = Array.from({ length: 3 }, (_, block) => seedRoutines(today).checkIns.map(c => ({ ...c, date: shift(c.date, block) }))).flat();
  const sessions = rehabLoads.map((load, index): Session => {
    const preset = structuredClone(workoutPresets.find(p => p.id === 'finger-rehab')!);
    if (preset.prescription.kind === 'hold') preset.prescription.targetKg = load.kg;
    const date = addDays(today, -1 - (rehabLoads.length - 1 - index) * 4);
    const now = Date.parse(`${date}T18:00:00`);
    const session = createSession(preset, exercises.find(e => e.id === preset.exerciseId)!, 'manual', now);
    return { ...session, id: `demo-drag-${index}`, phase: 'review', finishedAt: new Date(now + 600_000).toISOString(),
      symptomNote: 'Demo workout',
      sets: Array.from({ length: preset.prescription.sets }, (_, i) => ({ set: i + 1, source: 'manual', status: 'completed', durationSeconds: 15, meanKg: load.kg, trace: [] })) };
  });
  return { days, routines, sessions };
}
