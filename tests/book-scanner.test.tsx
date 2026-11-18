import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { scanWebBarcode } from '../src/books/web-scanner';
import { scanBookIsbn } from '../src/books/scanner';

const camera = vi.hoisted(() => ({ start: vi.fn(), stop: vi.fn(), clear: vi.fn(), running: false, native: false, scanNative: vi.fn() }));
vi.mock('html5-qrcode', () => ({
  Html5QrcodeSupportedFormats: { EAN_13: 9 },
  Html5Qrcode: class {
    get isScanning() { return camera.running; }
    start = camera.start;
    stop = camera.stop;
    clear = camera.clear;
  },
}));
vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => camera.native } }));
vi.mock('@capacitor/barcode-scanner', () => ({ CapacitorBarcodeScanner: { scanBarcode: camera.scanNative }, CapacitorBarcodeScannerTypeHint: { EAN_13: 9 }, CapacitorBarcodeScannerCameraDirection: { BACK: 1 } }));
beforeEach(() => {
  vi.resetAllMocks(); camera.running = false; camera.native = false;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia: vi.fn() } });
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
  camera.stop.mockImplementation(async () => { camera.running = false; });
});
afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks(); });
it('closes and releases the camera when a barcode is decoded', async () => {
  let decoded: (value: string) => void = () => {};
  camera.start.mockImplementation(async (_facing, _config, onSuccess) => { decoded = onSuccess; camera.running = true; });
  const pending = scanWebBarcode(); await Promise.resolve();
  expect(document.querySelector('dialog')?.open).toBe(true);
  decoded('9780306406157');
  expect(await pending).toBe('9780306406157');
  expect(camera.stop).toHaveBeenCalledOnce(); expect(camera.clear).toHaveBeenCalledOnce();
  expect(document.querySelector('dialog')).toBeNull();
});
it('cancels promptly while camera permission is pending and stops a late camera start', async () => {
  let allow: () => void = () => {};
  camera.start.mockImplementation(() => new Promise<void>(resolve => { allow = () => { camera.running = true; resolve(); }; }));
  const pending = scanWebBarcode();
  (document.querySelector('button') as HTMLButtonElement).click();
  expect(await pending).toBeUndefined();
  expect(document.querySelector('dialog')).toBeNull();
  allow(); await Promise.resolve(); await Promise.resolve();
  expect(camera.stop).toHaveBeenCalledOnce();
});
it('cleans up a denied camera and allows retrying', async () => {
  camera.start.mockRejectedValue(new DOMException('Permission denied', 'NotAllowedError'));
  await expect(scanBookIsbn()).rejects.toThrow('Allow it in your device settings');
  expect(document.querySelector('dialog')).toBeNull();
  const controller = new AbortController(); camera.start.mockImplementation(async () => { camera.running = true; });
  const pending = scanWebBarcode(controller.signal); await Promise.resolve(); controller.abort();
  expect(await pending).toBeUndefined(); expect(camera.stop).toHaveBeenCalledOnce();
});
it('rejects non-book barcodes from the native scanner and treats dismissals as cancellation', async () => {
  camera.native = true; camera.scanNative.mockResolvedValueOnce({ ScanResult: '1234567890128' });
  await expect(scanBookIsbn()).rejects.toThrow('not a valid book ISBN');
  camera.scanNative.mockRejectedValueOnce(new Error('User cancelled scanning'));
  expect(await scanBookIsbn()).toBeUndefined();
  camera.scanNative.mockResolvedValueOnce({ ScanResult: '9780306406157' });
  expect(await scanBookIsbn()).toBe('9780306406157');
});
