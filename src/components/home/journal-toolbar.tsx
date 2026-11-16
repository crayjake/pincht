import { useEffect, useRef } from 'react';
import type { Editor } from '@tiptap/react';
import { Button } from '@/components/tiptap-ui-primitive/button';
import { Toolbar, ToolbarGroup, ToolbarSeparator } from '@/components/tiptap-ui-primitive/toolbar';
import { MarkButton } from '@/components/tiptap-ui/mark-button';
import { HeadingButton } from '@/components/tiptap-ui/heading-button';
import { ListButton } from '@/components/tiptap-ui/list-button';
import { BlockquoteButton } from '@/components/tiptap-ui/blockquote-button';
import { CodeBlockButton } from '@/components/tiptap-ui/code-block-button';
import { UndoRedoButton } from '@/components/tiptap-ui/undo-redo-button';
import { CheckIcon } from '@/components/tiptap-icons/check-icon';
import './journal-toolbar.scss';

export function JournalToolbar({ editor, active, onDone }: {
  editor: Editor; active: boolean; onDone: () => void;
}) {
  const toolbar = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    const position = () => {
      const keyboardHeight = viewport ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop) : 0;
      toolbar.current?.style.setProperty('--keyboard-height', `${keyboardHeight}px`);
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

  return <Toolbar ref={toolbar} variant="floating" className="journal-toolbar" aria-label="Journal formatting" tabIndex={0}
    data-visible={active} inert={!active}
    onPointerDown={event => {
      // Keep the text selection and mobile keyboard while tapping a format.
      if ((event.target as HTMLElement).closest('button')) event.preventDefault();
    }}>
    <ToolbarGroup>
      <UndoRedoButton editor={editor} action="undo" showTooltip={false} />
      <UndoRedoButton editor={editor} action="redo" showTooltip={false} />
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup>
      {(['bold', 'italic', 'underline', 'strike', 'code'] as const).map(type =>
        <MarkButton key={type} editor={editor} type={type} showTooltip={false} />)}
    </ToolbarGroup>
    <ToolbarSeparator />
    <ToolbarGroup>
      <HeadingButton editor={editor} level={2} showTooltip={false} />
      <HeadingButton editor={editor} level={3} showTooltip={false} />
      <ListButton editor={editor} type="bulletList" showTooltip={false} />
      <ListButton editor={editor} type="orderedList" showTooltip={false} />
      <BlockquoteButton editor={editor} showTooltip={false} />
      <CodeBlockButton editor={editor} showTooltip={false} />
    </ToolbarGroup>
    <ToolbarSeparator />
    <Button type="button" variant="ghost" aria-label="Finish editing" onClick={onDone}>
      <CheckIcon className="tiptap-button-icon" />
    </Button>
  </Toolbar>;
}
