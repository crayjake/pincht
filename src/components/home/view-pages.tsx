import { useState, type DragEvent } from 'react';
import { PrimaryNav } from '../app-navigation';
import { viewTags, type ViewTag } from '../../routines/tasks';
import { climbingView, loadViews, saveView, widgetNames, fullWidgets, type JournalView, type ViewBlock, type WidgetId } from './journal-views';
import './home.scss';
import { loadResources } from './journal-storage';
import { viewEditorHref, viewEditorReturnPath } from './view-navigation';

const blockNames = { widgets: 'Widgets', todo: 'To-do', journal: 'Journal', chart: 'Chart' };
export function ViewPages({ id, returnTo }: { id?: string; returnTo?: string }) {
  const [views] = useState(loadViews);
  const view = id === 'new' ? { ...structuredClone(climbingView), id: crypto.randomUUID(), name: '', isDefault: false } : views.find(v => v.id === id);
  if (id) return view ? <ViewEditor key={id} view={view} returnTo={returnTo} /> : <main className="today-page"><a href="#/views">Back to views</a><p>View not found.</p></main>;
  return <><main className="today-page configuration-page"><header className="screen-heading"><div><h1>Views</h1><p>Your data, filtered and arranged</p></div><a className="text-action" href={viewEditorHref('new')}>Add view</a></header><div className="settings-list">{views.map(view => <div className="settings-row" key={view.id}><a href={`#/view/${view.id}`}><strong>{view.name}</strong><small>{view.tags.join(' · ') || 'All entries and routines'}</small></a><a className="text-action" href={viewEditorHref(view.id)}>Edit</a></div>)}</div></main><PrimaryNav active="library" /></>;
}
function ViewEditor({ view, returnTo }: { view: JournalView; returnTo?: string }) {
  const [value, setValue] = useState(() => structuredClone(view));
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);
  const [dragged, setDragged] = useState<number | null>(null);
  const [editingBlock, setEditingBlock] = useState<string>();
  const [preset, setPreset] = useState(view.tags.join(',') === climbingView.tags.join(',') ? 'Climbing' : 'Custom');
  const patch = (change: Partial<JournalView>) => setValue(current => ({ ...current, ...change }));
  function blockPatch(id: string, change: Partial<ViewBlock>) { patch({ blocks: value.blocks.map(b => b.id === id ? { ...b, ...change } : b) }); }
  function reorder(from: number, to: number) {
    const blocks = [...value.blocks]; const [block] = blocks.splice(from, 1); blocks.splice(to, 0, block); patch({ blocks });
  }
  function drop(event: DragEvent, to: number) { event.preventDefault(); if (dragged !== null) reorder(dragged, to); setDragged(null); }
  const presets: Record<string, ViewTag[]> = { Climbing: ['climb', 'rehab', 'training'], Reading: ['reading'], Habits: ['habit'], Sleep: ['sleep'], Custom: [] };
  return <><main className="today-page configuration-page"><header className="editor-heading"><a className="text-action" href={viewEditorReturnPath(returnTo)}>Cancel</a><h1>{view.name ? 'Edit view' : 'New view'}</h1><button className="save-action" onClick={() => { try { saveView(value); location.hash = `/view/${value.id}`; } catch (cause) { setError((cause as Error).message); } }}>Done</button></header>
    {error && <p role="alert">{error}</p>}
    <label className="settings-field"><span className="eyebrow muted">Name</span><input aria-label="View name" value={value.name} onChange={e => patch({ name: e.target.value })} /></label>
    <section className="settings-section"><h2 className="eyebrow muted">Start from a premade filter</h2><div className="settings-chips">{Object.entries(presets).map(([name, tags]) => <button key={name} aria-pressed={preset === name} onClick={() => { patch({ tags }); setPreset(name); }}>{name}</button>)}</div></section>
    <section className="settings-section"><h2 className="eyebrow muted">Shows entries and routines tagged</h2><div className="settings-chips">{viewTags.map(tag => <button key={tag} data-category={tag === 'reading' ? 'habit' : tag} aria-pressed={value.tags.includes(tag)} onClick={() => { patch({ tags: value.tags.includes(tag) ? value.tags.filter(t => t !== tag) : [...value.tags, tag] }); setPreset('Custom'); }}>{tag}</button>)}</div></section>
    <section className="settings-section"><h2 className="eyebrow muted">Blocks · drag to reorder</h2><div className="settings-list">{value.blocks.map((block, index) => <div className="view-block" key={block.id} draggable onDragStart={() => setDragged(index)} onDragOver={e => e.preventDefault()} onDrop={e => drop(e, index)}><div className="settings-row"><span className="block-grip" aria-hidden="true">⠿</span><button className="block-title" aria-label={`Configure ${blockNames[block.type]}`} aria-expanded={editingBlock === block.id} onClick={() => setEditingBlock(editingBlock === block.id ? undefined : block.id)}><strong>{blockNames[block.type]}</strong><small>{block.type === 'widgets' ? `${block.widgets?.length ?? 0} · ${(block.widgets ?? []).map(id => widgetNames[id].toLowerCase()).join(', ')}` : block.type === 'todo' ? 'Routines matching the filter' : block.type === 'journal' ? 'Cards · filtered' : widgetNames[block.chart ?? 'rehab']}</small></button><button className="settings-switch" aria-label={`${blockNames[block.type]} shown`} aria-pressed={block.enabled} onClick={() => blockPatch(block.id, { enabled: !block.enabled })}><i /></button></div>
      {editingBlock === block.id && block.type === 'widgets' && <div className="settings-chips">{Object.entries(widgetNames).map(([id, name]) => <button key={id} aria-pressed={block.widgets?.includes(id as WidgetId) ?? false} onClick={() => blockPatch(block.id, { widgets: block.widgets?.includes(id as WidgetId) ? block.widgets.filter(w => w !== id) : [...(block.widgets ?? []), id as WidgetId] })}>{name}</button>)}</div>}
      {editingBlock === block.id && block.type === 'chart' && <div className="settings-chips">{fullWidgets.map(chart => <button key={chart} aria-pressed={block.chart === chart} onClick={() => blockPatch(block.id, { chart })}>{widgetNames[chart]}</button>)}</div>}
      {editingBlock === block.id && ((block.type === 'widgets' && block.widgets?.includes('strength')) || (block.type === 'chart' && block.chart === 'strength')) && <label className="settings-field">Strength target<select aria-label="Strength target" value={block.goalId ?? ''} onChange={event => blockPatch(block.id, { goalId: event.target.value || undefined })}><option value="">No target</option>{loadResources().filter(record => record.goal?.metric === 'finger-strength').map(record => <option key={record.id} value={record.id}>{record.title} · {record.goal!.targetKg} kg</option>)}</select><a className="text-action" href="#/library/goals/new">New goal</a></label>}
      {editingBlock === block.id && <div className="block-actions"><button disabled={!index} onClick={() => reorder(index, index - 1)} aria-label={`Move ${blockNames[block.type]} up`}>↑</button><button disabled={index === value.blocks.length - 1} onClick={() => reorder(index, index + 1)} aria-label={`Move ${blockNames[block.type]} down`}>↓</button><button onClick={() => patch({ blocks: value.blocks.filter(b => b.id !== block.id) })}>Remove</button></div>}</div>)}</div>
      <button className="add-block" aria-expanded={adding} onClick={() => setAdding(!adding)}>Add block · widget, to-do, journal, chart</button>{adding && <div className="settings-chips">{(['widgets', 'todo', 'journal', 'chart'] as const).map(type => <button key={type} disabled={value.blocks.some(block => block.type === type)} onClick={() => { patch({ blocks: [...value.blocks, { id: crypto.randomUUID(), type, enabled: true, ...(type === 'widgets' ? { widgets: ['rehab'] as WidgetId[] } : type === 'chart' ? { chart: 'strength' as const } : {}) }] }); setAdding(false); }}>{blockNames[type]}</button>)}</div>}
    </section>
    <section className="settings-section"><h2 className="eyebrow muted">Placement</h2><div className="settings-list"><div className="settings-row"><div><strong>Make default</strong><small>Open this view when entering Journal</small></div><button className="settings-switch" aria-label="Make default" aria-pressed={!!value.isDefault} onClick={() => patch({ isDefault: !value.isDefault })}><i /></button></div></div></section>
  </main><PrimaryNav active="library" /></>;
}
