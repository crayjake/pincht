import { readStored, writeStored } from './storage.ts';
export const PREFERENCES_KEY = 'pincht.preferences';
export interface Preferences {
  appearance: 'system' | 'light' | 'dark';
  reminder: boolean; reminderTime: string;
  tindeq: { autoConnect: boolean; zeroEachSet: boolean; thresholdKg: number; deviceId?: string; deviceName?: string };
}
export const defaultPreferences: Preferences = { appearance:'system', reminder:false, reminderTime:'20:30', tindeq:{autoConnect:true,zeroEachSet:false,thresholdKg:2} };
export function isPreferences(value: unknown): value is Preferences {
  const p=value as Preferences;
  return !!p && ['system','light','dark'].includes(p.appearance) && typeof p.reminder==='boolean' && /^([01]\d|2[0-3]):[0-5]\d$/.test(p.reminderTime)
    && !!p.tindeq && typeof p.tindeq.autoConnect==='boolean' && typeof p.tindeq.zeroEachSet==='boolean' && Number.isFinite(p.tindeq.thresholdKg) && p.tindeq.thresholdKg>=0 && p.tindeq.thresholdKg<=100
    && (p.tindeq.deviceId===undefined || typeof p.tindeq.deviceId==='string') && (p.tindeq.deviceName===undefined || typeof p.tindeq.deviceName==='string');
}
export const loadPreferences = () => readStored(PREFERENCES_KEY,defaultPreferences,isPreferences);
export function savePreferences(value:Preferences) {
  writeStored(PREFERENCES_KEY,value,defaultPreferences,isPreferences);
  applyAppearance(value);
}
export function applyAppearance(value=loadPreferences()) {
  document.documentElement.style.colorScheme=value.appearance==='system'?'light dark':value.appearance;
}
