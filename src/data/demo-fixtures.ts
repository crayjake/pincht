import { stageTotals, asleepMinutes, duration, type SleepStage, type SleepNight, type RehabLoad, type RichNode, type JournalRecord, type DayType, type Category, type Entry, type Day } from '../components/home/journal-data.ts';
const stages: SleepStage[] = ['light', 'deep', 'light', 'rem', 'light', 'deep', 'light', 'rem', 'awake', 'light', 'deep', 'light', 'rem', 'awake', 'light', 'rem'];
const minutes = [22, 38, 30, 14, 36, 32, 28, 26, 8, 40, 15, 25, 30, 16, 58, 38];
const todayNight: SleepNight = {
  date: '2026-11-15', start: '23:10', end: '06:46',
  segments: stages.map((stage, i) => ({ stage, minutes: minutes[i] })),
};
function makeNight(date: string, asleep: number, deep: number, rem: number): SleepNight {
  const totals = { deep, rem, light: asleep - deep - rem, awake: 12 };
  const base = stageTotals(todayNight);
  return {
    date, start: '23:25', end: `${String(Math.floor(((23 * 60 + 25 + asleep + 12) % 1440) / 60)).padStart(2, '0')}:${String((25 + asleep + 12) % 60).padStart(2, '0')}`,
    segments: todayNight.segments.map(s => ({ stage: s.stage, minutes: s.minutes / base[s.stage] * totals[s.stage] })),
  };
}
export const rehabLoads: RehabLoad[] = [16.5, 17, 18, 18.5, 19.5, 20, 20.5, 21.5, 22].map((kg, i) => ({
  date: new Date(Date.UTC(2026, 8, 20 + i * 7)).toISOString().slice(0, 10), kg, edgeMm: 20,
}));
const text = (value: string): RichNode => ({ type: 'text', text: value });
const pill = (id: string, label: string, category: Category): RichNode => ({ type: 'recordPill', attrs: { id, label, category } });
const todayRecords: JournalRecord[] = [
  { id: 'sleep-15', kind: 'sleep', title: 'Last night’s sleep', metric: duration(asleepMinutes(todayNight)), meta: '', sleep: todayNight },
  { id: 'sidepull', kind: 'climb', title: 'Sidepull Season', metric: '7A', meta: 'Boulder room', climbInfo: { type: 'boulder', where: 'Boulder room', notes: 'Left heel up before the sidepull, hips in, then pull through.' }, climb: { goes: 3, sendGo: 3 }, note: 'Stopped trying to match.' },
  { id: 'rehab-15', kind: 'rehab', title: 'Finger rehab', metric: '5 sets', meta: `Max hang · ${rehabLoads.at(-1)!.edgeMm} mm · +${rehabLoads.at(-1)!.kg} kg · 10 s`, note: 'Left ring finger quiet all session. Try +0.5 kg next week.' },
  { id: 'pull-ups', kind: 'training', title: 'Pull-ups', metric: '4 × 6', meta: '+10 kg · last set RPE 7' },
  { id: 'christmas', kind: 'goal', title: 'Christmas goal', metric: '2 / 4', meta: 'Climbing projects', progress: { completed: 2, total: 4 }, climbGoal: { climbIds: ['sidepull', 'blue-slab', 'heel-hook', 'pinch-panic'] } },
];
const routineSeeds: [number, DayType[], number, number, number, number][] = [
  [14, ['rehab'], 468, 72.1, 92, 110], [13, ['climb', 'training'], 453, 72.3, 88, 101],
  [12, ['rest'], 478, 72.2, 96, 112], [11, ['rehab', 'training'], 425, 72.5, 80, 90],
  [10, ['climb'], 440, 72.6, 84, 96], [9, ['rest'], 401, 72.8, 70, 82],
  [8, ['rehab', 'training'], 451, 72.9, 86, 100], [7, ['climb'], 418, 72.7, 75, 92],
  [6, ['rest'], 464, 72.8, 89, 107], [5, ['rehab'], 437, 73, 82, 98],
  [4, ['climb', 'training'], 446, 72.8, 85, 104], [3, ['rehab'], 422, 72.9, 78, 92], [2, ['rest'], 458, 73.1, 87, 102],
];
const sampleEntries: Record<number, Entry> = {
  13: { title: 'Stopped while the skin was good', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('Kept the attempts on '), pill('sidepull', 'Sidepull Season', 'climb'), text(' short today. The steeper problems felt good, but the small holds were getting sore. Finished with '), pill('training-13', 'Core + shoulders', 'training'), text(' rather than squeezing in another climb.')] },
  ] } },
  10: { title: 'Getting comfortable on the slabs', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('Spent most of the session on '), pill('blue-slab', 'Blue slab', 'climb'), text(', practising balance and quiet feet. Repeating the easier problems helped more than chasing a harder grade.')] },
    { type: 'paragraph', content: [text('Try the same warm-up next time, then come back to the blue volume problem.')] },
  ] } },
  7: { title: 'A few good attempts', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('No send on '), pill('heel-hook', 'Heel Hook Hell', 'climb'), text(', but the moves are starting to connect. Taking longer rests made the last attempts much better than the first.')] },
  ] } },
  4: { title: 'Back into the rhythm', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('A few attempts on '), pill('pinch-panic', 'Pinch Panic', 'climb'), text(' to get moving again, followed by '), pill('training-4', 'Core + shoulders', 'training'), text('. Fingers felt quiet throughout. Keep the next session at the same intensity.')] },
  ] } },
};
export const seedDays: Day[] = [{
  date: '2026-11-15', types: ['climb', 'rehab', 'training'], metrics: { sleep: asleepMinutes(todayNight), weight: 72.4 }, visibleMetrics: ['sleep', 'weight'],
  entry: { title: 'The high heel worked', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('Finally stuck the last move on '), pill('sidepull', 'Sidepull Season', 'climb'), text('. Another climb ticked off my '), pill('christmas', 'Christmas goal', 'goal'), text(' list.')] },
    { type: 'paragraph', content: [pill('rehab-15', 'Finger rehab', 'rehab'), text(' felt steady and I had plenty left for '), pill('pull-ups', 'Pull-ups', 'training'), text('. Felt better than I expected after '), pill('sleep-15', 'Last night’s sleep', 'sleep'), text('.')] },
  ] } }, records: todayRecords,
}, ...routineSeeds.map(([day, types, sleep, weight, deep, rem]): Day => {
  const date = `2026-11-${String(day).padStart(2, '0')}`;
  const night = makeNight(date, sleep, deep, rem);
  const climbs: Record<number, JournalRecord> = {
    13: { id: 'sidepull', kind: 'climb', title: 'Sidepull Season', metric: '7A', meta: 'Boulder room', climbInfo: { type: 'boulder', where: 'Boulder room', notes: 'Left heel up before the sidepull, hips in, then pull through.' }, climb: { goes: 3 } },
    10: { id: 'blue-slab', kind: 'climb', title: 'Blue slab', metric: '5+', meta: 'Slab wall', climbInfo: { type: 'boulder', where: 'Slab wall' }, climb: { goes: 1, sendGo: 1 } },
    7: { id: 'heel-hook', kind: 'climb', title: 'Heel Hook Hell', metric: '7A', meta: 'Boulder room', climbInfo: { type: 'boulder', where: 'Boulder room' }, climb: { goes: 4 } },
    4: { id: 'pinch-panic', kind: 'climb', title: 'Pinch Panic', metric: '6C', meta: 'Slab wall', climbInfo: { type: 'boulder', where: 'Slab wall' }, climb: { goes: 4 } },
  };
  const records: JournalRecord[] = types.filter((type): type is Category => type !== 'rest').map(kind => kind === 'climb' ? { ...climbs[day] } : ({
    id: `${kind}-${day}`, kind, title: kind === 'rehab' ? 'Finger rehab' : 'Core + shoulders',
    metric: kind === 'rehab' ? '5 sets' : '25 min',
    meta: kind === 'rehab' ? 'Max hang · 20 mm · +21.5 kg · 10 s' : 'L-sit · face pulls · RPE 6',
  }));
  records.push({ id: `sleep-${day}`, kind: 'sleep', title: 'Sleep', metric: duration(asleepMinutes(night), true), meta: '', sleep: night });
  return { date, types, metrics: { sleep: asleepMinutes(night), weight }, visibleMetrics: ['sleep', 'weight'], entry: sampleEntries[day], records };
})];

import { localDate } from '../components/home/journal-data.ts';
import { daysBetween, type CheckIn, type RoutineData } from '../routines/data.ts';
export function seedRoutines(today = localDate()): RoutineData {
  const checkIns: CheckIn[] = [];
  for (const date of daysBetween('2026-11-02', '2026-11-15')) {
    checkIns.push({ routineId: 'alcohol', date, status: 'done', drinks: 0 });
    if (!['2026-11-12', '2026-11-15'].includes(date)) checkIns.push({ routineId: 'read', date,
      status: date === '2026-11-10' ? 'skipped' : 'done',
      ...(date === '2026-11-10' ? { reason: 'travelling' } : { minutes: 20, bookId: 'piranesi' }) });
  }
  return {
    routines: [
      { id: 'read', name: 'Read', kind: 'reading', active: true, start: '2026-11-02', schedule: 'daily', interval: 1, target: 20 },
      { id: 'alcohol', name: 'Alcohol-free day', kind: 'alcohol', active: true, start: '2026-11-02', schedule: 'daily', interval: 1, target: 3 },
      { id: 'train', name: 'Train', kind: 'training', active: true, start: '2026-11-02', schedule: 'weekly', interval: 1, target: 3 },
      { id: 'rehab', name: 'Finger rehab', kind: 'rehab', active: true, start: '2026-11-03', schedule: 'interval', interval: 2, target: 1 },
    ], books: [{ id: 'piranesi', title: 'Piranesi', author: 'Susanna Clarke', pages: 272, initialPage: 112 }],
    currentBookId: 'piranesi', checkIns, lastVisit: today, widgets: { rehab: true, sleep: true },
  };
}
