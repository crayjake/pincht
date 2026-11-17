import { useState } from 'react';
import { addDays, realSessions, weekStart, type RoutineData } from '../../routines/data';
import { allRoutines, routineCount, routineDone, routineDue, routinePlans } from '../../routines/tasks';
import { loadWorkoutPlans } from '../../workouts/catalog';
import { clearWorkoutDraft, loadWorkoutDraft } from '../../workouts/draft';
import { planPresets } from '../../workouts/fixtures';
import { loadSessions } from '../../workouts/storage';
import { localDate, shortDate } from './journal-data';
import { Sheet } from './journal-sheet';
export function NextWorkout({ data, empty = false }: { data: RoutineData; empty?: boolean }) {
  const [draft,setDraft] = useState(loadWorkoutDraft);
  const [discard,setDiscard] = useState(false);
  const plans = loadWorkoutPlans(), sessions = realSessions(loadSessions()), today = localDate();
  const next = allRoutines(data).filter(routine => routine.active && routine.start && ['training','rehab'].includes(routine.kind)).flatMap(routine => {
    const date = routine.schedule === 'weekly' ? routine.start > today ? routine.start : routineCount(routine,data,sessions,today) < routine.target ? today : addDays(weekStart(today),7) : Array.from({length:366},(_,i)=>addDays(today,i)).find(date=>routineDue(routine,data,sessions,date)&&!routineDone(routine,data,sessions,date));
    const plan = routinePlans(routine).flatMap(id=>plans.filter(plan=>plan.id===id))[0];
    return date && plan ? [{date,plan,weekly:routine.schedule==='weekly'}] : [];
  }).sort((a,b)=>a.date.localeCompare(b.date)||Number(a.weekly)-Number(b.weekly))[0];
  const plan = plans.find(plan=>draft?.route===`/train/${plan.id}`) ?? next?.plan;
  if (!draft && !next) return empty ? <section className="full-widget"><header><h2>Next up</h2></header><p className="widget-empty">No workouts scheduled.</p><a className="text-action" href="#/routines">Routines ›</a></section> : null;
  return <><section className="next-workout" data-category={plan?.id.includes('rehab')?'rehab':plan?.id==='mobility'?'sleep':'training'}>
    <div className="next-eyebrow">{draft?'In progress':`Next up · ${next.weekly&&next.date===today?'due this week':next.date===today?'due today':`due ${shortDate(next.date,{weekday:'short',day:'numeric'})}`}`}</div><h2>{draft?.title??next.plan.name}</h2>
    {!draft&&<p>{planPresets(next.plan).filter(preset=>!preset.locked&&!preset.optional).map(preset=>preset.name).join(' · ')}</p>}
    <a className="open-workout" href={draft?`#${draft.route}`:`#/train/${next.plan.id}`}>{draft?'Resume workout':'Open workout'}</a>{draft&&<button className="text-action" onClick={()=>setDiscard(true)}>Discard progress</button>}
  </section>{discard&&<Sheet title="Discard workout progress?" onClose={()=>setDiscard(false)}><p>This removes the unfinished workout. Saved workouts stay in your journal.</p><button className="primary-button" onClick={()=>{clearWorkoutDraft();setDraft(null);setDiscard(false)}}>Discard progress</button></Sheet>}</>;
}
