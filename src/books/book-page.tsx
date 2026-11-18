import { BookCover } from './book-cover';
import { BookEditSheet } from './book-selector';
import { ClimbHeader } from '../climbs/climb-pages';
import { Icon } from '../components/home/journal-icons';
import { useState } from 'react';
import { ReadingSheet } from '../routines/routine-sheets';
import { addDays, bookPage, type Book, type RoutineData } from '../routines/data';
import { localDate, shortDate } from '../components/home/journal-data';

export function BookPage({ book, data, onChange }: { book: Book; data: RoutineData; onChange: (data: RoutineData) => boolean }) {
  const [logging, setLogging] = useState(false), [editing, setEditing] = useState(false);
  const [error, setError] = useState('');
  const today = localDate(), page = bookPage(data, book.id);
  const logs = data.checkIns.filter(log => log.bookId === book.id && log.status === 'done').sort((a,b) => a.date.localeCompare(b.date));
  const dates = Array.from({ length: 14 }, (_, i) => addDays(today, i - 13));
  const pages = dates.map(date => Math.max(0, Math.max(bookPage(data, book.id, date), ...logs.filter(log => log.date === date).map(log => log.page ?? 0)) - bookPage(data, book.id, date)));
  const recent = logs.filter(log => log.date >= dates[0]);
  const rate = recent.length ? (page - bookPage(data, book.id, recent[0].date)) / Math.max(1, Math.round((Date.parse(today) - Date.parse(recent[0].date))/86400000) + 1) : 0;
  const routine = data.routines.find(routine => routine.kind === 'reading');
  function logReading() {
    if (!routine?.active) { setError('Enable the Read routine before logging reading.'); return; }
    // Reuse the existing reading logger with this book selected, without changing the current book.
    setLogging(true);
  }
  return <>
    <ClimbHeader title={book.title} back="#/library/books"><button className="icon-button" aria-label="Edit book" onClick={() => setEditing(true)}><Icon name="edit" size={22} /></button></ClimbHeader>
    <div className="book-detail-heading"><BookCover book={book} /><div><p className="muted">{book.author}</p><strong className="mono">{page} / {book.pages}</strong><div className="book-progress"><div><i style={{width: `${Math.min(100,page/book.pages*100)}%`}} /></div></div></div></div>
    <div className="thing-stats"><div><strong>{rate > 0 ? Math.round(rate) : '—'}</strong><span>pages a day</span></div><div><strong>{logs.length}</strong><span>sessions</span></div><div><strong>{rate > 0 && page < book.pages ? shortDate(addDays(today, Math.ceil((book.pages-page)/rate)), {day:'numeric',month:'short'}) : page === book.pages ? 'Finished' : '—'}</strong><span>finish about</span></div></div>
    <section className="settings-section"><h2 className="eyebrow">Pages a day · 14 days</h2><div className="reading-bars" role="img" aria-label={`Pages read over the last fourteen days: ${dates.map((date,i) => `${date}: ${pages[i]}`).join(', ')}`}>{dates.map((date,i) => <div key={date} title={`${date}: ${pages[i]} pages`}><i style={{height:`${pages[i]/Math.max(1,...pages)*100}%`}} /></div>)}</div><div className="chart-endpoints mono"><span>{shortDate(dates[0],{day:'numeric',month:'short'})}</span><span>today</span></div></section>
    <section className="settings-section"><h2 className="eyebrow">Recent sessions</h2><div className="settings-list">{[...logs].reverse().map(log => <a className="settings-row" href={`#/journal/${log.date}`} key={`${log.routineId}-${log.date}`}><strong>{shortDate(log.date,{weekday:'short',day:'numeric',month:'short'})}</strong><small>+{Math.max(0,(log.page ?? bookPage(data,book.id,log.date))-bookPage(data,book.id,log.date))} pages · {log.minutes ?? 0} min</small></a>)}{!logs.length && <p className="muted">No reading sessions yet.</p>}</div></section>
    <div className="thing-actions"><button className="primary-button" onClick={logReading}>Log reading</button><button className="option" disabled={book.status === 'finished' || page === book.pages} onClick={() => onChange({...data, books:data.books.map(item => item.id === book.id ? {...item,status:'finished'} : item)})}>Finished</button></div>
    {editing && <BookEditSheet book={book} data={data} onChange={onChange} onClose={() => setEditing(false)} />}
    {error && <p role="alert">{error}</p>}
    {logging && routine && <ReadingSheet data={{...data,currentBookId:book.id}} routine={routine} date={today} onChange={next => onChange({...next,currentBookId:data.currentBookId})} onClose={() => setLogging(false)} />}
  </>;
}

export function BooksList({ data, query, onLog }: { data: RoutineData; query: string; onLog: (book: Book) => void }) {
  const books = data.books.filter(book => `${book.title} ${book.author}`.toLowerCase().includes(query.toLowerCase()));
  return <>{(['reading','want-to-read','finished'] as const).map(status => {
    const group = books.filter(book => (book.status ?? (bookPage(data,book.id) === book.pages ? 'finished' : 'reading')) === status);
    return group.length > 0 && <section className="settings-section" key={status}><h2 className="eyebrow">{status === 'want-to-read' ? 'Want to read' : status === 'reading' ? 'Reading' : 'Finished'}</h2><div className="home-list">{group.map(book => <div className="home-row" key={book.id}><a className="mini-book-cover" aria-label={`Open ${book.title}`} href={`#/library/books/book-${book.id}`}><BookCover book={book} className="cover-image" /></a><a className="home-row-body" href={`#/library/books/book-${book.id}`}><strong>{book.title}</strong><small>{book.author}</small>{status === 'reading' && <><div className="book-progress"><div><i style={{width:`${bookPage(data,book.id)/book.pages*100}%`}} /></div><span>{bookPage(data,book.id)} / {book.pages}</span></div></>}</a>{status === 'reading' && <button className="text-action habit-text" onClick={() => onLog(book)}>Log</button>}</div>)}</div></section>;
  })}{!books.length && <div className="empty-library"><div className="book-cover" aria-hidden="true" /><h2>{query ? 'No matches' : 'No books yet'}</h2><p className="muted">{query ? 'Try another title or author.' : 'Add what you are reading and log pages from the Do tab.'}</p><a className="primary-button" href="#/library/books/new">Add a book</a></div>}</>;
}
