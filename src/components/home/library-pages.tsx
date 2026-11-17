import { loadDays } from './journal-storage';
import { useMemo, useState } from 'react';
import { useRoutines } from '../../routines/use-routines';
import { dragLoads } from '../../routines/rehab-loads';
import { loadSessions } from '../../workouts/storage';
import { InDevelopment, PrimaryNav } from '../app-navigation';
import { shortDate, type PillResource } from './journal-data';
import { RecordItem } from './journal-records';
import { Sheet } from './journal-sheet';
import { JournalWidgets } from './journal-widgets';
import './home.scss';

export default function LibraryPage({ kind }: { kind: 'climbs' | 'metrics' }) {
  const routines = useRoutines(false);
  const [detail, setDetail] = useState<PillResource | null>(null);
  const [configure, setConfigure] = useState(false);
  const days = useMemo(loadDays, []);
  const loads = useMemo(() => dragLoads(loadSessions()), []);
  return <><main className="today-page library-page"><InDevelopment /><h1>{kind === 'climbs' ? 'Climbs' : 'Metrics'}</h1>
    {kind === 'climbs' ? <div className="library-records">{days.flatMap(day => day.records.filter(r => r.kind === 'climb').map(record => <section key={record.id}><div className="eyebrow muted">{shortDate(day.date, { weekday: 'short', day: 'numeric', month: 'short' })}</div><div className="day-records"><RecordItem record={record} onOpen={setDetail} /></div></section>))}</div> : <><JournalWidgets days={days} loads={loads} visible={{ rehab: true, sleep: true }} onConfigure={() => setConfigure(true)} /><h2 className="eyebrow muted">Daily metrics</h2><div className="routine-card">{days.filter(d => d.metrics.sleep !== undefined || d.metrics.weight !== undefined).map(day => <div className="metrics-row" key={day.date}><span>{shortDate(day.date, { day: 'numeric', month: 'short' })}</span><span data-category="sleep">{day.metrics.sleep !== undefined ? `${Math.floor(day.metrics.sleep / 60)}h ${Math.round(day.metrics.sleep % 60)}m` : '—'}</span><span>{day.metrics.weight !== undefined ? `${day.metrics.weight.toFixed(1)} kg` : '—'}</span></div>)}</div></>}
    {routines.error && <p role="status">{routines.error}</p>}
  </main><PrimaryNav active={kind === 'climbs' ? 'climbing' : undefined} />
  {configure && <Sheet title="Today widgets" development onClose={() => setConfigure(false)}>{(['rehab', 'sleep'] as const).map(widget => <label className="metric-choice" key={widget}><span>{widget === 'rehab' ? 'Finger rehab' : 'Sleep'} on Today</span><input type="checkbox" checked={routines.data.widgets[widget]} onChange={event => routines.update({ ...routines.data, widgets: { ...routines.data.widgets, [widget]: event.target.checked } })} /></label>)}<button className="primary-button full-width" onClick={() => setConfigure(false)}>Done</button></Sheet>}
  {detail && detail.kind !== 'chart' && <Sheet title={detail.title} development onClose={() => setDetail(null)}><RecordItem record={detail} onOpen={() => {}} /></Sheet>}
  </>;
}
