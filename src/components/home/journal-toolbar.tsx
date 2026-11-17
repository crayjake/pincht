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

export function JournalToolbar({ editor, active, linking, onLinkRecord, onDone }: {
  editor: Editor; active: boolean; linking: boolean; onLinkRecord: () => void; onDone: () => void;
}) {
  return <Toolbar variant="floating" className="journal-toolbar" aria-label="Journal formatting" tabIndex={0}
    data-visible={active} inert={!active}
    onPointerDown={event => {
      // Keep the text selection and mobile keyboard while tapping a format.
      if ((event.target as HTMLElement).closest('button')) event.preventDefault();
    }}>
    <ToolbarGroup>
      <Button type="button" variant="ghost" aria-label="Link a record" aria-expanded={linking} onClick={onLinkRecord}>
        <span className="journal-link-icon" aria-hidden="true">@</span>
      </Button>
    </ToolbarGroup>
    <ToolbarSeparator />
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
