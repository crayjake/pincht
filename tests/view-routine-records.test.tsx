import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Home from '../src/components/home/home';
import { ViewPages } from '../src/components/home/view-pages';
import { loadViews, VIEWS_KEY } from '../src/components/home/journal-views';
import { JOURNAL_KEY, JOURNAL_RESOURCES_KEY } from '../src/components/home/journal-storage';
import type { Day, JournalRecord } from '../src/components/home/journal-data';
import { RoutinePages } from '../src/routines/routine-pages';
import { createRoutines, putCheckIn, ROUTINES_KEY, type RoutineData } from '../src/routines/data';
import { routineCount, routineDone, routineDue } from '../src/routines/tasks';
import { exercises, workoutPresets } from '../src/workouts/fixtures';
import { createSession, type Session } from '../src/workouts/session';
import { DATA_MODE_KEY } from '../src/data/mode';

const today = '2026-11-16';
const savedRoutines = () => JSON.parse(localStorage.getItem(ROUTINES_KEY)!) as RoutineData;
const savedDays = () => JSON.parse(localStorage.getItem(JOURNAL_KEY)!) as Day[];
async function click(name: string | RegExp, scope = screen) {
  await act(async () => { fireEvent.click(scope.getByRole('button', { name })); });
}
async function change(label: string, value: string) {
  await act(async () => { fireEvent.change(screen.getByLabelText(label), { target: { value } }); });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T12:00:00Z`));
  localStorage.clear(); localStorage.setItem(ROUTINES_KEY, JSON.stringify(createRoutines(today)));
  window.history.replaceState(null, '', '/#/journal'); window.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('saves an after-completion routine, moves its due date with the actual completion, and pauses it', async () => {
  render(<RoutinePages id="read" />);
  await change('Routine name', 'Read slowly');
  await click('After done'); await change('Rest days between', '2'); await change('Routine start date', '2026-11-01');
  await click('Save');
  let data = savedRoutines(); const routine = data.routines.find(r => r.id === 'read')!;
  expect(routine).toMatchObject({ name: 'Read slowly', schedule: 'interval', interval: 3, afterCompletion: true });
  expect(routineDue(routine, data, [], '2026-11-04')).toBe(true);
  data = { ...data, books: [{ id: 'book', title: 'Book', author: '', pages: 200, initialPage: 0 }], currentBookId: 'book' };
  data = putCheckIn(data, { routineId: 'read', date: '2026-11-05', status: 'done', bookId: 'book', minutes: 20 });
  expect(routineDue(routine, data, [], '2026-11-06')).toBe(false);
  expect(routineDue(routine, data, [], '2026-11-07')).toBe(false);
  expect(routineDue(routine, data, [], '2026-11-08')).toBe(true);
  expect(routineDue(routine, data, [], '2026-11-10')).toBe(true);
  expect(() => putCheckIn(data, { routineId: 'read', date: '2026-11-06', status: 'done', bookId: 'book', minutes: 20 })).toThrow(/not scheduled/);
  await click('Pause routine');
  expect(savedRoutines().routines.find(r => r.id === 'read')?.active).toBe(false);
  expect(routineDue(savedRoutines().routines.find(r => r.id === 'read')!, data, [], today)).toBe(false);
});

it('saves weekly targets and assigned workouts, counting only matching saved real sessions once', async () => {
  render(<RoutinePages id="train" />);
  await click('More'); await click('exactly'); await click('Mobility'); await click('Save');
  const data = savedRoutines(), routine = data.routines.find(r => r.id === 'train')!;
  expect(routine).toMatchObject({ target: 4, comparator: 'exactly', workoutPlanIds: ['pull-ups-3x5'] });
  function session(presetId: string, date = today, source: Session['source'] = 'manual'): Session {
    const preset = workoutPresets.find(p => p.id === presetId)!;
    return { ...createSession(preset, exercises.find(e => e.id === preset.exerciseId)!, source, Date.parse(`${date}T12:00:00Z`)), phase: 'review', finishedAt: `${date}T12:10:00Z`, sets: [{ set: 1, source, reps: 5, status: 'completed', trace: [] }] };
  }
  const matching = session('pull-ups-3x5');
  const sessions = [matching, matching, session('tendon-glides'), session('pull-ups-3x5', today, 'simulator'), session('pull-ups-3x5', '2026-11-15'), { ...session('pull-ups-3x5'), finishedAt: undefined }];
  expect(routineCount(routine, data, sessions, today)).toBe(1);
  expect(routineDone(routine, data, sessions, today)).toBe(true);
  expect(routineCount(routine, data, [], today)).toBe(0);
});

it('persists view filters, widget choices and order, and renders that configuration independently of the other data mode', async () => {
  const { unmount } = render(<ViewPages id="climbing" />);
  await change('View name', 'Rest and sleep'); await click('Sleep', within(screen.getByText('Start from a premade filter').closest('section')!));
  await click('Configure Widgets'); await click('Finger rehab'); await click('Climbing days');
  await click('Sleep', within(screen.getByRole('button', { name: 'Configure Widgets' }).closest('.view-block') as HTMLElement));
  await click('To-do shown'); await click('Configure Journal'); await click('Move Journal up'); await click('Move Journal up');
  await click('Done');
  const view = loadViews()[0];
  expect(view).toMatchObject({ name: 'Rest and sleep', tags: ['sleep'], tab: true });
  expect(view.blocks.map(b => b.type)).toEqual(['journal', 'widgets', 'todo']);
  expect(view.blocks.find(b => b.type === 'widgets')?.widgets).toEqual(['sleep']);
  unmount();
  const { container, unmount: closeHome } = render(<Home screen="climbing" viewId={view.id} />);
  expect(screen.getByRole('main', { name: 'Rest and sleep' })).toBeTruthy();
  expect(screen.getByRole('region', { name: 'Sleep' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Due today' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Finger rehab' })).toBeNull();
  expect(container.querySelector('.block-journal')!.compareDocumentPosition(screen.getByRole('region', { name: 'Sleep' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  closeHome();
  localStorage.setItem(DATA_MODE_KEY, 'demo');
  expect(loadViews()[0].name).toBe('Climbing');
  expect(JSON.parse(localStorage.getItem(VIEWS_KEY)!)[0].name).toBe('Rest and sleep');
});

it('creates a fresh day climb log from a mention while keeping workout mentions as references, and persists editable goes and notes', async () => {
  const climb: JournalRecord = { id: 'slab', title: 'Blue slab', kind: 'climb', metric: 'V3', meta: 'Gym', note: 'Yesterday’s note', climb: { goes: 5, sendGo: 4 } };
  localStorage.setItem(JOURNAL_KEY, JSON.stringify([{ date: '2026-11-15', types: [], metrics: {}, visibleMetrics: [], records: [climb] }]));
  const { unmount } = render(<Home entryDate={today} />);
  const body = screen.getByRole('textbox', { name: /Journal body/ }) as HTMLElement & { editor: Editor };
  await act(async () => { body.editor.commands.setContent({ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'recordPill', attrs: { id: 'slab', label: 'Blue slab', category: 'climb' } },
    { type: 'recordPill', attrs: { id: 'plan-pull-ups-3x5', label: 'Pull-ups', category: 'training' } },
  ] }] }); });
  expect(savedDays().find(d => d.date === today)?.records).toEqual([{ id: 'slab', kind: 'climb', title: 'Blue slab', metric: 'V3', meta: 'Gym', climb: { goes: 0 } }]);
  const records = within(screen.getByRole('region', { name: 'Day records' }));
  expect(records.getByRole('link', { name: 'Pull-ups' })).toBeTruthy();
  expect(records.queryByRole('textbox', { name: 'Notes for Pull-ups' })).toBeNull();
  await click('Another go', records); await click('Another go', records); await click('Sent it ✓', records);
  await change('Notes for Blue slab', 'Keep the heel high');
  expect(savedDays().find(d => d.date === today)?.records[0]).toMatchObject({ climb: { goes: 2, sendGo: 2 }, note: 'Keep the heel high' });
  await click('Go 1', records); await click('Remove go', records);
  expect(savedDays().find(d => d.date === today)?.records[0].climb).toEqual({ goes: 1, sendGo: 1 });
  unmount(); render(<Home entryDate={today} />);
  expect(screen.getByRole('button', { name: 'Go 1, sent' })).toBeTruthy();
  expect((screen.getByRole('textbox', { name: 'Notes for Blue slab' }) as HTMLTextAreaElement).value).toBe('Keep the heel high');
  expect(savedDays().find(d => d.date === '2026-11-15')?.records[0]).toEqual(climb);
  expect(savedRoutines().checkIns).toEqual([]);
});

it('creates and reuses references in each picker category, with no creation under All or for an existing title', async () => {
  const categories = [
    { filter: 'Climbs', kind: 'climb', label: 'a climb' },
    { filter: 'Workouts', kind: 'training', label: 'a workout' },
    { filter: 'Goals', kind: 'goal', label: 'a goal' },
    { filter: 'Books', kind: 'habit', label: 'a book' },
  ];
  const { unmount } = render(<Home entryDate={today} />);
  const body = screen.getByRole('textbox', { name: /Journal body/ }) as HTMLElement & { editor: Editor };
  async function mention(title: string) {
    await act(async () => {
      body.editor.commands.focus('end');
      body.editor.commands.insertContent(` @${title}`);
    });
  }
  for (const category of categories) {
    const title = `New ${category.filter}`;
    await mention(title);
    const picker = within(screen.getByRole('dialog', { name: 'Link a record' }));
    await click('All', picker);
    expect(picker.queryByRole('button', { name: /^Create / })).toBeNull();
    await click(category.filter, picker);
    await click(`Create “${title}” as ${category.label}`, picker);
    expect(screen.queryByRole('dialog', { name: 'Link a record' })).toBeNull();
    expect(body.querySelector(`a[data-category="${category.kind}"]`)?.textContent).toBe(title);
    await mention(title);
    const duplicatePicker = within(screen.getByRole('dialog', { name: 'Link a record' }));
    expect(duplicatePicker.queryByRole('button', { name: /^Create / })).toBeNull();
    await click(new RegExp(`^${title}`), duplicatePicker);
  }
  const stored = JSON.parse(localStorage.getItem(JOURNAL_RESOURCES_KEY)!) as JournalRecord[];
  expect(stored.map(record => record.kind)).toEqual(categories.map(category => category.kind));
  expect(savedDays().find(day => day.date === today)?.records.map(record => record.kind)).toEqual(['climb']);
  expect(savedRoutines().checkIns).toEqual([]);
  unmount(); render(<Home entryDate={today} />);
  const records = within(screen.getByRole('region', { name: 'Day records' }));
  for (const category of categories) expect(records.getByRole('link', { name: `New ${category.filter}` })).toBeTruthy();
  cleanup();
  localStorage.setItem(DATA_MODE_KEY, 'demo');
  render(<Home entryDate={today} />);
  expect(screen.getByRole('region', { name: 'Day records' }).textContent).not.toContain('New Books');
  expect(localStorage.getItem(`${JOURNAL_RESOURCES_KEY}.demo`)).toBe('[]');
});
