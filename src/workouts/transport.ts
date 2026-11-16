import { BleClient, type BleClientInterface } from '@capacitor-community/bluetooth-le';
import { Capacitor } from '@capacitor/core';
import { command, decodeProgressor, PROGRESSOR_CONTROL, PROGRESSOR_DATA, PROGRESSOR_SERVICE } from './progressor-protocol.ts';
import type { ForceSample } from './session.ts';

export interface ForceTransport {
  connect(): Promise<string>; tare(): Promise<void>; start(): Promise<void>; stop(): Promise<void>; dispose(): Promise<void>;
}
export interface TransportEvents { sample: (sample: ForceSample) => void; disconnected: () => void; error: (message: string) => void }
export class ProgressorTransport implements ForceTransport {
  private deviceId?: string;
  private online = false;
  private disposed = false;
  private streaming = false;
  private queue: Promise<void> = Promise.resolve();
  private events: TransportEvents;
  private client: BleClientInterface;
  constructor(events: TransportEvents, client: BleClientInterface = BleClient) { this.events = events; this.client = client; }
  async connect() {
    try {
      await this.client.initialize();
      if (!await this.client.isEnabled()) throw new Error('Bluetooth is off. Enable it in your device settings.');
      if (this.disposed) throw new Error('Session closed');
      const device = await this.client.requestDevice({ services: [PROGRESSOR_SERVICE] });
      if (this.disposed) throw new Error('Session closed');
      this.deviceId = device.deviceId;
      await this.client.connect(device.deviceId, () => {
        this.streaming = false;
        this.online = false;
        if (!this.disposed) this.events.disconnected();
      });
      this.online = true;
      if (this.disposed) { await this.client.disconnect(device.deviceId); throw new Error('Session closed'); }
      await this.client.startNotifications(device.deviceId, PROGRESSOR_SERVICE, PROGRESSOR_DATA, data => {
        if (this.disposed) return;
        try {
          const decoded = decodeProgressor(data);
          if (decoded.lowBattery) this.events.error('Progressor battery is empty. Charge it before retrying.');
          if (this.streaming) decoded.samples.forEach(this.events.sample);
        } catch { this.events.error('Invalid Progressor data. Tare and retry the hold.'); }
      });
      if (this.disposed) { await this.dispose(); throw new Error('Session closed'); }
      return device.name || 'Tindeq Progressor';
    } catch (error) {
      await this.dispose();
      throw error;
    }
  }
  private send(opcode: 'tare' | 'start' | 'stop') {
    const task = this.queue.catch(() => {}).then(async () => {
      if (!this.deviceId || !this.online || (this.disposed && opcode !== 'stop')) throw new Error('Progressor is disconnected. Connect again.');
      if (opcode === 'start') this.streaming = true;
      await this.client.write(this.deviceId, PROGRESSOR_SERVICE, PROGRESSOR_CONTROL, command(opcode));
    });
    this.queue = task;
    return task;
  }
  tare() { return this.send('tare'); }
  async start() { try { await this.send('start'); } catch (error) { this.streaming = false; throw error; } }
  async stop() {
    this.streaming = false;
    if (this.deviceId && this.online) await this.send('stop');
  }
  async dispose() {
    this.disposed = true;
    await this.stop().catch(() => {});
    const id = this.deviceId;
    this.deviceId = undefined;
    this.online = false;
    if (id) {
      await this.client.stopNotifications(id, PROGRESSOR_SERVICE, PROGRESSOR_DATA).catch(() => {});
      await this.client.disconnect(id).catch(() => {});
    }
  }
}
export class SimulatorTransport implements ForceTransport {
  private timer?: ReturnType<typeof setInterval>;
  private events: TransportEvents;
  private targetKg: number;
  constructor(events: TransportEvents, targetKg: number) { this.events = events; this.targetKg = targetKg; }
  async connect() { return 'Simulator · no hardware'; }
  async tare() {}
  async start() {
    await this.stop();
    let index = 0;
    this.timer = setInterval(() => {
      this.events.sample({ kg: this.targetKg + Math.sin(index / 6) * .6, deviceTimeUs: index++ * 100_000 });
    }, 100);
  }
  async stop() { clearInterval(this.timer); this.timer = undefined; }
  async dispose() { await this.stop(); }
}
export const bluetoothError = (error: unknown, native = Capacitor.isNativePlatform()) => {
  const message = error instanceof Error ? error.message : String(error);
  const detail = `${error instanceof Error ? error.name : ''} ${message}`;
  if (/cancel|notfounderror|no device selected/i.test(detail)) return 'No device selected. Turn on your Progressor, close other apps connected to it, and connect again.';
  if (/denied|unauthori[sz]ed|permission|notallowederror|securityerror/i.test(detail)) return native
    ? 'Bluetooth permission denied. Enable pincht in Settings → Privacy & Security → Bluetooth, then connect again.'
    : 'Bluetooth access was blocked. Allow Bluetooth in this browser’s site settings, open the app on localhost or HTTPS, then click Connect again.';
  if (/radio|adapter|powered off|bluetooth is off/i.test(detail)) return 'No active Bluetooth adapter. Turn on Bluetooth in your computer or device settings, then connect again.';
  return `Could not use Progressor: ${message}`;
};
