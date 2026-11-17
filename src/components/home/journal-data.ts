export type Category = 'climb' | 'rehab' | 'training' | 'sleep' | 'goal' | 'habit';
export type DayType = Category | 'rest';
export type SleepStage = 'deep' | 'rem' | 'light' | 'awake';
export interface SleepNight {
  date: string;
  start?: string;
  end?: string;
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
  climb?: { goes: number; sendGo?: number };
  sleep?: SleepNight;
  progress?: { completed: number; total: number };
  goal?: { metric: 'finger-strength'; targetKg: number };
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
  measurements?: { fingerStrengthKg?: number; climbingMinutes?: number };
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
export function localDate(d = new Date()) {
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
