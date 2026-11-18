import { useState } from 'react';
import { localDate, stageTotals } from './journal-data';
import { loadDays } from './journal-storage';
import { setDailyMeasurement } from '../../data/history';
import { ClimbSessionSheet } from '../../climbs/climb-pages';
import { Sheet } from './journal-sheet';

type Props = { kind: 'weight' | 'climb' | 'sleep' | 'finger'; onClose: () => void; onSaved?: () => void };
export function QuickLog(props: Props) { return props.kind === 'climb' ? <ClimbSessionSheet {...props} /> : <MeasurementLog {...props} />; }
function MeasurementLog({kind,onClose,onSaved}: Props) {
  const [days] = useState(loadDays);
  const [weight, setWeight] = useState(() => String(days.find(day => day.date === localDate())?.metrics.weight ?? ''));
  const initialSleep = days.find(day => day.date === localDate())?.metrics.sleep;
  const [hours, setHours] = useState(initialSleep === undefined ? '' : String(Math.floor(initialSleep / 60)));
  const [minutes, setMinutes] = useState(initialSleep === undefined ? '' : String(initialSleep % 60));
  const today = days.find(day => day.date === localDate());
  const [finger, setFinger] = useState(String(today?.measurements?.fingerStrengthKg ?? ''));
  const totals = today?.records.find(record => record.sleep)?.sleep;
  const [stages, setStages] = useState(() => totals ? Object.fromEntries(Object.entries(stageTotals(totals)).filter(([key]) => key !== 'awake').map(([key,value]) => [key,String(value)])) : { deep: '', rem: '', light: '' } as Record<string,string>);
  const [error, setError] = useState('');
  function save() {
    try {
      const day = {date:localDate()};
      if (kind === 'weight') {
        if (!Number.isFinite(Number(weight)) || Number(weight) <= 0) throw new Error('Enter your weight.');
        setDailyMeasurement(day.date, 'weight', Number(weight));
      } else if (kind === 'finger') {
        if (!Number.isFinite(Number(finger)) || Number(finger) <= 0) throw new Error('Enter a load greater than zero.');
        setDailyMeasurement(day.date, 'finger', Number(finger));
      } else if (kind === 'sleep') {
        const total = Number(hours) * 60 + Number(minutes);
        if ((!hours && !minutes) || !Number.isInteger(Number(hours)) || !Number.isInteger(Number(minutes)) || Number(hours) < 0 || Number(minutes) < 0 || Number(minutes) > 59 || total <= 0 || total > 1440) throw new Error('Enter a sleep duration of up to 24 hours.');
        const hasStages = Object.values(stages).some(value => value !== '');
        if (hasStages && (Object.values(stages).some(value => value === '' || !Number.isInteger(Number(value)) || Number(value) < 0) || Object.values(stages).reduce((sum,value) => sum + Number(value),0) !== total)) throw new Error('Enter all three stages in minutes, adding up to your sleep duration.');
        setDailyMeasurement(day.date, 'sleep', total, hasStages ? (['deep','rem','light'] as const).map(stage => ({stage,minutes:Number(stages[stage])})) : undefined);
      }
      onSaved?.(); onClose();
    } catch (error) { setError((error as Error).message); }
  }
  return <Sheet title={kind === 'weight' ? 'Log weigh-in' : kind === 'sleep' ? 'Log sleep' : kind === 'finger' ? 'Log finger strength' : 'Log climb'} onClose={onClose}><form className="entry-form" onSubmit={event => { event.preventDefault(); save(); }}>
    {kind === 'weight' ? <label>Weight · kg<input autoFocus required type="number" min="1" step="0.1" value={weight} onChange={event => setWeight(event.target.value)} /></label> : kind === 'finger' ? <label>20 mm three-finger drag · kg<input autoFocus required type="number" min="0.1" step="0.1" value={finger} onChange={event => setFinger(event.target.value)} /></label> : kind === 'sleep' ? <><label>Hours<input autoFocus type="number" min="0" max="24" step="1" value={hours} onChange={event => setHours(event.target.value)} /></label><label>Minutes<input type="number" min="0" max="59" step="1" value={minutes} onChange={event => setMinutes(event.target.value)} /></label><details><summary>Sleep stages · optional</summary>{(['deep','rem','light'] as const).map(stage => <label key={stage}>{stage === 'rem' ? 'REM' : stage === 'deep' ? 'Deep' : 'Light'} · minutes<input type="number" min="0" step="1" value={stages[stage]} onChange={event => setStages(current => ({...current,[stage]:event.target.value}))} /></label>)}</details></> : null}{error && <p role="alert">{error}</p>}<button className="primary-button" type="submit">Save {kind === 'weight' ? 'weigh-in' : kind === 'sleep' ? 'sleep' : kind === 'finger' ? 'measurement' : 'climb'}</button>
  </form></Sheet>;
}
