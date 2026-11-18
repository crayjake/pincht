import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { seedRoutines } from './fixtures/journal';
import { ROUTINES_KEY } from '../src/routines/data';
import { DATA_MODE_KEY } from '../src/data/mode';
import { loadDays, loadResources, saveDays, saveResources } from '../src/components/home/journal-storage';
import { loadViews } from '../src/components/home/journal-views';
import { loadWorkoutPlans } from '../src/workouts/catalog';
import { clearWorkoutDraft, loadWorkoutDraft, restoredSession, saveWorkoutDraft } from '../src/workouts/draft';
import { createSession, sessionReducer } from '../src/workouts/session';
import { exercises, workoutPresets } from '../src/workouts/fixtures';
import { saveSession } from '../src/workouts/storage';
import { saveClimb, saveClimbSession, climbStats } from '../src/climbs/data';

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
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
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
  expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
  expect(screen.getByRole('link', { name: 'Back to Journal' }).getAttribute('href')).toBe('#/journal');
  expect(screen.getByRole('link', { name: 'Routines ›' }).getAttribute('href')).toBe('#/routines');
});
it.each(['settings', 'routines', 'routines/read', 'views', 'views/edit/all', 'views/edit/new', 'library/climbs', 'library/books', 'library/books/book-piranesi', 'journal/2026-11-15'])('hides the dock on the nested %s screen', async path => {
  render(<App />);
  await navigate(path);
  expect(screen.queryByRole('navigation', { name: 'Primary' })).toBeNull();
});
it('hides the dock after inactivity, restores it on interaction, and keeps it available for keyboard navigation', async () => {
  render(<App />);
  const nav = screen.getByRole('navigation', { name: 'Primary' });
  expect(nav.getAttribute('data-idle')).toBe('false');
  await act(async () => { await vi.advanceTimersByTimeAsync(3000); });
  expect(nav.getAttribute('data-idle')).toBe('true');
  await act(async () => { fireEvent.pointerDown(document.body); });
  expect(nav.getAttribute('data-idle')).toBe('false');
  await act(async () => { screen.getByRole('link', { name: 'Library', exact: true }).focus(); await vi.advanceTimersByTimeAsync(3000); });
  expect(nav.getAttribute('data-idle')).toBe('false');
  await act(async () => { (document.activeElement as HTMLElement).blur(); await vi.advanceTimersByTimeAsync(3000); });
  expect(nav.getAttribute('data-idle')).toBe('true');
});
it('opens More using the existing app rows and opens its finger-strength log', async () => {
  render(<App />);
  await navigate('do');
  expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  await click('More');
  const more = within(screen.getByRole('dialog', { name: 'More' }));
  expect(more.getByRole('link', { name: 'Start workout' }).className).toBe('home-row');
  expect(more.getByRole('link', { name: 'Max pull test' }).getAttribute('href')).toBe('#/train/max-pull-left');
  await click(/Finger strength/, more);
  expect(screen.queryByRole('dialog', { name: 'More' })).toBeNull();
  expect(screen.getByLabelText('20 mm three-finger drag · kg')).toBeTruthy();
});
it('remembers the selected journal view across dock changes, To-do, and app reopening', async () => {
  const app = render(<App />);
  await navigate('view/reading');
  await navigate('do'); await navigate('journal');
  expect(screen.getByRole('link', { name: 'Reading' }).getAttribute('aria-current')).toBe('page');
  await navigate('todo'); await navigate('journal');
  expect(screen.getByRole('link', { name: 'Reading' }).getAttribute('aria-current')).toBe('page');
  app.unmount();
  window.history.replaceState(null, '', '/');
  render(<App />);
  expect(screen.getByRole('link', { name: 'Reading' }).getAttribute('aria-current')).toBe('page');
});
it('returns from a mention to the actual journal visit with records, edits, and its position preserved', async () => {
  const climb = { id: 'return-slab', kind: 'climb' as const, title: 'Return slab', metric: '6A', meta: 'Gym', climbInfo: { type: 'boulder' as const, where: 'Gym' } };
  saveClimb(climb);
  saveDays([{ date: '2026-11-15', types: ['climb'], metrics: {}, visibleMetrics: [], records: [climb], entry: {
    title: 'Keep my place', body: { type: 'doc', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Original writing ' },
      { type: 'recordPill', attrs: { id: climb.id, label: climb.title, category: 'climb' } },
    ] }] },
  } }]);
  vi.stubGlobal('scrollY', 0);
  window.scrollTo = vi.fn((_x, y) => { vi.stubGlobal('scrollY', y); });
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function(this: HTMLElement) {
    const top = this.dataset.navigationAnchor === 'day-2026-11-15' ? 1000 - window.scrollY : -500;
    return { top, bottom: top + 300, height: 300 } as DOMRect;
  });
  render(<App />);
  await navigate('view/climbing');
  let entry = screen.getByRole('heading', { name: 'Keep my place' }).closest('article')!;
  await click(/\d+ records/, within(entry));
  const editor = entry.querySelector('.journal-prose') as HTMLElement & { editor: { commands: { insertContent: (text: string) => void } } };
  await act(async () => { editor.focus(); editor.editor.commands.insertContent('Saved edit. '); });
  vi.stubGlobal('scrollY', 870);
  const mention = entry.querySelector('a[data-record-id]')!;
  await act(async () => { fireEvent.pointerDown(mention); });
  const journalVisit = window.history.state;
  await navigate('library/climbs/return-slab');
  const back = vi.spyOn(window.history, 'back').mockImplementation(() => {});
  await act(async () => { fireEvent.click(screen.getByRole('link', { name: 'Back', exact: true })); });
  expect(back).toHaveBeenCalledOnce();
  await act(async () => {
    window.history.replaceState(journalVisit, '', '/#/view/climbing');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
  entry = screen.getByRole('heading', { name: 'Keep my place' }).closest('article')!;
  expect(entry.querySelector('.records-toggle')?.getAttribute('aria-expanded')).toBe('true');
  expect(entry.querySelector('.journal-prose')?.textContent).toContain('Saved edit.');
  expect(window.scrollY).toBe(870);
  expect(screen.getByRole('link', { name: 'Climbing', exact: true }).getAttribute('aria-current')).toBe('page');
  // A late keyboard dismissal must keep this anchor steady too.
  await act(async () => { await vi.advanceTimersByTimeAsync(100); });
  expect(window.scrollY).toBe(870);
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
it.each([
  ['journal', 'All', 'Edit view'],
  ['journal', 'New view', 'New view'],
  ['view/reading', 'Reading', 'Edit view'],
  ['view/reading', 'New view', 'New view'],
  ['library/views', /\+ New\s*views/, 'New view'],
  ['library/views/reading', 'Edit view', 'Edit view'],
  ['views', 'Add view', 'New view'],
])('cancels view editing back to %s from %s without saving', async (origin, action, heading) => {
  render(<App />); await navigate(origin);
  const before = loadViews();
  const link = screen.queryByRole('link', { name: action, exact: true });
  if (link) {
    const href = link.getAttribute('href')!;
    expect(href).toContain('/views/edit/');
    await navigate(href.slice(2));
  } else {
    await click(action);
    await act(async () => { window.dispatchEvent(new HashChangeEvent('hashchange')); });
  }
  expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
  await change('View name', 'Unsaved view change');
  const cancel = screen.getByRole('link', { name: 'Cancel' });
  expect(cancel.getAttribute('href')).toBe(`#/${origin}`);
  await navigate(cancel.getAttribute('href')!.slice(2));
  expect(screen.queryByRole('heading', { name: heading })).toBeNull();
  expect(loadViews()).toEqual(before);
});
it('writes Do weigh-ins and climb logs into today and preserves the original send go', async () => {
  render(<App />); await navigate('do');
  await click('Weight'); await change('Weight · kg', '73.2'); await click('Save weigh-in');
  await click('Climb'); await click('+ Create new climb'); await change('Name', 'Green slab'); await change('Grade', 'V3'); await click('Create climb');
  await click('More goes for Green slab'); await click('Sent'); await click('Save session');
  await click('Climb'); await click(/Green slab/); await click('More goes for Green slab'); await click('More goes for Green slab'); await click('Save session');
  expect(loadDays().find(day => day.date === '2026-11-16')?.records[0].climb).toEqual({ goes: 4, sendGo: 2 });
  await navigate('journal');
  const today = within(screen.getByLabelText('Journal title').closest('article')!);
  expect(today.getByRole('link', { name: '73.2 kg' })).toBeTruthy();
  await click('1 records', today);
  expect(today.getByRole('link', { name: 'Green slab' })).toBeTruthy();
  await navigate('library/climbs'); await click('All'); await change('Search Library', 'green');
  expect(screen.getByRole('link', { name: /Green slab/ })).toBeTruthy();
  await change('Search Library', 'nonexistent'); expect(screen.getByText('No matching climbs.')).toBeTruthy();
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
it('filters climb projects and sends, shows cumulative send attempts, and saves beta without changing session notes', async () => {
  const slab = { id: 'slab', kind: 'climb' as const, title: 'Blue slab', metric: '6A', meta: 'Gym', climbInfo: { type: 'boulder' as const, where: 'Gym' } };
  saveClimb(slab);
  saveClimb({ ...slab, id: 'roof', title: 'Roof project', metric: '7A' });
  saveClimbSession('2026-11-14', [{ ...slab, note: 'First session note', climb: { goes: 3 } }]);
  saveClimbSession('2026-11-16', [{ ...slab, climb: { goes: 4, sendGo: 2 } }]);
  saveResources([...loadResources(), { id: 'goal', kind: 'goal', title: 'Winter projects', metric: '', meta: '', climbGoal: { climbIds: ['slab', 'roof'] } }]);
  expect(climbStats('slab').sendGo).toBe(5);
  render(<App />); await navigate('library/climbs');
  expect(screen.getByRole('link', { name: /Roof project/ })).toBeTruthy();
  expect(screen.queryByRole('link', { name: /Blue slab/ })).toBeNull();
  await click('Sent');
  expect(screen.getByRole('link', { name: /Blue slab/ })).toBeTruthy();
  await change('Grade', '7A'); expect(screen.getByText('No climbs here yet.')).toBeTruthy();
  await change('Grade', ''); await change('Where', 'Gym'); await change('Type', 'boulder');
  await navigate('library/climbs/slab');
  expect(screen.getByText('on the 5th go')).toBeTruthy();
  expect(screen.getByRole('link', { name: 'Winter projects' }).getAttribute('href')).toBe('#/library/goals/goal');
  await change('Climb notes', 'Keep the heel high');
  await act(async () => { fireEvent.blur(screen.getByLabelText('Climb notes')); });
  await navigate('library/climbs'); await navigate('library/climbs/slab');
  expect((screen.getByLabelText('Climb notes') as HTMLTextAreaElement).value).toBe('Keep the heel high');
  expect(loadDays().find(day => day.date === '2026-11-14')?.records[0].note).toBe('First session note');
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
  await click('+ Add exercise'); await click(/Pull-ups/); await click('Done'); await click('Save workout');
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

it.each(['number', 'checklist'])('edits %s goals from their existing page and keeps the same identity', async mode => {
  const goal = { id: 'editable-goal', kind: 'goal' as const, title: 'Original goal', metric: '', meta: '', ...(mode === 'number' ? { goal: { metric: 'finger-strength' as const, targetKg: 30 } } : { climbGoal: { climbIds: ['slab'] } }) };
  saveClimb({ id: 'slab', kind: 'climb', title: 'Slab', metric: '6A', meta: 'Gym', climbInfo: { type: 'boulder', where: 'Gym' } });
  saveResources([...loadResources(), goal]);
  render(<App />); await navigate('library/goals/editable-goal');
  await click('Edit');
  expect(screen.getByRole('heading', { name: 'Edit goal' })).toBeTruthy();
  await change('Name', 'Updated goal');
  if (mode === 'number') await change('Target · kg', '40');
  await click('Save goal');
  expect(screen.queryByRole('heading', { name: 'Edit goal' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Updated goal' })).toBeTruthy();
  const saved = loadResources().filter(record => record.id === goal.id);
  expect(saved).toHaveLength(1);
  expect(saved[0].title).toBe('Updated goal');
  if (mode === 'number') expect(saved[0].goal?.targetKg).toBe(40);
  else expect(saved[0].climbGoal?.climbIds).toEqual(['slab']);
  await navigate('library'); await navigate('library/goals/editable-goal'); await click('Edit');
  expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Updated goal');
});
it('opens book editing directly and persists the changes', async () => {
  const data = JSON.parse(localStorage.getItem(ROUTINES_KEY)!);
  const book = data.books[0];
  render(<App />); await navigate(`library/books/book-${book.id}`);
  await click('Edit book');
  await change('Title', 'Updated book'); await click('Save book');
  expect(screen.queryByRole('heading', { name: 'Edit book' })).toBeNull();
  expect(screen.getByRole('heading', { name: 'Updated book' })).toBeTruthy();
  const saved = JSON.parse(localStorage.getItem(ROUTINES_KEY)!);
  expect(saved.books).toHaveLength(data.books.length);
  expect(saved.books.find((item: { id: string }) => item.id === book.id).title).toBe('Updated book');
  expect(saved.checkIns).toEqual(data.checkIns);
  await navigate('library'); await navigate(`library/books/book-${book.id}`);
  expect(screen.getByRole('heading', { name: 'Updated book' })).toBeTruthy();
});
