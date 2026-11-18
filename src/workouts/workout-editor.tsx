import { useState } from 'react';
import { Sheet } from '../components/home/journal-sheet';
import { loadExercises, loadPresets, loadWorkoutPlans, saveExercise, saveWorkoutPlan } from './catalog';
import { prescriptionLabel, type Exercise, type Prescription, type WorkoutPlan } from './fixtures';

export function ExerciseSheet({ initial, onClose, onSaved }: { initial?: Exercise; onClose:()=>void; onSaved?:()=>void }) {
  const original=loadPresets().filter(item=>item.exerciseId===initial?.id), p=original[0]?.prescription;
  const [name,setName]=useState(initial?.name??''), [kind,setKind]=useState<Prescription['kind']>(p?.kind??'timed');
  const [sets,setSets]=useState(p?.sets??3), [seconds,setSeconds]=useState(p && 'holdSeconds' in p?p.holdSeconds:10), [rest,setRest]=useState(p?.restSeconds??30), [reps,setReps]=useState(p && 'reps' in p?p.reps:6);
  const [load,setLoad]=useState(p?.kind==='hold'?p.targetKg:p && 'addedLoadKg' in p?p.addedLoadKg??0:0), [band,setBand]=useState(p?.kind==='hold'?p.toleranceKg:1);
  const [edge,setEdge]=useState(p?.kind==='hold'?p.edgeMm:20), [grip,setGrip]=useState(p?.kind==='hold'?p.grip:'three-finger drag');
  const [hands,setHands]=useState<'both'|'left'|'right'|'each'>(original.length===2?'each':p?.kind==='hold'?p.hand:'both');
  const [steps,setSteps]=useState(p?.kind==='paced'?p.steps:[{label:'Hold',seconds:3},{label:'Release',seconds:3}]);
  const [tags,setTags]=useState(initial?.tags??[initial?.category??'training']), [error,setError]=useState('');
  const field=(label:string,value:number,update:(v:number)=>void,min=0)=><label>{label}<input type="number" required min={min} step={label.includes('kg')?'0.1':'1'} value={value} onChange={e=>update(Number(e.target.value))} /></label>;
  return <Sheet title={initial?'Edit exercise':'New exercise'} onClose={onClose}><form className="entry-form" onSubmit={event=>{event.preventDefault();try{
    const id=initial?.id??crypto.randomUUID(), exercise:Exercise={id,name:name.trim(),description:initial?.description??'',category:tags.includes('rehab')?'rehab':'training',tags};
    const base={sets,restSeconds:rest};
    const prescription:Prescription=kind==='timed'?{...base,kind,holdSeconds:seconds}:kind==='reps'?{...base,kind,reps,addedLoadKg:load}:kind==='paced'?{...base,kind,reps,steps,addedLoadKg:load}:{...base,kind,holdSeconds:seconds,targetKg:load,toleranceKg:band,edgeMm:edge,grip,hand:hands==='each'?'left':hands};
    const selections=kind==='hold'&&hands==='each'?['left','right'] as const:[null];
    saveExercise(exercise,selections.map((hand,index)=>({id:original[index]?.id??`${id}-${hand??'preset'}`,exerciseId:id,name:hand?`${name.trim()} · ${hand}`:name.trim(),tags,prescription:hand&&prescription.kind==='hold'?{...prescription,hand}:prescription})));
    onSaved?.();onClose();
  }catch(e){setError((e as Error).message);}}}>
    <label>Name<input required autoFocus value={name} onChange={e=>setName(e.target.value)} /></label>
    <fieldset><legend>Type</legend>{([['timed','Timed hold','Hold for seconds, rest between'],['paced','Paced reps','Follow a rhythm for each rep'],['hold','Force hold','Tindeq target and band'],['reps','Reps and load','Sets of reps with weight']] as const).map(([value,label,description])=><label className="metric-choice" key={value}><span><strong>{label}</strong><small className="muted">{description}</small></span><input type="radio" name="exercise-type" checked={kind===value} onChange={()=>setKind(value)} /></label>)}</fieldset>
    <fieldset><legend>Prescription</legend><div className="form-grid">{field('Sets',sets,setSets,1)}{kind==='reps'||kind==='paced'?field('Reps',reps,setReps,1):field('Hold · s',seconds,setSeconds,1)}{field('Rest between · s',rest,setRest)}{kind!=='timed'&&field(kind==='hold'?'Target · kg':'Added load · kg',load,setLoad)}</div>
    {kind==='hold'&&<><div className="form-grid">{field('Band ± kg',band,setBand)}{field('Edge · mm',edge,setEdge,1)}</div><label>Grip<input required value={grip} onChange={e=>setGrip(e.target.value)} /></label></>}
    {kind==='paced'&&<><p className="eyebrow">Rhythm</p>{steps.map((step,index)=><div className="form-grid" key={index}><label>Movement<input required value={step.label} onChange={e=>setSteps(values=>values.map((item,i)=>i===index?{...item,label:e.target.value}:item))} /></label>{field('Seconds',step.seconds,value=>setSteps(values=>values.map((item,i)=>i===index?{...item,seconds:value}:item)),1)}<button type="button" className="text-action" disabled={steps.length===1} onClick={()=>setSteps(values=>values.filter((_,i)=>i!==index))}>Remove</button></div>)}<button type="button" className="dashed-add" onClick={()=>setSteps(values=>[...values,{label:'',seconds:2}])}>+ Add movement</button></>}
    </fieldset>
    {kind==='hold'&&<fieldset><legend>Hands</legend><div className="choice-pills">{(['both','left','right','each'] as const).map(value=><button key={value} type="button" aria-pressed={hands===value} onClick={()=>setHands(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div></fieldset>}
    <fieldset><legend>Tags</legend><div className="choice-pills">{['rehab','training','climb'].map(tag=><button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={()=>setTags(values=>values.includes(tag)?values.filter(value=>value!==tag):[...values,tag])}>{tag}</button>)}</div></fieldset>
    {error&&<p role="alert">{error}</p>}<button className="primary-button" type="submit">Save exercise</button>
  </form></Sheet>;
}
export function WorkoutSheet({initial,onClose,onSaved,initialTitle=''}:{initial?:WorkoutPlan;onClose:()=>void;onSaved?:(plan:WorkoutPlan)=>void;initialTitle?:string}) {
  const [name,setName]=useState(initial?.name??initialTitle), [ids,setIds]=useState(initial?.presetIds??[]), [tags,setTags]=useState(initial?.tags??['training']);
  const [picker,setPicker]=useState(false), [query,setQuery]=useState(''), [tag,setTag]=useState('all'), [newExercise,setNewExercise]=useState(false), [routine,setRoutine]=useState(false), [error,setError]=useState('');
  const [version,refresh]=useState(0);void version;
  const presets=[...(initial?.presets??[]),...loadPresets()], catalog=loadExercises();
  const reorder=(index:number,delta:number)=>setIds(current=>{const next=[...current];[next[index],next[index+delta]]=[next[index+delta],next[index]];return next;});
  return <><Sheet title={initial?'Edit workout':'New workout'} onClose={onClose}><form className="entry-form" onSubmit={event=>{event.preventDefault();try{
    const plan=saveWorkoutPlan({...initial,id:initial?.id??crypto.randomUUID(),name,description:initial?.description??'',presetIds:ids,tags},routine);
    onSaved?.(plan);onClose();
  }catch(e){setError((e as Error).message);}}}>
  <label>Name<input required autoFocus value={name} onChange={e=>setName(e.target.value)} /></label>
  <fieldset><legend>Exercises · in order</legend><ol className="workout-editor-list">{ids.map((id,index)=>{const preset=presets.find(item=>item.id===id);return <li key={id}><span><strong>{preset?.name}</strong><small>{preset&&prescriptionLabel(preset.prescription)}</small></span><div><button className="icon-button" type="button" aria-label={`Move ${preset?.name} up`} disabled={index===0} onClick={()=>reorder(index,-1)}>↑</button><button className="icon-button" type="button" aria-label={`Move ${preset?.name} down`} disabled={index===ids.length-1} onClick={()=>reorder(index,1)}>↓</button><button className="icon-button" type="button" aria-label={`Remove ${preset?.name}`} onClick={()=>setIds(values=>values.filter(value=>value!==id))}>×</button></div></li>;})}</ol><button className="dashed-add" type="button" onClick={()=>setPicker(true)}>+ Add exercise</button><p className="settings-caption">{ids.length} exercises</p></fieldset>
  <fieldset><legend>Tags</legend><div className="choice-pills">{['rehab','training','climb'].map(tag=><button key={tag} type="button" aria-pressed={tags.includes(tag)} onClick={()=>setTags(values=>values.includes(tag)?values.filter(value=>value!==tag):[...values,tag])}>{tag}</button>)}</div></fieldset>
  <fieldset><legend>Schedule</legend><label className="metric-choice"><span>Make it a routine<small className="muted">After done · 1 rest day between</small></span><input type="checkbox" checked={routine} onChange={e=>setRoutine(e.target.checked)} /></label></fieldset>
  {error&&<p role="alert">{error}</p>}<button type="submit" className="primary-button">Save workout</button></form></Sheet>
  {picker&&<Sheet title="Add exercise" eyebrow={name} onClose={()=>setPicker(false)}><label className="form-label">Search exercises<input type="search" value={query} onChange={e=>setQuery(e.target.value)} /></label><div className="choice-pills">{['all','rehab','training','climb'].map(value=><button key={value} aria-pressed={tag===value} onClick={()=>setTag(value)}>{value}</button>)}</div><div className="settings-list">{loadPresets().filter(p=>p.id!=='finger-rehab').filter(p=>{const exercise=catalog.find(e=>e.id===p.exerciseId);return p.name.toLowerCase().includes(query.toLowerCase())&&(tag==='all'||exercise?.category===tag||exercise?.tags?.includes(tag));}).map(p=><button type="button" key={p.id} className="settings-row" onClick={()=>setIds(values=>values.includes(p.id)?values.filter(id=>id!==p.id):[...values,p.id])}><span><strong>{p.name}</strong><small>{prescriptionLabel(p.prescription)}</small></span><span>{ids.includes(p.id)?'Added':'+'}</span></button>)}</div><button className="dashed-add" onClick={()=>setNewExercise(true)}>+ Create new exercise</button><button className="primary-button full-width" onClick={()=>setPicker(false)}>Done</button></Sheet>}
  {newExercise&&<ExerciseSheet onClose={()=>setNewExercise(false)} onSaved={()=>refresh(value=>value+1)} />}</>;
}
export function WorkoutsList({query,onNew}:{query:string;onNew:()=>void}) {
  const [tab,setTab]=useState<'workouts'|'exercises'>('workouts'), [editing,setEditing]=useState<Exercise>(), [,refresh]=useState(0);
  const plans=loadWorkoutPlans(),exercises=loadExercises();
  return <><div className="choice-pills">{(['workouts','exercises'] as const).map(value=><button key={value} aria-pressed={tab===value} onClick={()=>setTab(value)}>{value[0].toUpperCase()+value.slice(1)}</button>)}</div><p className="settings-caption">{plans.length} workouts · {exercises.length} exercises</p><div className="settings-list">{tab==='workouts'?plans.filter(p=>p.name.toLowerCase().includes(query.toLowerCase())).map(p=><a className="settings-row" key={p.id} href={`#/library/workouts/plan-${p.id}`}><strong>{p.name}</strong><small>{p.presetIds.length} exercises</small></a>):exercises.filter(e=>e.name.toLowerCase().includes(query.toLowerCase())).map(e=><button key={e.id} className="settings-row" onClick={()=>setEditing(e)}><strong>{e.name}</strong><small>{e.category}</small></button>)}</div><button className="dashed-add" onClick={()=>tab==='workouts'?onNew():setEditing({id:crypto.randomUUID(),name:'',category:'training',description:''})}>+ New {tab==='workouts'?'workout':'exercise'}</button><p className="settings-caption">Exercises are the building blocks. Switch tabs to edit one or create a new one.</p>{editing&&<ExerciseSheet initial={editing.name?editing:undefined} onClose={()=>setEditing(undefined)} onSaved={()=>refresh(value=>value+1)} />}</>;
}
