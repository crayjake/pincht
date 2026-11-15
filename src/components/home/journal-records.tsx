import type { CSSProperties } from 'react';
import { duration, stageTotals, type JournalRecord, type PillResource, type SleepNight } from './journal-data';
import { Icon } from './journal-icons';
import { Holds } from './journal-widgets';

export function RecordPill({ record, onOpen }: { record: PillResource; onOpen: (record: PillResource) => void }) {
  return <a className="record-pill" data-category={record.kind === 'chart' ? record.category : record.kind} href={`#record-${record.id}`} onClick={event => { event.preventDefault(); onOpen(record); }}>@{record.title}</a>;
}
export function Hypnogram({ night, compact = false }: { night: SleepNight; compact?: boolean }) {
  const totals = stageTotals(night);
  return <>
    <div className={`hypnogram${compact ? ' hypnogram-compact' : ''}`} role="img" aria-label={`Sleep stages from ${night.start} to ${night.end}. ${(['deep', 'rem', 'light', 'awake'] as const).map(stage => `${stage}: ${duration(totals[stage])}`).join(', ')}`}>
      {night.segments.map((segment, i) => <span key={i} data-stage={segment.stage} style={{ flexGrow: segment.minutes } as CSSProperties} />)}
    </div>
    <div className="sleep-times"><span>{night.start}</span><span>{night.end}</span></div>
    {!compact && <div className="sleep-legend">{(['deep', 'rem', 'light', 'awake'] as const).map(stage => <span key={stage}><i data-stage={stage} />{stage === 'rem' ? 'REM' : stage[0].toUpperCase() + stage.slice(1)} <strong>{duration(totals[stage])}</strong></span>)}</div>}
  </>;
}
export function RecordItem({ record, onOpen, compact = false }: { record: JournalRecord; onOpen: (record: PillResource) => void; compact?: boolean }) {
  return <div className="day-record">
    <div className="record-heading"><h3><RecordPill record={record} onOpen={onOpen} /></h3><span className="record-metric">{record.metric}</span></div>
    {record.meta && <div className="record-meta">{record.meta}</div>}
    {record.sleep && <Hypnogram night={record.sleep} compact={compact} />}
    {record.note && <div className="record-note"><Icon name="note" size={14} /><p>{record.note}</p></div>}
    {record.progress && <div className="goal-progress" role="img" aria-label={`${record.progress.completed} of ${record.progress.total} climbs sent`}><Holds categories={Array.from({ length: record.progress.total }, () => 'goal')} /></div>}
  </div>;
}
export function DayRecords({ records, onOpen, compact = false, id }: { records: JournalRecord[]; onOpen: (record: PillResource) => void; compact?: boolean; id: string }) {
  return <section className={`day-records${compact ? ' day-records-inline' : ''}`} aria-label="Day records" id={id}>
    {records.map(record => <RecordItem key={record.id} record={record} onOpen={onOpen} compact={compact} />)}
    {!records.length && <p className="empty-records">No records for this day.</p>}
  </section>;
}
