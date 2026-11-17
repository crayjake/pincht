import { useEffect, useMemo, useRef, useState } from 'react';
import { Node, mergeAttributes, type JSONContent, type Range } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
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
  body: RichBody; resources: PillResource[]; onChange: (body: RichBody) => void; onOpen: (record: PillResource) => void; label?: string; placeholder?: string; onCreateRecord?: (title: string, kind: CreatableRecordKind) => PillResource;
}) {
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
  const editor = useEditor({
    extensions: [StarterKit.configure({ link: false }), extension],
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
  function insert(resource?: PillResource) {
    if (!resource || !picker || !editor) return;
    editor.chain().focus().insertContentAt(picker.range, [{ type: 'recordPill', attrs: { id: resource.id, label: resource.title, category: resource.kind === 'chart' ? resource.category : resource.kind } }, { type: 'text', text: ' ' }]).run();
    setPicker(null);
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
  }, [editor]);
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
  return <div ref={container} className="journal-body" data-empty={editor?.isEmpty}
    onPointerDownCapture={event => {
      interactions.current.add(event.nativeEvent);
      if (editor?.view.dom.contains(event.target as globalThis.Node)) setActive(true);
    }}
    onFocusCapture={event => { interactions.current.add(event.nativeEvent); setActive(true); }}>
    {editor && <JournalToolbar editor={editor} active={active} linking={!!picker} onLinkRecord={linkRecord} onDone={() => { exitSuggestion(editor.view); setPicker(null); editor.commands.blur(); setActive(false); }} />}
    <EditorContent editor={editor} />
    {picker && <div className="record-picker" role="dialog" aria-label="Link a record">
      <div className="picker-heading"><span>Link a record</span><button type="button" aria-label="Close record picker" onClick={() => { if (editor) exitSuggestion(editor.view); }}>×</button></div>
      <div className="picker-filters">{Object.keys(filters).map(filter => <button key={filter} aria-pressed={pickerFilter === filter} onMouseDown={event => event.preventDefault()} onClick={() => { setPickerFilter(filter); setHighlight(0); }}>{filter}</button>)}</div>
      <div className="picker-options">{matches.map((record, i) => <button type="button" key={record.id} className={i === selected ? 'is-selected' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(i)}><span className="record-pill" data-category={record.kind === 'chart' ? record.category : record.kind}>{record.title}</span><small>{record.kind === 'chart' ? 'chart' : record.metric || record.kind}</small></button>)}</div>
      {!matches.length && <p>No matching records.</p>}
      {canCreate && <button className="picker-create" onMouseDown={event => event.preventDefault()} onClick={() => insert(onCreateRecord(title, creation.kind))}>Create “{title}” as {creation.label}</button>}
    </div>}
  </div>;
}
