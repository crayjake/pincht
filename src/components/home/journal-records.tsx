import { useState } from 'react';
import { changeGoes } from './journal-climbs';
import type { CSSProperties } from 'react';
import { duration, stageTotals, type JournalRecord, type PillResource, type SleepNight } from './journal-data';
import { Icon } from './journal-icons';
import { Holds } from './journal-widgets';

export function RecordPill({ record, onOpen }: { record: PillResource; onOpen: (record: PillResource) => void }) {
  return <a className="record-pill" data-category={record.kind === 'chart' ? record.category : record.kind} href={`#record-${record.id}`} onClick={event => { event.preventDefault(); onOpen(record); }}>{record.title}</a>;
}
export function Hypnogram({ night, compact = false }: { night: SleepNight; compact?: boolean }) {
  const totals = stageTotals(night);
  if (!night.start || !night.end) return <div className="sleep-legend">{(['deep','rem','light'] as const).map(stage => <span key={stage}><i data-stage={stage} />{stage === 'rem' ? 'REM' : stage === 'deep' ? 'Deep' : 'Light'} <strong>{duration(totals[stage])}</strong></span>)}</div>;
  return <>
    <div className={`hypnogram${compact ? ' hypnogram-compact' : ''}`} role="img" aria-label={`Sleep stages from ${night.start} to ${night.end}. ${(['deep', 'rem', 'light', 'awake'] as const).map(stage => `${stage}: ${duration(totals[stage])}`).join(', ')}`}>
      {night.segments.map((segment, i) => <span key={i} data-stage={segment.stage} style={{ flexGrow: segment.minutes } as CSSProperties} />)}
    </div>
    <div className="sleep-times"><span>{night.start}</span><span>{night.end}</span></div>
    {!compact && <div className="sleep-legend">{(['deep', 'rem', 'light', 'awake'] as const).map(stage => <span key={stage}><i data-stage={stage} />{stage === 'rem' ? 'REM' : stage[0].toUpperCase() + stage.slice(1)} <strong>{duration(totals[stage])}</strong></span>)}</div>}
  </>;
}
export function RecordItem({ record, onOpen, compact = false, onUpdate }: { record: PillResource; onOpen: (record: PillResource) => void; compact?: boolean; onUpdate?: (record: JournalRecord) => void }) {
  if (record.kind === 'chart') return <div className="day-record"><div className="record-heading"><h3><RecordPill record={record} onOpen={onOpen} /></h3><span className="record-metric">Chart</span></div></div>;
  return <div className="day-record">
    <div className="record-heading"><h3><RecordPill record={record} onOpen={onOpen} /></h3><span className="record-metric">{record.metric}</span></div>
    {record.meta && <div className="record-meta">{record.meta}</div>}
    {record.sleep && <Hypnogram night={record.sleep} compact={compact} />}
    {record.kind === 'climb' && onUpdate && <ClimbLog record={record} onUpdate={onUpdate} />}
    {record.note && !onUpdate && <div className="record-note"><Icon name="note" size={14} /><p>{record.note}</p></div>}
    {record.kind !== 'climb' && onUpdate && <label className="record-note-field"><span className="sr-only">Notes for {record.title}</span><textarea aria-label={`Notes for ${record.title}`} placeholder="Add a note…" value={record.note ?? ''} onChange={e => onUpdate({ ...record, note: e.target.value })} /></label>}
    {record.progress && <div className="goal-progress" role="img" aria-label={`${record.progress.completed} of ${record.progress.total} climbs sent`}><Holds categories={Array.from({ length: record.progress.total }, () => 'goal')} /></div>}
  </div>;
}
export function DayRecords({ records, onOpen, compact = false, id, onUpdate, editableIds }: { records: PillResource[]; onOpen: (record: PillResource) => void; compact?: boolean; id: string; onUpdate?: (record: JournalRecord) => void; editableIds?: string[] }) {
  return <section className={`day-records${compact ? ' day-records-inline' : ''}`} aria-label="Day records" id={id}>
    {records.map(record => <RecordItem key={record.id} record={record} onOpen={onOpen} compact={compact} onUpdate={(!editableIds || editableIds.includes(record.id)) && !record.id.startsWith('routine-') ? onUpdate : undefined} />)}
    {!records.length && <p className="empty-records">No records for this day.</p>}
  </section>;
}

function ClimbLog({ record, onUpdate }: { record: JournalRecord; onUpdate: (record: JournalRecord) => void }) {
  const [selected, setSelected] = useState<number | null>(null);
  const climb = record.climb ?? { goes: 0 };
  return <div className="climb-log">
    <div className="climb-log-heading"><span>Goes today</span><span>{climb.goes} · {climb.sendGo ? `sent on go ${climb.sendGo}` : 'not sent yet'}</span></div>
    <div className="go-counts" aria-label={`Goes for ${record.title}`}>{Array.from({ length: climb.goes }, (_, i) => <button key={i} aria-label={`Go ${i + 1}${climb.sendGo === i + 1 ? ', sent' : ''}`} aria-pressed={selected === i + 1} data-sent={climb.sendGo === i + 1} onClick={() => setSelected(selected === i + 1 ? null : i + 1)}><i>{i + 1}{climb.sendGo === i + 1 ? ' ✓' : ''}</i></button>)}<button className="go-add" aria-label={`Add go for ${record.title}`} onClick={() => onUpdate(changeGoes(record, climb.goes + 1))}><i>+</i></button></div>
    {selected && <div className="go-actions"><button onClick={() => { onUpdate({ ...record, climb: { ...climb, sendGo: climb.sendGo === selected ? undefined : selected } }); setSelected(null); }}>{climb.sendGo === selected ? 'Clear send' : 'Sent on this go'}</button><button onClick={() => { const sendGo = climb.sendGo === selected ? undefined : climb.sendGo && climb.sendGo > selected ? climb.sendGo - 1 : climb.sendGo; onUpdate({ ...record, climb: { goes: climb.goes - 1, sendGo } }); setSelected(null); }}>Remove go</button></div>}
    <div className="climb-actions"><button onClick={() => onUpdate(changeGoes(record, climb.goes + 1))}>Another go</button><button aria-pressed={!!climb.sendGo} onClick={() => onUpdate({ ...record, climb: climb.sendGo ? { goes: climb.goes } : { goes: Math.max(1, climb.goes), sendGo: Math.max(1, climb.goes) } })}>Sent it ✓</button></div>
    <p className="settings-caption">Tap a go to mark the send or remove it.</p>
    <label className="record-note-field"><span>Note for this record</span><textarea rows={1} aria-label={`Notes for ${record.title}`} placeholder="Beta, conditions, how it felt…" value={record.note ?? ''} onChange={e => onUpdate({ ...record, note: e.target.value })} /></label>
  </div>;
}
