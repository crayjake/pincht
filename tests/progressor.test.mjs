import assert from 'node:assert/strict';
import test from 'node:test';
import { command, decodeProgressor, PROGRESSOR_SERVICE, PROGRESSOR_DATA, PROGRESSOR_CONTROL } from '../src/workouts/progressor-protocol.ts';
import { ProgressorTransport, bluetoothError } from '../src/workouts/transport.ts';

function packet(samples = [[10.5, 0], [11, 12_500]]) {
  const view = new DataView(new ArrayBuffer(2 + samples.length * 8));
  view.setUint8(0, 1); view.setUint8(1, samples.length * 8);
  samples.forEach(([kg, us], i) => { view.setFloat32(2 + i * 8, kg, true); view.setUint32(6 + i * 8, us, true); });
  return view;
}
function fakeClient() {
  const calls = []; let notify, disconnected;
  return {
    calls,
    client: {
      initialize: async () => calls.push('initialize'), isEnabled: async () => true,
      requestDevice: async options => { calls.push(options); return { deviceId: 'test-id', name: 'Progressor' }; },
      connect: async (id, callback) => { calls.push(['connect', id]); disconnected = callback; },
      startNotifications: async (id, service, data, callback) => { calls.push(['notify', id, service, data]); notify = callback; },
      write: async (id, service, control, value) => { calls.push(['write', id, service, control, [...new Uint8Array(value.buffer)]]); },
      stopNotifications: async (...args) => calls.push(['unsubscribe', ...args]),
      disconnect: async id => calls.push(['disconnect', id]),
    },
    emit: data => notify(data), drop: () => disconnected(),
  };
}

test('official command bytes, batched little-endian samples, and offset views decode correctly', () => {
  assert.deepEqual(['tare', 'start', 'stop'].map(name => [...new Uint8Array(command(name).buffer)]), [[0x64], [0x65], [0x66]]);
  const view = packet();
  const padded = new Uint8Array(view.byteLength + 6); padded.set(new Uint8Array(view.buffer), 3);
  assert.deepEqual(decodeProgressor(new DataView(padded.buffer, 3, view.byteLength)), { samples: [{ kg: 10.5, deviceTimeUs: 0 }, { kg: 11, deviceTimeUs: 12_500 }], lowBattery: false });
  assert.deepEqual(decodeProgressor(new DataView(Uint8Array.of(0, 1, 42, 4, 0).buffer)), { samples: [], lowBattery: true });
});

test('truncated, misaligned and non-finite notifications are rejected', () => {
  for (const bytes of [[1], [1, 8, 0], [1, 1, 0]]) assert.throws(() => decodeProgressor(new DataView(Uint8Array.from(bytes).buffer)));
  assert.throws(() => decodeProgressor(packet([[NaN, 0]])), /Invalid force/);
});

test('native transport discovers service, subscribes, tares, streams, stops, and cleans up', async () => {
  const fake = fakeClient(); const samples = [], errors = [];
  const transport = new ProgressorTransport({ sample: s => samples.push(s), error: e => errors.push(e), disconnected: () => {} }, fake.client);
  assert.equal(await transport.connect(), 'Progressor');
  assert.deepEqual(fake.calls[1], { services: [PROGRESSOR_SERVICE] });
  assert.deepEqual(fake.calls[3], ['notify', 'test-id', PROGRESSOR_SERVICE, PROGRESSOR_DATA]);
  fake.emit(packet()); assert.equal(samples.length, 0);
  await transport.tare(); await transport.start(); fake.emit(packet());
  assert.equal(samples.length, 2);
  await transport.stop(); fake.emit(packet()); assert.equal(samples.length, 2);
  assert.deepEqual(fake.calls.filter(c => c[0] === 'write').map(c => [c[3], c[4]]), [[PROGRESSOR_CONTROL, [100]], [PROGRESSOR_CONTROL, [101]], [PROGRESSOR_CONTROL, [102]]]);
  fake.emit(new DataView(Uint8Array.of(4, 0).buffer)); assert.match(errors[0], /battery/);
  await transport.dispose(); fake.emit(packet()); assert.equal(samples.length, 2);
  assert.ok(fake.calls.some(c => c[0] === 'unsubscribe')); assert.ok(fake.calls.some(c => c[0] === 'disconnect'));
  await assert.rejects(transport.start(), /disconnected/);
});

test('disconnect halts samples and disposed subscriptions are still cleaned up', async () => {
  const fake = fakeClient(); let drops = 0, samples = 0;
  const transport = new ProgressorTransport({ sample: () => samples++, error: () => {}, disconnected: () => drops++ }, fake.client);
  await transport.connect(); await transport.start(); fake.drop(); fake.emit(packet());
  assert.equal(drops, 1); assert.equal(samples, 0);
  await assert.rejects(transport.tare(), /disconnected/);
  await transport.dispose(); assert.ok(fake.calls.some(c => c[0] === 'unsubscribe'));
  fake.drop(); assert.equal(drops, 1);
});

test('permission denial and leaving during device selection cannot create a late subscription', async () => {
  const fake = fakeClient(); fake.client.initialize = async () => { throw new Error('Permission denied'); };
  const events = { sample: () => {}, error: () => {}, disconnected: () => {} };
  await assert.rejects(new ProgressorTransport(events, fake.client).connect(), /denied/);
  assert.match(bluetoothError(new Error('Permission denied'), true), /Settings/);
  const late = fakeClient(); let selected;
  late.client.requestDevice = () => new Promise(resolve => { selected = resolve; });
  const transport = new ProgressorTransport(events, late.client);
  const connecting = transport.connect();
  await new Promise(resolve => setImmediate(resolve));
  await transport.dispose(); selected({ deviceId: 'late-device' });
  await assert.rejects(connecting, /closed/);
  assert.ok(!late.calls.some(c => c[0] === 'notify'));
});
