import { loadPresets } from '../workouts/catalog';
import { useState } from 'react';
import { Sheet } from '../components/home/journal-sheet';
import { localDate, type JournalRecord } from '../components/home/journal-data';
import { loadDays, loadResources, saveResources } from '../components/home/journal-storage';
import { availableLoadSeries, directDragSeriesId, type LoadSeries } from '../workouts/measurements';
import { loadSessions } from '../workouts/storage';
import { climbGoalProgress } from './progress';
import { climbResources } from '../climbs/data';

export function seriesLabel(series: LoadSeries) {
  const p = series.prescription;
  return p?.kind === 'hold' ? `${series.name} · ${p.hand} · ${p.edgeMm} mm · ${p.grip} · ${p.sets} × ${p.holdSeconds} s · ${series.statistic === 'peak' ? 'peak' : 'set mean'}` : `${series.name} · ${series.statistic}`;
}
export function GoalSheet({ onClose, initial, initialTitle = '', onCreated }: { onClose: () => void; initial?: JournalRecord; initialTitle?: string; onCreated?: (record: JournalRecord) => void }) {
  const [name,setName] = useState(initial?.title ?? initialTitle);
  const [mode,setMode] = useState(initial?.goal ? 'number' : 'checklist');
  const [climbIds,setClimbIds] = useState(initial?.climbGoal?.climbIds ?? []);
  const [targetDate,setTargetDate] = useState(initial?.climbGoal?.targetDate ?? '');
  const [tags,setTags] = useState(initial?.climbGoal?.tags ?? ['goal','climb']);
  const [target,setTarget] = useState(String(initial?.goal?.targetKg ?? 25));
  const [seriesId,setSeriesId] = useState(initial?.goal?.seriesId ?? directDragSeriesId);
  const [query,setQuery] = useState('');
  const [adding,setAdding] = useState(false);
  const [error,setError] = useState('');
  const days = loadDays();
  const climbs = climbResources();
  const series = availableLoadSeries(days,loadSessions(),loadPresets());
  const progress = climbGoalProgress({id:'draft',kind:'goal',title:name,metric:'',meta:'',climbGoal:{climbIds}},days);
  function save() {
    try {
      if (!name.trim()) throw new Error('Enter a name.');
      if (mode === 'checklist' && !climbIds.length) throw new Error('Add at least one climb.');
      if (mode === 'number' && (!series.some(item => item.id === seriesId) || !Number.isFinite(Number(target)) || Number(target) <= 0)) throw new Error('Choose a measurement and a positive target.');
      const record: JournalRecord = { id:initial?.id ?? crypto.randomUUID(),kind:'goal',title:name.trim(),metric:mode === 'number' ? `${Number(target)} kg` : `${progress.completed} of ${progress.total}`,meta:targetDate ? `By ${targetDate}` : '',
        ...(mode === 'checklist' ? {climbGoal:{climbIds,targetDate:targetDate || undefined,tags}} : {goal:{metric:'finger-strength',targetKg:Number(target),seriesId}}) };
      saveResources([...loadResources().filter(item => item.id !== record.id),record]);
      onCreated?.(record); onClose();
    } catch(error) { setError((error as Error).message); }
  }
  return <Sheet title={initial ? 'Edit goal' : 'New goal'} onClose={onClose}><form className="entry-form" onSubmit={event => {event.preventDefault();save();}}><label>Name<input autoFocus value={name} onChange={event => setName(event.target.value)} required /></label><fieldset><legend>Measured by</legend><div className="settings-segment">{['checklist','number'].map(value => <button type="button" key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{value === 'checklist' ? 'Checklist' : 'Number'}</button>)}</div></fieldset>
    {mode === 'checklist' ? <><fieldset><legend>Climbs on the list</legend><div className="settings-list">{climbIds.map(id => <div key={id} className="settings-row"><strong>{climbs.find(climb => climb.id === id)?.title ?? 'Unavailable climb'}</strong><button type="button" className="text-action" aria-label={`Remove ${climbs.find(climb => climb.id === id)?.title ?? 'climb'}`} onClick={() => setClimbIds(values => values.filter(value => value !== id))}>×</button></div>)}<button type="button" className="settings-row" onClick={() => setAdding(value => !value)}>+ Add</button></div>{adding && <><input type="search" aria-label="Search climbs to add" placeholder="Search climbs" value={query} onChange={event => setQuery(event.target.value)} /><div className="settings-list">{climbs.filter(climb => !climbIds.includes(climb.id) && climb.title.toLowerCase().includes(query.toLowerCase())).map(climb => <button className="settings-row" type="button" key={climb.id} onClick={() => {setClimbIds(values => [...values,climb.id]);setAdding(false);setQuery('');}}><strong>{climb.title}</strong><small>{climb.metric}</small></button>)}{!climbs.length && <p className="settings-caption">Add climbs to your library first.</p>}</div></>}</fieldset><p className="settings-caption">Sent so far · {progress.completed} of {progress.total}</p><label>Target date<input type="date" value={targetDate} onChange={event => setTargetDate(event.target.value)} /></label><fieldset><legend>Show in views tagged</legend><div className="settings-chips">{['goal','climb','training'].map(tag => <button type="button" key={tag} aria-pressed={tags.includes(tag)} onClick={() => setTags(values => values.includes(tag) ? values.filter(value => value !== tag) : [...values,tag])}>{tag}</button>)}</div></fieldset></> : <><label>Measurement<select value={seriesId} onChange={event => setSeriesId(event.target.value)}>{series.map(item => <option key={item.id} value={item.id}>{seriesLabel(item)}</option>)}</select></label><label>Target · kg<input type="number" min="0.1" step="0.1" required value={target} onChange={event => setTarget(event.target.value)} /></label></>}
    {error && <p role="alert">{error}</p>}<button className="primary-button" type="submit">{initial ? 'Save goal' : 'Create goal'}</button></form></Sheet>;
}

export function GoalChecklist({ goal, days, resources, onEdit }: { goal:JournalRecord;days:ReturnType<typeof loadDays>;resources:JournalRecord[];onEdit:() => void }) {
  const progress = climbGoalProgress(goal,days);
  const remaining = goal.climbGoal?.targetDate ? Math.ceil((Date.parse(goal.climbGoal.targetDate)-Date.parse(localDate()))/86400000) : undefined;
  return <>{goal.climbGoal?.targetDate && <p className="mono muted">By {goal.climbGoal.targetDate}{remaining !== undefined && remaining >= 0 ? ` · ${remaining} days left` : ''}</p>}<p className="goal-count">{progress.completed} <span className="muted">of {progress.total}</span></p><section className="settings-section"><h2 className="eyebrow">Climbs on this goal</h2><div className="settings-list">{progress.climbs.map(climb => {const record=resources.find(record => record.id === climb.id);return <a className="settings-row" href={`#/library/climbs/${encodeURIComponent(climb.id)}`} key={climb.id}><strong>{record?.title ?? 'Unavailable climb'}</strong><small>{climb.sent ? `sent ${climb.sentAt} · done` : record?.metric || 'project'}</small></a>;})}<button className="settings-row text-action" onClick={onEdit}>+ Add climb to goal</button></div></section></>;
}
