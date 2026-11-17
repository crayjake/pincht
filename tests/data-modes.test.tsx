import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import App from '../src/App';
import { JOURNAL_KEY, loadDays, saveDays } from '../src/components/home/journal-storage';
import { createDemoData } from '../src/data/demo';
import { initialiseDataMode, selectDataMode } from '../src/data/initialise';
import { DATA_MODE_KEY, dataKey, getDataMode } from '../src/data/mode';
import { createRoutines, ROUTINES_KEY } from '../src/routines/data';
import { loadSessions, saveSession, SESSION_KEY, SIMULATOR_KEY } from '../src/workouts/storage';

beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
  localStorage.clear(); window.scrollTo = vi.fn();
  window.history.replaceState(null, '', '/#/today');
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

async function navigate(path: string) {
  await act(async () => {
    window.history.replaceState(null, '', `/#/${path}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
async function switchMode(mode: 'real' | 'demo') {
  await navigate('library');
  await act(async () => { fireEvent.change(screen.getByLabelText('Stored data mode'), { target: { value: mode } }); });
  await navigate('todo');
}
async function write(title: string) {
  await act(async () => { fireEvent.change(screen.getByLabelText('Journal title'), { target: { value: title } }); });
}

it('starts in demo mode without changing existing real data, and remembers a later real selection', () => {
  localStorage.setItem(JOURNAL_KEY, 'real journal stays here');
  localStorage.setItem(ROUTINES_KEY, 'real habits stay here');
  localStorage.setItem(SESSION_KEY, 'real workouts stay here');
  initialiseDataMode();
  expect(getDataMode()).toBe('demo');
  expect(localStorage.getItem(JOURNAL_KEY)).toBe('real journal stays here');
  expect(localStorage.getItem(ROUTINES_KEY)).toBe('real habits stay here');
  expect(localStorage.getItem(SESSION_KEY)).toBe('real workouts stay here');
  expect(loadDays().length).toBeGreaterThanOrEqual(42);
  const demoKey = dataKey(JOURNAL_KEY);
  localStorage.setItem(demoKey, 'edited demo data');
  selectDataMode('real');
  initialiseDataMode();
  expect(getDataMode()).toBe('real');
  selectDataMode('demo');
  expect(localStorage.getItem(demoKey)).toBe('edited demo data');
});

it('creates varied dated examples with valid inline references and no future history', () => {
  const { days, routines, sessions } = createDemoData('2027-01-03');
  expect(days).toHaveLength(42);
  expect(new Set(days.map(day => day.date)).size).toBe(42);
  expect(days.filter(day => day.entry)).toHaveLength(15);
  expect(new Set(days.flatMap(day => day.entry ? [day.entry.title] : [])).size).toBe(15);
  expect(days[0].date).toBe('2027-01-02');
  expect(days.every(day => day.date < '2027-01-03')).toBe(true);
  expect(routines.lastVisit).toBe('2027-01-03');
  expect(routines.checkIns.every(c => c.date < '2027-01-03')).toBe(true);
  expect(sessions.every(s => s.startedAt.slice(0, 10) < '2027-01-03')).toBe(true);
  for (const day of days) {
    for (const record of day.records) if (record.sleep) expect(record.sleep.date).toBe(day.date);
    JSON.stringify(day.entry, (key, value) => {
      if (key === 'id') expect(day.records.some(record => record.id === value)).toBe(true);
      return value;
    });
  }
});

it('saves journal, workout, and simulator edits only to their selected mode', () => {
  const sample = createDemoData('2026-11-17');
  selectDataMode('demo');
  saveDays([{ ...sample.days[0], entry: { title: 'Demo edit', body: { type: 'doc', content: [] } } }]);
  const demoSession = { ...sample.sessions[0], id: 'demo-edited-session' };
  saveSession(demoSession, '', Date.now());
  const simulated = { ...demoSession, id: 'demo-simulation', source: 'simulator' as const };
  saveSession(simulated, '', Date.now());
  expect(loadSessions().some(s => s.id === demoSession.id)).toBe(true);
  expect(loadSessions(localStorage, true).map(s => s.id)).toEqual(['demo-simulation']);
  selectDataMode('real');
  expect(loadDays()).toEqual([]);
  expect(loadSessions()).toEqual([]);
  expect(loadSessions(localStorage, true)).toEqual([]);
  saveDays([{ ...sample.days[0], records: [], entry: { title: 'Real edit', body: { type: 'doc', content: [] } } }]);
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  expect(localStorage.getItem(SIMULATOR_KEY)).toBeNull();
  selectDataMode('demo');
  expect(loadDays().find(day => day.entry)?.entry?.title).toBe('Demo edit');
  expect(loadSessions().some(s => s.id === demoSession.id)).toBe(true);
});

it('switches the working app and restores journal edits and habit changes in both modes', async () => {
  localStorage.setItem(DATA_MODE_KEY, 'real');
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(createRoutines('2026-11-17')));
  render(<App />);
  await switchMode('demo');
  expect(screen.getByRole('main', { name: 'To-do' })).toBeTruthy();
  expect(screen.queryByRole('region', { name: 'Sleep' })).toBeNull();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Complete Read for today' })); });
  await navigate('journal');
  expect(screen.getByRole('link', { name: 'The high heel worked' })).toBeTruthy();
  await write('My demo writing');
  await navigate('today');
  await switchMode('real');
  expect(screen.queryByRole('region', { name: 'Sleep' })).toBeNull();
  const realRoutines = JSON.parse(localStorage.getItem(ROUTINES_KEY)!);
  expect(realRoutines.books).toEqual([]);
  expect(realRoutines.checkIns).toEqual([]);
  await navigate('journal');
  expect(screen.queryByRole('link', { name: 'The high heel worked' })).toBeNull();
  expect((screen.getByLabelText('Journal title') as HTMLInputElement).value).toBe('');
  await write('My real writing');
  await navigate('today');
  await switchMode('demo');
  expect(screen.getByRole('button', { name: 'Clear Read for today' })).toBeTruthy();
  await navigate('journal');
  expect((screen.getByLabelText('Journal title') as HTMLInputElement).value).toBe('My demo writing');
  await navigate('today');
  await switchMode('real');
  await navigate('journal');
  expect((screen.getByLabelText('Journal title') as HTMLInputElement).value).toBe('My real writing');
});
