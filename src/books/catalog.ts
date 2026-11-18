export interface BookMatch {
  key: string; title: string; author: string; pages?: number; year?: string; isbn?: string;
}
type Json = Record<string, any>;
const positivePages = (value: unknown): number | undefined => typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : undefined;
const object = (value: unknown): Json => value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const isbns = (value: unknown): string[] => Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').flatMap(item => normaliseIsbn(item) ?? []) : [];

/** Accept ISBNs, never a non-book EAN or a barcode with an invalid check digit. */
export function normaliseIsbn(value: string): string | undefined {
  const isbn = value.replace(/^ISBN(?:-1[03])?:?\s*/i, '').replace(/[\s-]/g, '').toUpperCase();
  if (/^\d{9}[\dX]$/.test(isbn)) {
    const sum = [...isbn].reduce((total, digit, i) => total + (digit === 'X' ? 10 : Number(digit)) * (10 - i), 0);
    return sum % 11 === 0 ? isbn : undefined;
  }
  if (!/^97[89]\d{10}$/.test(isbn)) return;
  return [...isbn].reduce((sum, digit, i) => sum + Number(digit) * (i % 2 ? 3 : 1), 0) % 10 === 0 ? isbn : undefined;
}

async function request(url: string, signal?: AbortSignal): Promise<Json> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = setTimeout(abort, 20_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(response.status === 429 ? 'Book search is busy. Please try again shortly, or add the book manually.' : 'Book search is unavailable. Try again or add the book manually.');
    return object(await response.json());
  } catch (error) {
    if (signal?.aborted) throw error;
    if (error instanceof TypeError || controller.signal.aborted) throw new Error('Book search could not connect. Check your connection, or add the book manually.');
    throw error;
  } finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
export function parseSearchResults(value: unknown): BookMatch[] {
  const docs = object(value).docs;
  if (!Array.isArray(docs)) return [];
  return docs.flatMap((item: unknown) => {
    const work = object(item), edition = object(work.editions?.docs?.[0]);
    const key = edition.key ?? work.key;
    if (typeof key !== 'string' || typeof work.title !== 'string') return [];
    return [{ key, title: typeof edition.title === 'string' ? edition.title : work.title,
      author: Array.isArray(work.author_name) ? work.author_name.filter((v: unknown) => typeof v === 'string').join(', ') : '',
      pages: positivePages(edition.number_of_pages), year: typeof edition.publish_date === 'string' ? edition.publish_date : typeof work.first_publish_year === 'number' ? String(work.first_publish_year) : undefined,
      isbn: isbns(edition.isbn)[0] }];
  }).filter((match, index, matches) => matches.findIndex(value => value.key === match.key) === index);
}
const cache = new Map<string, BookMatch[]>();
export async function searchBooks(query: string, signal?: AbortSignal): Promise<BookMatch[]> {
  const term = query.trim();
  if (term.length < 2) return [];
  const cached = cache.get(term.toLowerCase());
  if (cached) return cached;
  const isbn = normaliseIsbn(term);
  let matches: BookMatch[];
  if (isbn) {
    const data = await request(`https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`, signal);
    const book = object(data[`ISBN:${isbn}`]);
    matches = typeof book.title === 'string' ? [{ key: typeof book.key === 'string' ? book.key : `ISBN:${isbn}`, title: book.title, author: Array.isArray(book.authors) ? book.authors.map((a: unknown) => object(a).name).filter((name: unknown) => typeof name === 'string').join(', ') : '', pages: positivePages(book.number_of_pages), year: typeof book.publish_date === 'string' ? book.publish_date : undefined, isbn }] : [];
  } else {
    const params = new URLSearchParams({ q: term, limit: '12', lang: 'en', fields: 'key,title,author_name,first_publish_year,editions,editions.key,editions.title,editions.isbn,editions.number_of_pages,editions.publish_date' });
    matches = parseSearchResults(await request(`https://openlibrary.org/search.json?${params}`, signal));
  }
  // Small in-memory cache only; the user's library is stored separately and works offline.
  if (cache.size >= 30) cache.delete(cache.keys().next().value!);
  cache.set(term.toLowerCase(), matches);
  return matches;
}
export async function bookDetails(match: BookMatch, signal?: AbortSignal): Promise<BookMatch> {
  if (!/^\/books\/OL\d+M$/.test(match.key)) return match;
  const edition = await request(`https://openlibrary.org${match.key}.json`, signal);
  return { ...match, title: typeof edition.title === 'string' ? edition.title : match.title,
    pages: positivePages(edition.number_of_pages), year: typeof edition.publish_date === 'string' ? edition.publish_date : match.year,
    isbn: isbns(edition.isbn_13)[0] ?? isbns(edition.isbn_10)[0] ?? match.isbn };
}
