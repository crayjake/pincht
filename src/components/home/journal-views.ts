import { dataKey } from '../../data/mode';
import { routineTags, type ViewTag } from '../../routines/tasks';
import type { Routine } from '../../routines/data';
import type { Day } from './journal-data';
import { readStored, readStoredStrict, writeStored } from '../../data/storage';
import { isViews } from '../../data/validation';

export const widgetNames = { rehab: 'Finger rehab', sleep: 'Sleep', climbing: 'Climbing days', weight: 'Weight', alcohol: 'Alcohol-free', reading: 'Reading', train: 'Train', drinks: 'Drinks', hardest: 'Hardest send', pullups: 'Pull-ups', projects: 'Projects', wall: 'Time on wall', sends: 'Sends by grade', sessions: 'Sessions per week', strength: 'Finger strength', stages: 'Sleep stages', calendar: 'Training calendar', habits: 'Habits', book: 'Reading · full width', next: 'Next up', activity: 'Last seven days' } as const;
export type WidgetId = keyof typeof widgetNames;
export const fullWidgets: WidgetId[] = ['sends', 'sessions', 'strength', 'stages', 'calendar', 'habits', 'book', 'next', 'activity'];
export interface ViewBlock { id: string; type: 'widgets' | 'todo' | 'journal' | 'chart'; enabled: boolean; widgets?: WidgetId[]; chart?: WidgetId; goalId?: string }
export interface JournalView { id: string; name: string; tags: ViewTag[]; blocks: ViewBlock[]; isDefault?: boolean }
export const VIEWS_KEY = 'pincht.views';
export const allView: JournalView = { id: 'all', name: 'All', tags: [], isDefault: true,
  blocks: [{ id: 'journal', type: 'journal', enabled: true }] };
export const climbingView: JournalView = { id: 'climbing', name: 'Climbing', tags: ['climb', 'rehab', 'training'],
  blocks: [{ id: 'widgets', type: 'widgets', enabled: true, widgets: ['rehab', 'climbing'] }, { id: 'todo', type: 'todo', enabled: true }, { id: 'journal', type: 'journal', enabled: true }] };
export function loadViews(): JournalView[] {
  const views = readStored(dataKey(VIEWS_KEY), defaultViews(), isViews);
  return views.some(view => view.id === 'all') ? views : [structuredClone(allView), ...views];
}
const defaultViews = (): JournalView[] => [structuredClone(allView), structuredClone(climbingView), { id: 'reading', name: 'Reading', tags: ['reading'], blocks: [{ id: 'journal', type: 'journal', enabled: true }] }];
export function saveView(view: JournalView) {
  if (!view.name.trim()) throw new Error('Enter a view name.');
  if (!view.blocks.some(block => block.enabled)) throw new Error('Show at least one block.');
  readStoredStrict(dataKey(VIEWS_KEY), defaultViews(), isViews);
  const views = loadViews();
  const next = { ...view, name: view.name.trim() };
  const updated = views.some(v => v.id === view.id) ? views.map(v => v.id === view.id ? next : v) : [...views, next];
  writeStored(dataKey(VIEWS_KEY), updated.map(v => next.isDefault && v.id !== next.id ? { ...v, isDefault: false } : v), defaultViews(), isViews);
}
export const defaultView = () => loadViews().find(view => view.isDefault) ?? loadViews()[0];
export function isViewDay(day: Day, view: JournalView) {
  if (!view.tags.length) return true;
  return view.tags.some(tag => day.entry?.tags?.includes(tag) || (tag === 'reading' ? day.records.some(r => r.kind === 'habit' && r.metric.endsWith('min')) : day.records.some(r => r.kind === tag) || tag === 'sleep' && day.metrics.sleep !== undefined));
}
export const isViewRoutine = (routine: Routine, tags: ViewTag[]) => !tags.length || routineTags(routine).some(tag => tags.includes(tag));
export const isClimbingDay = (day: Day) => isViewDay(day, climbingView);
