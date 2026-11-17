import { emptyRehab, personalRehab } from '../src/rehab/data';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Train from '../src/components/train/train';
import { SESSION_KEY, SIMULATOR_KEY } from '../src/workouts/storage';

const native = vi.hoisted(() => ({ enabled: false, appState: undefined as undefined | ((state: { isActive: boolean }) => void), remove: vi.fn() }));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => native.enabled } }));
vi.mock('@capacitor/app', () => ({ App: { addListener: vi.fn(async (_event, callback) => { native.appState = callback; return { remove: native.remove }; }) } }));

async function click(name: string | RegExp) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
}
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
async function simulator() {
  render(<Train presetId="finger-rehab" />);
  fireEvent.click(screen.getByRole('radio', { name: /Simulator/ }));
  await click('Start workout'); await click('Connect'); await click('Tare'); await click('Start hold');
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  localStorage.clear(); Object.assign(personalRehab, { ...emptyRehab(), pulleyStart: '2026-10-31', wristStart: '2026-11-15' }); native.enabled = false; native.appState = undefined; native.remove.mockClear();
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: undefined });
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  window.scrollTo = vi.fn();
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('workout screens', () => {
  it('explains unavailable browser Bluetooth without hiding the real device option', () => {
    render(<Train presetId="finger-rehab" />);
    expect((screen.getByRole('radio', { name: /Tindeq Progressor/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Web Bluetooth is unavailable/).textContent).toContain('chrome://flags');
    expect((screen.getByRole('radio', { name: /Manual entry/ }) as HTMLInputElement).checked).toBe(true);
  });

  it('requires localhost or HTTPS for browser Bluetooth', () => {
    vi.stubGlobal('isSecureContext', false);
    Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: { requestDevice: vi.fn() } });
    render(<Train presetId="finger-rehab" />);
    expect((screen.getByRole('radio', { name: /Tindeq Progressor/ }) as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByText(/Bluetooth needs a secure page/)).toBeTruthy();
  });

  it('pull-ups preview → edited actuals → rest/skip → final review → save', async () => {
    render(<Train presetId="pull-ups-3x5" />);
    expect(screen.getByText('3 × 5 reps · bodyweight')).toBeTruthy();
    await click('Start workout');
    fireEvent.change(screen.getByLabelText('Actual reps'), { target: { value: '4' } });
    fireEvent.change(screen.getByLabelText('Added load · kg'), { target: { value: '2.5' } });
    await click('Complete set 1'); expect(screen.getByRole('timer').textContent).toBe('1:30');
    await advance(90_000); await click('Complete set 2'); await click('Skip rest'); await click('Complete set 3');
    expect(screen.getByText('Pull-ups · 1 of 1 exercises')).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/Symptom note/), { target: { value: 'Felt good' } });
    fireEvent.change(screen.getByLabelText('Effort · RPE 1–10 · optional'), { target: { value: '7' } });
    await click('Save workout');
    expect(screen.getByRole('status').textContent).toContain('added to your journal');
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY)!)[0];
    expect(saved.sets[0]).toMatchObject({ reps: 4, addedLoadKg: 2.5, source: 'manual' });
    expect(saved.symptomNote).toBe('Felt good');
    expect(saved.rpe).toBe(7);
  });

  it('simulator shows live samples; retry repeats the set; keep starts rest; save stays isolated', async () => {
    await simulator(); await advance(15_200);
    expect(screen.getByText(/15.0 s recorded · mean force/)).toBeTruthy();
    await click('Retry set 1'); expect(screen.getByText('Set 1 / 6')).toBeTruthy();
    await click('Start hold'); await advance(15_200); await click('Keep set');
    expect(screen.getByRole('timer').textContent).toBe('1:00');
    await click('Finish early & review'); await click('Save simulator test');
    expect(localStorage.getItem(SESSION_KEY)).toBeNull();
    expect(JSON.parse(localStorage.getItem(SIMULATOR_KEY)!)[0].sets).toHaveLength(1);
  });

  it('a dropped stream interrupts and requires reconnect and tare before retry', async () => {
    await simulator(); await advance(600); await click('Test stream disconnect');
    expect(screen.getByText(/Simulated stream disconnect/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Keep set' })).toBeNull();
    await click('Retry set 1'); await click('Connect'); await click('Tare'); await click('Start hold');
    await advance(1100); await click('Stop hold'); await click('Keep set');
    await click('Finish early & review'); expect(screen.getByText(/1 interrupted attempt/)).toBeTruthy();
    expect(screen.getByText('1 of 6 sets kept · Simulator · test only')).toBeTruthy();
  });

  it('web background interrupts a hold and invalidates tare', async () => {
    await simulator(); await advance(400);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(screen.getByText(/App left the foreground during the hold/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Keep set' })).toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await click('Retry set 1'); expect(screen.getByRole('button', { name: 'Tare' })).toBeTruthy();
  });

  it('native App background event interrupts even if document visibility is unchanged; unmount removes listener and timer', async () => {
    native.enabled = true;
    await simulator(); await advance(400);
    act(() => { native.appState?.({ isActive: false }); });
    expect(screen.getByText(/App left the foreground during the hold/)).toBeTruthy();
    cleanup(); await act(async () => {});
    expect(native.remove).toHaveBeenCalledOnce(); expect(vi.getTimerCount()).toBe(0);
  });

  it('manual partial hold can be kept and saved; failed save retains the review for retry', async () => {
    render(<Train presetId="finger-rehab" />);
    await click('Start workout'); await click('Start hold'); await advance(2400); await click('Stop hold');
    expect((screen.getByRole('button', { name: 'Keep set' }) as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('Mean force · kg (manual)'), { target: { value: '9.8' } });
    await click('Keep set'); await click('Finish early & review');
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => { throw new Error('Storage full'); });
    await click('Save workout'); expect(screen.getByRole('alert').textContent).toBe('Storage full');
    await click('Save workout'); write.mockRestore();
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY)!)[0];
    expect(saved.sets[0]).toMatchObject({ meanKg: 9.8, durationSeconds: 2.4, status: 'stopped' });
  });
});

describe('reference workout plans', () => {
  it('shows the complete rehab plan and the separate Mobility workout', () => {
    render(<Train />);
    expect(screen.getByRole('heading', { name: 'Pulley rehab' })).toBeTruthy();
    expect(screen.getByText('Tendon glides')).toBeTruthy();
    expect(screen.getByText('Isometric mug grips')).toBeTruthy();
    expect(screen.getByText('3-finger drag')).toBeTruthy();
    expect(screen.getByText('After four weeks')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Mobility/ })).toBeTruthy();
  });

  it('runs glides → squeeze → drag, excludes the locked half crimp, and saves the whole workout', async () => {
    render(<Train presetId="pulley-rehab" />);
    expect(screen.getByRole('list', { name: 'Workout exercises' }).children).toHaveLength(4);
    expect(screen.getByText('Unlocks after 28 full days.')).toBeTruthy();
    screen.getAllByRole('checkbox', { name: 'Include optional exercise' }).forEach(input => fireEvent.click(input));
    await click('Start workout');
    expect(screen.getByRole('timer').textContent).toBe('0:05');
    await advance(5000); expect(screen.getByText('Fingers straight')).toBeTruthy();
    await advance(2000); expect(screen.getByText('Hook fist')).toBeTruthy();
    await click('Pause'); await advance(4000);
    expect(screen.getByText('Hook fist')).toBeTruthy();
    expect(screen.getByRole('timer').textContent).toBe('0:58');
    await click('Resume'); await advance(58_000);
    expect(screen.getByText('6 reps')).toBeTruthy();
    await click('Start isometric mug grips'); await advance(15_000);
    expect(screen.getByText('Rest as needed. Start the next set when ready.')).toBeTruthy();
    await click('Next set'); expect(screen.getByRole('timer').textContent).toBe('0:05');
    await advance(5500);
    Object.defineProperty(document, 'hidden', { configurable: true, value: true });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(screen.getByText(/App left the foreground/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Keep set' })).toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, value: false });
    act(() => { document.dispatchEvent(new Event('visibilitychange')); });
    await click('Retry set 2'); await advance(15_000);
    await click('Finish early & review');
    expect(screen.getByText('2 sets · 20 s held')).toBeTruthy();
    await click('Start 3-finger drag'); await click('Start hold'); await advance(1500); await click('Stop hold');
    fireEvent.change(screen.getByLabelText('Mean force · kg (manual)'), { target: { value: '9.8' } });
    await click('Keep set'); await click('Finish early & review');
    expect(screen.getByText('Pulley rehab · 3 of 3 exercises')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Workout ended' })).toBeTruthy();
    await click('Familiar, settled');
    fireEvent.change(screen.getByLabelText(/Symptom note/), { target: { value: 'Settled afterwards' } });
    await click('Save workout');
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY)!)[0];
    expect(saved.workout.plan.id).toBe('pulley-rehab');
    expect(saved.workout.prescriptions).toHaveLength(4);
    expect(saved.workout.sessions.map((s: { preset: { id: string } }) => s.preset.id)).toEqual(['tendon-glides', 'isometric-squeeze', 'three-finger-drag']);
    expect(saved.sets).toHaveLength(4);
    expect(saved.sets.at(-1)).toMatchObject({ exerciseId: 'finger-drag', meanKg: 9.8, source: 'manual' });
    expect(saved.symptomFeeling).toBe('Familiar, settled');
    expect(saved.symptomNote).toBe('Settled afterwards');
    expect(saved.attempts.filter((a: { status: string }) => a.status === 'interrupted')).toHaveLength(1);
  });

  it('Stop asks before ending and reviews only completed exercises when finishing early', async () => {
    render(<Train presetId="mobility" />);
    expect(screen.queryByText('Change')).toBeNull();
    screen.getAllByRole('checkbox', { name: 'Include optional exercise' }).forEach(input => fireEvent.click(input));
    await click('Start workout'); await advance(65_000);
    await click('Start isometric mug grips'); await advance(6000);
    await click('Stop'); expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    await click('Stop'); await click('Stop exercise');
    expect(screen.getByText('Up next')).toBeTruthy();
    await click('Finish workout & review');
    expect(screen.getByText('Mobility · 1 of 2 exercises')).toBeTruthy();
    await click('Save workout');
    const saved = JSON.parse(localStorage.getItem(SESSION_KEY)!)[0];
    expect(saved.workout.sessions).toHaveLength(1);
    expect(saved.sets[0].reps).toBe(6);
  });
});
