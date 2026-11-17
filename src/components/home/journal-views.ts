import { dataKey } from '../../data/mode';
import { routineTags, type ViewTag } from '../../routines/tasks';
import type { Routine } from '../../routines/data';
import type { Day } from './journal-data';

export type WidgetId = 'rehab' | 'climbing' | 'sleep' | 'activity';
export interface ViewBlock { id: string; type: 'widgets' | 'todo' | 'journal' | 'chart'; enabled: boolean; widgets?: WidgetId[]; chart?: 'rehab' | 'sleep' }
export interface JournalView { id: string; name: string; tags: ViewTag[]; blocks: ViewBlock[]; isDefault?: boolean }
export const VIEWS_KEY = 'pincht.views';
export const allView: JournalView = { id: 'all', name: 'All', tags: [], isDefault: true,
  blocks: [{ id: 'journal', type: 'journal', enabled: true }] };
export const climbingView: JournalView = { id: 'climbing', name: 'Climbing', tags: ['climb', 'rehab', 'training'],
  blocks: [{ id: 'widgets', type: 'widgets', enabled: true, widgets: ['rehab', 'climbing'] }, { id: 'todo', type: 'todo', enabled: true }, { id: 'journal', type: 'journal', enabled: true }] };
export function loadViews(): JournalView[] {
  const saved = localStorage.getItem(dataKey(VIEWS_KEY));
  if (saved) {
    try {
      const views: JournalView[] = JSON.parse(saved);
      if (Array.isArray(views) && views.every(view => typeof view.id === 'string' && typeof view.name === 'string' && Array.isArray(view.tags) && Array.isArray(view.blocks))) return views.some(view => view.id === 'all') ? views : [structuredClone(allView), ...views];
    } catch { /* Keep unreadable storage untouched until explicitly saved. */ }
  }
  return [structuredClone(allView), structuredClone(climbingView), { id: 'reading', name: 'Reading', tags: ['reading'], blocks: [{ id: 'journal', type: 'journal', enabled: true }] }];
}
export function saveView(view: JournalView) {
  if (!view.name.trim()) throw new Error('Enter a view name.');
  if (!view.blocks.some(block => block.enabled)) throw new Error('Show at least one block.');
  const views = loadViews();
  const next = { ...view, name: view.name.trim() };
  const updated = views.some(v => v.id === view.id) ? views.map(v => v.id === view.id ? next : v) : [...views, next];
  localStorage.setItem(dataKey(VIEWS_KEY), JSON.stringify(updated.map(v => next.isDefault && v.id !== next.id ? { ...v, isDefault: false } : v)));
}
export const defaultView = () => loadViews().find(view => view.isDefault) ?? loadViews()[0];
export function isViewDay(day: Day, view: JournalView) {
  if (!view.tags.length) return true;
  return view.tags.some(tag => tag === 'reading' ? day.records.some(r => r.kind === 'habit' && r.metric.endsWith('min')) : day.records.some(r => r.kind === tag) || tag === 'sleep' && day.metrics.sleep !== undefined);
}
export const isViewRoutine = (routine: Routine, tags: ViewTag[]) => !tags.length || routineTags(routine).some(tag => tags.includes(tag));
export const isClimbingDay = (day: Day) => isViewDay(day, climbingView);
