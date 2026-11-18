import { useState } from 'react';
import { localDate, shortDate } from '../components/home/journal-data';
import { Icon } from '../components/home/journal-icons';
import { Sheet } from '../components/home/journal-sheet';
import { addDays, bookPage, checkIn, putCheckIn, scheduled, weeklyDrinks, type CheckIn, type Routine, type RoutineData } from './data';

import { BookSelector } from '../books/book-selector';
export { BookSelector } from '../books/book-selector';

type SheetProps = { data: RoutineData; routine: Routine; date: string; onChange: (data: RoutineData) => void | boolean; onClose: () => void };
export function ReadingSheet({ data, routine, date: initialDate, onChange, onClose }: SheetProps) {
  const initialCheckIn = checkIn(data, routine.id, initialDate);
  const [date, setDate] = useState(initialDate);
  const existing = checkIn(data, routine.id, date);
  const [bookId, setBookId] = useState(initialCheckIn?.bookId ?? data.currentBookId);
  const [minutes, setMinutes] = useState(initialCheckIn?.minutes ?? (routine.schedule === 'weekly' ? 20 : routine.target));
  const [page, setPage] = useState(initialCheckIn?.page ?? bookPage(data, initialCheckIn?.bookId ?? data.currentBookId));
  const [change, setChange] = useState(false);
  const [error, setError] = useState('');
  const book = data.books.find(b => b.id === bookId);
  const baseline = bookPage(data, bookId, date);
  function changeDate(next: string) {
    setDate(next); const value = checkIn(data, routine.id, next);
    setMinutes(value?.minutes ?? (routine.schedule === 'weekly' ? 20 : routine.target)); setBookId(value?.bookId ?? data.currentBookId);
    setPage(value?.page ?? bookPage(data, value?.bookId ?? data.currentBookId));
  }
  if (change || !book) return <BookSelector data={data} onChange={onChange} onClose={() => { if (!book) onClose(); else setChange(false); }} onSelect={(id, currentPage) => { setBookId(id); setPage(currentPage); setChange(false); }} />;
  return <Sheet title="Log reading" onClose={onClose}>
    <form onSubmit={event => { event.preventDefault(); try { if (onChange(putCheckIn(data, { routineId: routine.id, date, status: 'done', minutes, bookId, page })) !== false) onClose(); } catch (error) { setError((error as Error).message); } }}>
      <div className="reading-book"><div className="book-cover" aria-hidden="true" /><div className="book-info"><strong>{book.title}</strong><span>{book.author}</span><div className="book-progress"><div className="progress-track"><i style={{ width: `${bookPage(data, bookId) / book.pages * 100}%` }} /></div><span>{bookPage(data, bookId)} / {book.pages}</span></div></div><button type="button" className="text-action habit-text" onClick={() => setChange(true)}>Change</button></div>
      <fieldset className="reading-field"><legend className="eyebrow">Time read</legend><div className="reading-options">{[...new Set([10, 20, 30, 45, minutes])].sort((a, b) => a - b).map(value => <button key={value} type="button" className="option" aria-pressed={minutes === value} onClick={() => setMinutes(value)}>{value} min</button>)}</div></fieldset>
      <fieldset className="reading-field"><legend className="eyebrow">Now on page</legend><div className="page-stepper"><button type="button" className="step-button" aria-label="Fewer pages" disabled={page <= 0} onClick={() => setPage(page - 1)}><Icon name="minus" /></button><div><input aria-label="Now on page" type="number" min="0" max={book.pages} required value={Number.isNaN(page) ? '' : page} onChange={event => setPage(event.target.value === '' ? NaN : Number(event.target.value))} /><span className="mono">{page - baseline >= 0 ? '+' : ''}{Number.isFinite(page) ? page - baseline : '—'} pages</span></div><button type="button" className="step-button" aria-label="More pages" disabled={page >= book.pages} onClick={() => setPage(page + 1)}><Icon name="plus" /></button></div></fieldset>
      <fieldset className="reading-field"><legend className="eyebrow">For</legend><div className="reading-options">{[...new Set([localDate(), addDays(localDate(), -1), initialDate])].filter(d => d >= routine.start && (scheduled(routine, d, data.checkIns.filter(c => c.routineId === routine.id && c.status === 'done').map(c => c.date)) || routine.schedule === 'weekly')).map(d => <button type="button" className="option date-option" aria-pressed={date === d} key={d} onClick={() => changeDate(d)}>{d === localDate() ? 'Today · ' : d === addDays(localDate(), -1) ? 'Yesterday · ' : ''}{shortDate(d, { weekday: 'short', day: 'numeric' })}</button>)}</div></fieldset>
      {error && <p role="alert">{error}</p>}
      <button type="submit" className="save-reading">Save reading</button><p className="sheet-hint">Checks off Read for the day and updates the book.</p>
      {existing && <button type="button" className="text-action full-width" onClick={() => { if (onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== routine.id || c.date !== date) }) !== false) onClose(); }}>Clear this check-in</button>}
    </form>
  </Sheet>;
}

export function AlcoholSheet({ data, routine, date, onChange, onClose }: SheetProps) {
  const existing = checkIn(data, routine.id, date);
  const [drinks, setDrinks] = useState(existing?.drinks ?? 0);
  const [error, setError] = useState('');
  const total = weeklyDrinks(data, date) - (existing?.drinks ?? 0) + drinks;
  return <Sheet title="Alcohol-free day" development onClose={onClose}>
    <p className="mono muted">{shortDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}</p>
    <form onSubmit={event => { event.preventDefault(); try { if (onChange(putCheckIn(data, { routineId: routine.id, date, status: 'done', drinks })) !== false) onClose(); } catch (error) { setError((error as Error).message); } }}>
      <label className="form-label">Drinks today<input type="number" min="0" step="1" required value={Number.isNaN(drinks) ? '' : drinks} onChange={e => setDrinks(e.target.value === '' ? NaN : Number(e.target.value))} /></label>
      <p className="sheet-hint">Zero records an alcohol-free day. {total} of {routine.target} drinks this week{total > routine.target ? ' · over your weekly allowance' : ''}.</p>
      {error && <p role="alert">{error}</p>}<button type="submit" className="save-reading">Save check-in</button>
      {existing && <button type="button" className="text-action full-width" onClick={() => { if (onChange({ ...data, checkIns: data.checkIns.filter(c => c.routineId !== routine.id || c.date !== date) }) !== false) onClose(); }}>Clear this check-in</button>}
    </form>
  </Sheet>;
}

export function RoutinesSheet({ data, onChange, onClose }: { data: RoutineData; onChange: (data: RoutineData) => void | boolean; onClose: () => void }) {
  const [routines, setRoutines] = useState(() => structuredClone(data.routines));
  const edit = (id: string, change: Partial<Routine>) => setRoutines(current => current.map(r => r.id === id ? { ...r, ...change } : r));
  return <Sheet title="Routines" development onClose={onClose}><form className="routine-settings" onSubmit={event => { event.preventDefault(); if (onChange({ ...data, routines }) !== false) onClose(); }}>
    {routines.map(r => <fieldset className="settings-card" key={r.id}><legend>{r.name}</legend><label className="metric-choice"><span>Active</span><input type="checkbox" checked={r.active} onChange={e => edit(r.id, { active: e.target.checked })} /></label><div className="date-fields"><label>Starts<input type="date" required value={r.start} onChange={e => edit(r.id, { start: e.target.value })} /></label><label>{r.kind === 'reading' ? 'Usual minutes' : r.kind === 'alcohol' ? 'Drinks per week' : r.kind === 'training' ? 'Workouts per week' : 'Every … days'}<input type="number" min={r.kind === 'alcohol' ? '0' : '1'} max={r.kind === 'rehab' ? '365' : '1440'} step="1" required value={r.kind === 'rehab' ? r.interval : r.target} onChange={e => edit(r.id, r.kind === 'rehab' ? { interval: Number(e.target.value) } : { target: Number(e.target.value) })} /></label></div>
      {r.kind === 'reading' && <label className="form-label">Schedule<select value={r.schedule} onChange={e => edit(r.id, { schedule: e.target.value as Routine['schedule'] })}><option value="daily">Daily</option><option value="interval">Every few days</option></select></label>}
      {r.kind === 'reading' && r.schedule === 'interval' && <label className="form-label">Every … days<input required type="number" min="1" max="365" value={r.interval} onChange={e => edit(r.id, { interval: Number(e.target.value) })} /></label>}
    </fieldset>)}<button type="submit" className="primary-button full-width">Save routines</button>
  </form></Sheet>;
}

export function WelcomeSheet({ data, away, onChange, onReview, onClose }: { data: RoutineData; away: { routine: Routine; date: string }[]; onChange: (data: RoutineData) => void | boolean; onReview: (routine: Routine, date: string) => void; onClose: () => void }) {
  const pending = away.filter(item => !checkIn(data, item.routine.id, item.date));
  const days = new Set(away.map(a => a.date)).size;
  function apply(values: CheckIn[]) {
    let next = data;
    for (const value of values) next = putCheckIn(next, value);
    return onChange(next);
  }
  return <Sheet title={`You were away ${days} ${days === 1 ? 'day' : 'days'}`} eyebrow={`Welcome back · ${shortDate(localDate(), { weekday: 'short', day: 'numeric', month: 'short' })}`} onClose={onClose}>
    <p className="welcome-intro">{pending.length} routine check-ins went unlogged. Nothing was skipped for you, so fill in what you remember.</p>
    <div className="welcome-groups">{data.routines.map(routine => {
      const items = pending.filter(item => item.routine.id === routine.id);
      if (!items.length) return null;
      return <section className="welcome-group" key={routine.id}><header><strong>{routine.name}</strong><span className="mono muted">{items.length} days</span></header><div className="welcome-days">{items.map(item => <button key={item.date} onClick={() => onReview(routine, item.date)}>{shortDate(item.date, { weekday: 'short' })}<strong>{shortDate(item.date, { day: 'numeric' })}</strong></button>)}</div>{routine.kind === 'alcohol' && <footer><span>Counts toward {routine.target} drinks a week</span><button className="text-action habit-text" onClick={() => apply(items.map(item => ({ routineId: routine.id, date: item.date, status: 'done', drinks: 0 })))}>No drinks on all {items.length}</button></footer>}</section>;
    })}</div>
    <button className="save-reading welcome-review" disabled={!pending.length} onClick={() => { if (pending[0]) onReview(pending[0].routine, pending[0].date); }}>Review one by one</button>
    <button className="text-action full-width" onClick={() => { if (apply(pending.map(item => ({ routineId: item.routine.id, date: item.date, status: 'skipped' }))) !== false) onClose(); }}>Skip all {pending.length}</button>
    <p className="sheet-hint">Older days stay in your feed as dashed rows.</p>
  </Sheet>;
}
