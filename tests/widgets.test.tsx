import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import LibraryPage from '../src/components/home/library-pages';
import { QuickLog } from '../src/components/home/quick-log';
import { ViewPages } from '../src/components/home/view-pages';
import { ViewWidgets } from '../src/components/home/view-widgets';
import { loadViews, widgetNames } from '../src/components/home/journal-views';
import { loadDays, loadResources, saveDays, saveResources } from '../src/components/home/journal-storage';
import { strengthMeasurements, widgetData } from '../src/components/home/widget-data';
import type { Day } from '../src/components/home/journal-data';
import { DATA_MODE_KEY } from '../src/data/mode';
import { createRoutines, ROUTINES_KEY } from '../src/routines/data';
import { createDemoData } from '../src/data/demo';
import { exercises, workoutPresets } from '../src/workouts/fixtures';
import { createSession, type Session } from '../src/workouts/session';

const today = '2026-11-16';
const day = (date = today): Day => ({ date, types: [], records: [], metrics: {}, visibleMetrics: [] });
const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = (name: string) => fireEvent.click(screen.getByRole('button', { name, exact: true }));
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date(`${today}T12:00:00Z`));
  localStorage.clear(); localStorage.setItem(DATA_MODE_KEY, 'real');
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(createRoutines(today)));
  window.history.replaceState(null, '', '/#/journal'); window.scrollTo = vi.fn();
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('creates a strength goal, logs a measurement, and binds the target to a saved view', () => {
  const page = render(<LibraryPage category="goals" id="new" onDataMode={() => {}} />);
  change('Name', '25 kg drag'); change('Measure', 'finger-strength'); change('Target load · kg', '25'); click('Create goal');
  const goal = loadResources()[0];
  expect(goal.goal).toEqual({ metric: 'finger-strength', targetKg: 25 });
  page.unmount();
  const detail = render(<LibraryPage category="goals" id={goal.id} onDataMode={() => {}} />);
  click('Log measurement'); change('20 mm three-finger drag · kg', '22.5'); click('Save measurement');
  expect(loadDays()[0].measurements?.fingerStrengthKg).toBe(22.5);
  expect(screen.getByRole('region', { name: 'Finger strength' }).textContent).toContain('target 25 kg');
  expect(screen.getByRole('heading', { name: 'History' }).parentElement!.textContent).toContain('22.5 kg');
  const measurement = screen.getByRole('button', { name: '16 Nov 2026: 22.5 kg' });
  fireEvent.focus(measurement);
  expect(screen.getByRole('status').textContent).toContain('22.5 kg');
  detail.unmount();
  render(<ViewPages id="climbing" />);
  click('Configure Widgets'); click('Finger strength'); change('Strength target', goal.id); click('Done');
  expect(loadViews().find(view => view.id === 'climbing')!.blocks[0]).toMatchObject({ widgets: ['rehab', 'climbing', 'strength'], goalId: goal.id });
  expect(strengthMeasurements(loadDays(), [{ date: today, kg: 20, edgeMm: 20 }])).toEqual([{ date: today, kg: 22.5, edgeMm: 20 }]);
});

it('validates optional stage totals and stores real stage durations without inventing sleep times', () => {
  render(<QuickLog kind="sleep" onClose={() => {}} />);
  change('Hours', '7'); change('Minutes', '30');
  change('Deep · minutes', '90'); change('REM · minutes', '90'); change('Light · minutes', '260'); click('Save sleep');
  expect(screen.getByRole('alert').textContent).toContain('adding up');
  expect(loadDays()).toEqual([]);
  change('Light · minutes', '270'); click('Save sleep');
  const saved = loadDays()[0];
  expect(saved.metrics.sleep).toBe(450);
  expect(saved.records[0].sleep).toEqual({ date: today, segments: [{ stage: 'deep', minutes: 90 }, { stage: 'rem', minutes: 90 }, { stage: 'light', minutes: 270 }] });
});

it('keeps climbing duration as a daily total when another climb is logged', () => {
  const log = () => render(<QuickLog kind="climb" onClose={() => {}} />);
  const first = log(); change('Name', 'Blue slab'); change('Grade', '6C'); change('Climbing time today · minutes · optional', '90'); click('Save climb'); first.unmount();
  const second = log(); change('Climb', 'new'); change('Name', 'Red wall'); change('Grade', '7A'); fireEvent.click(screen.getByLabelText('Sent it')); click('Save climb'); second.unmount();
  expect(loadDays()[0].measurements?.climbingMinutes).toBe(90);
  expect(loadDays()[0].records).toHaveLength(2);
  const model = widgetData(loadDays(), createRoutines(today), []);
  expect(model.activity(today)).toEqual(['climb']);
  expect(model.hardest?.record.title).toBe('Red wall');
  expect(model.projects.map(item => item.record.title)).toEqual(['Blue slab']);
});

it('counts real workouts once and excludes references, simulator sessions, and strength measurements from activity', () => {
  const preset = workoutPresets.find(preset => preset.id === 'pull-ups-3x5')!;
  const session: Session = { ...createSession(preset, exercises.find(exercise => exercise.id === preset.exerciseId)!, 'manual', Date.parse(`${today}T12:00:00Z`)), phase: 'review', finishedAt: `${today}T12:10:00Z`, rpe: 7,
    sets: [{ set: 1, source: 'manual', status: 'completed', reps: 5, trace: [] }] };
  const saved: Day = { ...day(), records: [
    { id: 'reference', kind: 'climb', title: 'Only mentioned', metric: '8A', meta: '', climb: { goes: 0 } },
    { id: 'measurement-finger-today', kind: 'rehab', title: '20 mm drag', metric: '22 kg', meta: '' },
    { id: `workout-${session.id}`, kind: 'training', title: 'Pull-ups', metric: '5 reps', meta: '' },
  ] };
  const model = widgetData([saved], createRoutines(today), [session, session, { ...session, id: 'simulator', source: 'simulator' }]);
  expect(model.activity(today)).toEqual(['training']);
  expect(model.counts(today)).toEqual({ training: 1, climb: 0, rehab: 0 });
  expect(model.sends).toEqual([]); expect(model.projects).toEqual([]);
  expect(model.pullups).toEqual([{ date: today, value: 5, rpe: 7 }]);
});

it('renders every new widget with useful empty states and no fabricated measurements', () => {
  render(<ViewWidgets widgets={Object.keys(widgetNames).filter(id => id !== 'activity') as (keyof typeof widgetNames)[]} days={[]} data={createRoutines(today)} loads={[]} />);
  expect(screen.getAllByRole('region')).toHaveLength(20);
  expect(within(screen.getByRole('region', { name: 'Finger rehab' })).getByText('No measurements yet.')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Hardest send' })).getByText('No graded sends yet')).toBeTruthy();
  expect(within(screen.getByRole('region', { name: 'Sleep stages' })).getByText(/No sleep stages logged/)).toBeTruthy();
  expect(screen.queryByText('22.0')).toBeNull();
  expect(loadDays()).toEqual([]); expect(loadResources()).toEqual([]);
});

it('uses structured demo data for climbing widgets without putting it in real storage', () => {
  const sample = createDemoData('2026-11-17'), model = widgetData(sample.days, sample.routines, sample.sessions, '2026-11-17');
  expect(model.sends.length).toBeGreaterThan(0); expect(model.projects.length).toBeGreaterThan(0);
  expect(model.hardest?.record.metric).toBe('7A'); expect(model.pullups.length).toBeGreaterThan(0);
  saveDays([{ ...day(), measurements: { fingerStrengthKg: 12 } }]);
  saveResources([{ id: 'real-goal', kind: 'goal', title: 'Real goal', metric: '', meta: '', goal: { metric: 'finger-strength', targetKg: 20 } }]);
  localStorage.setItem(DATA_MODE_KEY, 'demo');
  expect(loadDays()).toEqual([]); expect(loadResources()).toEqual([]);
});
