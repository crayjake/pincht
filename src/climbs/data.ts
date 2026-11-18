import { localDate, type Day, type JournalRecord } from '../components/home/journal-data';
import { JOURNAL_KEY, JOURNAL_RESOURCES_KEY, loadDays, loadResources } from '../components/home/journal-storage';
import { dataKey } from '../data/mode';
import { readStoredStrict } from '../data/storage';
import { commitStored } from '../data/transaction';
import { isDays, isResources } from '../data/validation';

export function climbResources() {
  return [...new Map([...loadDays().flatMap(day => day.records), ...loadResources()].filter(isClimbResource).map(record => [record.id,record])).values()];
}
export function isClimbResource(record: JournalRecord) {
  return record.kind === 'climb' && !!record.climbInfo;
}
export function climbStats(id: string, days = loadDays()) {
  const logs = days.filter(day => day.date <= localDate()).flatMap(day => day.records.filter(record => record.id === id && record.climb && record.climb.goes > 0).map(record => ({date:day.date,record}))).sort((a,b) => a.date.localeCompare(b.date));
  const sent = logs.find(log => log.record.climb?.sendGo);
  const sendGo = sent ? logs.slice(0, logs.indexOf(sent)).reduce((sum, log) => sum + log.record.climb!.goes, 0) + sent.record.climb!.sendGo! : undefined;
  return {logs,goes:logs.reduce((sum,log) => sum+log.record.climb!.goes,0),sentAt:sent?.date,firstAt:logs[0]?.date,sendGo};
}
export function saveClimbSession(date: string, logs: JournalRecord[], resources: JournalRecord[] = [], minutes?: number) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > localDate() || !isDays([{date,types:[],metrics:{},visibleMetrics:[],records:[]}])) throw new Error('Choose a valid date up to today.');
  if (!logs.length || logs.some(log => log.kind !== 'climb' || !log.title.trim() || !log.climb || !Number.isInteger(log.climb.goes) || log.climb.goes < 1)) throw new Error('Add a climb and at least one go.');
  if (new Set(logs.map(log => log.id)).size !== logs.length) throw new Error('Each climb can appear once in a session.');
  if (minutes !== undefined && (!Number.isInteger(minutes) || minutes <= 0)) throw new Error('Enter climbing time in whole minutes.');
  const journalKey = dataKey(JOURNAL_KEY), resourceKey = dataKey(JOURNAL_RESOURCES_KEY);
  const days = readStoredStrict(journalKey,[],isDays);
  const previous = readStoredStrict(resourceKey,[],isResources);
  const day: Day = days.find(day => day.date === date) ?? {date,types:[],metrics:{},visibleMetrics:[],records:[]};
  day.records = [...day.records.filter(record => !logs.some(log => log.id === record.id)), ...logs];
  day.types = [...new Set([...day.types.filter(type => type !== 'rest'),'climb' as const])];
  if (minutes !== undefined) day.measurements = {...day.measurements,climbingMinutes:minutes};
  const catalog = [...new Map([...previous,...resources].map(record => [record.id,record])).values()];
  commitStored([{key:journalKey,value:[...days.filter(item => item.date !== date),day].sort((a,b) => b.date.localeCompare(a.date)),fallback:[],valid:isDays},{key:resourceKey,value:catalog,fallback:[],valid:isResources}]);
}
export function saveClimb(record: JournalRecord, sentAlready = false) {
  if (record.kind !== 'climb' || !record.title.trim() || !record.metric.trim()) throw new Error('Enter the climb name and grade.');
  if (sentAlready) saveClimbSession(localDate(),[{...record,climb:{goes:1,sendGo:1}}],[record]);
  else {
    const key = dataKey(JOURNAL_RESOURCES_KEY);
    const previous = readStoredStrict(key,[],isResources);
    commitStored([{key,value:[...previous.filter(item => item.id !== record.id),record],fallback:[],valid:isResources}]);
  }
}
