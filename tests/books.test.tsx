import { StrictMode } from 'react';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { BookSelector } from '../src/books/book-selector';
import { bookDetails, normaliseIsbn, parseSearchResults, searchBooks } from '../src/books/catalog';
import { scanBookIsbn } from '../src/books/scanner';
import { createRoutines, type RoutineData } from '../src/routines/data';
import { isRoutineData } from '../src/data/validation';

vi.mock('../src/books/scanner', () => ({ scanBookIsbn: vi.fn() }));
const json = (value: unknown, status = 200) => ({ ok: status === 200, status, json: async () => value }) as Response;
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-18T12:00:00Z'));
  window.scrollTo = vi.fn();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const click = async (name: string | RegExp) => act(async () => { fireEvent.click(screen.getByRole('button', { name })); });
const change = async (label: string, value: string) => act(async () => { fireEvent.change(screen.getByLabelText(label), { target: { value } }); });

it('accepts checked ISBN-10/13 values, rejecting price barcodes and invalid check digits', () => {
  expect(normaliseIsbn('ISBN-13: 978-0-306-40615-7')).toBe('9780306406157');
  expect(normaliseIsbn('0-306-40615-2')).toBe('0306406152');
  expect(normaliseIsbn('0-8044-2957-X')).toBe('080442957X');
  for (const value of ['9781408891894', '1234567890128', '51299', '', '9780306406157 extra']) expect(normaliseIsbn(value)).toBeUndefined();
});
it('parses partial catalogue responses without inventing a page count', () => {
  expect(parseSearchResults(null)).toEqual([]);
  const results = parseSearchResults({ docs: [null, {}, { key: '/works/OL1W', title: 'Test', author_name: ['Writer', null], first_publish_year: 2020, editions: { docs: [{ key: '/books/OL2M', isbn: [null, 123, '9780306406157'] }] } }] });
  expect(results).toEqual([{ key: '/books/OL2M', title: 'Test', author: 'Writer', pages: undefined, year: '2020', isbn: '9780306406157' }]);
});
it('looks up an ISBN directly and retrieves pages from the selected edition', async () => {
  const fetch = vi.fn().mockResolvedValueOnce(json({ 'ISBN:9780306406157': { title: 'Piranesi', authors: [{ name: 'Susanna Clarke' }], number_of_pages: 272, publish_date: '2020' } })).mockResolvedValueOnce(json({ title: 'Large print', number_of_pages: 352, isbn_13: null, isbn_10: [false] }));
  vi.stubGlobal('fetch', fetch);
  const results = await searchBooks('9780306406157');
  expect(fetch.mock.calls[0][0]).toContain('bibkeys=ISBN:9780306406157');
  expect(results[0]).toMatchObject({ pages: 272, author: 'Susanna Clarke', isbn: '9780306406157' });
  expect(await bookDetails({ ...results[0], key: '/books/OL123M' })).toMatchObject({ title: 'Large print', pages: 352, isbn: '9780306406157' });
});
it('searches, selects an edition, and saves its editable metadata to the canonical library', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(json({ docs: [{ key: '/works/OL900W', title: 'Edition test', author_name: ['Writer'], editions: { docs: [{ key: '/books/OL901M' }] } }] })).mockResolvedValueOnce(json({ title: 'Edition test', number_of_pages: 300, isbn_13: ['9780306406157'] })));
  const onChange = vi.fn(), onSelect = vi.fn();
  render(<BookSelector data={createRoutines('2026-11-18')} onChange={onChange} onSelect={onSelect} onClose={vi.fn()} />);
  await change('Search books by title, author or ISBN', 'edition search test');
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await click(/Edition test.*Writer/);
  expect((screen.getByLabelText('Total pages') as HTMLInputElement).value).toBe('300');
  await change('Currently on page', '12'); await click('Add to library');
  const data: RoutineData = onChange.mock.calls[0][0];
  expect(data.books[0]).toMatchObject({ title: 'Edition test', pages: 300, initialPage: 12, status: 'reading', isbn: '9780306406157', catalogKey: '/books/OL901M', started: '2026-11-18' });
  expect(data.currentBookId).toBe(data.books[0].id);
  expect(isRoutineData(data)).toBe(true);
  expect(onSelect).toHaveBeenCalledWith(data.books[0].id, 12);
});
it('keeps manual addition usable offline and leaves the sheet open if saving fails', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
  const onChange = vi.fn().mockReturnValue(false), onSelect = vi.fn();
  render(<BookSelector data={createRoutines('2026-11-18')} onChange={onChange} onSelect={onSelect} onClose={vi.fn()} />);
  await change('Search books by title, author or ISBN', 'offline title');
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(screen.getByRole('alert').textContent).toContain('Check your connection');
  await click('Can’t find it? Add manually'); await change('Total pages', '200');
  await click('Want to read'); await click('Add to library');
  expect(onChange.mock.calls[0][0].books[0]).toMatchObject({ status: 'want-to-read', initialPage: 0 });
  expect(onChange.mock.calls[0][0].currentBookId).toBe('');
  expect(onSelect).not.toHaveBeenCalled();
  expect(screen.getByRole('alert').textContent).toContain('could not be saved');
});
it('ignores stale search responses when the query changes', async () => {
  let resolve: (value: Response) => void = () => {};
  const fetch = vi.fn().mockImplementationOnce(() => new Promise<Response>(done => { resolve = done; })).mockResolvedValueOnce(json({ docs: [{ key: '/works/OL902W', title: 'Current title' }] }));
  vi.stubGlobal('fetch', fetch);
  render(<BookSelector data={createRoutines('2026-11-18')} onChange={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()} />);
  await change('Search books by title, author or ISBN', 'stale search'); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await change('Search books by title, author or ISBN', 'current search'); await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  await act(async () => { resolve(json({ docs: [{ key: '/works/OL903W', title: 'Stale title' }] })); });
  expect(screen.queryByText('Stale title')).toBeNull();
  expect(screen.getByText('Current title')).toBeTruthy();
});
it('looks up scanned ISBNs under StrictMode and aborts the camera when the sheet closes', async () => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(json({})));
  vi.mocked(scanBookIsbn).mockResolvedValue('9780140328721');
  const view = render(<StrictMode><BookSelector data={createRoutines('2026-11-18')} onChange={vi.fn()} onSelect={vi.fn()} onClose={vi.fn()} /></StrictMode>);
  await click('Scan barcode');
  expect((screen.getByLabelText('Search books by title, author or ISBN') as HTMLInputElement).value).toBe('9780140328721');
  const signal = vi.mocked(scanBookIsbn).mock.calls.at(-1)![0]!;
  view.unmount(); expect(signal.aborted).toBe(true);
});
