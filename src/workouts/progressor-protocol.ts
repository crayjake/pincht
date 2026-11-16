import type { ForceSample } from './session.ts';

// https://tindeq.com/progressor_api/ — little endian TLV notifications.
export const PROGRESSOR_SERVICE = '7e4e1701-1ea6-40c9-9dcc-13d34ffead57';
export const PROGRESSOR_DATA = '7e4e1702-1ea6-40c9-9dcc-13d34ffead57';
export const PROGRESSOR_CONTROL = '7e4e1703-1ea6-40c9-9dcc-13d34ffead57';
// Parameterless commands are a single opcode (as in Tindeq's linked Python client).
export const command = (opcode: 'tare' | 'start' | 'stop') => new DataView(Uint8Array.of({ tare: 0x64, start: 0x65, stop: 0x66 }[opcode]).buffer);
export function decodeProgressor(data: DataView): { samples: ForceSample[]; lowBattery: boolean } {
  const samples: ForceSample[] = [];
  let lowBattery = false;
  for (let offset = 0; offset < data.byteLength;) {
    if (offset + 2 > data.byteLength) throw new Error('Truncated Progressor header');
    const tag = data.getUint8(offset), length = data.getUint8(offset + 1);
    const end = offset + 2 + length;
    if (end > data.byteLength) throw new Error('Truncated Progressor payload');
    if (tag === 1) {
      if (!length || length % 8) throw new Error('Invalid weight payload length');
      for (let i = offset + 2; i < end; i += 8) {
        const kg = data.getFloat32(i, true);
        if (!Number.isFinite(kg)) throw new Error('Invalid force sample');
        samples.push({ kg, deviceTimeUs: data.getUint32(i + 4, true) });
      }
    }
    if (tag === 4) lowBattery = true;
    offset = end;
  }
  return { samples, lowBattery };
}
