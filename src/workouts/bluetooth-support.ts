import { Capacitor } from '@capacitor/core';

export function progressorAvailability(): { available: boolean; reason?: string } {
  if (Capacitor.isNativePlatform()) return { available: true };
  if (!window.isSecureContext) return { available: false, reason: 'Bluetooth needs a secure page. Open this app on http://localhost or HTTPS.' };
  const browser = navigator as Navigator & { bluetooth?: { requestDevice?: unknown } };
  if (typeof browser.bluetooth?.requestDevice !== 'function') return {
    available: false,
    reason: 'Web Bluetooth is unavailable. Use Chrome or Chromium. On Linux, enable Experimental Web Platform features at chrome://flags/#enable-experimental-web-platform-features, relaunch the browser, and reload this page.',
  };
  return { available: true };
}
