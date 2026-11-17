import { dataKey } from '../data/mode';
import { workoutPlans, workoutPresets, type WorkoutPlan } from './fixtures';
const KEY = 'pincht.workout-plans';
export function loadWorkoutPlans(): WorkoutPlan[] {
  const saved: unknown = JSON.parse(localStorage.getItem(dataKey(KEY)) || '[]');
  if (!Array.isArray(saved) || !saved.every(plan => typeof plan.id === 'string' && typeof plan.name === 'string' && Array.isArray(plan.presetIds))) throw new Error('Workout plans could not be read.');
  return [...workoutPlans, ...saved];
}
export function saveWorkoutPlan(plan: WorkoutPlan) {
  if (!plan.name.trim() || !plan.presetIds.length || plan.presetIds.some(id => !workoutPresets.some(preset => preset.id === id))) throw new Error('Name the workout and select at least one exercise.');
  const custom = loadWorkoutPlans().filter(item => !workoutPlans.some(builtIn => builtIn.id === item.id));
  localStorage.setItem(dataKey(KEY), JSON.stringify([...custom.filter(item => item.id !== plan.id), { ...plan, name: plan.name.trim() }]));
}
