import { dataKey } from '../data/mode';
import { exercises, workoutPlans, workoutPresets, type Exercise, type WorkoutPlan, type WorkoutPreset } from './fixtures';
import { readStored, readStoredStrict } from '../data/storage';
import { isExercises, isPlans, isPresets, isRoutineData } from '../data/validation';
import { commitStored } from '../data/transaction';
import { loadRoutines } from '../routines/storage';
import { allRoutines, routinePlans } from '../routines/tasks';
import { saveRoutine } from '../routines/tasks';
import { localDate } from '../components/home/journal-data';
import { planCategory } from './fixtures';
import { ROUTINES_KEY, createRoutines } from '../routines/data';
export const KEY = 'pincht.workout-plans';
export const EXERCISES_KEY = 'pincht.exercises';
export const PRESETS_KEY = 'pincht.exercise-presets';
export const DELETED_KEY = 'pincht.deleted-workouts';
export const isDeleted = (value:unknown): value is string[] => Array.isArray(value) && value.every(item=>typeof item==='string');
export function loadExercises(): Exercise[] { return [...new Map([...exercises,...readStored(dataKey(EXERCISES_KEY),[],isExercises)].map(item=>[item.id,item])).values()]; }
export function loadPresets(): WorkoutPreset[] { const saved=readStored(dataKey(PRESETS_KEY),[],isPresets), edited=new Set(readStored(dataKey(EXERCISES_KEY),[],isExercises).map(item=>item.id)); return [...workoutPresets.filter(item=>!edited.has(item.exerciseId)),...saved]; }
export function loadWorkoutPlans(): WorkoutPlan[] {
  const saved = readStored(dataKey(KEY), [], isPlans), deleted=readStored(dataKey(DELETED_KEY),[],isDeleted);
  const presets=loadPresets(), catalog=loadExercises();
  return [...new Map([...workoutPlans,...saved].map(plan=>[plan.id,plan])).values()].filter(plan=>!deleted.includes(plan.id)).map(plan=>({...plan,presets:plan.presetIds.map(id=>presets.find(item=>item.id===id)??plan.presets?.find(item=>item.id===id)??workoutPresets.find(item=>item.id===id)!).filter(Boolean),exercises:catalog}));
}
export function saveExercise(exercise:Exercise, presets:WorkoutPreset[]) {
  if(!exercise.name.trim() || !presets.length || presets.some(preset=>preset.exerciseId!==exercise.id)) throw new Error('Name the exercise and enter a valid prescription.');
  const savedExercises=readStoredStrict(dataKey(EXERCISES_KEY),[],isExercises), savedPresets=readStoredStrict(dataKey(PRESETS_KEY),[],isPresets);
  commitStored([{key:dataKey(EXERCISES_KEY),value:[...savedExercises.filter(item=>item.id!==exercise.id),exercise],fallback:[],valid:isExercises},{key:dataKey(PRESETS_KEY),value:[...savedPresets.filter(item=>item.exerciseId!==exercise.id),...presets],fallback:[],valid:isPresets}]);
}
export function saveWorkoutPlan(plan: WorkoutPlan, makeRoutine = false) {
  const available=[...(plan.presets??[]),...loadPresets()], catalog=[...(plan.exercises??[]),...loadExercises()];
  if (!plan.name.trim() || !plan.presetIds.length || plan.presetIds.some(id => !available.some(preset => preset.id === id))) throw new Error('Name the workout and select at least one exercise.');
  const value={...plan,name:plan.name.trim(),presets:plan.presetIds.map(id=>structuredClone(available.find(item=>item.id===id)!))};
  value.exercises=[...new Map(value.presets.map(preset=>{const exercise=catalog.find(item=>item.id===preset.exerciseId);if(!exercise)throw new Error('An exercise is missing.');return [exercise.id,structuredClone(exercise)] as const;})).values()];
  const custom = readStoredStrict(dataKey(KEY), [], isPlans);
  const writes: Parameters<typeof commitStored>[0] = [{key:dataKey(KEY),value:[...custom.filter(item => item.id !== plan.id),value],fallback:[],valid:isPlans}];
  if(makeRoutine) writes.push({key:dataKey(ROUTINES_KEY),value:saveRoutine(loadRoutines(),{id:crypto.randomUUID(),name:value.name,kind:planCategory(value),active:true,start:localDate(),schedule:'interval',interval:2,target:1,workoutPlanIds:[value.id],tags:[planCategory(value)]}),fallback:createRoutines(),valid:isRoutineData});
  commitStored(writes);
  return value;
}
export function deleteWorkoutPlan(id:string) {
  const plans=readStoredStrict(dataKey(KEY),[],isPlans), deleted=readStoredStrict(dataKey(DELETED_KEY),[],isDeleted), data=loadRoutines();
  const routines=allRoutines(data).map(routine=>{const linked=routinePlans(routine);return linked.includes(id)?{...routine,workoutPlanIds:linked.filter(value=>value!==id),active:linked.length>1&&routine.active}:routine;});
  commitStored([{key:dataKey(KEY),value:plans.filter(plan=>plan.id!==id),fallback:[],valid:isPlans},{key:dataKey(DELETED_KEY),value:[...new Set([...deleted,id])],fallback:[],valid:isDeleted},{key:dataKey(ROUTINES_KEY),value:{...data,routines},fallback:createRoutines(),valid:isRoutineData}]);
}
export const findExercise=(preset:WorkoutPreset,plan?:WorkoutPlan) => plan?.exercises?.find(item=>item.id===preset.exerciseId) ?? loadExercises().find(item=>item.id===preset.exerciseId) ?? {id:preset.exerciseId,name:preset.name,category:'training' as const,description:''};
