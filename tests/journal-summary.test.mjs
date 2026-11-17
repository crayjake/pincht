import { seedRoutines, seedDays } from './fixtures/journal.ts';
import assert from 'node:assert/strict';
import test from 'node:test';
import { daySummary } from '../src/components/home/journal-summary.ts';

import { withRoutineDays } from '../src/routines/data.ts';

test('summary automatically includes recorded metrics and completed habits, with one item per activity category', () => {
  const date = '2026-11-16';
  const data = seedRoutines(date);
  data.checkIns = [
    { routineId: 'read', date, status: 'done', minutes: 30, bookId: 'piranesi' },
    { routineId: 'alcohol', date, status: 'done', drinks: 0 },
  ];
  const climb = seedDays[0].records.find(record => record.kind === 'climb');
  const day = { date, types: ['rest'], visibleMetrics: [], metrics: { sleep: 432, weight: 72.4 }, records: [climb, { ...climb, id: 'another' }] };
  const projected = withRoutineDays([day], data, date).find(day => day.date === date);
  assert.deepEqual(daySummary(projected, data).map(({ category, label }) => [category, label]), [
    ['climb', 'climb'], ['sleep', 'sleep 7h 12m'], ['habit', 'read 30 min'], ['habit', 'alcohol-free'], ['weight', '72.4 kg'],
  ]);
  data.checkIns[1].drinks = 2;
  assert.ok(daySummary(projected, data).some(item => item.label === '2 drinks'));
});

test('empty days and skipped or missing habits produce no summary items', () => {
  const date = '2026-11-16';
  const data = seedRoutines(date);
  data.checkIns = [{ routineId: 'read', date, status: 'skipped' }];
  assert.deepEqual(daySummary({ date, types: ['training'], metrics: {}, visibleMetrics: [], records: [] }, data), []);
});
