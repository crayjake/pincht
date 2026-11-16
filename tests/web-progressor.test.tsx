import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import Train from '../src/components/train/train';
import { PROGRESSOR_CONTROL, PROGRESSOR_DATA, PROGRESSOR_SERVICE } from '../src/workouts/progressor-protocol';
import { SESSION_KEY, SIMULATOR_KEY } from '../src/workouts/storage';

// Exercise the installed BLE plugin's web implementation, down to browser GATT.
// Only navigator.bluetooth and the peripheral are faked; transport and UI are real.
function browserPeripheral() {
  const writes: number[] = [];
  const device = Object.assign(new EventTarget(), { id: crypto.randomUUID(), name: 'Progressor desktop test' });
  const data = Object.assign(new EventTarget(), {
    uuid: PROGRESSOR_DATA, service: { uuid: PROGRESSOR_SERVICE, device },
    value: new DataView(new ArrayBuffer(0)),
    startNotifications: vi.fn(async () => {}), stopNotifications: vi.fn(async () => {}),
  });
  const control = { writeValueWithResponse: vi.fn(async (value: DataView) => { writes.push(value.getUint8(0)); }) };
  const getCharacteristic = vi.fn(async (uuid: string) => {
    if (uuid === PROGRESSOR_DATA) return data;
    if (uuid === PROGRESSOR_CONTROL) return control;
    throw new Error('Unexpected characteristic');
  });
  const gatt = {
    connected: false,
    connect: vi.fn(async () => { gatt.connected = true; return gatt; }),
    disconnect: vi.fn(() => { gatt.connected = false; device.dispatchEvent(new Event('gattserverdisconnected')); }),
    getPrimaryService: vi.fn(async (uuid: string) => {
      expect(uuid).toBe(PROGRESSOR_SERVICE);
      return { getCharacteristic };
    }),
  };
  Object.assign(device, { gatt });
  const bluetooth = { getAvailability: vi.fn(async () => true), requestDevice: vi.fn(async () => device) };
  Object.defineProperty(navigator, 'bluetooth', { configurable: true, value: bluetooth });
  function sample(kg: number, seconds: number) {
    const value = new DataView(new ArrayBuffer(10));
    value.setUint8(0, 1); value.setUint8(1, 8);
    value.setFloat32(2, kg, true); value.setUint32(6, seconds * 1_000_000, true);
    data.value = value;
    data.dispatchEvent(new Event('characteristicvaluechanged'));
  }
  return { bluetooth, gatt, data, writes, sample };
}
async function click(name: string | RegExp) {
  await act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
}
async function advance(ms: number) {
  await act(async () => { await vi.advanceTimersByTimeAsync(ms); });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-15T12:00:00Z'));
  vi.stubGlobal('isSecureContext', true);
  Object.defineProperty(document, 'hidden', { configurable: true, value: false });
  window.scrollTo = vi.fn(); localStorage.clear();
});
afterEach(async () => { cleanup(); await act(async () => {}); vi.useRealTimers(); vi.unstubAllGlobals(); });

it('desktop browser discovers a real device, tares, streams through the plugin, saves real results, and cleans up', async () => {
  const peripheral = browserPeripheral();
  render(<Train presetId="finger-rehab" />);
  expect((screen.getByRole('radio', { name: /Tindeq Progressor/ }) as HTMLInputElement).checked).toBe(true);
  await click('Start workout'); await click('Connect');
  expect(peripheral.bluetooth.requestDevice).toHaveBeenCalledWith({
    filters: [{ services: [PROGRESSOR_SERVICE], name: undefined, namePrefix: undefined }],
    optionalServices: undefined, acceptAllDevices: false,
  });
  expect(peripheral.data.startNotifications).toHaveBeenCalledOnce();
  await click('Tare'); await click('Start hold');
  expect(peripheral.writes).toEqual([0x64, 0x65]);
  act(() => peripheral.sample(10, 0));
  expect(screen.getByText('10.0')).toBeTruthy();
  for (let second = 1; second <= 15; second++) {
    await advance(1000); act(() => peripheral.sample(10, second));
  }
  expect(screen.getByText('15.0 s recorded · mean force')).toBeTruthy();
  await click('Keep set'); await click('Finish early & review'); await click('Save workout');
  const saved = JSON.parse(localStorage.getItem(SESSION_KEY)!)[0];
  expect(saved.source).toBe('tindeq');
  expect(saved.sets[0]).toMatchObject({ source: 'tindeq', meanKg: 10, durationSeconds: 15 });
  expect(localStorage.getItem(SIMULATOR_KEY)).toBeNull();
  expect(peripheral.writes).toContain(0x66);
  expect(peripheral.data.stopNotifications).toHaveBeenCalled();
  expect(peripheral.gatt.disconnect).toHaveBeenCalled();
});

it('browser cancellation and permission denial are recoverable and give browser-specific guidance', async () => {
  const peripheral = browserPeripheral();
  peripheral.bluetooth.requestDevice.mockRejectedValueOnce(new DOMException('User cancelled the requestDevice chooser.', 'NotFoundError'));
  render(<Train presetId="finger-rehab" />);
  await click('Start workout'); await click('Connect');
  expect(screen.getByRole('alert').textContent).toContain('No device selected');
  peripheral.bluetooth.requestDevice.mockRejectedValueOnce(new DOMException('Permission denied', 'NotAllowedError'));
  await click('Connect');
  expect(screen.getByRole('alert').textContent).toContain('browser’s site settings');
  expect(screen.queryByRole('button', { name: 'Open app settings' })).toBeNull();
  await click('Connect'); expect(screen.getByRole('button', { name: 'Tare' })).toBeTruthy();
});

it('a missing computer Bluetooth adapter leaves Connect available with a useful error', async () => {
  const peripheral = browserPeripheral();
  peripheral.bluetooth.getAvailability.mockResolvedValue(false);
  render(<Train presetId="finger-rehab" />);
  await click('Start workout'); await click('Connect');
  expect(screen.getByRole('alert').textContent).toContain('No active Bluetooth adapter');
  expect(peripheral.bluetooth.requestDevice).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Connect' })).toBeTruthy();
});

it('a browser GATT disconnect interrupts a real hold and retry requires reconnect and tare', async () => {
  const peripheral = browserPeripheral();
  render(<Train presetId="finger-rehab" />);
  await click('Start workout'); await click('Connect'); await click('Tare'); await click('Start hold');
  act(() => { peripheral.sample(10, 0); peripheral.gatt.disconnect(); });
  expect(screen.getByText('Progressor disconnected during the hold.')).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Keep set' })).toBeNull();
  await click('Retry set 1'); await click('Connect'); await click('Tare'); await click('Start hold');
  act(() => peripheral.sample(9, 0)); await advance(1000); act(() => peripheral.sample(11, 1));
  await click('Stop hold'); await click('Keep set'); await click('Finish early & review'); await click('Save workout');
  const saved = JSON.parse(localStorage.getItem(SESSION_KEY)!)[0];
  expect(saved.sets).toHaveLength(1);
  expect(saved.sets[0]).toMatchObject({ meanKg: 10, durationSeconds: 1, source: 'tindeq' });
});
