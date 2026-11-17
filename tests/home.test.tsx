import { seedRoutines, seedDays } from './fixtures/journal.ts';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../src/components/home/home';
import LibraryPage from '../src/components/home/library-pages';
import App from '../src/App';
import { ROUTINES_KEY, type RoutineData } from '../src/routines/data';
import { DueToday } from '../src/routines/due-today';
import { chartResources, type Day } from '../src/components/home/journal-data';
import { emptyRehab, personalRehab } from '../src/rehab/data';

const saved = () => JSON.parse(localStorage.getItem(ROUTINES_KEY)!) as RoutineData;
const journal = () => JSON.parse(localStorage.getItem('pincht.journal.live')!) as Day[];
async function navigate(date?: string) {
  await act(async () => {
    window.history.replaceState(null, '', `/#/journal${date ? `/${date}` : ''}`);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });
}
async function click(name: string | RegExp, scope = screen) {
  await act(async () => { fireEvent.click(scope.getByRole('button', { name })); });
}
async function change(label: string | RegExp, value: string) {
  await act(async () => { fireEvent.change(screen.getByLabelText(label, { selector: 'input' }), { target: { value } }); });
}
beforeEach(() => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-16T12:00:00Z'));
  localStorage.clear();
  localStorage.setItem(ROUTINES_KEY, JSON.stringify(seedRoutines('2026-11-16')));
  localStorage.setItem('pincht.journal.live', JSON.stringify(seedDays));
  Object.assign(personalRehab, { ...emptyRehab(), pulleyStart: '2026-10-31', wristStart: '2026-11-16' });
  window.history.replaceState(null, '', '/#/journal');
  window.scrollTo = vi.fn();
  Object.defineProperties(HTMLDialogElement.prototype, {
    showModal: { configurable: true, value() { this.open = true; } },
    close: { configurable: true, value() { this.open = false; } },
  });
  window.matchMedia = vi.fn().mockImplementation(query => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.restoreAllMocks(); });

describe('Today and journal flows', () => {
  it.each(['card', 'todo', 'compact'] as const)('shows the %s assigned workouts inline without navigating or a Routines dropdown', async variant => {
    render(<DueToday data={seedRoutines('2026-11-16')} recentSkips={[]} sessions={[]} onChange={vi.fn()} onOpen={vi.fn()} variant={variant} />);
    const arrow = screen.getByRole('button', { name: 'Required workout' });
    expect(arrow.getAttribute('aria-expanded')).toBe('false');
    await click('Required workout');
    expect(arrow.getAttribute('aria-expanded')).toBe('true');
    expect(window.location.hash).toBe('#/journal');
    const breakdown = screen.getByRole('region', { name: 'Required workout' });
    expect(breakdown.id).toBe(arrow.getAttribute('aria-controls'));
    expect(within(breakdown).getByRole('link', { name: 'Pull-ups Open workout' }).getAttribute('href')).toBe('#/train/pull-ups-3x5');
    expect(within(breakdown).getByRole('link', { name: 'Mobility Open workout' }).getAttribute('href')).toBe('#/train/mobility');
    expect(within(breakdown).getByText('3 × 5 reps · bodyweight')).toBeTruthy();
    expect(within(breakdown).getByText('Tendon glides')).toBeTruthy();
    expect(within(breakdown).getByText('Isometric mug grips')).toBeTruthy();
    expect(within(breakdown).getByText('6 × 10 s')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Routines' })).toBeNull();
    await click('Required workout');
    expect(screen.queryByRole('region', { name: 'Required workout' })).toBeNull();
  });

  it('opens To-do with three task sections, and shares updates with the separate journal', async () => {
    window.history.replaceState(null, '', '/#/todo');
    render(<App />);
    expect(screen.getByRole('main', { name: 'To-do' })).toBeTruthy();
    for (const name of ['Today', 'This week', 'Coming up']) expect(screen.getByRole('region', { name })).toBeTruthy();
    for (const name of ['Finger rehab', 'Sleep', 'Last seven days']) expect(screen.queryByRole('region', { name })).toBeNull();
    expect(screen.queryByPlaceholderText('Journal title')).toBeNull();
    expect(screen.queryByRole('link', { name: 'The high heel worked' })).toBeNull();
    await click('Complete Read for today');
    await navigate();
    const today = screen.getByLabelText('Journal title').closest('article')!;
    expect(within(today).getByRole('region', { name: 'Today’s tasks' })).toBeTruthy();
    expect(within(today).getByRole('link', { name: 'read 20 min' })).toBeTruthy();
    expect(within(today).queryByText('read · unlogged')).toBeNull();
    expect(screen.queryByRole('region', { name: 'Sleep' })).toBeNull();
    await change('Journal title', 'Today’s notes');
    await click('Complete Alcohol-free day for today', within(today));
    expect(within(today).getByRole('button', { name: 'Clear Alcohol-free day for today' })).toBeTruthy();
    await act(async () => {
      window.history.replaceState(null, '', '/#/today');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    await navigate();
    expect((screen.getByLabelText('Journal title') as HTMLInputElement).value).toBe('Today’s notes');
    expect(screen.getByRole('button', { name: 'Clear Alcohol-free day for today' })).toBeTruthy();
    expect(saved().checkIns.filter(c => c.routineId === 'read' && c.date === '2026-11-16')).toHaveLength(1);
  });

  it('scopes Climbing tasks and days by logged activity while preserving the full journal context', async () => {
    const sleep = seedDays[0].records.find(r => r.kind === 'sleep')!;
    const climb = seedDays[0].records.find(r => r.kind === 'climb')!;
    const entry = (title: string) => ({ title, body: { type: 'doc' as const, content: [] } });
    const base = { types: [] as Day['types'], metrics: {}, visibleMetrics: [] as Day['visibleMetrics'] };
    localStorage.setItem('pincht.journal.live', JSON.stringify([
      { ...base, date: '2026-11-15', records: [climb, sleep], entry: entry('Climbing notes') },
      { ...base, date: '2026-11-14', records: [sleep], types: ['climb'], entry: entry('Rest notes') },
      { ...base, date: '2026-11-13', records: [], entry: { title: 'Remembering a climb', body: { type: 'doc', content: [{ type: 'paragraph', content: [{ type: 'recordPill', attrs: { id: climb.id, label: climb.title, category: 'climb' } }] }] } } },
    ]));
    window.history.replaceState(null, '', '/#/climbing');
    render(<App />);
    const due = within(screen.getByRole('region', { name: 'Due today' }));
    expect(due.getByRole('link', { name: /^Train/ })).toBeTruthy();
    expect(due.queryByText(/Read|Alcohol/)).toBeNull();
    expect(due.queryByText(/unlogged/)).toBeNull();
    expect(screen.getByRole('region', { name: 'Finger rehab' })).toBeTruthy();
    expect(screen.getByRole('region', { name: 'Climbing' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Sleep' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Climbing notes' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Rest notes' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Remembering a climb' })).toBeNull();
    expect(screen.getByPlaceholderText('Journal title')).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Today’s tasks' })).queryByText(/read|alcohol/i)).toBeNull();
    const written = within(screen.getByRole('link', { name: 'Climbing notes' }).closest('article')!);
    expect(written.getByRole('link', { name: /sleep/ })).toBeTruthy();
    await click(/^\d+ records$/, written);
    expect(written.getByRole('region', { name: 'Day records' })).toBeTruthy();
    await navigate();
    expect(screen.getByRole('link', { name: 'Rest notes' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Remembering a climb' })).toBeTruthy();
  });

  it('expands and collapses a written entry’s records inline without opening the journal entry', async () => {
    render(<Home />);
    const entry = screen.getByRole('link', { name: 'The high heel worked' }).closest('article')!;
    const scope = within(entry);
    const toggle = scope.getByRole('button', { name: /^\d+ records$/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(scope.queryByRole('region', { name: 'Day records' })).toBeNull();
    await click(/^\d+ records$/, scope);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(within(scope.getByRole('region', { name: 'Day records' })).getByRole('link', { name: 'Sidepull Season' })).toBeTruthy();
    expect(window.location.hash).toBe('#/journal');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
    await click(/^\d+ records$/, scope);
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(scope.queryByRole('region', { name: 'Day records' })).toBeNull();
  });

  it('bases summary pills on logged records and completed habits, excluding manual day types and skipped or unlogged habits', () => {
    const date = '2026-11-16';
    const sleep = seedDays[0].records.find(record => record.kind === 'sleep')!;
    const training = seedDays[0].records.find(record => record.kind === 'training')!;
    const day: Day = { ...seedDays[0], date, types: ['rehab'], records: [sleep, { ...sleep, id: 'another-sleep' }, training] };
    for (const status of ['done', 'skipped', undefined] as const) {
      const data = seedRoutines(date);
      data.checkIns = status ? [{ routineId: 'read', date, status, minutes: 20, bookId: 'piranesi' }] : [];
      localStorage.setItem(ROUTINES_KEY, JSON.stringify(data));
      localStorage.setItem('pincht.journal.live', JSON.stringify([day]));
      const { container, unmount } = render(<Home entryDate={date} />);
      expect(container.querySelector('.entry-date .holds')).toBeNull();
      const pills = [...container.querySelectorAll('.entry-summary .summary-item')];
      expect(pills.map(pill => pill.getAttribute('data-category'))).toEqual(status === 'done' ? ['sleep', 'training', 'habit', 'weight'] : ['sleep', 'training', 'weight']);
      expect(pills.map(pill => pill.textContent)).toEqual(status === 'done'
        ? ['sleep 7h 12m', 'training', 'read 20 min', '72.4 kg']
        : ['sleep 7h 12m', 'training', '72.4 kg']);
      expect(screen.queryByRole('button', { name: /Edit summary/ })).toBeNull();
      expect(screen.queryByText(/^read · skipped/)).toBeNull();
      expect(!!screen.queryByText('read · unlogged')).toBe(status === undefined);
      unmount();
    }
  });

  it('keeps newly skipped habits available for undo but hides saved skips on return', async () => {
    const date = '2026-11-16';
    const { unmount } = render(<Home entryDate={date} />);
    const read = within(screen.getByText('read · unlogged').closest('div')!);
    const alcohol = within(screen.getByText('alcohol-free day · unlogged').closest('div')!);
    await click('Skip', read);
    expect(read.getByText('read · skipped')).toBeTruthy();
    expect(saved().checkIns.find(c => c.routineId === 'read' && c.date === date)?.status).toBe('skipped');
    await click('Skip', alcohol);
    await click('Undo skipping Read', read);
    expect(read.getByText('read · unlogged')).toBeTruthy();
    expect(saved().checkIns.some(c => c.routineId === 'read' && c.date === date)).toBe(false);
    expect(alcohol.getByText('alcohol-free day · skipped')).toBeTruthy();
    await click('Skip', read);
    unmount();

    render(<Home entryDate={date} />);
    expect(screen.queryByText(/· skipped/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Undo skipping/ })).toBeNull();
    expect(saved().checkIns.filter(c => c.date === date && c.status === 'skipped')).toHaveLength(2);
    expect(saved().checkIns.find(c => c.routineId === 'read' && c.date === '2026-11-10')?.reason).toBe('travelling');
  });

  it('keeps an earlier routine in To-do after skipping so it can be undone', async () => {
    const { unmount } = render(<Home screen="today" />);
    const due = within(screen.getByRole('main', { name: 'To-do' }));
    expect(due.getByText('Read · Sun 15')).toBeTruthy();
    await click('Skip', due);
    expect(due.getByText('Read · Sun 15')).toBeTruthy();
    expect(due.getByText('earlier · skipped')).toBeTruthy();
    await click('Undo skipping Read', due);
    expect(due.getByText('earlier · unlogged')).toBeTruthy();
    expect(saved().checkIns.some(c => c.routineId === 'read' && c.date === '2026-11-15')).toBe(false);
    await click('Skip', due);
    unmount();

    render(<Home screen="today" />);
    const returned = within(screen.getByRole('main', { name: 'To-do' }));
    expect(returned.queryByRole('button', { name: /Undo skipping/ })).toBeNull();
    expect(returned.getByText('Read · Thu 12')).toBeTruthy();
  });

  it('links summary pills to their Library things', () => {
    const date = '2026-11-15';
    const data = seedRoutines('2026-11-16');
    data.checkIns.push({ routineId: 'read', date, status: 'done', minutes: 35, bookId: 'piranesi', page: 145 });
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(data));
    const { container } = render(<Home entryDate={date} />);
    const summary = within(container.querySelector('.entry-summary')! as HTMLElement);
    for (const [label, href] of [
      ['climb', '#/library/climbs'], ['rehab', '#/library/workouts'], ['training', '#/library/workouts'],
      ['sleep 7h 12m', '#/library/metrics/sleep'], ['72.4 kg', '#/library/metrics/weight'],
      ['goal', '#/library/goals'], ['read 35 min', '#/library/books/book-piranesi'],
      ['alcohol-free', '#/library/routines/alcohol'],
    ]) expect(summary.getByRole('link', { name: label }).getAttribute('href')).toBe(href);
  });

  it('combines logged and referenced records without duplicates or adding referenced activity to the summary', async () => {
    const training = seedDays[0].records.find(record => record.kind === 'training')!;
    const climb = seedDays[0].records.find(record => record.kind === 'climb')!;
    const chart = chartResources[0];
    const ref = (id: string, label: string, category: 'climb' | 'rehab' | 'training') => ({ type: 'recordPill' as const, attrs: { id, label, category } });
    const day: Day = { date: '2026-11-16', types: [], metrics: {}, visibleMetrics: [], records: [training], entry: {
      title: 'Looking back', body: { type: 'doc', content: [{ type: 'blockquote', content: [{ type: 'paragraph', content: [
        ref(climb.id, climb.title, 'climb'), ref(climb.id, climb.title, 'climb'),
        ref(training.id, training.title, 'training'), ref(chart.id, chart.title, 'rehab'),
      ] }] }] },
    } };
    const data = seedRoutines(day.date); data.checkIns = [];
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(data));
    localStorage.setItem('pincht.journal.live', JSON.stringify([day, seedDays[0]]));
    const { container } = render(<Home />);
    const entry = screen.getByLabelText('Journal title').closest('article')!;
    await click('3 records', within(entry));
    const records = within(within(entry).getByRole('region', { name: 'Day records' }));
    expect(records.getAllByRole('link').map(link => link.textContent)).toEqual([training.title, climb.title, chart.title]);
    expect([...entry.querySelectorAll('.entry-summary .summary-item')].map(item => item.textContent)).toEqual(['training']);
    await click('3 records', within(entry));
    expect(container.querySelector(`#records-${day.date}`)).toBeNull();
  });

  it('shows an empty composer only for today without saving it as writing, including on the following day', async () => {
    const { unmount } = render(<Home />);
    expect(screen.getByPlaceholderText('Journal title')).toBeTruthy();
    const today = screen.getByPlaceholderText('Journal title').closest('article')!;
    expect(today.querySelector('.entry-date .holds')).toBeNull();
    expect(today.querySelector('.entry-summary')).toBeNull();
    expect(screen.getAllByRole('textbox', { name: /Journal body/ }).filter(el => el.getAttribute('aria-placeholder'))).toHaveLength(1);
    expect(screen.queryByRole('button', { name: 'New entry' })).toBeNull();
    expect(journal().find(day => day.date === '2026-11-16')?.entry).toBeUndefined();
    await click('Search journal'); await click('Journal entries only');
    await click(/All filters/);
    await change('From', '2026-11-16'); await change('To', '2026-11-16'); await click('Show results');
    expect(screen.getByRole('status').textContent).toBe('0 results · journal entries');
    unmount();
    vi.setSystemTime(new Date('2026-11-17T12:00:00Z'));
    render(<Home />);
    expect(screen.getAllByPlaceholderText('Journal title')).toHaveLength(1);
    expect(screen.getByRole('button', { name: /Monday 16 November/ })).toBeTruthy();
    expect(journal().find(day => day.date === '2026-11-16')?.entry).toBeUndefined();
  });

  it('keeps today’s composer stable when focusing and completing tasks', async () => {
    render(<Home />);
    const title = screen.getByPlaceholderText('Journal title');
    const today = title.closest('article')!;
    const tasks = within(within(today).getByRole('region', { name: 'Today’s tasks' }));
    const complete = tasks.getByRole('button', { name: 'Complete Read for today' });
    const before = journal();

    expect(today.classList.contains('composer-open')).toBe(false);
    await act(async () => { complete.focus(); });
    await click('Complete Read for today', tasks);
    expect(complete.getAttribute('aria-pressed')).toBe('true');
    expect(today.classList.contains('composer-open')).toBe(false);
    const body = within(today).getByRole('textbox', { name: /Journal body/ });
    await act(async () => { body.focus(); });
    expect(today.classList.contains('composer-open')).toBe(true);
    await act(async () => { complete.focus(); });
    await click('Clear Read for today', tasks);
    expect(today.classList.contains('composer-open')).toBe(true);
    expect(screen.getByPlaceholderText('Journal title')).toBe(title);
    expect(window.location.hash).toBe('#/journal');
    expect(journal()).toEqual(before);
  });

  it('autosaves today’s title and body, and clearing both restores an unwritten day', async () => {
    const { unmount } = render(<Home />);
    await change('Journal title', 'A steady session');
    const today = screen.getByLabelText('Journal title').closest('article')!;
    const body = within(today).getByRole('textbox', { name: /Journal body/ }) as HTMLElement & { editor: Editor };
    await act(async () => { body.editor.commands.setContent('<p>Kept the intensity comfortable.</p>'); });
    await change('Journal title', '');
    expect(journal().find(day => day.date === '2026-11-16')?.entry).toMatchObject({ title: '', body: { content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Kept the intensity comfortable.' }] }] } });
    unmount();
    render(<Home />);
    const restored = within(screen.getByLabelText('Journal title').closest('article')!).getByRole('textbox', { name: /Journal body/ }) as HTMLElement & { editor: Editor };
    expect(restored.textContent).toBe('Kept the intensity comfortable.');
    await act(async () => { restored.editor.commands.clearContent(); });
    expect(journal().find(day => day.date === '2026-11-16')?.entry).toBeUndefined();
    expect(screen.getByPlaceholderText('Journal title')).toBeTruthy();
  });

  it('turns a past empty day into writing while keeping its records and persists it on return', async () => {
    render(<App />);
    await click(/Saturday 14 November/);
    const action = screen.getByRole('link', { name: 'Write journal entry' });
    expect(action.getAttribute('href')).toBe('#/journal/2026-11-14');
    await navigate('2026-11-14');
    expect(screen.queryByRole('navigation')).toBeNull();
    const original = journal().find(day => day.date === '2026-11-14')!;
    await change('Journal title', 'Quiet fingers again');
    expect(journal().find(day => day.date === '2026-11-14')?.records).toEqual(original.records);
    await navigate();
    expect(screen.getByRole('link', { name: 'Quiet fingers again' })).toBeTruthy();
    await navigate('2026-11-14');
    await change('Journal title', '');
    await navigate();
    expect(screen.getByRole('button', { name: /Saturday 14 November/ })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Quiet fingers again' })).toBeNull();
  });

  it('does not insert sample writing into saved journal days', () => {
    const days = structuredClone(seedDays).map(day => ({ ...day, entry: undefined }));
    localStorage.setItem('pincht.journal.live', JSON.stringify(days));
    render(<Home />);
    expect(screen.queryByRole('link', { name: 'Stopped while the skin was good' })).toBeNull();
    expect(journal().every(day => !day.entry)).toBe(true);
  });
  it('quick completion saves usual reading time without invented pages and keeps unfinished rehab visible', async () => {
    render(<Home screen="today" />);
    expect(within(screen.getByRole('navigation', { name: 'Primary' })).getAllByRole('link').map(link => link.getAttribute('aria-label'))).toEqual(['Journal', 'Do', 'Library']);
    expect(screen.queryByRole('img', { name: '0 of 3 workouts' })).toBeNull();
    expect(within(screen.getByRole('region', { name: 'This week' })).getByRole('link', { name: /^Train.*0 of 3 this week/ }).getAttribute('href')).toBe('#/train/pull-ups-3x5');
    await click('Complete Read for today');
    expect(saved().checkIns.find(c => c.routineId === 'read' && c.date === '2026-11-16')).toMatchObject({ minutes: 20, bookId: 'piranesi' });
    expect(saved().checkIns.find(c => c.routineId === 'read' && c.date === '2026-11-16')?.page).toBeUndefined();
    await click('Complete Alcohol-free day for today');
    expect(screen.getByText(/2 of 3 done today/)).toBeTruthy();
    expect(within(screen.getByRole('region', { name: 'Today' })).getByRole('link', { name: 'Open Pulley rehab' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Clear Read for today' })).toBeTruthy();
    await click('Clear Read for today');
    expect(saved().checkIns.some(c => c.routineId === 'read' && c.date === '2026-11-16')).toBe(false);
  });

  it('logs reading against yesterday and updates the book while leaving today due', async () => {
    render(<Home screen="today" />);
    await click('Open Read');
    expect(screen.queryByText('Awaiting UI/UX pass')).toBeNull();
    await click(/Yesterday · Sun 15/);
    await click('30 min');
    await change('Now on page', '128');
    await click('Save reading');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(saved().checkIns.find(c => c.routineId === 'read' && c.date === '2026-11-15')).toMatchObject({ status: 'done', minutes: 30, page: 128 });
    expect(saved().checkIns.some(c => c.routineId === 'read' && c.date === '2026-11-16')).toBe(false);
    expect(screen.getByRole('button', { name: 'Complete Read for today' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Read\s*daily.*Piranesi.*p.128/ })).toBeTruthy();
  });

  it('marks the additional book screen as in development and saves a newly selected book', async () => {
    render(<Home screen="today" />);
    await click('Open Read'); await click('Change');
    expect(screen.getByText('In development')).toBeTruthy();
    expect(screen.getByText('Awaiting UI/UX pass')).toBeTruthy();
    await change('Title', 'A new book'); await change('Author', 'An author');
    await change('Total pages', '300'); await change('Current page', '12');
    await click('Add and select book');
    expect(screen.getByRole('heading', { name: 'Log reading' })).toBeTruthy();
    expect((screen.getByLabelText('Now on page') as HTMLInputElement).value).toBe('12');
    await click('Save reading');
    const data = saved();
    expect(data.books.find(b => b.id === data.currentBookId)).toMatchObject({ title: 'A new book', pages: 300 });
    expect(data.checkIns.find(c => c.routineId === 'read' && c.date === '2026-11-16')?.bookId).toBe(data.currentBookId);
  });

  it('bulk alcohol logging and Skip all persist independently when dismissing welcome back', async () => {
    const data = seedRoutines('2026-11-11');
    data.checkIns = data.checkIns.filter(c => c.date < '2026-11-11');
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(data));
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'You were away 5 days' })).toBeTruthy();
    await click('No drinks on all 5');
    await click('Skip all 5');
    expect(screen.queryByRole('dialog')).toBeNull();
    const logged = saved().checkIns.filter(c => c.date >= '2026-11-11');
    expect(logged).toHaveLength(10);
    expect(logged.filter(c => c.routineId === 'alcohol').every(c => c.status === 'done' && c.drinks === 0)).toBe(true);
    expect(logged.filter(c => c.routineId === 'read').every(c => c.status === 'skipped')).toBe(true);
    expect(saved().checkIns.find(c => c.date === '2026-11-10' && c.routineId === 'read')?.reason).toBe('travelling');
    expect(saved().lastVisit).toBe('2026-11-16');
  });

  it('search shows individual records and entries, applies filters, and restores navigation on Cancel', async () => {
    render(<Home />);
    await click('Search journal');
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New entry' })).toBeNull();
    await change('Search journal', 'sidepull');
    await click('Climb');
    expect(screen.getByRole('status').textContent).toBe('2 results · climb records and entries');
    expect(screen.getByRole('button', { name: 'Sidepull Season' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'The high heel worked' }).getAttribute('href')).toBe('#/journal/2026-11-15');
    await click(/All filters/);
    expect(screen.getByText('Awaiting UI/UX pass')).toBeTruthy();
    await change('From', '2026-11-16'); await click('Show results');
    expect(screen.getByRole('status').textContent).toContain('0 results');
    await click('Cancel');
    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeTruthy();
  });

  it('pins the existing search controls only when the journal heading reaches the safe top', async () => {
    render(<Home />);
    const heading = document.querySelector('.journal-heading') as HTMLElement;
    heading.style.top = '50px';
    let top = 300;
    vi.spyOn(heading, 'getBoundingClientRect').mockImplementation(() => ({ top, bottom: top + 44, height: 44, width: 343, left: 16, right: 359, x: 16, y: top, toJSON: () => ({}) }));
    const search = screen.getByRole('button', { name: 'Search journal' });
    await act(async () => { fireEvent.scroll(window); });
    expect(heading.classList.contains('is-pinned')).toBe(false);
    top = 51;
    await act(async () => { fireEvent.scroll(window); });
    expect(heading.classList.contains('is-pinned')).toBe(false);
    top = 50;
    await act(async () => { fireEvent.scroll(window); });
    expect(heading.classList.contains('is-pinned')).toBe(true);
    expect(screen.getAllByRole('button', { name: 'Search journal' })).toEqual([search]);
    expect(search.closest('header')).toBe(heading);
    top = 90;
    await act(async () => { fireEvent.scroll(window); });
    expect(heading.classList.contains('is-pinned')).toBe(false);
  });

  it('filters to written journal entries, combines with category/date filters, and resets', async () => {
    render(<Home />);
    await click('Search journal');
    await change('Search journal', 'sidepull');
    await click('Journal entries only');
    expect(screen.getByRole('status').textContent).toBe('1 result · journal entries');
    expect(screen.queryByRole('button', { name: 'Sidepull Season' })).toBeNull();
    expect(screen.getByRole('link', { name: 'The high heel worked' })).toBeTruthy();
    await click('Climb');
    expect(screen.getByRole('status').textContent).toBe('1 result · journal entries');
    await click(/All filters/);
    expect((screen.getByRole('checkbox', { name: 'Journal entries only' }) as HTMLInputElement).checked).toBe(true);
    await change('From', '2026-11-16'); await click('Show results');
    expect(screen.getByRole('status').textContent).toBe('0 results · journal entries');
    await click(/All filters/); await click('Reset filters'); await click('Show results');
    expect(screen.getByRole('button', { name: 'Journal entries only' }).getAttribute('aria-pressed')).toBe('false');
    expect(screen.getByRole('button', { name: 'Sidepull Season' })).toBeTruthy();
  });

  it('routes to an expanded entry with all records and no bottom navigation or new-entry button', async () => {
    render(<App />);
    await act(async () => {
      window.history.replaceState(null, '', '/#/journal/2026-11-15');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(screen.getByRole('main', { name: 'Expanded journal entry' })).toBeTruthy();
    expect((screen.getByLabelText('Journal title') as HTMLInputElement).value).toBe('The high heel worked');
    expect(screen.getByRole('link', { name: 'Back to Journal' }).getAttribute('href')).toBe('#/journal');
    expect(screen.queryByRole('navigation')).toBeNull();
    expect(screen.queryByRole('button', { name: 'New entry' })).toBeNull();
    expect(document.querySelectorAll('.day-record')).toHaveLength(6);
  });

  it('keeps additional destinations visibly in development', () => {
    const { rerender } = render(<LibraryPage category="climbs" onDataMode={vi.fn()} />);
    expect(screen.getByText('Awaiting UI/UX pass')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('aria-current')).toBe('page');
    rerender(<LibraryPage category="metrics" onDataMode={vi.fn()} />);
    expect(screen.getByText('In development')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Metrics' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Library' }).getAttribute('aria-current')).toBe('page');
  });

  it('does not consume the welcome-back visit when opening an additional destination first', () => {
    const data = seedRoutines('2026-11-11');
    data.checkIns = data.checkIns.filter(c => c.date < '2026-11-11');
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(data));
    const { unmount } = render(<LibraryPage category="metrics" onDataMode={vi.fn()} />);
    expect(saved().lastVisit).toBe('2026-11-11');
    unmount();
    render(<Home />);
    expect(screen.getByRole('heading', { name: 'You were away 5 days' })).toBeTruthy();
  });
});
