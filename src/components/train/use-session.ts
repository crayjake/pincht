import { useCallback, useEffect, useRef, useState } from 'react';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { createSession, sessionReducer, type MeasurementSource, type SessionEvent } from '../../workouts/session';
import type { Exercise, WorkoutPreset } from '../../workouts/fixtures';
import { bluetoothError, ProgressorTransport, SimulatorTransport, type ForceTransport } from '../../workouts/transport';

export function useWorkoutSession(preset: WorkoutPreset, exercise: Exercise, source: MeasurementSource) {
  const [session, setSession] = useState(() => createSession(preset, exercise, source, Date.now()));
  const current = useRef(session);
  const transport = useRef<ForceTransport | null>(null);
  const mounted = useRef(true);
  const foreground = useRef(!document.hidden);
  const backgroundEpoch = useRef(0);
  const [now, setNow] = useState(Date.now);
  const [connected, setConnected] = useState(false);
  const [tared, setTared] = useState(false);
  const [device, setDevice] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const act = useCallback((event: SessionEvent) => {
    if (!mounted.current) return;
    const previous = current.current;
    const next = sessionReducer(previous, event);
    current.current = next;
    setSession(next);
    if (previous.phase === 'holding' && next.phase !== 'holding') {
      void transport.current?.stop().catch(error => {
        if (mounted.current) { setError(bluetoothError(error)); setConnected(false); setTared(false); }
      });
      if (next.candidate?.status === 'interrupted') setTared(false);
    }
  }, []);
  useEffect(() => {
    mounted.current = true;
    const timer = setInterval(() => {
      const time = Date.now(); setNow(time); if (foreground.current && !document.hidden) act({ type: 'tick', now: time });
    }, 100);
    const background = () => {
      foreground.current = false;
      backgroundEpoch.current++;
      setTared(false);
      act({ type: 'interrupt', now: Date.now(), reason: 'App left the foreground during the hold. Retry this set.' });
      void transport.current?.stop().catch(() => {});
    };
    const visibility = () => { if (document.hidden) background(); else foreground.current = true; };
    document.addEventListener('visibilitychange', visibility);
    const listener = Capacitor.isNativePlatform() ? App.addListener('appStateChange', ({ isActive }) => { if (!isActive) background(); else foreground.current = !document.hidden; }) : undefined;
    return () => {
      mounted.current = false;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', visibility);
      void listener?.then(handle => handle.remove());
      void transport.current?.dispose();
    };
  }, [act]);
  useEffect(() => {
    if (session.phase === 'review') void transport.current?.dispose();
  }, [session.phase]);
  async function connect() {
    setBusy(true); setError(''); setTared(false); setConnected(false);
    await transport.current?.dispose();
    // Each connection owns its callbacks; disposed transports cannot feed the next hold.
    const callbacks = {
      sample: (sample: import('../../workouts/session').ForceSample) => act({ type: 'sample', sample, now: Date.now() }),
      disconnected: () => {
        if (!mounted.current) return;
        setConnected(false); setTared(false); setError('Progressor disconnected. Connect and tare to retry.');
        act({ type: 'interrupt', now: Date.now(), reason: 'Progressor disconnected during the hold.' });
      },
      error: (message: string) => {
        if (!mounted.current) return;
        setError(message); setTared(false);
        act({ type: 'interrupt', now: Date.now(), reason: message });
      },
    };
    const next = source === 'simulator' ? new SimulatorTransport(callbacks, preset.prescription.kind === 'hold' ? preset.prescription.targetKg : 0) : new ProgressorTransport(callbacks);
    transport.current = next;
    try {
      const name = await next.connect();
      if (mounted.current) { setDevice(name); setConnected(true); }
    } catch (error) { if (mounted.current) setError(bluetoothError(error)); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function tare() {
    setBusy(true); setError(''); setTared(false);
    const epoch = backgroundEpoch.current;
    try { await transport.current!.tare(); if (mounted.current && foreground.current && epoch === backgroundEpoch.current) setTared(true); }
    catch (error) { if (mounted.current) setError(bluetoothError(error)); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function start() {
    if (!foreground.current || document.hidden || (source !== 'manual' && (!connected || !tared)) || !['ready', 'preparing'].includes(current.current.phase)) return;
    setError(''); setBusy(true);
    act({ type: 'start', now: Date.now() });
    try { await transport.current?.start(); }
    catch (error) {
      if (mounted.current) setError(bluetoothError(error));
      act({ type: 'interrupt', now: Date.now(), reason: 'Could not start the force stream. Connect and tare, then retry.' });
    } finally { if (mounted.current) setBusy(false); }
  }
  async function simulateDrop() {
    await transport.current?.dispose();
    setConnected(false); setTared(false);
    act({ type: 'interrupt', now: Date.now(), reason: 'Simulated stream disconnect. Reconnect and retry.' });
  }
  return { session, now, act, connect, tare, start, simulateDrop, connected, tared, busy, device, error };
}
