import { normaliseIsbn } from './catalog';
import { Capacitor } from '@capacitor/core';

export async function scanBookIsbn(signal?: AbortSignal): Promise<string | undefined> {
  try {
    if (signal?.aborted) return;
    let value: string | undefined;
    if (Capacitor.isNativePlatform()) {
      const { CapacitorBarcodeScanner, CapacitorBarcodeScannerTypeHint, CapacitorBarcodeScannerCameraDirection } = await import('@capacitor/barcode-scanner');
      if (signal?.aborted) return;
      const result = await CapacitorBarcodeScanner.scanBarcode({ hint: CapacitorBarcodeScannerTypeHint.EAN_13, cameraDirection: CapacitorBarcodeScannerCameraDirection.BACK,
        scanInstructions: 'Scan the ISBN barcode on the back of your book', scanButton: false });
      value = result.ScanResult;
    } else {
      const { scanWebBarcode } = await import('./web-scanner');
      value = await scanWebBarcode(signal);
    }
    if (!value || signal?.aborted) return;
    const isbn = normaliseIsbn(value);
    if (!isbn) throw new Error('That is not a valid book ISBN barcode. Try the barcode starting 978 or 979, or search by title.');
    return isbn;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (signal?.aborted || /cancel|dismiss/i.test(message)) return;
    if (/permission|denied|notallowed/i.test(message)) throw new Error('Camera access is needed to scan a book. Allow it in your device settings, or search by title or ISBN.');
    throw new Error(message || 'The camera could not open. Search by title or ISBN instead.');
  }
}
