import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { seedRoutines } from './fixtures/journal';
import { ROUTINES_KEY } from '../src/routines/data';
import { DATA_MODE_KEY } from '../src/data/mode';
import { loadDays } from '../src/components/home/journal-storage';
import { loadViews } from '../src/components/home/journal-views';
import { loadWorkoutPlans } from '../src/workouts/catalog';
import { clearWorkoutDraft, loadWorkoutDraft, restoredSession, saveWorkoutDraft } from '../src/workouts/draft';
import { createSession, sessionReducer } from '../src/workouts/session';
import { exercises, workoutPresets } from '../src/workouts/fixtures';
import { saveSession } from '../src/workouts/storage';

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  localStorage.clear(); localStorage.setItem(DATA_MODE_KEY, 'real');
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(seedRoutines('2026-11-16')));
  window.history.replaceState(null, '', '/'); window.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });
async function navigate(path: string) {
  await act(async () => { window.history.replaceState(null, '', `/#/${path}`); window.dispatchEvent(new HashChangeEvent('hashchange')); });
}
async function click(name: string | RegExp, scope = screen) {
  await act(async () => { fireEvent.click(scope.getByRole('button', { name })); });
}
async function change(label: string, value: string) {
  await act(async () => { fireEvent.change(screen.getByLabelText(label), { target: { value } }); });
}
it('opens Journal without default widgets and with three symbol dock links, with To-do reached from today', async () => {
  render(<App />);
  expect(screen.getByRole('main', { name: 'Journal' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Sleep' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Finger rehab' })).toBeNull();
  expect(loadViews().find(view => view.id === 'all')?.blocks.map(block => block.type)).toEqual(['journal']);
  const dock = within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link');
  expect(dock.map(link => link.getAttribute('aria-label'))).toEqual(['Journal', 'Do', 'Library']);
  expect(dock.every(link => link.textContent === '')).toBe(true);
  expect(screen.getByRole('link', { name: 'Open To-do' }).getAttribute('href')).toBe('#/todo');
  await navigate('todo');
  expect(screen.getByRole('link', { name: 'Routines ›' }).getAttribute('href')).toBe('#/routines');
});
it('edits a held view pill and uses its saved default on returning to Journal', async () => {
  render(<App />);
  await act(async () => { fireEvent.pointerDown(screen.getByRole('link', { name: 'Reading' })); await vi.advanceTimersByTimeAsync(550); });
  await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
  expect(screen.getByRole('heading', { name: 'Edit view' })).toBeTruthy();
  await click('Make default'); await click('Done');
  await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
  expect(loadViews().find(view => view.isDefault)?.id).toBe('reading');
  await navigate('do'); await navigate('journal');
  expect(screen.getByRole('main', { name: 'Reading' })).toBeTruthy();
});
it('writes Do weigh-ins and climb logs into today and preserves the original send go', async () => {
  render(<App />); await navigate('do');
  await click('Weight'); await change('Weight · kg', '73.2'); await click('Save weigh-in');
  await click('Climb'); await change('Name', 'Green slab'); await change('Grade', 'V3');
  await change('Goes today', '2'); await act(async () => { fireEvent.click(screen.getByRole('checkbox', { name: 'Sent it' })); }); await click('Save climb');
  await click('Climb'); await change('Goes today', '4'); await click('Save climb');
  expect(loadDays().find(day => day.date === '2026-11-16')?.records[0].climb).toEqual({ goes: 4, sendGo: 2 });
  await navigate('journal');
  const today = within(screen.getByLabelText('Journal title').closest('article')!);
  expect(today.getByRole('link', { name: '73.2 kg' })).toBeTruthy();
  await click('1 records', today);
  expect(today.getByRole('link', { name: 'Green slab' })).toBeTruthy();
  await navigate('library/climbs'); await change('Search Library', 'green');
  expect(screen.getByRole('link', { name: /Green slab/ })).toBeTruthy();
  await change('Search Library', 'nonexistent'); expect(screen.getByText('No matches.')).toBeTruthy();
});
it('logs and edits sleep as the daily metric without creating a synthetic sleep record', async () => {
  render(<App />); await navigate('do');
  await click('Sleep'); await change('Hours', '7'); await change('Minutes', '35'); await click('Save sleep');
  const day = loadDays().find(day => day.date === '2026-11-16')!;
  expect(day.metrics.sleep).toBe(455);
  expect(day.visibleMetrics).toContain('sleep');
  expect(day.records.some(record => record.kind === 'sleep')).toBe(false);
  await click('Sleep');
  expect((screen.getByLabelText('Hours') as HTMLInputElement).value).toBe('7');
  expect((screen.getByLabelText('Minutes') as HTMLInputElement).value).toBe('35');
  await change('Minutes', '45'); await click('Save sleep'); await navigate('journal');
  const today = within(screen.getByLabelText('Journal title').closest('article')!);
  expect(today.getByRole('link', { name: 'sleep 7h 45m' }).getAttribute('href')).toBe('#/library/metrics/sleep');
});
it('shows Library category totals for workout plans, searches them, and offers existing create flows', async () => {
  render(<App />); await navigate('library');
  const workouts = screen.getByRole('link', { name: /^Workouts/ });
  expect(workouts.textContent).toContain(`Workouts${loadWorkoutPlans().length} ·`);
  await change('Search Library', 'mobility');
  expect(screen.getByRole('link', { name: /^Mobility/ }).getAttribute('href')).toBe('#/library/workouts/plan-mobility');
  await change('Search Library', ''); await click('Create new');
  const create = within(screen.getByRole('dialog', { name: 'Create new' }));
  for (const name of ['climbs', 'workouts', 'books', 'goals', 'routines', 'views']) expect(create.getByRole('button', { name: `+ New ${name}` })).toBeTruthy();
  await click('+ New routines', create);
  await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
  expect(screen.getByRole('heading', { name: 'New routine' })).toBeTruthy();
});
it('creates a workout from existing exercises in Library and offers it in Do', async () => {
  render(<App />); await navigate('library/workouts/new');
  await change('Name', 'My pull session');
  await act(async () => { fireEvent.click(within(screen.getByRole('dialog', { name: 'New workout' })).getByRole('checkbox', { name: /Pull-ups/ })); });
  await click('Create workout');
  await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
  const plan = loadWorkoutPlans().find(plan => plan.name === 'My pull session')!;
  expect(plan.presetIds).toEqual(['pull-ups-3x5']);
  expect(screen.getByRole('link', { name: /My pull session/ })).toBeTruthy();
  await navigate('do'); expect(screen.getByRole('link', { name: /My pull session/ }).getAttribute('href')).toBe(`#/train/${plan.id}`);
});
it('resumes kept workout sets through Do and protects the draft when another workout opens', async () => {
  vi.setSystemTime(new Date('2026-11-30T12:00:00Z'));
  render(<App />); await navigate('train/pull-ups-3x5'); await click('Start workout'); await click('Complete set 1');
  expect(loadWorkoutDraft()?.flow?.runningSession?.sets).toHaveLength(1);
  await navigate('do'); expect(screen.getByRole('link', { name: 'Resume workout' }).getAttribute('href')).toBe('#/train/pull-ups-3x5');
  await navigate('train/mobility'); expect(screen.getByRole('heading', { name: 'Workout in progress' })).toBeTruthy();
  expect(loadWorkoutDraft()?.route).toBe('/train/pull-ups-3x5');
  await navigate('train/pull-ups-3x5');
  expect(screen.getByRole('button', { name: 'Complete set 2' })).toBeTruthy();
  await click('Finish early & review'); await click('Save workout');
  expect(loadWorkoutDraft()).toBeNull();
  await navigate('journal');
  expect(screen.getByLabelText('Journal title').closest('article')!.textContent).toContain('training');
});
it('restores interrupted holds without counting time away, keeping drafts isolated by data mode', () => {
  const preset = workoutPresets.find(preset => preset.id === 'three-finger-drag') ?? workoutPresets.find(preset => preset.prescription.kind === 'hold')!;
  const session = sessionReducer(createSession(preset, exercises.find(exercise => exercise.id === preset.exerciseId)!, 'manual', Date.now()), { type: 'start', now: Date.now() });
  saveWorkoutDraft({ route: `/train/${preset.id}`, title: preset.name, session });
  vi.advanceTimersByTime(60_000);
  const restored = restoredSession(loadWorkoutDraft()!.session!, Date.now()-60_000);
  expect(restored.phase).toBe('result'); expect(restored.candidate?.status).toBe('interrupted');
  expect(restored.sets).toHaveLength(0); expect(restored.candidate?.durationSeconds).toBe(0);
  localStorage.setItem(DATA_MODE_KEY, 'demo'); expect(loadWorkoutDraft()).toBeNull(); clearWorkoutDraft();
  localStorage.setItem(DATA_MODE_KEY, 'real'); expect(loadWorkoutDraft()?.session?.id).toBe(session.id);
});
it('shows recorded workout bests and history in Library without using prescribed or simulated results', async () => {
  const preset = workoutPresets.find(preset => preset.id === 'pull-ups-3x5')!;
  const exercise = exercises.find(exercise => exercise.id === preset.exerciseId)!;
  for (const [index, reps] of [4, 6, 99].entries()) {
    const now = Date.now() - (2-index)*86_400_000;
    const session = sessionReducer(sessionReducer(createSession(preset, exercise, 'manual', now), { type: 'complete-reps', now, reps, addedLoadKg: 0 }), { type: 'finish', now });
    if (reps === 99) { session.source = 'simulator'; session.sets[0].source = 'simulator'; }
    saveSession(session, '', now);
  }
  render(<App />); await navigate('library/workouts/plan-pull-ups-3x5');
  expect(screen.getByText('Personal best · 6 reps in a set')).toBeTruthy();
  expect(screen.getByRole('img', { name: 'Pull-ups history · reps in a set' }).querySelectorAll('circle')).toHaveLength(2);
  expect(screen.getByRole('link', { name: /Sat, 14 Nov 2026 · logged/ })).toBeTruthy();
  expect(screen.queryByText(/99 reps/)).toBeNull();
});
