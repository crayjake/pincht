import { useEffect, useRef, useState } from 'react';
import { Icon } from '../components/home/journal-icons';
import { Sheet } from '../components/home/journal-sheet';
import { localDate } from '../components/home/journal-data';
import { bookPage, type Book, type RoutineData } from '../routines/data';
import { bookDetails, searchBooks, type BookMatch } from './catalog';
import { scanBookIsbn } from './scanner';

export function BookSelector({ data, onChange, onSelect, onClose, initialTitle = '' }: { data: RoutineData; onChange: (data: RoutineData) => void | boolean; onSelect: (id: string, page: number) => void; onClose: () => void; initialTitle?: string }) {
  const [query, setQuery] = useState(initialTitle);
  const [results, setResults] = useState<BookMatch[]>([]), [searched, setSearched] = useState(false);
  const [searching, setSearching] = useState(false), [selecting, setSelecting] = useState(false), [scanning, setScanning] = useState(false), [error, setError] = useState('');
  const busy = searching || selecting;
  const [details, setDetails] = useState<BookMatch>();
  const selection = useRef<AbortController | undefined>(undefined);
  const camera = useRef<AbortController | undefined>(undefined);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; selection.current?.abort(); camera.current?.abort(); }; }, []);
  useEffect(() => {
    if (details || query.trim().length < 2) return;
    const controller = new AbortController();
    const timeout = setTimeout(() => {
      setSearching(true); setError(''); setSearched(false);
      searchBooks(query, controller.signal).then(matches => { if (!controller.signal.aborted) { setResults(matches); setSearched(true); } }).catch(error => { if (!controller.signal.aborted) { setResults([]); setError(error instanceof Error ? error.message : 'Book search is unavailable. You can add the book manually.'); } }).finally(() => { if (!controller.signal.aborted) setSearching(false); });
    }, 1000);
    return () => { clearTimeout(timeout); controller.abort(); };
  }, [query, details]);
  async function choose(match: BookMatch) {
    selection.current?.abort();
    const controller = new AbortController(); selection.current = controller;
    setSelecting(true); setError('');
    try { const book = await bookDetails(match, controller.signal); if (!controller.signal.aborted) setDetails(book); }
    catch { if (!controller.signal.aborted) setDetails(match); /* Details remain editable when edition lookup fails. */ }
    finally { if (!controller.signal.aborted) setSelecting(false); }
  }
  async function scan() {
    setScanning(true); setError('');
    camera.current = new AbortController();
    try { const isbn = await scanBookIsbn(camera.current.signal); if (isbn && mounted.current) { setQuery(isbn); setResults([]); setSearched(false); } }
    catch (error) { if (mounted.current) setError((error as Error).message); }
    finally { if (mounted.current) setScanning(false); }
  }
  function manual() { selection.current?.abort(); setSelecting(false); setSearching(false); setError(''); setDetails({ key: '', title: /^\d[\d\s-]+$/.test(query) ? '' : query.trim(), author: '' }); }
  const existingBooks = data.books.filter(book => `${book.title} ${book.author} ${book.isbn ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));
  return <Sheet title="Add book" onClose={onClose}>
    {details ? <BookDetails key={details.key} match={details} data={data} onChange={onChange} onSelect={onSelect} onBack={() => setDetails(undefined)} /> : <div className="book-search-flow">
      <label className="library-search"><Icon name="search" /><span className="sr-only">Search books by title, author or ISBN</span><input type="search" value={query} autoFocus placeholder="Search title, author or ISBN…" onChange={event => { setQuery(event.target.value); setResults([]); setSearched(false); setError(''); selection.current?.abort(); setSearching(false); setSelecting(false); }} /></label>
      <button className="book-scan-button" type="button" onClick={scan} disabled={scanning || busy}><Icon name="barcode" />{scanning ? 'Opening camera…' : 'Scan barcode'}</button>
      {error && <p role="alert">{error}</p>}
      {busy && <p className="mono muted" role="status">Looking up books…</p>}
      {searched && !busy && <p className="eyebrow" role="status">{results.length ? `${results.length} results` : 'No books found'}</p>}
      {!!results.length && <div className="book-search-results">{results.map(match => <button className="book-list-row" key={match.key} disabled={busy} onClick={() => choose(match)}><span className="book-cover" aria-hidden="true" /><span><strong>{match.title}</strong><span>{match.author}</span><small>{[match.pages ? `${match.pages} pages` : '', match.year].filter(Boolean).join(' · ')}</small></span><Icon name="back" /></button>)}</div>}
      <button className="text-action full-width" type="button" onClick={manual}>Can’t find it? Add manually</button>
      {existingBooks.length > 0 && <><h3 className="eyebrow">Your library</h3><div className="book-list">{existingBooks.map(book => <button className="book-list-row" key={book.id} onClick={() => { try { if (onChange({ ...data, currentBookId: book.id, books: data.books.map(value => value.id === book.id ? { ...value, status: 'reading', started: value.started ?? localDate() } : value) }) !== false) onSelect(book.id, bookPage(data, book.id)); else setError('The book could not be selected. Please try again.'); } catch(error) { setError((error as Error).message); } }}><Icon name="book" /><span><strong>{book.title}</strong><small>{book.author} · {bookPage(data, book.id)} / {book.pages}</small></span>{data.currentBookId === book.id && <Icon name="check" />}</button>)}</div></>}
      {!!results.length && <p className="sheet-hint">Book data from Open Library. Check the edition’s page count before adding.</p>}
    </div>}
  </Sheet>;
}

function BookDetails({ match, data, onChange, onSelect, onBack }: { match: BookMatch; data: RoutineData; onChange: (data: RoutineData) => void | boolean; onSelect: (id: string, page: number) => void; onBack: () => void }) {
  const [title, setTitle] = useState(match.title), [author, setAuthor] = useState(match.author);
  const [pages, setPages] = useState(match.pages ? String(match.pages) : ''), [page, setPage] = useState('0');
  const [status, setStatus] = useState<NonNullable<Book['status']>>('reading'), [started, setStarted] = useState(localDate());
  const [useForRead, setUseForRead] = useState(true), [error, setError] = useState('');
  function changeStatus(value: NonNullable<Book['status']>) { setStatus(value); setUseForRead(value === 'reading'); setPage(value === 'finished' ? pages : '0'); }
  return <form className="entry-form book-details-form" onSubmit={event => {
    event.preventDefault();
    const count = Number(pages), current = status === 'finished' ? count : status === 'want-to-read' ? 0 : Number(page);
    if (!title.trim() || !Number.isInteger(count) || count < 1 || !Number.isInteger(current) || current < 0 || current > count) { setError('Enter a title, total pages, and a current page within the book.'); return; }
    const duplicate = match.isbn && data.books.find(book => book.isbn === match.isbn);
    if (duplicate) { setError('This edition is already in your library. Go back and select it from Your library.'); return; }
    const book: Book = { id: crypto.randomUUID(), title: title.trim(), author: author.trim(), pages: count, initialPage: current, status,
      ...(status !== 'want-to-read' && started ? { started } : {}), ...(match.isbn ? { isbn: match.isbn } : {}), ...(match.key ? { catalogKey: match.key } : {}) };
    try { if (onChange({ ...data, books: [...data.books, book], currentBookId: useForRead ? book.id : data.currentBookId }) !== false) onSelect(book.id, current); else setError('The book could not be saved. Please try again.'); }
    catch (error) { setError((error as Error).message); }
  }}>
    <button type="button" className="text-action" onClick={onBack}>‹ Search books</button>
    <label>Title<input required value={title} onChange={event => setTitle(event.target.value)} /></label>
    <label>Author<input value={author} onChange={event => setAuthor(event.target.value)} /></label>
    <fieldset className="book-status"><legend className="eyebrow">Status</legend><div className="book-status-options">{([['want-to-read', 'Want to read'], ['reading', 'Reading'], ['finished', 'Finished']] as const).map(([value, label]) => <button type="button" key={value} aria-pressed={status === value} onClick={() => changeStatus(value)}>{label}</button>)}</div></fieldset>
    <div className="date-fields"><label>Total pages<input type="number" required min="1" step="1" value={pages} onChange={event => { setPages(event.target.value); if (status === 'finished') setPage(event.target.value); }} /></label><label>Currently on page<input type="number" required min="0" step="1" max={pages || undefined} value={status === 'finished' ? pages : page} disabled={status !== 'reading'} onChange={event => setPage(event.target.value)} /></label></div>
    {status !== 'want-to-read' && <label>Started<input type="date" max={localDate()} value={started} onChange={event => setStarted(event.target.value)} /></label>}
    <label className="metric-choice"><span>Use for the Read routine<small className="muted">Logging reading updates this book</small></span><input type="checkbox" checked={useForRead} disabled={status !== 'reading'} onChange={event => setUseForRead(event.target.checked)} /></label>
    {error && <p role="alert">{error}</p>}
    <button type="submit" className="primary-button full-width">Add to library</button>
  </form>;
}
