import { useEffect, useState } from 'react';
import { bookCoverUrl, searchBooks, type BookMatch } from './catalog';

/** Keep the existing cover slots; resolve older, manually added titles through the same catalogue. */
export function BookCover({ book, className = 'book-cover' }: { book: { title: string; author: string; isbn?: string; catalogKey?: string; coverUrl?: string; key?: string }; className?: string }) {
  const source = bookCoverUrl(book);
  const query = `${book.title} ${book.author}`.trim();
  const [resolved, setResolved] = useState<{ query: string; match: BookMatch }>();
  useEffect(() => {
    if (source || !query) return;
    const controller = new AbortController();
    searchBooks(query, controller.signal).then(matches => {
      const match = matches.find(match => match.title.toLowerCase() === book.title.toLowerCase() && (!book.author || match.author.toLowerCase().includes(book.author.toLowerCase())));
      if (match && !controller.signal.aborted) setResolved({ query, match });
    }).catch(() => { /* Keep the existing placeholder if offline or the title has no cover. */ });
    return () => controller.abort();
  }, [source, query, book.title, book.author]);
  const url = source ?? (resolved?.query === query ? bookCoverUrl(resolved.match) : undefined);
  return <span className={className} aria-hidden="true">{url && <img key={url} src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span>;
}
