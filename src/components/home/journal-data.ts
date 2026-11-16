export type Category = 'climb' | 'rehab' | 'training' | 'sleep' | 'goal' | 'habit';
export type DayType = Category | 'rest';
export type SleepStage = 'deep' | 'rem' | 'light' | 'awake';
export interface SleepNight {
  date: string;
  start: string;
  end: string;
  segments: { stage: SleepStage; minutes: number }[];
}
export interface RehabLoad { date: string; kg: number; edgeMm: number }
export interface JournalRecord {
  id: string;
  kind: Category;
  title: string;
  metric: string;
  meta: string;
  note?: string;
  sleep?: SleepNight;
  progress?: { completed: number; total: number };
}
export type RichNode = { type: 'text'; text: string; marks?: { type: string; attrs?: Record<string, unknown> }[] } | {
  type: 'recordPill'; attrs: { id: string; label: string; category: Category };
} | {
  type: 'paragraph' | 'heading' | 'bulletList' | 'orderedList' | 'listItem' | 'blockquote' | 'codeBlock' | 'hardBreak' | 'horizontalRule';
  attrs?: Record<string, unknown>;
  content?: RichNode[];
};
export interface RichBody { type: 'doc'; content: RichNode[] }
export interface Entry { title: string; body: RichBody }
export interface Day {
  date: string;
  types: DayType[];
  metrics: { sleep?: number; weight?: number };
  visibleMetrics: ('sleep' | 'weight')[];
  entry?: Entry;
  records: JournalRecord[];
}
export interface ChartResource { id: string; kind: 'chart'; category: Category; title: string }
export type PillResource = JournalRecord | ChartResource;
export function entryRecords(day: Day, resources: PillResource[]): PillResource[] {
  const records = new Map<string, PillResource>(day.records.map(record => [record.id, record]));
  const byId = new Map(resources.map(record => [record.id, record]));
  function visit(nodes: RichNode[]) {
    for (const node of nodes) {
      if (node.type === 'recordPill') {
        const record = byId.get(node.attrs.id);
        if (record && !records.has(record.id)) records.set(record.id, record);
      } else if ('content' in node && node.content) visit(node.content);
    }
  }
  visit(day.entry?.body.content ?? []);
  return [...records.values()];
}
export const categories: Category[] = ['climb', 'rehab', 'training', 'sleep', 'goal'];
export interface TimelineFilter { categories: Category[]; from: string; to: string; routines: boolean; unlogged: boolean; entriesOnly: boolean }
export const emptyFilter: TimelineFilter = { categories: [], from: '', to: '', routines: false, unlogged: false, entriesOnly: false };
export const categoryLabels: Record<Category, string> = {
  climb: 'Climb', rehab: 'Rehab', training: 'Training', sleep: 'Sleep', goal: 'Goal', habit: 'Routines',
};
export function duration(minutes: number, padded = false) {
  const rounded = Math.round(minutes);
  const m = rounded % 60;
  return rounded < 60 ? `${rounded}m` : `${Math.floor(rounded / 60)}h ${padded ? String(m).padStart(2, '0') : m}m`;
}
export const dateValue = (date: string) => new Date(`${date}T12:00:00Z`);
export const shortDate = (date: string, options: Intl.DateTimeFormatOptions) =>
  dateValue(date).toLocaleDateString('en-GB', { ...options, timeZone: 'UTC' });
export function stageTotals(night: SleepNight) {
  return night.segments.reduce((totals, segment) => {
    totals[segment.stage] += segment.minutes;
    return totals;
  }, { deep: 0, rem: 0, light: 0, awake: 0 });
}
export function asleepMinutes(night: SleepNight) {
  const totals = stageTotals(night);
  return totals.deep + totals.rem + totals.light;
}
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
  { id: 'sidepull', kind: 'climb', title: 'Sidepull Season', metric: 'sent · 6th go', meta: 'Font 7A · 6 attempts', note: 'Left heel up before the sidepull, hips in, then pull through. Stopped trying to match.' },
  { id: 'rehab-15', kind: 'rehab', title: 'Finger rehab', metric: '5 sets', meta: `Max hang · ${rehabLoads.at(-1)!.edgeMm} mm · +${rehabLoads.at(-1)!.kg} kg · 10 s`, note: 'Left ring finger quiet all session. Try +0.5 kg next week.' },
  { id: 'pull-ups', kind: 'training', title: 'Pull-ups', metric: '4 × 6', meta: '+10 kg · last set RPE 7' },
  { id: 'christmas', kind: 'goal', title: 'Christmas goal', metric: '5 / 5', meta: 'All climbs sent · 40 days early', progress: { completed: 5, total: 5 } },
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
    { type: 'paragraph', content: [text('Kept the '), pill('climb-13', 'Boulder session', 'climb'), text(' short today. The steeper problems felt good, but the small holds were getting sore. Finished with '), pill('training-13', 'Core + shoulders', 'training'), text(' rather than squeezing in another climb.')] },
  ] } },
  10: { title: 'Getting comfortable on the slabs', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('Spent most of the '), pill('climb-10', 'Boulder session', 'climb'), text(' on balance and quiet feet. Repeating the easier problems helped more than chasing a harder grade.')] },
    { type: 'paragraph', content: [text('Try the same warm-up next time, then come back to the blue volume problem.')] },
  ] } },
  7: { title: 'A few good attempts', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('No big sends in the '), pill('climb-7', 'Boulder session', 'climb'), text(', but the moves are starting to connect. Taking longer rests made the last attempts much better than the first.')] },
  ] } },
  4: { title: 'Back into the rhythm', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('An easy '), pill('climb-4', 'Boulder session', 'climb'), text(' to get moving again, followed by '), pill('training-4', 'Core + shoulders', 'training'), text('. Fingers felt quiet throughout. Keep the next session at the same intensity.')] },
  ] } },
};
export const seedDays: Day[] = [{
  date: '2026-11-15', types: ['climb', 'rehab', 'training'], metrics: { sleep: asleepMinutes(todayNight), weight: 72.4 }, visibleMetrics: ['sleep', 'weight'],
  entry: { title: 'The high heel worked', body: { type: 'doc', content: [
    { type: 'paragraph', content: [text('Finally stuck the last move on '), pill('sidepull', 'Sidepull Season', 'climb'), text('. That was the last climb on my '), pill('christmas', 'Christmas goal', 'goal'), text(' list.')] },
    { type: 'paragraph', content: [pill('rehab-15', 'Finger rehab', 'rehab'), text(' felt steady and I had plenty left for '), pill('pull-ups', 'Pull-ups', 'training'), text('. Felt better than I expected after '), pill('sleep-15', 'Last night’s sleep', 'sleep'), text('.')] },
  ] } }, records: todayRecords,
}, ...routineSeeds.map(([day, types, sleep, weight, deep, rem]): Day => {
  const date = `2026-11-${String(day).padStart(2, '0')}`;
  const night = makeNight(date, sleep, deep, rem);
  const records: JournalRecord[] = types.filter((type): type is Category => type !== 'rest').map(kind => ({
    id: `${kind}-${day}`, kind, title: kind === 'rehab' ? 'Finger rehab' : kind === 'climb' ? 'Boulder session' : 'Core + shoulders',
    metric: kind === 'rehab' ? '5 sets' : kind === 'climb' ? '11 problems' : '25 min',
    meta: kind === 'rehab' ? 'Max hang · 20 mm · +21.5 kg · 10 s' : kind === 'climb' ? 'Top send Font 6C+ · 1h 40m' : 'L-sit · face pulls · RPE 6',
    ...(day === 13 && kind === 'climb' ? { note: 'Skin gave out early, so I stopped before the crimpy problems.' } : {}),
  }));
  records.push({ id: `sleep-${day}`, kind: 'sleep', title: 'Sleep', metric: duration(asleepMinutes(night), true), meta: '', sleep: night });
  return { date, types, metrics: { sleep: asleepMinutes(night), weight }, visibleMetrics: ['sleep', 'weight'], entry: sampleEntries[day], records };
})];
export const chartResources: ChartResource[] = [
  { id: 'chart-rehab', kind: 'chart', category: 'rehab', title: 'Finger rehab load chart' },
  { id: 'chart-sleep', kind: 'chart', category: 'sleep', title: 'Sleep stages chart' },
];
function mondayKey(date: string) {
  const d = dateValue(date);
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
export type TimelineGroup = { kind: 'entry'; day: Day } | { kind: 'routine'; days: Day[] };
export function groupDays(days: Day[]): TimelineGroup[] {
  const groups: TimelineGroup[] = [];
  for (const day of [...days].sort((a, b) => b.date.localeCompare(a.date))) {
    if (day.entry) { groups.push({ kind: 'entry', day }); continue; }
    const last = groups.at(-1);
    const previous = last?.kind === 'routine' ? last.days.at(-1) : undefined;
    if (last?.kind === 'routine' && previous && mondayKey(previous.date) === mondayKey(day.date)
      && dateValue(previous.date).getTime() - dateValue(day.date).getTime() === 86400000) last.days.push(day);
    else groups.push({ kind: 'routine', days: [day] });
  }
  return groups;
}
export function rangeLabel(days: Day[]) {
  const first = days.at(-1)!.date;
  const last = days[0].date;
  if (first === last) return shortDate(first, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${shortDate(first, { weekday: 'short', day: 'numeric' })}${first.slice(0, 7) !== last.slice(0, 7) ? ` ${shortDate(first, { month: 'short' })}` : ''} – ${shortDate(last, { weekday: 'short', day: 'numeric', month: 'short' })}`;
}
export function localDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function dayMatches(day: Day, query: string, selected: Category[], from: string, to: string) {
  if ((from && day.date < from) || (to && day.date > to)) return false;
  if (selected.length && !selected.some(category => day.types.includes(category) || day.records.some(r => r.kind === category))) return false;
  const searchable = [day.date, shortDate(day.date, { weekday: 'long', month: 'long' }), ...day.types, day.entry?.title,
    ...richText(day.entry?.body.content ?? []),
    ...day.records.flatMap(r => [r.title, r.metric, r.meta, r.note])].join(' ').toLocaleLowerCase();
  return searchable.includes(query.trim().toLocaleLowerCase());
}

export function richText(nodes: RichNode[]): string[] {
  return nodes.flatMap(node => node.type === 'text' ? [node.text] : node.type === 'recordPill' ? [node.attrs.label] : richText(node.content ?? []));
}

export function hasJournalContent(entry?: Entry) {
  return !!entry && !!(entry.title.trim() || richText(entry.body.content).join('').trim());
}

export function getNights(days: Day[]) {
  return days.flatMap(day => day.records.flatMap(record => record.sleep ? [record.sleep] : [])).sort((a, b) => a.date.localeCompare(b.date)).slice(-7);
}
