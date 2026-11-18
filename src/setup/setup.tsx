import { useState } from 'react';
import { allView, climbingView, VIEWS_KEY, type JournalView } from '../components/home/journal-views';
import { JOURNAL_KEY } from '../components/home/journal-storage';
import { Icon } from '../components/home/journal-icons';
import { createRoutines, ROUTINES_KEY } from '../routines/data';
import { allRoutines } from '../routines/tasks';
import { dataKey, getDataMode } from '../data/mode';
import { writeStored } from '../data/storage';
import { isRoutineData, isViews } from '../data/validation';

const interests = [
  { id: 'climbing', name: 'Climbing', icon: 'climbs' },
  { id: 'rehab', name: 'Finger rehab', icon: 'train' },
  { id: 'training', name: 'Training', icon: 'bolt' },
  { id: 'sleep', name: 'Sleep', icon: 'sleep' },
  { id: 'reading', name: 'Reading', icon: 'book' },
  { id: 'alcohol', name: 'Alcohol-free days', icon: 'drink' },
] as const;
export function needsSetup() {
  return getDataMode() === 'real' && localStorage.getItem(dataKey(ROUTINES_KEY)) === null && localStorage.getItem(dataKey(JOURNAL_KEY)) === null;
}
export function configureInterests(selected: string[]) {
  const data = createRoutines();
  data.routines = allRoutines(data).map(routine => ({...routine, active: selected.includes(routine.kind === 'rehab' ? 'rehab' : routine.kind)}));
  data.widgets = { rehab: selected.includes('rehab'), sleep: selected.includes('sleep') };
  const views: JournalView[] = [structuredClone(allView)];
  if (selected.includes('climbing') || selected.includes('rehab') || selected.includes('training')) views.push(structuredClone(climbingView));
  if (selected.includes('reading')) views.push({id:'reading',name:'Reading',tags:['reading'],blocks:[{id:'journal',type:'journal',enabled:true}]});
  if (selected.includes('sleep')) views.push({id:'sleep',name:'Sleep',tags:['sleep'],blocks:[{id:'widgets',type:'widgets',enabled:true,widgets:['sleep','stages']},{id:'journal',type:'journal',enabled:true}]});
  const keys = [dataKey(ROUTINES_KEY),dataKey(VIEWS_KEY)];
  const previous = keys.map(key => localStorage.getItem(key));
  try {
    writeStored(keys[1], views, [], isViews);
    writeStored(keys[0], data, createRoutines(), isRoutineData);
  } catch (error) {
    keys.forEach((key,i) => { if (previous[i] === null) localStorage.removeItem(key); else localStorage.setItem(key,previous[i]!); });
    throw error;
  }
}
export function FirstRun({ onDone }: { onDone: () => void }) {
  const [selected, setSelected] = useState<string[]>(['climbing','rehab','training']);
  const [error, setError] = useState('');
  function finish(values: string[]) { try { configureInterests(values); onDone(); } catch (error) { setError((error as Error).message); } }
  return <main className="today-page first-run"><span className="eyebrow">Welcome</span><h1>What do you want to keep track of?</h1><p className="muted">Each choice sets up routines, views and widgets. You can change everything later.</p><div className="interest-grid">{interests.map(item => <button key={item.id} className="interest-tile" aria-pressed={selected.includes(item.id)} onClick={() => setSelected(values => values.includes(item.id) ? values.filter(value => value !== item.id) : [...values,item.id])}><Icon name={item.icon} size={28} /><strong>{item.name}</strong>{selected.includes(item.id) && <span className="interest-check"><Icon name="check" size={14} /></span>}</button>)}</div>{error && <p role="alert">{error}</p>}<button className="primary-button full-width" onClick={() => finish(selected)}>Set up {selected.length} {selected.length === 1 ? 'thing' : 'things'}</button><button className="text-action full-width" onClick={() => finish([])}>Start empty</button></main>;
}
