import { useState } from 'react';
import { localDate, shortDate, hasJournalContent, richText, type Day, type Entry } from './journal-data';
import { Sheet } from './journal-sheet';
import { addDays } from '../../routines/data';
import { validDate } from '../../rehab/data';

export function moveEntry(days: Day[], from: string, to: string): Day[] {
  if (!validDate(to) || to > localDate()) throw new Error('Choose today or an earlier day.');
  if (from === to) return days;
  const entry = days.find(day => day.date === from)?.entry;
  if (!entry) throw new Error('There is no writing to move.');
  if (hasJournalContent(days.find(day => day.date === to)?.entry)) throw new Error('That day already has a journal entry.');
  const next = days.map(day => day.date === from ? { ...day, entry: undefined } : day.date === to ? { ...day, entry: structuredClone(entry) } : day);
  if (!next.some(day => day.date === to)) next.push({date:to,entry:structuredClone(entry),types:[],metrics:{},visibleMetrics:[],records:[]});
  return next.sort((a,b) => b.date.localeCompare(a.date));
}
export function entryText(entry?: Entry) { return entry ? [entry.title, ...entry.body.content.map(node => richText([node]).join(''))].filter(Boolean).join('\n\n') : ''; }

export function DayPicker({ days, initial = localDate(), moving = false, onClose, onChoose }: {days: Day[]; initial?: string; moving?: boolean; onClose: () => void; onChoose: (date: string) => void}) {
  const [month, setMonth] = useState(initial.slice(0,7));
  const [selected, setSelected] = useState(initial);
  const first = `${month}-01`, offset = (new Date(`${first}T12:00:00`).getDay()+6)%7;
  const count = new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const change = (by:number) => { const date = new Date(`${first}T12:00:00`); date.setMonth(date.getMonth()+by); setMonth(localDate(date).slice(0,7)); };
  const hasEntry = hasJournalContent(days.find(day => day.date === selected)?.entry);
  return <Sheet title={moving ? 'Move to another day' : 'Jump to a day'} onClose={onClose}>
    <div className="calendar-heading"><button className="text-action" onClick={() => {setMonth(localDate().slice(0,7));setSelected(localDate());}}>Today</button><button className="icon-button" aria-label="Previous month" onClick={() => change(-1)}>‹</button><strong>{shortDate(first,{month:'long',year:'numeric'})}</strong><button className="icon-button" aria-label="Next month" disabled={month >= localDate().slice(0,7)} onClick={() => change(1)}>›</button></div>
    <div className="day-calendar">{['M','T','W','T','F','S','S'].map((d,i)=><span className="muted" key={i}>{d}</span>)}{Array.from({length:offset},(_,i)=><span key={`empty${i}`} />)}{Array.from({length:count},(_,i)=>{const date=addDays(first,i);return <button key={date} aria-label={date} aria-pressed={date===selected} disabled={date>localDate()} onClick={()=>setSelected(date)}>{i+1}{hasJournalContent(days.find(day=>day.date===date)?.entry) && <i />}</button>;})}</div>
    <p className="mono">{shortDate(selected,{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</p><p className="muted">{hasEntry ? 'Journal entry' : 'No entry yet'}</p>
    <button className="primary-button full-width" onClick={()=>onChoose(selected)}>{moving ? 'Move entry' : hasEntry ? 'Open entry' : 'Add entry'}</button>
  </Sheet>;
}
export function EntryMenu({day,onClose,onEdit,onMove,onTags,onDelete}: {day:Day;onClose:()=>void;onEdit:()=>void;onMove:()=>void;onTags:()=>void;onDelete:()=>void}) {
  const [confirm,setConfirm]=useState(false),[status,setStatus]=useState('');
  return <Sheet title={confirm?'Delete entry?':'Entry'} onClose={onClose}>{confirm?<><p>Your writing will be deleted. Logged records and items in your Library stay saved.</p><button className="secondary-button full-width" onClick={()=>setConfirm(false)}>Cancel</button><button className="primary-button full-width" onClick={onDelete}>Delete entry</button></>:<div className="settings-list"><button className="settings-row" onClick={onEdit}>Edit entry</button><button className="settings-row" onClick={onMove} disabled={!hasJournalContent(day.entry)}>Move to another day</button><button className="settings-row" onClick={onTags}>Edit tags</button><button className="settings-row" onClick={()=>{void Promise.resolve().then(()=>navigator.clipboard.writeText(entryText(day.entry))).then(()=>setStatus('Copied')).catch(()=>setStatus('Could not copy text.'));}}>Copy text</button><button className="settings-row danger" onClick={()=>setConfirm(true)} disabled={!hasJournalContent(day.entry)}>Delete entry</button></div>}{status&&<p role="status">{status}</p>}</Sheet>;
}
export function EntryTags({entry,onClose,onSave}: {entry:Entry;onClose:()=>void;onSave:(tags:string[])=>void}) {
  const [tags,setTags]=useState((entry.tags??[]).join(', '));
  return <Sheet title="Edit tags" onClose={onClose}><label className="form-label">Tags<input value={tags} placeholder="climb, rehab" onChange={event=>setTags(event.target.value)} /></label><button className="primary-button full-width" onClick={()=>onSave([...new Set(tags.split(',').map(tag=>tag.trim().toLowerCase()).filter(Boolean))])}>Save</button></Sheet>;
}
