import type { Entry, JournalRecord, PillResource, RichNode } from './journal-data';

// A mention starts a climb log for this day. Workout mentions remain references.
export function withMentionedClimbs(entry: Entry, records: JournalRecord[], resources: PillResource[]): JournalRecord[] {
  const result = new Map(records.map(record => [record.id, record]));
  const catalog = new Map(resources.map(record => [record.id, record]));
  function visit(nodes: RichNode[]) {
    for (const node of nodes) {
      if (node.type === 'recordPill') {
        const resource = catalog.get(node.attrs.id);
        if (resource?.kind === 'climb' && !result.has(resource.id)) result.set(resource.id, { id: resource.id, kind: 'climb', title: resource.title, metric: resource.metric, meta: resource.meta, climb: { goes: 0 } });
      } else if ('content' in node && node.content) visit(node.content);
    }
  }
  visit(entry.body.content);
  return [...result.values()];
}
export function changeGoes(record: JournalRecord, goes: number): JournalRecord {
  const climb = record.climb ?? { goes: 0 };
  return { ...record, climb: { goes: Math.max(0, goes), ...(climb.sendGo && climb.sendGo <= goes ? { sendGo: climb.sendGo } : {}) } };
}
