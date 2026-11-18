import { useEffect, useMemo, useRef, useState } from 'react';
import { Node, Extension, mergeAttributes, type JSONContent, type Range } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import { TaskList, TaskItem } from '@tiptap/extension-list';
import { PluginKey } from '@tiptap/pm/state';
import { journalBlock, climbCard } from './journal-block';
import { widgetNames, type WidgetId } from './journal-views';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import type { PillResource, RichBody } from './journal-data';
import { JournalToolbar } from './journal-toolbar';

interface PickerState { query: string; range: Range }
export type CreatableRecordKind = 'climb' | 'training' | 'goal' | 'habit';
const filters: Record<string, { kinds: string[]; create?: { kind: CreatableRecordKind; label: string } }> = {
  All: { kinds: [] },
  Climbs: { kinds: ['climb'], create: { kind: 'climb', label: 'a climb' } },
  Workouts: { kinds: ['training', 'rehab'], create: { kind: 'training', label: 'a workout' } },
  Goals: { kinds: ['goal'], create: { kind: 'goal', label: 'a goal' } },
  Books: { kinds: ['habit'], create: { kind: 'habit', label: 'a book' } },
};
export function JournalBody({ body, resources, onChange, onOpen, onCreateRecord, label = 'Journal body', placeholder }: {
  body: RichBody; resources: PillResource[]; onChange: (body: RichBody) => void; onOpen: (record: PillResource) => void; label?: string; placeholder?: string; onCreateRecord?: (title: string, kind: CreatableRecordKind) => PillResource | undefined | Promise<PillResource | undefined>;
}) {
  const [slash, setSlash] = useState<PickerState | null>(null);
  const [insertMode, setInsertMode] = useState<'menu' | 'widgets' | 'climbs'>('menu');
  const [insertError, setInsertError] = useState('');
  const photo = useRef<HTMLInputElement>(null);
  const photoRange = useRef<Range | null>(null);
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [pickerFilter, setPickerFilter] = useState('All');
  const [highlight, setHighlight] = useState(0);
  const [active, setActive] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const interactions = useRef(new WeakSet<Event>());
  const callbacks = useRef({ onChange, onOpen, resources });
  useEffect(() => { callbacks.current = { onChange, onOpen, resources }; }, [onChange, onOpen, resources]);
  const chooseRef = useRef<(index: number) => void>(() => {});
  const extension = useMemo(() => Node.create({
    name: 'recordPill', group: 'inline', inline: true, atom: true, selectable: true,
    addAttributes() { return { id: { default: null, renderHTML: () => ({}) }, label: { default: '', renderHTML: () => ({}) }, category: { default: 'climb', renderHTML: () => ({}) } }; },
    parseHTML() { return [{ tag: 'a[data-record-id]', getAttrs: node => ({ id: node.getAttribute('data-record-id'), label: node.textContent, category: node.getAttribute('data-category') }) }]; },
    renderHTML({ node, HTMLAttributes }) {
      return ['a', mergeAttributes(HTMLAttributes, { class: 'record-pill', 'data-record-id': node.attrs.id, 'data-category': node.attrs.category, href: `#record-${node.attrs.id}`, contenteditable: 'false', tabindex: '0' }), node.attrs.label];
    },
    renderText({ node }) { return node.attrs.label; },
    addProseMirrorPlugins() {
      return [Suggestion({
        editor: this.editor, char: '@', allowSpaces: true,
        items: () => [],
        render: () => ({
          onStart: props => { setPicker({ query: props.query, range: props.range }); setHighlight(0); },
          onUpdate: props => { setPicker({ query: props.query, range: props.range }); setHighlight(0); },
          onExit: () => setPicker(null),
          onKeyDown: ({ event }) => {
            if (event.key === 'Escape') { exitSuggestion(this.editor.view); return true; }
            if (event.key === 'ArrowDown') { setHighlight(i => i + 1); return true; }
            if (event.key === 'ArrowUp') { setHighlight(i => Math.max(0, i - 1)); return true; }
            if (event.key === 'Enter') { chooseRef.current(-1); return true; }
            return false;
          },
        }),
      })];
    },
  }), []);
  const slashKey = useMemo(() => new PluginKey('journalInsert'), []);
  const slashExtension = useMemo(() => Extension.create({
    name: 'journalInsertMenu',
    addProseMirrorPlugins() { return [Suggestion({editor:this.editor,pluginKey:slashKey,char:'/',items:()=>[],render:()=>({
      onStart:props=>{setSlash({query:props.query,range:props.range});setInsertMode('menu');},
      onUpdate:props=>setSlash({query:props.query,range:props.range}),
      onExit:()=>setSlash(null),
      onKeyDown:({event})=>{if(event.key==='Escape'){exitSuggestion(this.editor.view,slashKey);return true;}return false;},
    })})]; },
  }), [slashKey]);
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), extension, slashExtension, journalBlock, climbCard, Image.configure({allowBase64:true}), TaskList, TaskItem.configure({nested:true})],
    content: body as JSONContent,
    onFocus: () => setActive(true),
    editorProps: {
      attributes: { class: 'journal-prose', 'aria-label': `${label}. Type @ to link a record.`, ...(placeholder ? { 'data-placeholder': placeholder, 'aria-placeholder': placeholder } : {}), role: 'textbox', 'aria-multiline': 'true', spellcheck: 'true' },
      handleClick: (_view, _pos, event) => {
        const anchor = (event.target as HTMLElement).closest('a[data-record-id]');
        const resource = callbacks.current.resources.find(r => r.id === anchor?.getAttribute('data-record-id'));
        if (!resource) return false;
        event.preventDefault(); callbacks.current.onOpen(resource); return true;
      },
      handleKeyDown: (_view, event) => {
        if (event.key !== 'Enter' || !(event.target instanceof HTMLElement)) return false;
        const id = event.target.closest('a[data-record-id]')?.getAttribute('data-record-id');
        const resource = callbacks.current.resources.find(r => r.id === id);
        if (!resource) return false;
        callbacks.current.onOpen(resource); return true;
      },
    },
    onUpdate: ({ editor: current }) => callbacks.current.onChange(current.getJSON() as RichBody),
  });
  const filter = filters[pickerFilter];
  const inCategory = (record: PillResource) => (!filter.kinds.length || filter.kinds.includes(record.kind)) && (pickerFilter !== 'Books' || record.id.startsWith('book-'));
  const matches = picker ? [...new Map(resources.map(r => [r.id, r])).values()].filter(r => r.title.toLowerCase().includes(picker.query.toLowerCase()) && inCategory(r)).slice(0, 12) : [];
  const creation = filter.create;
  const title = picker?.query.trim() ?? '';
  const canCreate = onCreateRecord && creation && title && !resources.some(r => inCategory(r) && r.title.toLowerCase() === title.toLowerCase());
  const selected = matches.length ? highlight % matches.length : 0;
  function choose(index: number) {
    const resource = matches[index < 0 ? selected : index];
    insert(resource);
  }
  function insert(resource?: PillResource, range = picker?.range) {
    if (!resource || !range || !editor || editor.isDestroyed) return;
    editor.chain().focus().insertContentAt(range, [{ type: 'recordPill', attrs: { id: resource.id, label: resource.title, category: resource.kind === 'chart' ? resource.category : resource.kind } }, { type: 'text', text: ' ' }]).run();
    setPicker(null);
  }
  async function create() {
    if (!picker || !creation || !onCreateRecord) return;
    const range = picker.range;
    if (editor) exitSuggestion(editor.view);
    insert(await onCreateRecord(title, creation.kind), range);
  }
  function linkRecord() {
    if (!editor) return;
    if (picker) { editor.commands.focus(); return; }
    const { $from } = editor.state.selection;
    const previous = $from.parent.textBetween(Math.max(0, $from.parentOffset - 1), $from.parentOffset, '', '\ufffc');
    editor.chain().focus().insertContent(previous && previous !== ' ' ? ' @' : '@').run();
  }
  useEffect(() => { chooseRef.current = choose; });
  useEffect(() => {
    const dismiss = () => {
      setActive(false);
      if (editor && !editor.isDestroyed) exitSuggestion(editor.view);
      setPicker(null);
      if (editor && !editor.isDestroyed) exitSuggestion(editor.view,slashKey);
      setSlash(null);
    };
    const outside = (event: Event) => {
      if (!interactions.current.has(event)) dismiss();
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    window.addEventListener('blur', dismiss);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('blur', dismiss);
    };
  }, [editor, slashKey]);
  useEffect(() => {
    const viewport = window.visualViewport;
    const position = () => {
      const keyboardHeight = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      // Share the keyboard boundary, including iOS viewport panning, between both controls.
      container.current?.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
      container.current?.style.setProperty('--journal-viewport-height', `${viewport?.height ?? window.innerHeight}px`);
      container.current?.style.setProperty('--journal-controls-gap', keyboardHeight > 0 ? '8px' : 'var(--journal-dock-bottom)');
    };
    position();
    viewport?.addEventListener('resize', position);
    viewport?.addEventListener('scroll', position);
    window.addEventListener('resize', position);
    return () => {
      viewport?.removeEventListener('resize', position);
      viewport?.removeEventListener('scroll', position);
      window.removeEventListener('resize', position);
    };
  }, []);
  function addBlock(content: JSONContent) {
    if (!editor || !slash) return;
    editor.chain().focus().insertContentAt(slash.range,[content,{type:'paragraph'}]).run();
    exitSuggestion(editor.view,slashKey); setSlash(null);
  }
  async function addPhoto(file?: File) {
    if (!file || !editor || !photoRange.current) return;
    try {
      if (!file.type.startsWith('image/')) throw new Error('Choose an image.');
      const url=URL.createObjectURL(file);
      let src:string;
      try { const bitmap=await createImageBitmap(file); const scale=Math.min(1,1200/Math.max(bitmap.width,bitmap.height)); const canvas=document.createElement('canvas');canvas.width=bitmap.width*scale;canvas.height=bitmap.height*scale;canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);src=canvas.toDataURL('image/jpeg',.8);bitmap.close(); } finally {URL.revokeObjectURL(url);}
      editor.chain().focus().insertContentAt(photoRange.current,[{type:'image',attrs:{src,alt:file.name}},{type:'paragraph'}]).run();setInsertError('');
    } catch(error) {setInsertError(error instanceof Error?error.message:'Could not add this photo.');}
  }
  return <div ref={container} className="journal-body" data-empty={editor?.isEmpty}
    onPointerDownCapture={event => {
      interactions.current.add(event.nativeEvent);
      if (editor?.view.dom.contains(event.target as globalThis.Node)) setActive(true);
    }}
    onFocusCapture={event => { interactions.current.add(event.nativeEvent); setActive(true); }}>
    {editor && <JournalToolbar editor={editor} active={active} linking={!!picker} onLinkRecord={linkRecord} onDone={() => { exitSuggestion(editor.view); setPicker(null); editor.commands.blur(); setActive(false); }} />}
    <EditorContent editor={editor} />
    <input ref={photo} type="file" accept="image/*" hidden onChange={event=>{void addPhoto(event.target.files?.[0]);event.target.value='';}} />
    {insertError&&<p role="alert">{insertError}</p>}
    {slash&&<div className="record-picker insert-picker" role="dialog" aria-label="Insert"><div className="picker-heading"><span>{insertMode==='menu'?'Insert':insertMode==='widgets'?'Widget':'Climb card'}</span><button type="button" aria-label="Close insert menu" onClick={()=>{if(editor)exitSuggestion(editor.view,slashKey);}}>×</button></div><div className="picker-options">
      {insertMode==='menu'&&[
        ['Chart','Sends by grade, sessions per week',()=>setInsertMode('widgets')],
        ['Widget','Any half or full-width widget',()=>setInsertMode('widgets')],
        ['Climb card','A climb with its history',()=>setInsertMode('climbs')],
        ['Photo','Camera or library',()=>{photoRange.current=slash.range;photo.current?.click();}],
        ['Checklist','A simple tick list',()=>addBlock({type:'taskList',content:[{type:'taskItem',attrs:{checked:false},content:[{type:'paragraph'}]}]})],
      ].filter(([name])=>String(name).toLowerCase().includes(slash.query.toLowerCase())).map(([name,description,action])=><button key={String(name)} type="button" onMouseDown={event=>event.preventDefault()} onClick={action as ()=>void}><strong>{String(name)}</strong><small>{String(description)}</small></button>)}
      {insertMode==='widgets'&&Object.entries(widgetNames).map(([id,title])=><button key={id} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>addBlock({type:'journalBlock',attrs:{widget:id as WidgetId}})}>{title}</button>)}
      {insertMode==='climbs'&&resources.filter(record=>record.kind==='climb').map(record=><button key={record.id} type="button" onMouseDown={event=>event.preventDefault()} onClick={()=>{if(!editor)return;editor.chain().focus().insertContentAt(slash.range,[{type:'climbCard',attrs:{id:record.id,label:record.title,category:'climb'}},{type:'paragraph'}]).run();exitSuggestion(editor.view,slashKey);}}>{record.title}<small>{record.kind!=='chart'&&record.metric}</small></button>)}
    </div></div>}

    {picker && <div className="record-picker" role="dialog" aria-label="Link a record">
      <div className="picker-heading"><span>Link a record</span><button type="button" aria-label="Close record picker" onClick={() => { if (editor) exitSuggestion(editor.view); }}>×</button></div>
      <div className="picker-filters">{Object.keys(filters).map(filter => <button key={filter} aria-pressed={pickerFilter === filter} onMouseDown={event => event.preventDefault()} onClick={() => { setPickerFilter(filter); setHighlight(0); }}>{filter}</button>)}</div>
      <div className="picker-options">{matches.map((record, i) => <button type="button" key={record.id} className={i === selected ? 'is-selected' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(i)}><span className="record-pill" data-category={record.kind === 'chart' ? record.category : record.kind}>{record.title}</span><small>{record.kind === 'chart' ? 'chart' : record.metric || record.kind}</small></button>)}</div>
      {!matches.length && <p>No matching records.</p>}
      {canCreate && <button className="picker-create" onMouseDown={event => event.preventDefault()} onClick={create}>Create “{title}” as {creation.label}</button>}
    </div>}
  </div>;
}
