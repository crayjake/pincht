import { useId, useState } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Sheet } from '../components/home/journal-sheet';
import { Icon } from '../components/home/journal-icons';
import { localDate, shortDate, type JournalRecord } from '../components/home/journal-data';
import { loadDays, loadResources } from '../components/home/journal-storage';
import { climbResources, climbStats, saveClimb, saveClimbSession } from './data';
import './climbs.scss';
import { BackLink } from '../navigation';

export function ClimbHeader({ title, back = '#/library/climbs', children }: { title: string; back?: string; children?: React.ReactNode }) {
  return <header className="reference-page-header"><BackLink href={back} className="icon-button" aria-label="Back"><Icon name="back" size={22} /></BackLink><h1>{title}</h1>{children}</header>;
}
export function ClimbSheet({ initial, initialTitle = '', fromEntry = false, onClose, onCreated }: {initial?: JournalRecord; initialTitle?: string; fromEntry?: boolean; onClose: () => void; onCreated?: (record: JournalRecord) => void}) {
  const formId = useId();
  const [name, setName] = useState(initial?.title ?? initialTitle), [grade, setGrade] = useState(initial?.metric ?? '6A');
  const [type, setType] = useState<'boulder' | 'route'>(initial?.climbInfo?.type ?? 'boulder'), [where, setWhere] = useState(initial?.climbInfo?.where ?? initial?.meta ?? '');
  const [sent, setSent] = useState(false), [error, setError] = useState('');
  const grades = ['6A', '6B', '6C', '7A', '7A+', '7B', '7C'];
  return <Sheet title={initial ? 'Edit climb' : 'New climb'} onClose={onClose} className="climb-editor" renderHeader={id => <header className="climb-editor-header"><button type="button" onClick={onClose}>Cancel</button><h2 id={id}>{initial ? 'Edit climb' : 'New climb'}</h2><button type="submit" form={formId} className="climb-save">Save</button></header>}>
    <form id={formId} className="climb-form" onSubmit={event => {
      event.preventDefault();
      try {
        const record: JournalRecord = { ...(initial ?? {}), id: initial?.id ?? crypto.randomUUID(), kind: 'climb', title: name.trim(), metric: grade.trim(), meta: where.trim(), climbInfo: { type, where: where.trim(), notes: initial?.climbInfo?.notes } };
        saveClimb(record, sent); onCreated?.(record); onClose();
      } catch (error) { setError((error as Error).message); }
    }}>
      {fromEntry && <p className="climb-entry-context">Created from your entry. It will be linked to the mention.</p>}
      <label className="climb-field"><span className="eyebrow">Name</span><input autoFocus required placeholder="Climb name" value={name} onChange={e => setName(e.target.value)} /></label>
      <fieldset><legend className="eyebrow">Grade</legend><div className="climb-chips climb-grades">{(grades.includes(grade) ? grades : [...grades, grade]).map(value => value === grade ? <input key="selected" aria-label="Grade" required value={grade} onChange={e => setGrade(e.target.value)} style={{width: `${Math.max(3, grade.length) + 3}ch`}} /> : <button key={value} type="button" aria-pressed={false} onClick={() => setGrade(value)}>{value}</button>)}</div></fieldset>
      <fieldset><legend className="eyebrow">Type</legend><div className="climb-segment">{(['boulder', 'route'] as const).map(value => <button type="button" key={value} aria-pressed={type === value} onClick={() => setType(value)}>{value === 'boulder' ? 'Boulder' : 'Route'}</button>)}</div></fieldset>
      <label className="climb-field"><span className="eyebrow">Where</span><input placeholder="Add a crag or gym" value={where} onChange={e => setWhere(e.target.value)} /></label>
      {!initial && <fieldset><legend className="eyebrow">Status</legend><div className="climb-segment"><button type="button" aria-pressed={!sent} onClick={() => setSent(false)}>Project</button><button type="button" aria-pressed={sent} onClick={() => setSent(true)}>Sent already</button></div></fieldset>}
      {error && <p role="alert">{error}</p>}<button type="submit" className="climb-cta">{initial ? 'Save climb' : 'Create climb'}</button>
    </form>
  </Sheet>;
}
export function ClimbSessionSheet({ onClose, onSaved, initialClimbId }: {onClose: () => void; onSaved?: () => void; initialClimbId?: string}) {
  const [date, setDate] = useState(localDate()), [where, setWhere] = useState(''), [query, setQuery] = useState(''), [creating, setCreating] = useState(false), [searching, setSearching] = useState(false);
  const [catalog, setCatalog] = useState(climbResources);
  const [logs, setLogs] = useState<JournalRecord[]>(() => initialClimbId ? climbResources().filter(record => record.id === initialClimbId).map(record => ({ ...record, climb: loadDays().find(day => day.date === localDate())?.records.find(log => log.id === record.id)?.climb ?? { goes: 1 } })) : []);
  const [error, setError] = useState('');
  function add(record: JournalRecord) {
    if (logs.some(log => log.id === record.id)) return;
    const old = loadDays().find(day => day.date === date)?.records.find(log => log.id === record.id);
    setLogs(values => [...values, { ...record, note: old?.note, climb: old?.climb ?? { goes: 1 } }]); setQuery(''); setSearching(false);
  }
  function change(id: string, patch: Partial<JournalRecord>) { setLogs(values => values.map(log => log.id === id ? { ...log, ...patch } : log)); }
  const goes = logs.reduce((sum, log) => sum + log.climb!.goes, 0), flashes = logs.filter(log => log.climb?.sendGo === 1).length, sends = logs.filter(log => log.climb?.sendGo && log.climb.sendGo > 1).length;
  return <><Sheet title="Log climbing" onClose={onClose} className="climb-session-sheet"><form onSubmit={event => {
    event.preventDefault();
    try { saveClimbSession(date, logs.map(log => ({ ...log, meta: where.trim() || log.meta, climbInfo: { type: log.climbInfo?.type ?? 'boulder', where: where.trim() || log.climbInfo?.where || log.meta, notes: log.climbInfo?.notes } }))); onSaved?.(); onClose(); } catch (error) { setError((error as Error).message); }
  }}>
    <div className="climb-chips session-context"><label className="session-date"><span>{date === localDate() ? 'Today · ' : ''}{shortDate(date, { weekday: 'short', day: 'numeric', month: date === localDate() ? undefined : 'short' })}</span><input aria-label="Date" type="date" required max={localDate()} value={date} onChange={e => { setDate(e.target.value); setLogs([]); }} /></label><label className="session-where"><span className="sr-only">Where</span><input placeholder="Add where" value={where} onChange={e => setWhere(e.target.value)} /></label></div>
    {logs.map(log => <section key={log.id} className="session-climb-card">
      <header><span className="session-climb-name"><span className="record-pill" data-category="climb">{log.title}</span><span className="mono muted">{log.metric}</span></span><div className="session-goes"><button type="button" aria-label={`Fewer goes for ${log.title}`} onClick={() => {
        if (log.climb!.goes === 1) { setLogs(values => values.filter(item => item.id !== log.id)); return; }
        const goes = log.climb!.goes - 1; change(log.id, { climb: { goes, ...(log.climb!.sendGo && log.climb!.sendGo <= goes ? { sendGo: log.climb!.sendGo } : {}) } });
      }}><Icon name="minus" size={18} /></button><span>{log.climb!.goes}</span><small>{log.climb!.goes === 1 ? 'go' : 'goes'}</small><button type="button" aria-label={`More goes for ${log.title}`} onClick={() => change(log.id, { climb: { ...log.climb!, goes: log.climb!.goes + 1 } })}><Icon name="plus" size={18} /></button></div></header>
      <div className="climb-segment session-outcome">{['Attempt', 'Sent', 'Flash'].map(status => <button type="button" key={status} aria-pressed={status === 'Attempt' ? !log.climb?.sendGo : status === 'Flash' ? log.climb?.sendGo === 1 : !!log.climb?.sendGo && log.climb.sendGo !== 1} onClick={() => change(log.id, { climb: { goes: log.climb!.goes, ...(status === 'Attempt' ? {} : { sendGo: status === 'Flash' ? 1 : log.climb!.goes }) } })}>{status}</button>)}</div>
    </section>)}
    <label className="climb-search session-search"><Icon name="search" /><input aria-label="Find a climb" type="search" placeholder="Search or create a climb" value={query} onFocus={() => setSearching(true)} onChange={e => { setQuery(e.target.value); setSearching(true); }} /></label>
    {(searching || !logs.length) && <div className="home-list session-search-results">{catalog.filter(record => !logs.some(log => log.id === record.id) && `${record.title} ${record.metric}`.toLowerCase().includes(query.toLowerCase())).map(record => <button type="button" key={record.id} className="home-row" onClick={() => add(record)}><span className="home-row-body"><strong>{record.title}</strong><small>{record.metric} · {record.climbInfo?.where ?? record.meta}</small></span></button>)}<button type="button" className="home-row" onClick={() => setCreating(true)}>+ Create new climb{query ? ` “${query}”` : ''}</button></div>}
    <p className="session-totals mono" aria-live="polite">{logs.length} {logs.length === 1 ? 'climb' : 'climbs'} · {goes} {goes === 1 ? 'go' : 'goes'} · {flashes} {flashes === 1 ? 'flash' : 'flashes'} · {sends} {sends === 1 ? 'send' : 'sends'}</p>
    {error && <p role="alert">{error}</p>}<button className="climb-cta" type="submit" disabled={!logs.length}>Save session</button>
  </form></Sheet>{creating && <ClimbSheet initialTitle={query} onClose={() => setCreating(false)} onCreated={record => { setCatalog(values => [...values.filter(item => item.id !== record.id), record]); add(record); }} />}</>;
}
export function ClimbsList({ query, onQuery }: {query: string; onQuery: (value: string) => void}) {
  const [status, setStatus] = useState('projects'), [grade, setGrade] = useState(''), [where, setWhere] = useState(''), [type, setType] = useState('');
  const climbs = climbResources(), days = loadDays();
  const filtered = climbs.filter(climb => { const sent = !!climbStats(climb.id, days).sentAt; return (status === 'all' || (status === 'sent' ? sent : !sent)) && `${climb.title} ${climb.metric} ${climb.meta}`.toLowerCase().includes(query.toLowerCase()) && (!grade || climb.metric === grade) && (!where || (climb.climbInfo?.where ?? climb.meta) === where) && (!type || (climb.climbInfo?.type ?? 'boulder') === type); });
  return <div className="climbs-catalog"><div className="climb-segment">{['projects', 'sent', 'all'].map(value => <button key={value} aria-pressed={status === value} onClick={() => setStatus(value)}>{value === 'projects' ? 'Projects' : value === 'sent' ? 'Sent' : 'All'}</button>)}</div>
    <label className="climb-search"><Icon name="search" /><input aria-label="Search Library" type="search" placeholder="Search climbs" value={query} onChange={e => onQuery(e.target.value)} /></label>
    <div className="climb-chips climb-filters">{[{ label: 'Grade', value: grade, set: setGrade, options: [...new Set(climbs.map(climb => climb.metric))].filter(Boolean).map(value => [value, value]) }, { label: 'Where', value: where, set: setWhere, options: [...new Set(climbs.map(climb => climb.climbInfo?.where ?? climb.meta))].filter(Boolean).map(value => [value, value]) }, { label: 'Type', value: type, set: setType, options: [['boulder', 'Boulder'], ['route', 'Route']] }].map(filter => <label className="climb-filter" key={filter.label}><span aria-hidden="true">{filter.options.find(([value]) => value === filter.value)?.[1] ?? filter.label}</span><select aria-label={filter.label} value={filter.value} onChange={e => filter.set(e.target.value)}><option value="">{filter.label}</option>{filter.options.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>)}</div>
    <h2 className="eyebrow">{filtered.length} {status === 'all' ? 'climbs' : status === 'sent' ? 'sent' : filtered.length === 1 ? 'project' : 'projects'}</h2><div className="home-list">{filtered.map(climb => { const stats = climbStats(climb.id, days); return <a className="home-row climb-catalog-row" key={climb.id} href={`#/library/climbs/${encodeURIComponent(climb.id)}`}><span className="home-lead"><span data-category="climb" className="catalog-grade">{climb.metric}</span></span><span className="home-row-body"><strong>{climb.title}</strong><small>{climb.climbInfo?.where || climb.meta}{stats.sendGo === 1 ? ' · flash' : stats.goes ? ` · ${stats.goes} ${stats.goes === 1 ? 'go' : 'goes'}` : ''}</small></span><span className="climb-status" data-sent={!!stats.sentAt}>{stats.sentAt ? 'sent' : 'project'}</span><span className="reference-chevron"><Icon name="back" size={16} /></span></a>; })}{!filtered.length && <p className="climb-empty muted">{query ? 'No matching climbs.' : 'No climbs here yet.'}</p>}</div>
  </div>;
}
function ordinal(value: number) { return `${value}${value % 100 >= 11 && value % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[value % 10] ?? 'th')}`; }
export function ClimbPage({ record, onChanged }: {record: JournalRecord; onChanged: () => void}) {
  const [editing, setEditing] = useState(false), [logging, setLogging] = useState(false), [notes, setNotes] = useState(record.climbInfo?.notes ?? ''), [error, setError] = useState('');
  const stats = climbStats(record.id), goals = [...new Map([...loadDays().flatMap(day => day.records), ...loadResources()].map(item => [item.id, item])).values()].filter(goal => goal.climbGoal?.climbIds.includes(record.id));
  return <><ClimbHeader title={record.title}><DropdownMenu.Root><DropdownMenu.Trigger asChild><button className="icon-button" aria-label="Climb actions"><Icon name="plus" size={22} /></button></DropdownMenu.Trigger><DropdownMenu.Portal><DropdownMenu.Content className="climb-action-menu" align="end" sideOffset={4}><DropdownMenu.Item onSelect={() => setLogging(true)}>Log a session</DropdownMenu.Item><DropdownMenu.Item onSelect={() => setEditing(true)}>Edit climb</DropdownMenu.Item></DropdownMenu.Content></DropdownMenu.Portal></DropdownMenu.Root></ClimbHeader>
    <p className="climb-detail-subtitle mono muted">{record.climbInfo?.type === 'route' ? 'French' : 'Font'} {record.metric} · {record.climbInfo?.type ?? 'boulder'}</p>
    <section className="climb-stats-card"><div className="climb-send-summary"><span className="climb-status" data-sent={!!stats.sentAt}>{stats.sentAt ? `Sent ${shortDate(stats.sentAt, { weekday: 'short', day: 'numeric', month: 'short' })}` : 'Project'}</span>{stats.sendGo && <span className="mono muted">on the {ordinal(stats.sendGo)} go</span>}</div><div className="climb-stats"><div><strong>{stats.goes}</strong><small>goes</small></div><div><strong>{stats.logs.length}</strong><small>sessions</small></div><div><strong>{stats.firstAt && stats.sentAt ? `${Math.round((Date.parse(stats.sentAt) - Date.parse(stats.firstAt)) / 86400000)} d` : '—'}</strong><small>first to send</small></div></div></section>
    <section className="climb-detail-section"><h2 className="eyebrow">History</h2><div className="climb-history">{[...stats.logs].reverse().map((log, index) => <a key={log.date} href={`#/journal/${log.date}`}><span><strong>{shortDate(log.date, { weekday: 'short', day: 'numeric', month: 'short' })}</strong><span className="climb-go-dots" aria-hidden="true">{Array.from({ length: Math.min(log.record.climb!.goes, 30) }, (_, i) => <i key={i} data-sent={i + 1 === log.record.climb!.sendGo} />)}</span></span><span className="mono muted">{log.record.climb?.sendGo ? log.record.climb.sendGo === 1 ? 'flash' : `sent · ${ordinal(log.record.climb.sendGo)} go` : `${log.record.climb!.goes} ${log.record.climb!.goes === 1 ? 'go' : 'goes'}${index === stats.logs.length - 1 ? ' · first try' : ''}`}</span></a>)}{!stats.logs.length && <p className="climb-empty muted">No sessions yet.</p>}</div></section>
    <section className="climb-detail-section"><h2 className="eyebrow">Notes</h2><textarea aria-label="Climb notes" className="climb-detail-notes" placeholder="Beta, holds, things to try…" value={notes} onChange={e => setNotes(e.target.value)} onBlur={() => { if (notes === (record.climbInfo?.notes ?? '')) return; try { saveClimb({ ...record, climbInfo: { type: record.climbInfo?.type ?? 'boulder', where: record.climbInfo?.where ?? record.meta, notes } }); onChanged(); setError(''); } catch (error) { setError((error as Error).message); } }} />{error && <p role="alert">{error}</p>}</section>
    {goals.length > 0 && <section className="climb-detail-section"><h2 className="eyebrow">Part of</h2>{goals.map(goal => <a key={goal.id} className="record-pill" data-category="goal" href={`#/library/goals/${encodeURIComponent(goal.id)}`}>{goal.title}</a>)}</section>}
    {editing && <ClimbSheet initial={record} onClose={() => setEditing(false)} onCreated={onChanged} />}{logging && <ClimbSessionSheet initialClimbId={record.id} onClose={() => setLogging(false)} onSaved={onChanged} />}
  </>;
}
