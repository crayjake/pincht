import { useEffect, useMemo, useRef, useState } from 'react';
import { Node, mergeAttributes, type JSONContent, type Range } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Suggestion, { exitSuggestion } from '@tiptap/suggestion';
import type { PillResource, RichBody } from './journal-data';
import { JournalToolbar } from './journal-toolbar';

interface PickerState { query: string; range: Range }
export function JournalBody({ body, resources, onChange, onOpen, label = 'Journal body', placeholder }: {
  body: RichBody; resources: PillResource[]; onChange: (body: RichBody) => void; onOpen: (record: PillResource) => void; label?: string; placeholder?: string;
}) {
  const [picker, setPicker] = useState<PickerState | null>(null);
  const [highlight, setHighlight] = useState(0);
  const [active, setActive] = useState(false);
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
  const matches = picker ? resources.filter(r => r.title.toLowerCase().includes(picker.query.toLowerCase())).slice(0, 12) : [];
  const selected = matches.length ? highlight % matches.length : 0;
  function choose(index: number) {
    const resource = matches[index < 0 ? selected : index];
    if (!resource || !picker || !editor) return;
    editor.chain().focus().insertContentAt(picker.range, [{ type: 'recordPill', attrs: { id: resource.id, label: resource.title, category: resource.kind === 'chart' ? resource.category : resource.kind } }, { type: 'text', text: ' ' }]).run();
    setPicker(null);
  }
  useEffect(() => { chooseRef.current = choose; });
  useEffect(() => {
    const outside = (event: Event) => {
      if (!interactions.current.has(event)) setActive(false);
    };
    const blur = () => setActive(false);
    document.addEventListener('pointerdown', outside);
    document.addEventListener('focusin', outside);
    window.addEventListener('blur', blur);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('focusin', outside);
      window.removeEventListener('blur', blur);
    };
  }, []);
  return <div className="journal-body" data-empty={editor?.isEmpty}
    onPointerDownCapture={event => {
      interactions.current.add(event.nativeEvent);
      if (editor?.view.dom.contains(event.target as globalThis.Node)) setActive(true);
    }}
    onFocusCapture={event => { interactions.current.add(event.nativeEvent); setActive(true); }}>
    {editor && <JournalToolbar editor={editor} active={active} onDone={() => { editor.commands.blur(); setActive(false); }} />}
    <EditorContent editor={editor} />
    {picker && <div className="record-picker" role="dialog" aria-label="Link a record">
      <div className="picker-heading"><span>Link a record or chart</span><button type="button" aria-label="Close record picker" onClick={() => { if (editor) exitSuggestion(editor.view); }}>×</button></div>
      <div className="picker-options">{matches.map((record, i) => <button type="button" key={record.id} className={i === selected ? 'is-selected' : ''} onMouseDown={event => event.preventDefault()} onClick={() => choose(i)}><span className="record-pill" data-category={record.kind === 'chart' ? record.category : record.kind}>{record.title}</span><small>{record.kind}</small></button>)}</div>
      {!matches.length && <p>No matching records. Try another name.</p>}
    </div>}
  </div>;
}
