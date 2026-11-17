import { useState } from 'react';
import { localDate, duration, stageTotals, type Day, type JournalRecord } from './journal-data';
import { loadDays, loadResources, saveDays, saveResources } from './journal-storage';
import { Sheet } from './journal-sheet';

export function QuickLog({ kind, onClose, onSaved }: { kind: 'weight' | 'climb' | 'sleep' | 'finger'; onClose: () => void; onSaved?: () => void }) {
  const [days] = useState(loadDays);
  const [resources] = useState(() => [...new Map([...loadDays().flatMap(day => day.records), ...loadResources()].filter(record => record.kind === 'climb').map(record => [record.id, record])).values()]);
  const [id, setId] = useState(resources[0]?.id ?? 'new');
  const [title, setTitle] = useState('');
  const [grade, setGrade] = useState('');
  const [weight, setWeight] = useState(() => String(days.find(day => day.date === localDate())?.metrics.weight ?? ''));
  const initialSleep = days.find(day => day.date === localDate())?.metrics.sleep;
  const [hours, setHours] = useState(initialSleep === undefined ? '' : String(Math.floor(initialSleep / 60)));
  const [minutes, setMinutes] = useState(initialSleep === undefined ? '' : String(initialSleep % 60));
  const initial = days.find(day => day.date === localDate())?.records.find(record => record.id === id);
  const [goes, setGoes] = useState(initial?.climb?.goes ?? 1);
  const [sent, setSent] = useState(!!initial?.climb?.sendGo);
  const [note, setNote] = useState(initial?.note ?? '');
  const today = days.find(day => day.date === localDate());
  const [finger, setFinger] = useState(String(today?.measurements?.fingerStrengthKg ?? ''));
  const [wall, setWall] = useState(String(today?.measurements?.climbingMinutes ?? ''));
  const totals = today?.records.find(record => record.sleep)?.sleep;
  const [stages, setStages] = useState(() => totals ? Object.fromEntries(Object.entries(stageTotals(totals)).filter(([key]) => key !== 'awake').map(([key,value]) => [key,String(value)])) : { deep: '', rem: '', light: '' } as Record<string,string>);
  const [error, setError] = useState('');
  function save() {
    try {
      const current = loadDays();
      const day: Day = structuredClone(current.find(day => day.date === localDate()) ?? { date: localDate(), types: [], metrics: {}, visibleMetrics: [], records: [] });
      if (kind === 'weight') {
        if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) throw new Error('Enter your weight.');
        day.metrics.weight = Number(weight); day.visibleMetrics = [...new Set([...day.visibleMetrics, 'weight' as const])];
      } else if (kind === 'finger') {
        if (!Number.isFinite(Number(finger)) || Number(finger) <= 0) throw new Error('Enter a load greater than zero.');
        day.measurements = { ...day.measurements, fingerStrengthKg: Number(finger) };
        const record: JournalRecord = { id: `measurement-finger-${day.date}`, kind: 'rehab', title: '20 mm drag', metric: `${Number(finger)} kg`, meta: 'Finger strength' };
        day.records = [...day.records.filter(item => item.id !== record.id), record];
      } else if (kind === 'sleep') {
        const total = Number(hours) * 60 + Number(minutes);
        if ((!hours && !minutes) || !Number.isInteger(Number(hours)) || !Number.isInteger(Number(minutes)) || Number(hours) < 0 || Number(minutes) < 0 || Number(minutes) > 59 || total <= 0 || total > 1440) throw new Error('Enter a sleep duration of up to 24 hours.');
        const hasStages = Object.values(stages).some(value => value !== '');
        if (hasStages && (Object.values(stages).some(value => value === '' || !Number.isInteger(Number(value)) || Number(value) < 0) || Object.values(stages).reduce((sum,value) => sum + Number(value),0) !== total)) throw new Error('Enter all three stages in minutes, adding up to your sleep duration.');
        const sleepRecord = day.records.find(record => record.sleep);
        if (hasStages) {
          const record: JournalRecord = { id: sleepRecord?.id ?? `sleep-${day.date}`, kind: 'sleep', title: 'Sleep', metric: duration(total), meta: 'Sleep stages', sleep: { date: day.date, segments: (['deep','rem','light'] as const).map(stage => ({stage,minutes:Number(stages[stage])})) } };
          day.records = [...day.records.filter(item => item.id !== record.id), record];
        } else if (sleepRecord) day.records = day.records.filter(record => record.id !== sleepRecord.id);
        day.metrics.sleep = total; day.visibleMetrics = [...new Set([...day.visibleMetrics, 'sleep' as const])];
      } else {
        const resource: JournalRecord = id === 'new' ? { id: crypto.randomUUID(), kind: 'climb', title: title.trim(), metric: grade.trim(), meta: '' } : resources.find(record => record.id === id)!;
        if (!resource?.title || !Number.isInteger(goes) || goes < 1) throw new Error('Name the climb and enter at least one go.');
        if (wall && (!Number.isInteger(Number(wall)) || Number(wall) <= 0)) throw new Error('Enter climbing time in whole minutes.');
        day.measurements = { ...day.measurements, climbingMinutes: wall ? Number(wall) : undefined };
        const previous = day.records.find(item => item.id === resource.id)?.climb;
        const record = { ...resource, note: note.trim(), climb: { goes, ...(sent ? { sendGo: Math.min(previous?.sendGo ?? goes, goes) } : {}) } };
        if (id === 'new') saveResources([...loadResources(), resource]);
        day.records = [...day.records.filter(item => item.id !== record.id), record]; day.types = [...new Set([...day.types.filter(type => type !== 'rest'), 'climb' as const])];
      }
      saveDays([...current.filter(item => item.date !== day.date), day].sort((a, b) => b.date.localeCompare(a.date)));
      onSaved?.(); onClose();
    } catch (error) { setError((error as Error).message); }
  }
  return <Sheet title={kind === 'weight' ? 'Log weigh-in' : kind === 'sleep' ? 'Log sleep' : kind === 'finger' ? 'Log finger strength' : 'Log climb'} onClose={onClose}><form className="entry-form" onSubmit={event => { event.preventDefault(); save(); }}>
    {kind === 'weight' ? <label>Weight · kg<input autoFocus required type="number" min="1" step="0.1" value={weight} onChange={event => setWeight(event.target.value)} /></label> : kind === 'finger' ? <label>20 mm three-finger drag · kg<input autoFocus required type="number" min="0.1" step="0.1" value={finger} onChange={event => setFinger(event.target.value)} /></label> : kind === 'sleep' ? <><label>Hours<input autoFocus type="number" min="0" max="24" step="1" value={hours} onChange={event => setHours(event.target.value)} /></label><label>Minutes<input type="number" min="0" max="59" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><details><summary>Sleep stages · optional</summary>{(['deep','rem','light'] as const).map(stage => <label key={stage}>{stage === 'rem' ? 'REM' : stage === 'deep' ? 'Deep' : 'Light'} · minutes<input type="number" min="0" step="1" value={stages[stage]} onChange={event => setStages(current => ({...current,[stage]:event.target.value}))} /></label>)}</details></> : <>
      <label>Climb<select value={id} onChange={event => { const next = event.target.value; setId(next); const log = days.find(day => day.date === localDate())?.records.find(record => record.id === next); setGoes(log?.climb?.goes ?? 1); setSent(!!log?.climb?.sendGo); setNote(log?.note ?? ''); }}>{resources.map(record => <option key={record.id} value={record.id}>{record.title}</option>)}<option value="new">+ New climb</option></select></label>
      {id === 'new' && <><label>Name<input required value={title} onChange={event => setTitle(event.target.value)} /></label><label>Grade<input value={grade} onChange={event => setGrade(event.target.value)} /></label></>}
      <label>Climbing time today · minutes · optional<input type="number" min="1" step="1" value={wall} onChange={event => setWall(event.target.value)} /></label>
      <label>Goes today<input required type="number" min="1" step="1" value={goes} onChange={event => setGoes(Number(event.target.value))} /></label><label className="metric-choice"><span>Sent it</span><input type="checkbox" checked={sent} onChange={event => setSent(event.target.checked)} /></label><label>Note<textarea value={note} onChange={event => setNote(event.target.value)} /></label>
    </>}{error && <p role="alert">{error}</p>}<button className="primary-button" type="submit">Save {kind === 'weight' ? 'weigh-in' : kind === 'sleep' ? 'sleep' : kind === 'finger' ? 'measurement' : 'climb'}</button>
  </form></Sheet>;
}
