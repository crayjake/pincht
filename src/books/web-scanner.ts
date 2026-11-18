import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';

let active = false;

/** A modal camera surface is needed above the book sheet's native <dialog>. */
export async function scanWebBarcode(signal?: AbortSignal): Promise<string | undefined> {
  if (signal?.aborted || active) return;
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('The camera needs HTTPS or the installed app. You can search by title or ISBN instead.');
  active = true;
  const previousFocus = document.activeElement as HTMLElement | null;
  const dialog = document.createElement('dialog');
  dialog.className = 'journal-sheet book-camera';
  dialog.setAttribute('aria-label', 'Scan book barcode');
  const heading = document.createElement('h2'); heading.textContent = 'Scan barcode';
  const instructions = document.createElement('p'); instructions.textContent = 'Point your camera at the ISBN barcode on the back of your book.';
  const preview = document.createElement('div'); preview.id = `book-camera-${crypto.randomUUID()}`;
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.textContent = 'Opening camera…';
  const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'primary-button full-width'; cancel.textContent = 'Cancel';
  dialog.append(heading, instructions, preview, status, cancel);
  document.body.append(dialog);
  let scanner: Html5Qrcode | undefined;
  let started = false;
  let cleanup: Promise<void> | undefined;
  const stop = () => cleanup ??= (async () => { if (scanner?.isScanning) await scanner.stop(); scanner?.clear(); })();
  try {
    dialog.showModal();
    scanner = new Html5Qrcode(preview.id, { formatsToSupport: [Html5QrcodeSupportedFormats.EAN_13], verbose: false });
    return await new Promise<string | undefined>((resolve, reject) => {
      let finished = false;
      const finish = (value?: string, error?: unknown) => {
        if (finished) return;
        finished = true;
        signal?.removeEventListener('abort', abort);
        // Resolve cancellation promptly, even while the camera permission prompt is open.
        // If start subsequently succeeds, its continuation stops the camera as well.
        if (error) reject(error); else resolve(value);
      };
      const abort = () => finish();
      cancel.onclick = abort;
      dialog.oncancel = event => { event.preventDefault(); abort(); };
      signal?.addEventListener('abort', abort, { once: true });
      if (signal?.aborted) { finish(); return; }
      scanner!.start({ facingMode: 'environment' }, { fps: 10, aspectRatio: 4 / 3 }, value => finish(value), () => {
        // A frame without a readable barcode is expected; keep scanning.
      }).then(async () => {
        started = true;
        if (finished) await stop();
        else status.textContent = 'Looking for a barcode…';
      }).catch(error => finish(undefined, error));
    });
  } finally {
    try { if (started) await stop(); } catch { /* Camera tracks may already have been released by the browser. */ }
    dialog.close(); dialog.remove(); active = false;
    if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true });
  }
}
