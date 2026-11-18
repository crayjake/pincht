import { dataKey } from '../data/mode';
import { readStoredStrict } from '../data/storage';
import { commitStored, type StoredChange } from '../data/transaction';
import { isDays, isSessions } from '../data/validation';
import { JOURNAL_KEY } from '../components/home/journal-storage';
import type { Day, RichNode } from '../components/home/journal-data';
import type { Session } from './session';
import { SESSION_KEY, SIMULATOR_KEY, workoutRecord } from './storage';

export function finishWorkout(session: Session, note: string, addToJournal: boolean, now = Date.now(), store: Storage = localStorage): Session {
  if (session.phase !== 'review' || !session.sets.length) throw new Error('Keep at least one set before saving.');
  const simulated = session.source === 'simulator' || session.sets.some(set => set.source === 'simulator');
  const key = dataKey(simulated ? SIMULATOR_KEY : SESSION_KEY, store);
  const previous = readStoredStrict(key, [], isSessions, store);
  const saved = { ...session, symptomNote: note.trim() || undefined, finishedAt: previous.find(item => item.id === session.id)?.finishedAt ?? new Date(now).toISOString() };
  const changes: StoredChange[] = [{ key, value: [saved, ...previous.filter(item => item.id !== saved.id)], fallback: [], valid: isSessions }];
  // A workout is always logged; this option only adds its reference to the writing.
  if (!simulated && addToJournal && !previous.some(item => item.id === session.id)) {
    const journalKey = dataKey(JOURNAL_KEY, store);
    const days = readStoredStrict(journalKey, [], isDays, store);
    const started = new Date(session.startedAt);
    const date = `${started.getFullYear()}-${String(started.getMonth()+1).padStart(2,'0')}-${String(started.getDate()).padStart(2,'0')}`;
    let day: Day | undefined = days.find(item => item.date === date);
    if (!day) { day = { date, types: [], metrics: {}, visibleMetrics: [], records: [] }; days.push(day); }
    const record = workoutRecord(saved);
    const reference: RichNode = { type: 'paragraph', content: [{ type: 'recordPill', attrs: { id: record.id, label: record.title, category: record.kind } }] };
    day.entry = day.entry ? { ...day.entry, body: { type: 'doc', content: [...day.entry.body.content, reference] } } : { title: '', body: { type: 'doc', content: [reference] } };
    changes.push({ key: journalKey, value: days, fallback: [], valid: isDays });
  }
  commitStored(changes, store);
  return saved;
}
