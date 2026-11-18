import { localDate, type Day, type JournalRecord } from '../components/home/journal-data.ts';
import { addDays, type RoutineData } from '../routines/data.ts';
import { exercises, workoutPresets } from '../workouts/fixtures.ts';
import { createSession, type Session } from '../workouts/session.ts';
import { rehabLoads, seedDays, seedRoutines } from './demo-fixtures.ts';

const olderTitles = [
  'Finding a steadier pace', 'Small improvements on the slabs', 'A short session after work',
  'Quiet feet and longer rests', 'A good day to take it easy', 'Back to the blue volumes',
  'Keeping the warm-up simple', 'Making time for mobility', 'One move closer', 'Finishing with something easy',
];

/** Replace the obsolete generated climb examples, retaining writing and user-created records. */
export function refreshDemoClimbs(days: Day[]): Day[] {
  const replacements = new Map<string, JournalRecord>();
  for (const day of days) for (const record of day.records) {
    const match = /^(sidepull|climb-(13|10|7|4))-demo-[012]$/.exec(record.id);
    if (!match || record.kind !== 'climb' || record.climbInfo || !['Sidepull Season', 'Boulder session'].includes(record.title)) continue;
    const example = seedDays.find(day => day.date === `2026-11-${(match[2] ?? '15').padStart(2, '0')}`)?.records.find(record => record.kind === 'climb');
    if (example) replacements.set(record.id, { ...example, note: record.note ?? example.note });
  }
  if (!replacements.size) return days;
  return days.map(day => ({ ...day,
    records: day.records.map(record => replacements.get(record.id) ?? record),
    ...(day.entry && { entry: { ...day.entry, body: JSON.parse(JSON.stringify(day.entry.body, (key, value) => {
      const replacement = key === 'attrs' && value ? replacements.get(value.id) : undefined;
      return replacement ? { ...value, id: replacement.id, label: replacement.title } : value;
    })) } }),
  }));
}

export function createDemoData(today = localDate()): { days: Day[]; routines: RoutineData; sessions: Session[] } {
  const offset = Math.round((Date.parse(today) - Date.parse('2026-11-16')) / 86400000);
  const shift = (date: string, block = 0) => addDays(date, offset - block * 14);
  const days = Array.from({ length: 3 }, (_, block) => seedDays.map(day => {
    // Climbs and goals keep one identity across days; a climb session is a log of that object.
    const ids = new Map(day.records.map(record => [record.id, record.kind === 'climb' || record.kind === 'goal' ? record.id : `${record.id}-demo-${block}`]));
    // Remap both logged records and inline references, including nested sleep dates.
    const shifted: Day = JSON.parse(JSON.stringify(day, (_key, value) => typeof value === 'string'
      ? /^\d{4}-\d{2}-\d{2}$/.test(value) ? shift(value, block) : ids.get(value) ?? value
      : value));
    // These are explicit demo logs, so widgets can exercise the same structured fields as real logs.
    if (shifted.records.some(record => record.kind === 'climb')) shifted.measurements = { climbingMinutes: 80 };
    if (block && shifted.entry) shifted.entry.title = olderTitles[(block - 1) * 5 + seedDays.filter(d => d.entry).findIndex(d => d.date === day.date)];
    return shifted;
  })).flat();
  const routines = seedRoutines(today);
  routines.routines = routines.routines.filter(r => r.kind !== 'rehab').map(r => ({ ...r, start: shift(r.start, 2) }));
  routines.checkIns = Array.from({ length: 3 }, (_, block) => seedRoutines(today).checkIns.map(c => ({ ...c, date: shift(c.date, block) }))).flat();
  const reading = demoBookHistory(routines);
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
  const pullupPreset = workoutPresets.find(preset => preset.id === 'pull-ups-3x5')!;
  for (const [index, daysAgo] of [1, 3, 6, 9, 13, 17, 21, 25, 30, 34].entries()) {
    const now = Date.parse(`${addDays(today, -daysAgo)}T19:00:00`);
    const session = createSession(pullupPreset, exercises.find(exercise => exercise.id === pullupPreset.exerciseId)!, 'manual', now);
    sessions.push({ ...session, id: `demo-pullups-${index}`, phase: 'review', finishedAt: new Date(now + 900_000).toISOString(), rpe: 7,
      sets: Array.from({ length: 3 }, (_, set) => ({ set: set + 1, source: 'manual', status: 'completed', reps: 5, trace: [] })) });
  }
  return { days, routines: reading, sessions };
}

/** Enrich the existing example library without resetting journal or workout edits. */
export function demoBookHistory(data: RoutineData): RoutineData {
  const piranesi = data.books.find(book => book.id === 'piranesi' && book.title === 'Piranesi' && book.author === 'Susanna Clarke');
  if (!piranesi) return data;
  const reading = data.checkIns.filter(log => log.bookId === piranesi.id && log.status === 'done').sort((a, b) => a.date.localeCompare(b.date));
  const latest = reading.at(-1)?.date;
  const recent = reading.filter(log => latest && log.date > addDays(latest, -14));
  const older = reading.filter(log => !recent.includes(log));
  const populate = reading.length > 0 && reading.every(log => log.page === undefined);
  const books: RoutineData['books'] = [
    { ...piranesi, isbn: '9781526622433', catalogKey: '/books/OL57673846M', coverUrl: 'https://covers.openlibrary.org/b/id/15268930-M.jpg', status: piranesi.status ?? 'reading', started: piranesi.started ?? recent[0]?.date },
    { id: 'nineteen-eighty-four', title: 'Nineteen Eighty-Four', author: 'George Orwell', pages: 384, initialPage: 0, status: 'finished', started: older[0]?.date, isbn: '9780141187761', catalogKey: '/books/OL7359256M', coverUrl: 'https://covers.openlibrary.org/b/id/12824243-M.jpg' },
    { id: 'atomic-habits', title: 'Atomic Habits', author: 'James Clear', pages: 320, initialPage: 0, status: 'want-to-read', isbn: '9781847941831', catalogKey: '/books/OL57360656M', coverUrl: 'https://covers.openlibrary.org/b/id/15247577-M.jpg' },
  ];
  const next = { ...data, books: [...data.books.map(book => book.id === piranesi.id ? books[0] : book), ...books.slice(1).filter(book => !data.books.some(existing => existing.id === book.id))],
    checkIns: populate ? data.checkIns.map(log => {
      const index = older.indexOf(log);
      if (index >= 0) return { ...log, bookId: 'nineteen-eighty-four', page: Math.ceil(384 * (index + 1) / older.length), minutes: [20, 25, 30][index % 3] };
      const recentIndex = recent.indexOf(log);
      return recentIndex >= 0 ? { ...log, page: Math.min(piranesi.pages, piranesi.initialPage + 12 * (recentIndex + 1)), minutes: [15, 20, 30][recentIndex % 3] } : log;
    }) : data.checkIns };
  return JSON.stringify(next) === JSON.stringify(data) ? data : next;
}
