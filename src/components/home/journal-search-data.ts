import { localDate, richText, type Day, type Entry, type JournalRecord, type TimelineFilter } from './journal-data.ts';
import { checkIn, scheduled, type Routine, type RoutineData } from '../../routines/data.ts';

export type SearchResult = { id: string; date: string } & ({ kind: 'entry'; entry: Entry; excerpt: string } | { kind: 'record'; record: JournalRecord } | { kind: 'routine'; routine: Routine; skipped: boolean });
export function searchJournal(days: Day[], data: RoutineData, query: string, filter: TimelineFilter): SearchResult[] {
  const needle = query.trim().toLocaleLowerCase();
  const matches = (...text: (string | undefined)[]) => text.join(' ').toLocaleLowerCase().includes(needle);
  const selected = filter.categories.length > 0 || filter.routines;
  return [...days].sort((a, b) => b.date.localeCompare(a.date)).flatMap((day): SearchResult[] => {
    if ((filter.from && day.date < filter.from) || (filter.to && day.date > filter.to)) return [];
    const results: SearchResult[] = [];
    if (!filter.unlogged) {
      for (const record of filter.entriesOnly ? [] : day.records) {
        if (selected && !(record.kind === 'habit' ? filter.routines : filter.categories.includes(record.kind))) continue;
        if (matches(record.title, record.metric, record.meta, record.note)) results.push({ id: record.id, kind: 'record', date: day.date, record });
      }
      const excerpt = richText(day.entry?.body.content ?? []).join('');
      if (day.entry && (!selected || day.types.some(type => type !== 'rest' && filter.categories.includes(type)) || day.records.some(r => filter.categories.includes(r.kind) || (filter.routines && r.kind === 'habit'))) && matches(day.entry.title, excerpt)) results.push({ id: `entry-${day.date}`, kind: 'entry', date: day.date, entry: day.entry, excerpt });
    }
    if (!filter.entriesOnly && day.date <= localDate() && (!selected || filter.routines || filter.unlogged)) for (const routine of data.routines.filter(r => ['reading', 'alcohol'].includes(r.kind) && scheduled(r, day.date))) {
      const value = checkIn(data, routine.id, day.date);
      if (value?.status === 'done' || (filter.unlogged && value) || !matches(routine.name, value?.reason, value ? 'skipped' : 'unlogged')) continue;
      results.push({ id: `${routine.id}-${day.date}`, date: day.date, kind: 'routine', routine, skipped: !!value });
    }
    return results;
  });
}
