import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import type { Editor } from '@tiptap/core';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { JournalBody } from '../src/components/home/journal-body';

beforeEach(() => {
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('opens inline record links on click and Enter using their actual record destination', async () => {
  const record = { id: 'sidepull', title: 'Sidepull Season', kind: 'climb' as const, metric: '7A', meta: '' };
  const onOpen = vi.fn();
  render(<JournalBody body={{ type: 'doc', content: [{ type: 'paragraph', content: [
    { type: 'recordPill', attrs: { id: record.id, label: record.title, category: 'climb' } },
  ] }] }} resources={[record]} onChange={vi.fn()} onOpen={onOpen} />);
  const link = screen.getByRole('link', { name: record.title });
  expect(link.getAttribute('href')).toBe('#/library/climbs/sidepull');
  await act(async () => { fireEvent.click(link); });
  expect(onOpen).toHaveBeenCalledExactlyOnceWith(record);
  await act(async () => { fireEvent.keyDown(link, { key: 'Enter' }); });
  expect(onOpen).toHaveBeenCalledTimes(2);
});

function setup() {
  render(<><input aria-label="Journal title" /><JournalBody
    body={{ type: 'doc', content: [{ type: 'paragraph' }] }}
    resources={[{ id: 'slab', title: 'Blue slab', kind: 'climb' }]}
    onChange={vi.fn()} onOpen={vi.fn()}
  /></>);
  const body = screen.getByRole('textbox', { name: /Journal body/ }) as HTMLElement & { editor: Editor };
  const toolbar = screen.getByRole('toolbar', { name: 'Journal formatting' });
  return { body, editor: body.editor, toolbar };
}

it('links a record from the first toolbar button at the caret without duplicating an open mention', async () => {
  const { body, editor, toolbar } = setup();
  await act(async () => { body.focus(); editor.commands.insertContent('Tried'); });
  const link = within(toolbar).getByRole('button', { name: 'Link a record' });
  expect(toolbar.querySelector('button')).toBe(link);
  expect(link.textContent).toBe('@');
  await act(async () => { fireEvent.pointerDown(link); fireEvent.click(link); });
  expect(screen.getByRole('dialog', { name: 'Link a record' })).toBeTruthy();
  expect(editor.getText()).toBe('Tried @');
  await act(async () => { fireEvent.click(link); });
  expect(editor.getText()).toBe('Tried @');
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: /Blue slab/ })); });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(body.querySelector('[data-record-id="slab"]')).toBeTruthy();
  expect(editor.getText()).toBe('Tried Blue slab ');
});

it('dismisses the picker on title focus and outside taps, while allowing picker filters and Done', async () => {
  const { body, editor, toolbar } = setup();
  const open = async () => {
    await act(async () => { body.focus(); editor.commands.insertContent(' @'); });
    expect(screen.getByRole('dialog', { name: 'Link a record' })).toBeTruthy();
  };
  await open();
  await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Climbs', exact: true })); });
  expect(screen.getByRole('dialog')).toBeTruthy();
  await act(async () => { screen.getByLabelText('Journal title').focus(); });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(toolbar.getAttribute('data-visible')).toBe('false');
  await open();
  await act(async () => { fireEvent.pointerDown(document.body); });
  expect(screen.queryByRole('dialog')).toBeNull();
  await open();
  await act(async () => { fireEvent.click(within(toolbar).getByRole('button', { name: 'Finish editing' })); });
  expect(screen.queryByRole('dialog')).toBeNull();
  expect(toolbar.getAttribute('data-visible')).toBe('false');
});

it('updates the shared picker and toolbar boundary as the keyboard opens, pans, and closes', async () => {
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0 });
  vi.stubGlobal('visualViewport', viewport);
  vi.stubGlobal('innerHeight', 844);
  const { body, editor } = setup();
  const root = body.closest('.journal-body') as HTMLElement;
  await act(async () => { body.focus(); editor.commands.insertContent('@'); });
  expect(root.contains(screen.getByRole('dialog'))).toBe(true);
  expect(root.contains(screen.getByRole('toolbar'))).toBe(true);
  expect(root.style.getPropertyValue('--keyboard-height')).toBe('0px');
  viewport.height = 430;
  await act(async () => { viewport.dispatchEvent(new Event('resize')); });
  expect(root.style.getPropertyValue('--keyboard-height')).toBe('414px');
  expect(root.style.getPropertyValue('--journal-viewport-height')).toBe('430px');
  expect(root.style.getPropertyValue('--journal-controls-gap')).toBe('8px');
  viewport.offsetTop = 60;
  await act(async () => { viewport.dispatchEvent(new Event('scroll')); });
  expect(root.style.getPropertyValue('--keyboard-height')).toBe('354px');
  viewport.height = 844; viewport.offsetTop = 0;
  await act(async () => { viewport.dispatchEvent(new Event('resize')); });
  expect(root.style.getPropertyValue('--keyboard-height')).toBe('0px');
  expect(root.style.getPropertyValue('--journal-controls-gap')).toBe('var(--journal-dock-bottom)');
});
