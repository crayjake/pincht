import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Home from '../src/components/home/home';
import Train from '../src/components/train/train';
import { emptyRehab, personalRehab } from '../src/rehab/data';
import { ROUTINES_KEY } from '../src/routines/data';
import { SESSION_KEY } from '../src/workouts/storage';
import { JOURNAL_KEY } from '../src/components/home/journal-storage';

const change = (label: string, value: string) => fireEvent.change(screen.getByLabelText(label), { target: { value } });
const click = async (name: string | RegExp) => { await act(async () => { fireEvent.click(screen.getByRole('button', { name })); }); };
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  localStorage.clear(); window.scrollTo = vi.fn();
  Object.assign(personalRehab, { ...emptyRehab(), pulleyStart: '2026-11-13', wristStart: '2026-11-16' });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

it('uses existing workout links with empty history and no rehab setup or care flows', async () => {
  render(<Home screen="today" />);
  expect(screen.getByRole('link', { name: 'Open Pulley rehab' }).getAttribute('href')).toBe('#/train/pulley-rehab');
  expect(screen.queryByText('Set up rehab')).toBeNull();
  expect(screen.queryByText('Pulley care & symptoms')).toBeNull();
  expect(screen.queryByRole('region', { name: 'Finger rehab' })).toBeNull();
  expect(screen.queryByRole('region', { name: 'Sleep' })).toBeNull();
  expect(localStorage.getItem(ROUTINES_KEY)).toBeNull();
  expect(localStorage.getItem(ROUTINES_KEY)).toBeNull();
  expect(JSON.parse(localStorage.getItem(JOURNAL_KEY)!)).toEqual([]);
  expect(localStorage.getItem(SESSION_KEY)).toBeNull();
  await click('Complete Read for today');
  expect(screen.getByRole('heading', { name: 'Add book' })).toBeTruthy();
  expect(localStorage.getItem(ROUTINES_KEY)).toBeNull();
  await click('Can’t find it? Add manually');
  change('Title', 'My actual book');
  change('Total pages', '200');
  await click('Add to library');
  change('Now on page', '12');
  await click('Save reading');
  const stored = JSON.parse(localStorage.getItem(ROUTINES_KEY)!);
  expect(stored.books).toHaveLength(1);
  expect(stored.books[0].title).toBe('My actual book');
  expect(stored.checkIns).toHaveLength(1);
  expect(stored.checkIns[0]).toMatchObject({ date: '2026-11-16', status: 'done', page: 12, bookId: stored.books[0].id });
});

it('preserves unreadable journal storage and reports the problem instead of replacing it with empty history', async () => {
  localStorage.setItem(JOURNAL_KEY, '{unfinished');
  render(<Home screen="journal" />);
  await act(async () => {});
  expect(screen.getByRole('status').textContent).toContain('Stored data has not been replaced');
  change('Journal title', 'Writing held for this visit');
  expect(localStorage.getItem(JOURNAL_KEY)).toBe('{unfinished');
});

it('leaves unspecified wrist repetitions unresolved without directing to a setup flow', () => {
  Object.assign(personalRehab, { ...emptyRehab(), wristStart: '2026-11-16', wristKg: 1 });
  render(<Train presetId="wrist-isometric" />);
  expect((screen.getByRole('button', { name: 'Start workout' }) as HTMLButtonElement).disabled).toBe(true);
  expect(screen.queryByRole('link', { name: /setup/i })).toBeNull();
});

it('runs only eccentrics during phase 2 and waits for the other hand to return the weight', async () => {
  Object.assign(personalRehab, { ...emptyRehab(), wristStart: '2026-11-01', wristKg: 1, wristEccentricWeeks: 2 });
  render(<Train presetId="wrist-rehab" />);
  await click('Start workout');
  await click('Start exercise');
  await act(async () => { await vi.advanceTimersByTimeAsync(8000); });
  expect(screen.getByText('Use the other hand to raise the weight')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Weight returned · next rep' })).toBeTruthy();
  expect(screen.queryByText('Hold in comfortable midrange')).toBeNull();
  const before = screen.getByRole('timer', { name: 'Exercise remaining' }).textContent;
  await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
  expect(screen.getByRole('timer', { name: 'Exercise remaining' }).textContent).toBe(before);
  await click('Weight returned · next rep');
  await click('Pause');
  expect(within(screen.getByRole('dialog', { name: 'Workout paused' })).getByRole('button', { name: 'Resume' })).toBeTruthy();
});

it('refreshes the phase and Today tasks when returning after midnight', () => {
  vi.setSystemTime(new Date('2026-11-14T23:59:00Z'));
  Object.assign(personalRehab, { ...emptyRehab(), pulleyStart: '2026-11-01', wristStart: '2026-11-01' });
  const view = render(<Home screen="today" />);
  expect(within(screen.getByRole('region', { name: 'Today' })).getByText(/glides and mug grips/)).toBeTruthy();
  act(() => { vi.setSystemTime(new Date('2026-11-15T00:01:00Z')); window.dispatchEvent(new Event('focus')); });
  expect(within(screen.getByRole('region', { name: 'Today' })).getByText('Alternate days · 3-finger drag')).toBeTruthy();
  view.unmount();
  expect(vi.getTimerCount()).toBe(0);
});
