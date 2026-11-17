import { clearWorkoutDraft, loadWorkoutDraft, restoredSession, saveWorkoutDraft } from '../../workouts/draft';
import { loadWorkoutPlans } from '../../workouts/catalog';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { BleClient } from '@capacitor-community/bluetooth-le';
import { exercises, planPresets, rehabPlanNote, resolvePreset, prescriptionLabel, workSeconds, workoutMinutes, workoutPresets, type HoldPrescription, type PacedPrescription, type TimedPrescription, type WorkoutPlan, type WorkoutPreset } from '../../workouts/fixtures';
import { remainingSeconds, type MeasurementSource, type Session, type SetResult, type TracePoint } from '../../workouts/session';
import { loadSessions, saveSession } from '../../workouts/storage';
import { useWorkoutSession } from './use-session';
import { progressorAvailability } from '../../workouts/bluetooth-support';
import { exerciseSummary, prescribedSets, sessionName, summariseWorkout } from '../../workouts/workout';
import './train.scss';
import '../home/home.scss';
import { useRehab } from '../../rehab/use-rehab';
import { InDevelopment, PrimaryNav } from '../app-navigation';

const sourceLabel = (source: MeasurementSource) => ({ manual: 'Manual entry', tindeq: 'Tindeq Progressor', simulator: 'Simulator · test only' }[source]);
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const navigate = (path: string) => { location.hash = path; window.scrollTo(0, 0); };
const categoryOf = (preset: WorkoutPreset) => exercises.find(exercise => exercise.id === preset.exerciseId)!.category;

function Chevron({ back = false }: { back?: boolean }) {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={back ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg>;
}
function Check() {
  return <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
}
function Header({ title, back, onBack, counter }: { title: string; back: string; onBack: () => void; counter?: string }) {
  useEffect(() => { document.title = `${title} · pincht`; }, [title]);
  return <header className="train-header">
    <button onClick={onBack} aria-label={back}>{back === 'Stop' ? <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg> : <Chevron back />}<span>{back}</span></button>
    {counter && <span className="session-counter">{counter}</span>}
  </header>;
}
function ForceTrace({ trace, prescription: p }: { trace: TracePoint[]; prescription: HoldPrescription }) {
  const max = Math.max(p.targetKg * 1.6, p.targetKg + p.toleranceKg, ...trace.map(point => point.kg), 1);
  const y = (kg: number) => 92 - Math.max(0, kg) / max * 80;
  // Keep the full trace in storage, and limit SVG points to screen resolution.
  const windowEnd = Math.max(6, trace.at(-1)?.seconds ?? 0);
  const windowStart = windowEnd - 6;
  const visible = trace.filter(point => point.seconds >= windowStart).filter((_, i) => i % Math.max(1, Math.floor(trace.length / 300)) === 0 || i === trace.length - 1);
  const low = Math.max(0, p.targetKg - p.toleranceKg), high = p.targetKg + p.toleranceKg;
  return <figure className="force-trace"><svg viewBox="0 0 320 104" role="img" aria-label={`Force over time. Target band ${low} to ${high} kg.`}>
    <rect x="0" y={y(high)} width="320" height={y(low) - y(high)} fill="var(--color-rehab-bg)" />
    <path d={`M0 ${y(p.targetKg)}H320`} stroke="var(--color-rehab-fg)" strokeDasharray="4 4" fill="none" />
    <polyline points={visible.map(point => `${Math.min(320, (point.seconds - windowStart) / 6 * 320)},${y(point.kg)}`).join(' ')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
  </svg><figcaption><span>Band {low}–{high} kg</span><span>last 6 s</span></figcaption></figure>;
}
function TimerRing({ seconds, total, label, caption = 'remaining' }: { seconds: number; total: number; label: string; caption?: string }) {
  const circumference = 2 * Math.PI * 106;
  return <div className="timer-ring">
    <svg viewBox="0 0 232 232" aria-hidden="true">
      <circle cx="116" cy="116" r="106" className="timer-ring-track" />
      <circle cx="116" cy="116" r="106" className="timer-ring-value" strokeDasharray={circumference} strokeDashoffset={circumference * (1 - Math.min(1, seconds / Math.max(1, total)))} transform="rotate(-90 116 116)" />
    </svg>
    <div><span className="big-timer" role="timer" aria-label={label}>{clock(seconds)}</span><span className="train-muted">{caption}</span></div>
  </div>;
}
function SetSummary({ result }: { result: SetResult }) {
  return <li><span className="set-number">{result.set}</span><div>
    <strong>{result.reps !== undefined ? `${result.reps} reps${result.addedLoadKg !== undefined ? ` · +${result.addedLoadKg} kg` : ''}` : `${result.meanKg !== undefined ? `${result.meanKg.toFixed(1)} kg · ` : ''}${result.durationSeconds?.toFixed(1)} s`}</strong>
    <small>{sourceLabel(result.source)}{result.status === 'stopped' ? ' · stopped early' : ''}</small>
  </div><span className="set-kept" aria-label="Kept"><Check /></span></li>;
}
function Review({ session, onDone, saved = false }: { session: Session; onDone: () => void; saved?: boolean }) {
  const [note, setNote] = useState(session.symptomNote ?? '');
  const [rpe, setRpe] = useState(session.rpe === undefined ? '' : String(session.rpe));
  const [error, setError] = useState('');
  const [didSave, setDidSave] = useState(saved);
  const [feeling, setFeeling] = useState(session.symptomFeeling);
  const simulated = session.source === 'simulator';
  const interrupted = session.attempts.filter(attempt => attempt.status === 'interrupted').length;
  const complete = session.sets.length === prescribedSets(session);
  useEffect(() => { document.title = `${didSave ? 'Saved session' : 'Review'} · pincht`; }, [didSave]);
  return <main className="train-page review-page" data-category={session.exercise.category}>
    <div className="review-mark"><Check /></div>
    <h1>{didSave ? 'Workout saved' : complete ? 'Workout complete' : 'Workout ended'}</h1>
    {session.workout ? <p className="review-workout-subtitle">{sessionName(session)} · {session.workout.sessions.length} of {session.workout.prescriptions.filter(preset => !preset.locked).length} exercises</p> : <><p className="review-workout-name">{session.preset.name}</p><p className="train-subtitle">{session.sets.length} of {prescribedSets(session)} sets kept · {sourceLabel(session.source)}</p></>}
    {simulated && <p className="simulator-label">SIMULATOR · no real measurements</p>}
    <section className="review-results" aria-label="Workout results">
      {session.workout ? <div className="workout-result-list">{session.workout.sessions.map(exerciseSession => <details key={exerciseSession.id} className="exercise-result"><summary><span className="category-hold" /><span><strong>{exerciseSession.preset.name}</strong><small>{exerciseSummary(exerciseSession)}</small></span><Chevron /></summary><ol className="set-list" aria-label={`${exerciseSession.preset.name} sets`}>{exerciseSession.sets.map(result => <SetSummary key={result.set} result={result} />)}</ol></details>)}</div> : <><h2 className="train-eyebrow">Kept sets</h2>{session.sets.length ? <ol className="set-list" aria-label="Completed sets">{session.sets.map(result => <SetSummary key={result.set} result={result} />)}</ol> : <p className="train-notice">No sets kept yet. Return to Train to start a workout.</p>}</>}
      {!!interrupted && <p className="train-muted">{interrupted} interrupted attempt(s) excluded from kept sets.</p>}
    </section>
    <details className="prescription-details"><summary>Prescription snapshot <Chevron /></summary>{(session.workout?.prescriptions ?? [session.preset]).map(preset => <div key={preset.id}><p><strong>{preset.name}</strong> · {prescriptionLabel(preset.prescription)}{preset.locked ? ` · ${preset.locked.label}` : ''}</p>{preset.prescription.kind === 'hold' && <p>{preset.prescription.hand} hand · {preset.prescription.edgeMm} mm · {preset.prescription.grip}</p>}<p>{preset.prescription.kind === 'timed' && preset.prescription.selfPacedRest ? 'Rest as needed between sets' : `${preset.prescription.restSeconds} s rest between sets`}</p></div>)}</details>
    {session.exercise.category === 'rehab' && <fieldset className="symptom-choices"><legend>How did the rehab area feel?</legend>{(['No pain', 'Familiar, settled', 'Worse'] as const).map(value => <button type="button" key={value} aria-pressed={feeling === value} disabled={didSave} onClick={() => setFeeling(value)}>{value}</button>)}</fieldset>}
    <label className="train-field symptom-field">Symptom note <span className="train-muted">· optional</span>
      <textarea value={note} readOnly={didSave} placeholder={session.exercise.category === 'rehab' ? 'Pain (0–10), swelling, and any changes?' : 'How did the workout feel?'} maxLength={2000} onChange={event => setNote(event.target.value)} />
    </label>
    <label className="train-field">Effort · RPE 1–10 · optional<input type="number" min="1" max="10" step="1" value={rpe} disabled={didSave} onChange={event => setRpe(event.target.value)} /></label>
    {simulated && <p className="train-muted">Test results stay separate from workout history and the journal.</p>}
    {error && <p role="alert" className="train-notice">{error}</p>}
    <div className="train-action-bar"><button className="train-primary" disabled={!session.sets.length && !didSave} onClick={() => {
      if (didSave) { onDone(); return; }
      try { if (rpe && (!Number.isInteger(Number(rpe)) || Number(rpe) < 1 || Number(rpe) > 10)) throw new Error('Enter an effort between 1 and 10.'); saveSession({ ...session, symptomFeeling: feeling, rpe: rpe ? Number(rpe) : undefined }, note, Date.now()); const draft = loadWorkoutDraft(); if (draft?.session?.id === session.id || draft?.flow?.workoutId === session.id) clearWorkoutDraft(); setDidSave(true); setError(''); } catch (error) { setError(error instanceof Error ? error.message : 'Could not save. Your session is still here; try again.'); }
    }}>{didSave ? 'Done' : simulated ? 'Save simulator test' : 'Save workout'}</button>{didSave && <p role="status">{simulated ? 'Saved to simulator tests.' : 'Saved on this device and added to your journal.'}</p>}</div>
  </main>;
}
function StopDialog({ sets, total, onContinue, onStop }: { sets: number; total: number; onContinue: () => void; onStop: () => void }) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector('button')?.focus();
    return () => { previous?.focus(); };
  }, []);
  return <div className="session-dialog-backdrop"><section ref={dialog} role="dialog" aria-modal="true" aria-labelledby="stop-exercise-title" className="session-dialog" onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); onContinue(); }
    if (event.key === 'Tab') {
      const buttons = dialog.current!.querySelectorAll('button');
      const first = buttons[0], last = buttons[buttons.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
  }}><h2 id="stop-exercise-title">Stop this exercise?</h2><p>{sets} of {total} sets kept so far. You can continue with the next exercise from the workout.</p><button className="train-primary" onClick={onContinue}>Keep going</button><button className="train-secondary" onClick={onStop}>Stop exercise</button></section></div>;
}
function GuidedSet({ prescription: p, session, now, remaining, cue }: { prescription: PacedPrescription | TimedPrescription; session: Session; now: number; remaining: number; cue: string }) {
  const total = workSeconds(p);
  const elapsed = Math.min(total, Math.max(0, ((session.pausedAt ?? now) - (session.holdStartedAt ?? now)) / 1000));
  const cycle = p.kind === 'paced' ? p.steps.reduce((sum, step) => sum + step.seconds, 0) : 1;
  let stepIndex = 0, offset = elapsed % cycle;
  if (p.kind === 'paced') for (let i = 0; i < p.steps.length; i++) { stepIndex = i; if (offset < p.steps[i].seconds) break; offset -= p.steps[i].seconds; }
  const preparing = session.phase === 'preparing' || session.phase === 'ready';
  const ready = session.phase === 'ready';
  return <section className="session-card guided-card">
    <span className="train-eyebrow">{preparing ? 'Get ready' : session.pausedAt !== undefined ? 'Paused' : session.phase === 'result' ? session.candidate?.status === 'interrupted' ? 'Set interrupted' : 'Set stopped' : p.kind === 'paced' ? 'Rep' : 'Hold steady'}</span>
    {p.kind === 'paced' && !preparing && session.phase !== 'result' ? <div className="paced-movement"><div className="big-reps">{Math.min(p.reps, Math.floor(elapsed / cycle) + 1)}<small>/ {p.reps}</small></div><div className="movement-name">{session.awaitingReset ? 'Use the other hand to raise the weight' : p.steps[stepIndex].label}</div><div className="movement-dots" aria-label={`Position ${stepIndex + 1} of ${p.steps.length}`}>{p.steps.map((step, i) => <span key={step.label} className={i === stepIndex ? 'is-current' : ''} />)}</div><div className="big-timer" role="timer" aria-label="Exercise remaining">{clock(remaining)}</div><div className="hold-progress"><span style={{ width: `${remaining / total * 100}%` }} /></div></div> : <TimerRing seconds={ready ? total : session.phase === 'result' ? Math.round(session.candidate?.durationSeconds ?? 0) : remaining} total={session.phase === 'preparing' ? 5 : total} label={ready ? 'Exercise duration' : preparing ? 'Starting in' : 'Hold remaining'} caption={ready ? 'ready when you are' : preparing ? 'starting in' : session.phase === 'result' ? 'recorded' : 'remaining'} />}
    <div className="session-info"><strong>{preparing ? prescriptionLabel(p) : p.kind === 'timed' ? 'Grip without movement' : 'Follow the movement cues'}</strong><span>{cue}</span></div>
  </section>;
}
function ActiveSession({ preset, source, onDone, onComplete, position, initial, onSession }: { preset: WorkoutPreset; source: MeasurementSource; onDone: () => void; onComplete?: (session: Session) => void; position?: string; initial?: Session; onSession?: (session: Session) => void }) {
  const exercise = exercises.find(e => e.id === preset.exerciseId)!;
  const { session, now, act, connected, tared, busy, device, error, connect, tare, start, simulateDrop } = useWorkoutSession(preset, exercise, source, initial);
  const [draftError, setDraftError] = useState('');
  useEffect(() => { try { if (onSession) onSession(session); else saveWorkoutDraft({ route: `/train/${preset.id}`, title: preset.name, session }); queueMicrotask(() => setDraftError('')); } catch { queueMicrotask(() => setDraftError('Could not save workout progress on this device.')); } }, [session, preset.id, preset.name, onSession]);
  const p = session.preset.prescription;
  const [reps, setReps] = useState(p.kind === 'reps' ? String(p.reps) : '5');
  const [load, setLoad] = useState(p.kind === 'reps' ? String(p.addedLoadKg) : '0');
  const [manualMean, setManualMean] = useState('');
  const [confirmStop, setConfirmStop] = useState(false);
  const delivered = useRef(false);
  useEffect(() => { if (!initial && (preset.prescription.kind === 'timed' || preset.prescription.kind === 'paced')) act({ type: 'prepare', now: Date.now() }); }, [preset, act, initial]);
  useEffect(() => {
    if (session.phase === 'review' && onComplete && !delivered.current) { delivered.current = true; onComplete(session); }
  }, [session, onComplete]);
  const review = () => act({ type: 'finish', now: Date.now() });
  if (session.phase === 'review') return onComplete ? null : <Review session={session} onDone={onDone} />;
  const candidate = session.candidate;
  const interrupted = candidate?.status === 'interrupted';
  const live = session.phase === 'holding' && session.lastSampleAt !== undefined && now - session.lastSampleAt < 1500;
  const force = live ? session.trace.at(-1)!.kg : undefined;
  const inBand = p.kind === 'hold' && force !== undefined && Math.abs(force - p.targetKg) <= p.toleranceKg;
  const remaining = remainingSeconds(session, now);
  return <main className="train-page session-page" data-category={exercise.category} data-phase={session.phase}>
    <Header title="Active session" back={onComplete ? 'Stop' : 'Review & finish'} onBack={onComplete ? () => setConfirmStop(true) : review} counter={`Set ${session.currentSet} / ${p.sets}`} />
    {draftError && <p role="alert">{draftError}</p>}<button className="train-text-button continue-later" onClick={() => { act({ type: 'interrupt', now: Date.now(), reason: 'Session paused. Retry this set.' }); navigate('/do'); }}>Continue later</button>
    <span className="train-eyebrow">{position ?? `${exercise.category === 'rehab' ? 'Rehab' : 'Strength'} · ${session.phase === 'rest' ? 'Rest' : session.phase === 'result' ? 'Set result' : 'In session'}`}</span>
    <h1>{preset.name}</h1>
    <p className="train-subtitle">{p.kind === 'reps' ? `Target ${p.reps} reps · ${p.addedLoadKg ? `+${p.addedLoadKg} kg` : 'bodyweight'}` : p.kind === 'hold' ? `${p.hand} hand · ${p.edgeMm} mm · ${p.grip}` : exercise.description}</p>
    <div className="set-progress" aria-label={`${session.sets.length} of ${p.sets} sets kept`}>{Array.from({ length: p.sets }, (_, i) => <span key={i} className={i < session.sets.length ? 'is-kept' : i === session.currentSet - 1 ? 'is-current' : ''} />)}</div>
    {session.phase === 'rest' ? <>
      <section className="session-card rest-card">
        <span className="train-eyebrow">Rest</span>
        {p.kind === 'timed' && p.selfPacedRest ? <p>Rest as needed. Start the next set when ready.</p> : <TimerRing seconds={remaining} total={p.restSeconds} label="Rest remaining" caption="until next set" />}
        <div className="session-info"><span className="kept-info"><Check /> Set {session.currentSet} kept{session.sets.at(-1)?.meanKg !== undefined ? ` · ${session.sets.at(-1)!.meanKg!.toFixed(1)} kg mean` : ''}</span><strong>Next: set {session.sets.length + 1} of {p.sets}</strong><span>{p.kind === 'hold' || p.kind === 'timed' ? `${p.holdSeconds} s hold${p.kind === 'hold' ? ` · ~${p.targetKg} kg` : ''}` : `${p.reps} reps`}</span></div>
      </section>
      <div className="train-action-bar"><div className="result-actions">{!(p.kind === 'timed' && p.selfPacedRest) && <button className="train-secondary" onClick={() => act({ type: 'extend-rest', seconds: 15 })}>+15 s</button>}<button className="train-primary" onClick={() => { act({ type: 'skip-rest' }); if (p.kind === 'timed' || p.kind === 'paced') act({ type: 'prepare', now: Date.now() }); }}>{p.kind === 'timed' && p.selfPacedRest ? 'Next set' : 'Skip rest'}</button></div><button className="train-text-button" onClick={review}>Finish early & review</button></div>
    </> : p.kind === 'timed' || p.kind === 'paced' ? <>
      <GuidedSet prescription={p} session={session} now={now} remaining={remaining} cue={exercise.cue ?? exercise.description} />
      <div className="train-action-bar">{session.phase === 'result' ? <><div className="result-actions">{!interrupted && <button className="train-primary" disabled={!candidate?.durationSeconds || (p.kind === 'paced' && !candidate.reps)} onClick={() => act({ type: 'keep', now: Date.now() })}>Keep set</button>}<button className={interrupted ? 'train-primary' : 'train-secondary'} onClick={() => { act({ type: 'retry' }); act({ type: 'prepare', now: Date.now() }); }}>Retry set {session.currentSet}</button></div>{candidate?.reason && <p role="alert">{candidate.reason}</p>}<button className="train-text-button" onClick={review}>Finish early & review kept sets</button></> : session.phase === 'holding' ? <div className="result-actions"><button className="train-secondary" onClick={() => act({ type: session.pausedAt === undefined ? 'pause' : 'resume', now: Date.now() })}>{session.pausedAt === undefined ? 'Pause' : session.awaitingReset ? 'Weight returned · next rep' : 'Resume'}</button><button className="train-primary" onClick={() => act({ type: 'stop', now: Date.now() })}>Finish set</button></div> : <button className="train-primary" onClick={() => void start()}>{p.kind === 'paced' ? 'Start exercise' : 'Start hold'}</button>}</div>
    </> : p.kind === 'reps' ? <form className="rep-form" onSubmit={event => {
      event.preventDefault(); act({ type: 'complete-reps', now: Date.now(), reps: Number(reps), addedLoadKg: Number(load) });
    }}>
      <section className="session-card rep-card"><span className="train-eyebrow">This set’s target</span><div className="big-reps">{p.reps}<small>reps</small></div><p>Move at your own pace.<br />Record what you completed below.</p>
        <div className="train-fields"><label className="train-field">Actual reps<input type="number" inputMode="numeric" min="0" step="1" required value={reps} onChange={event => setReps(event.target.value)} /></label><label className="train-field">Added load · kg<input type="number" inputMode="decimal" min="0" step="0.1" required value={load} onChange={event => setLoad(event.target.value)} /></label></div>
      </section>
      <div className="train-action-bar"><button className="train-primary" type="submit">Complete set {session.currentSet}</button><button className="train-text-button" type="button" onClick={review}>Finish early & review</button></div>
    </form> : <>
      <section className={`session-card force-card${inBand ? ' is-in-band' : ''}`}>
        <div className="measurement-status"><span className={source === 'simulator' ? 'simulator-label' : 'measurement-source'}>{source === 'simulator' ? 'SIMULATOR · no real measurements' : sourceLabel(source)}</span>{source !== 'manual' && <span className="connection-status" data-connected={connected}>{connected ? tared ? 'Tared' : 'Tare needed' : 'Not connected'}</span>}</div>
        {(source === 'manual' || session.phase === 'ready') && session.phase !== 'result' ? <div className="manual-timer"><span className="train-eyebrow">{session.phase === 'holding' ? 'Hold steady' : 'Ready when you are'}</span><TimerRing seconds={remaining} total={p.holdSeconds} label="Hold remaining" /><span className="train-muted">{source === 'manual' ? 'Manual hold · no live force' : `Target ~${p.targetKg} kg · ${p.holdSeconds} s hold`}</span></div> : <>
          <div className="force-reading"><span className="train-eyebrow">{session.phase === 'result' ? interrupted ? 'Hold interrupted' : candidate?.status === 'stopped' ? 'Hold stopped · mean force' : 'Hold complete · mean force' : 'Live force'}</span>
            <div className="big-force"><span>{session.phase === 'result' ? candidate?.meanKg?.toFixed(1) ?? '—' : force?.toFixed(1) ?? '—'}</span><small>kg</small></div>
            {session.phase === 'result' ? <p className="recorded-duration">{candidate?.durationSeconds?.toFixed(1)} s recorded · {source === 'manual' ? 'enter mean below' : 'mean force'}</p> : <p className="force-feedback">{force === undefined ? `Target ${p.targetKg} kg · band ${Math.max(0, p.targetKg - p.toleranceKg)}–${p.targetKg + p.toleranceKg} kg` : inBand ? 'In the target band · hold steady' : force < p.targetKg ? 'Below target · pull gently' : 'Above target · ease off'}</p>}
          </div>
          {session.phase !== 'result' && <div className="hold-countdown"><span className="train-eyebrow">Time left</span><div className="big-timer" role="timer" aria-label="Hold remaining">{Math.max(0, p.holdSeconds - (session.holdStartedAt === undefined ? 0 : (now - session.holdStartedAt) / 1000)).toFixed(1)}<small> s</small></div><div className="hold-progress" aria-hidden="true"><span style={{ width: `${remaining / p.holdSeconds * 100}%` }} /></div></div>}
          {source !== 'manual' && <ForceTrace trace={session.trace} prescription={p} />}
        </>}
        {session.phase === 'ready' && source !== 'manual' && <div className="device-state">
          <ol aria-label="Device setup"><li data-complete={connected}>1 Connect</li><li data-complete={tared}>2 Tare</li><li>3 Start hold</li></ol>
          <p>{connected ? tared ? `${device} · ready to measure` : 'Remove all load, then tare your Progressor.' : 'Connect your Progressor to begin.'}</p>
        </div>}
        {session.phase === 'holding' && source !== 'manual' && !live && <p role="status" className="train-muted">Waiting for fresh force samples…</p>}
      </section>
      {session.phase === 'result' ? <>
        {candidate?.reason && <p role="alert" className="train-notice">{candidate.reason}</p>}
        {source === 'manual' && !interrupted && <label className="train-field manual-mean">Mean force · kg (manual)<input type="number" inputMode="decimal" min="0" step="0.1" value={manualMean} onChange={event => setManualMean(event.target.value)} placeholder="Enter measured mean" /></label>}
        <div className="train-action-bar"><div className="result-actions">{!interrupted && <button className="train-primary" disabled={!candidate?.durationSeconds || (source === 'manual' && (!manualMean.trim() || !Number.isFinite(Number(manualMean)) || Number(manualMean) < 0))} onClick={() => { act({ type: 'keep', now: Date.now(), manualMeanKg: Number(manualMean) }); setManualMean(''); }}>Keep set</button>}<button className={interrupted ? 'train-primary' : 'train-secondary'} onClick={() => { act({ type: 'retry' }); setManualMean(''); }}>Retry set {session.currentSet}</button></div><button className="train-text-button" onClick={review}>Finish early & review kept sets</button></div>
      </> : session.phase === 'holding' ? <div className="train-action-bar"><button className="train-primary" onClick={() => act({ type: 'stop', now: Date.now() })}>Stop hold</button>{source === 'simulator' && <button className="train-text-button" onClick={() => void simulateDrop()}>Test stream disconnect</button>}</div> : <div className="train-action-bar">
        {source !== 'manual' && !connected ? <button className="train-primary" disabled={busy} onClick={() => void connect()}>{busy ? 'Connecting…' : 'Connect'}</button> : source !== 'manual' && !tared ? <button className="train-primary" disabled={busy} onClick={() => void tare()}>{busy ? 'Taring…' : 'Tare'}</button> : <button className="train-primary" disabled={busy} onClick={() => void start()}>Start hold</button>}
        {source !== 'manual' && connected && tared && <button className="train-text-button" disabled={busy} onClick={() => void tare()}>Tare again</button>}
      </div>}
    </>}
    {error && <div role="alert" className="train-notice">{error}{Capacitor.isNativePlatform() && <button className="train-secondary" onClick={() => void BleClient.openAppSettings().catch(() => {})}>Open app settings</button>}</div>}
    {confirmStop && <StopDialog sets={session.sets.length} total={p.sets} onContinue={() => setConfirmStop(false)} onStop={review} />}

  </main>;
}
function Lock() {
  return <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}
function SourcePicker({ source, onChange }: { source: MeasurementSource; onChange: (source: MeasurementSource) => void }) {
  const bluetooth = progressorAvailability();
  return <details className="workout-source"><summary><span className="device-dot" /><span><strong>{sourceLabel(source)}</strong><small>{source === 'tindeq' ? 'Connect and tare before the drag holds' : source === 'manual' ? 'Timed holds · enter measured force' : 'Generated force · excluded from history'}</small></span><span className="source-change">Change</span></summary>
    <fieldset className="source-choices"><legend>Record force with</legend>{(['tindeq', 'manual', ...(import.meta.env.DEV ? ['simulator' as const] : [])] as const).map(option => <label key={option}><input type="radio" name="workout-source" checked={source === option} disabled={option === 'tindeq' && !bluetooth.available} onChange={() => onChange(option)} /><span>{sourceLabel(option)}<small>{option === 'tindeq' ? 'Real measurements over Bluetooth' : option === 'manual' ? 'Enter the measured mean after each hold' : 'Test only · no real workout history'}</small></span></label>)}</fieldset>
    {!bluetooth.available && <p className="train-notice">{bluetooth.reason}</p>}
  </details>;
}
function WorkoutFlow({ plan, onDone }: { plan: WorkoutPlan; onDone: () => void }) {
  const [draft] = useState(() => { const value = loadWorkoutDraft(); return value?.route === `/train/${plan.id}` ? value : null; });
  const [snapshot] = useState(() => draft?.flow?.snapshot ?? structuredClone({ plan, presets: planPresets(plan) }));
  const [workoutId] = useState(() => draft?.flow?.workoutId ?? crypto.randomUUID());
  const [startedAt] = useState(() => draft?.flow?.startedAt ?? new Date().toISOString());
  const [source, setSource] = useState<MeasurementSource>(() => draft?.flow?.source ?? (progressorAvailability().available ? 'tindeq' : 'manual'));
  const [sessions, setSessions] = useState<Session[]>(() => draft?.flow?.sessions ?? []);
  const [running, setRunning] = useState<WorkoutPreset | null>(() => draft?.flow?.running ?? null);
  const [review, setReview] = useState<Session | null>(() => draft?.flow?.review ?? null);
  const [optional, setOptional] = useState<string[]>(() => draft?.flow?.optional ?? []);
  const [initialRunning, setInitialRunning] = useState(() => draft?.flow?.runningSession ? restoredSession(draft.flow.runningSession, draft.updatedAt) : undefined);
  const runningSession = useRef<Session | undefined>(initialRunning);
  const [draftError, setDraftError] = useState('');
  const persist = useCallback((session?: Session) => {
    if (session) runningSession.current = session;
    if (!running && !sessions.length && !review) return;
    try { saveWorkoutDraft({ route: `/train/${plan.id}`, title: snapshot.plan.name, flow: { snapshot, workoutId, startedAt, source, sessions, running, review, optional, runningSession: runningSession.current } }); queueMicrotask(() => setDraftError('')); }
    catch { queueMicrotask(() => setDraftError('Could not save workout progress on this device.')); }
  }, [plan.id, snapshot, workoutId, startedAt, source, sessions, running, review, optional]);
  useEffect(() => { persist(); }, [persist]);
  const selected = snapshot.presets.filter(preset => !preset.optional || optional.includes(preset.id));
  const runnable = selected.filter(preset => !preset.locked);
  const next = runnable.find(preset => !sessions.some(session => session.preset.id === preset.id));
  const hasForce = runnable.some(preset => preset.prescription.kind === 'hold');
  const category = categoryOf(snapshot.presets[0]);
  const summarise = (results: Session[]) => summariseWorkout(snapshot.plan, selected, results, source === 'simulator' && hasForce ? 'simulator' : results.some(session => session.source === 'tindeq') ? 'tindeq' : 'manual', workoutId, startedAt);
  function complete(session: Session) {
    const results = session.sets.length ? [...sessions, session] : sessions;
    runningSession.current = undefined; setInitialRunning(undefined); setSessions(results); setRunning(null); window.scrollTo(0, 0);
    if (results.length === runnable.length) setReview(summarise(results));
  }
  if (review) return <Review session={review} onDone={onDone} />;
  if (running) return <ActiveSession key={running.id} preset={running} source={running.prescription.kind === 'hold' ? source : 'manual'} onDone={onDone} onComplete={complete} initial={initialRunning?.preset.id === running.id ? initialRunning : undefined} onSession={persist} position={`Exercise ${runnable.indexOf(running) + 1} / ${runnable.length}`} />;
  return <main className="train-page preview-page workout-overview" data-category={category}>
    <Header title="Workout preview" back="Do" onBack={onDone} />
    {draftError && <p role="alert">{draftError}</p>}<h1>{snapshot.plan.name}</h1><p className="train-subtitle">{runnable.length} {runnable.length === 1 ? 'exercise' : 'exercises'} · ~{workoutMinutes(snapshot.plan, runnable.map(preset => ({ ...preset, optional: false })))} min · {rehabPlanNote(snapshot.plan)}</p>
    {hasForce && <SourcePicker source={source} onChange={setSource} />}
    <ol className="exercise-preview-list" aria-label="Workout exercises">{snapshot.presets.map((preset, index) => {
      const result = sessions.find(session => session.preset.id === preset.id);
      const upNext = next?.id === preset.id;
      return <li key={preset.id} className={`exercise-preview${preset.locked ? ' is-locked' : ''}${result ? ' is-complete' : ''}${upNext ? ' is-next' : ''}`}>
        <span className="exercise-order">{preset.locked ? <Lock /> : result ? <Check /> : index + 1}</span><div><strong>{preset.name}</strong><small>{result ? exerciseSummary(result) : preset.locked ? preset.locked.label : prescriptionLabel(preset.prescription)}</small>{preset.locked && <p>{preset.locked.note}</p>}{preset.optional && <label className="optional-exercise"><input type="checkbox" checked={optional.includes(preset.id)} disabled={!!sessions.length} onChange={event => setOptional(current => event.target.checked ? [...current, preset.id] : current.filter(id => id !== preset.id))} /> Include optional exercise</label>}</div>{preset.locked ? <span className="exercise-tag">{preset.locked.label}</span> : upNext ? <span className="exercise-tag">Up next</span> : null}
      </li>;
    })}</ol>
    <div className="train-action-bar">{next && <button className="train-primary" onClick={() => { runningSession.current = undefined; setRunning(next); window.scrollTo(0, 0); }}>{sessions.length ? `Start ${next.name.toLowerCase()}` : 'Start workout'}</button>}{!!sessions.length && <button className="train-text-button" onClick={() => setReview(summarise(sessions))}>Finish workout & review</button>}</div>
  </main>;
}
function TrainScreens({ presetId }: { presetId?: string }) {
  const [draft] = useState(() => { const value = loadWorkoutDraft(); return value?.route === `/train/${presetId}` && value.session ? value : null; });
  const [active, setActive] = useState<{ preset: WorkoutPreset; source: MeasurementSource } | null>(() => draft?.session ? { preset: draft.session.preset, source: draft.session.source } : null);
  const [initialSession] = useState(() => draft?.session ? restoredSession(draft.session, draft.updatedAt) : undefined);
  const bluetooth = progressorAvailability();
  const [source, setSource] = useState<MeasurementSource>(() => progressorAvailability().available ? 'tindeq' : 'manual');
  const [history, setHistory] = useState(loadSessions);
  const [today] = useState(() => new Date().toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }));
  const [detail, setDetail] = useState<Session | null>(null);
  const rehab = useRehab();
  const base = workoutPresets.find(p => p.id === presetId);
  const preset = base ? resolvePreset(base, rehab.data) : undefined;
  const plan = loadWorkoutPlans().find(plan => plan.id === presetId);
  function done() { setActive(null); setDetail(null); setHistory(loadSessions()); navigate('/do'); }
  function open(plan: WorkoutPlan) { setActive(null); navigate(`/train/${plan.id}`); }
  if (plan) return <WorkoutFlow key={plan.id} plan={plan} onDone={done} />;
  if (active && presetId === active.preset.id) return <ActiveSession preset={active.preset} source={active.source} initial={initialSession} onDone={done} />;
  if (detail && !presetId) return <Review key={detail.id} session={detail} onDone={done} saved />;
  if (preset) {
    const exercise = exercises.find(e => e.id === preset.exerciseId)!;
    const p = preset.prescription;
    return <main className="train-page preview-page" data-category={exercise.category}>
      <Header title="Workout preview" back="Do" onBack={done} />
      <span className="train-eyebrow">{exercise.category === 'rehab' ? 'Rehab' : 'Strength'} · Workout</span><h1>{preset.name}</h1><p className="train-subtitle">{exercise.description}</p>
      <section className="train-card prescription-card"><div className="prescription-heading"><span className="set-number">1</span><div><span className="train-eyebrow">The plan</span><h2>{preset.locked ? preset.locked.label : prescriptionLabel(p)}</h2></div></div>
        {p.kind === 'hold' && <p className="grip-description">{p.hand} hand · {p.edgeMm} mm · {p.grip}</p>}
        <dl className="prescription-stats"><div><dt>Sets</dt><dd>{p.sets}</dd></div><div><dt>{p.kind === 'hold' ? 'Hold' : 'Reps'}</dt><dd>{p.kind === 'hold' || p.kind === 'timed' ? `${p.holdSeconds} s` : p.reps}</dd></div><div><dt>Rest</dt><dd>{p.kind === 'timed' && p.selfPacedRest ? 'As needed' : clock(p.restSeconds)}</dd></div></dl>
        <p className="prescription-hint">{p.kind === 'hold' ? 'Hold, check the result, then keep or retry each set.' : p.kind === 'reps' ? 'Record your actual reps and added load after each set.' : 'Follow the timer and movement cues. Pause or finish early whenever needed.'}</p>
      </section>
      {p.kind === 'hold' && <fieldset className="source-choices"><legend>Record force with</legend>{(['tindeq', 'manual', ...(import.meta.env.DEV ? ['simulator' as const] : [])] as const).map(option => <label key={option}>
        <input type="radio" name="source" checked={source === option} disabled={option === 'tindeq' && !bluetooth.available} aria-describedby={option === 'tindeq' && !bluetooth.available ? 'bluetooth-help' : undefined} onChange={() => setSource(option)} />
        <span>{sourceLabel(option)}<small>{option === 'tindeq' ? 'Real measurements over Bluetooth' : option === 'manual' ? 'Timed hold · enter the measured mean' : 'Generated force · no workout history'}</small></span>
      </label>)}</fieldset>}
      {p.kind === 'hold' && !Capacitor.isNativePlatform() && <p id="bluetooth-help" className="train-notice">{bluetooth.reason || 'Real Progressor measurements via Web Bluetooth. Turn on Bluetooth and your Progressor, then select it in the browser’s Connect dialog. Close other apps connected to it.'}</p>}
      <div className="train-action-bar">{preset.locked && <p role="status">{preset.locked.note}</p>}<button className="train-primary" disabled={!!preset.locked} onClick={() => { setActive({ preset, source: p.kind === 'hold' ? source : 'manual' }); window.scrollTo(0, 0); }}>Start workout</button><p>{p.kind === 'hold' && source !== 'manual' ? 'Next: connect, remove all load, then tare.' : 'One set at a time. Finish early whenever you need.'}</p></div>
    </main>;
  }
  const featured = loadWorkoutPlans().find(plan => plan.featured) ?? loadWorkoutPlans()[0];
  const featuredPresets = planPresets(featured);
  const otherPlans = loadWorkoutPlans().filter(plan => plan !== featured);
  const lastFeatured = history.find(session => session.workout?.plan.id === featured.id);
  return <main className="train-page train-home">
    <header className="train-home-heading"><span className="train-eyebrow">{today}</span><h1>Train</h1></header>
    <section className="train-card featured-workout" data-category={categoryOf(featuredPresets[0])}>
      <div className="featured-heading"><span className="train-eyebrow">Today’s workout</span><span className="train-muted">{lastFeatured ? `Last: ${new Date(lastFeatured.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : 'Ready when you are'}</span></div>
      <h2>{featured.name}</h2><p>{rehabPlanNote(featured, rehab.data)}</p>
      <ul className="featured-exercises">{featuredPresets.map(preset => <li key={preset.id} className={preset.locked ? 'is-locked' : ''}><span className="category-hold" /><strong>{preset.name}</strong><span>{preset.locked ? <><Lock /> {preset.locked.label}</> : `${prescriptionLabel(preset.prescription)}${preset.optional ? ' · optional' : ''}`}</span></li>)}</ul>
      <div className="featured-meta">~{workoutMinutes(featured)} min · includes rests</div>
      <button className="train-primary" onClick={() => open(featured)}>Open workout</button>
    </section>
    <section className="other-workouts"><h2 className="train-eyebrow">Other workouts</h2><div className="workout-presets">{otherPlans.map(plan => <button className="workout-preset" key={plan.id} data-category={categoryOf(planPresets(plan)[0])} onClick={() => open(plan)}>
      <span className="category-hold" aria-hidden="true" /><span><strong>{plan.name}</strong><small>{rehabPlanNote(plan, rehab.data)}</small></span><span className="workout-duration">~{workoutMinutes(plan)} min</span><Chevron />
    </button>)}</div></section>
    <section className="workout-history"><h2 className="train-eyebrow">Recent</h2><div className="history-list">{history.length ? history.map(session => <button className="history-row" key={session.id} onClick={() => setDetail(session)}>
      <span className="history-date">{new Date(session.startedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span><span><strong>{sessionName(session)}</strong><small>{session.workout ? `${session.workout.sessions.length} exercises` : `${session.sets.length} sets`} · {sourceLabel(session.source)}</small></span><Chevron />
    </button>) : <p className="history-empty">Your saved workouts will appear here.</p>}</div></section>
    {import.meta.env.DEV && <details className="simulator-history"><summary>Simulator tests</summary><p>Test results stay separate from workout history and the journal.</p>{loadSessions(localStorage, true).map(session => <button className="history-row" key={session.id} onClick={() => setDetail(session)}>{sessionName(session)} · {session.sets.length} sets<Chevron /></button>)}</details>}
  </main>;
}

export default function Train({ presetId }: { presetId?: string }) {
  const [otherDraft, setOtherDraft] = useState(() => { const draft = loadWorkoutDraft(); return presetId && draft?.route !== `/train/${presetId}` ? draft : null; });
  const [error, setError] = useState('');
  return <div className="development-screen"><InDevelopment />{otherDraft ? <main className="train-page"><h1>Workout in progress</h1><p>{otherDraft.title}</p><a className="primary-button full-width" href={`#${otherDraft.route}`}>Resume workout</a><button className="train-text-button" onClick={() => { try { clearWorkoutDraft(); setOtherDraft(null); } catch { setError('Could not discard workout progress.'); } }}>Discard progress and open workout</button>{error && <p role="alert">{error}</p>}</main> : <TrainScreens presetId={presetId} />}<PrimaryNav active="do" /></div>;
}
