import assert from 'node:assert/strict';
import test from 'node:test';
import { asleepMinutes, dayMatches, getNights, groupDays, rangeLabel, rehabLoads, seedDays, stageTotals } from '../src/components/home/journal-data.ts';

const day = (date, entry) => ({ date, types: [], metrics: {}, visibleMetrics: [], records: [], entry });
const entry = { title: 'Written day', body: { type: 'doc', content: [] } };

test('sample timeline groups routine days by calendar week', () => {
  const groups = groupDays(seedDays);
  assert.equal(groups[0].kind, 'entry');
  assert.deepEqual(groups.slice(1).map(group => group.days.length), [6, 7]);
  assert.equal(rangeLabel(groups[1].days), 'Mon 9 – Sat 14 Nov');
});

test('written days, missing dates, and Monday boundaries break runs', () => {
  const groups = groupDays([
    day('2026-11-08'), day('2026-11-13'), day('2026-11-09'),
    day('2026-11-11'), day('2026-11-12', entry),
  ]);
  assert.deepEqual(groups.map(group => group.kind === 'entry' ? group.day.date : group.days.map(d => d.date)), [
    ['2026-11-13'], '2026-11-12', ['2026-11-11'], ['2026-11-09'], ['2026-11-08'],
  ]);
});

test('a week can span a month boundary without splitting', () => {
  const groups = groupDays([day('2026-04-01'), day('2026-03-31'), day('2026-03-30')]);
  assert.equal(groups.length, 1);
  assert.equal(rangeLabel(groups[0].days), 'Mon 30 Mar – Wed 1 Apr');
});

test('sleep totals agree with metrics and overnight start/end times', () => {
  for (const item of seedDays) {
    const night = item.records.find(record => record.sleep).sleep;
    const totals = stageTotals(night);
    assert.ok(Math.abs(asleepMinutes(night) - item.metrics.sleep) < 0.001);
    const clock = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
    const elapsed = (clock(night.end) - clock(night.start) + 1440) % 1440;
    assert.ok(Math.abs(Object.values(totals).reduce((sum, value) => sum + value, 0) - elapsed) < 0.001);
  }
  assert.deepEqual(stageTotals(seedDays[0].records[0].sleep), { deep: 85, rem: 108, light: 239, awake: 24 });
  const nights = getNights([...seedDays].reverse());
  assert.equal(nights.length, 7);
  assert.equal(Math.round(nights.reduce((sum, night) => sum + asleepMinutes(night), 0) / 7), 442);
  assert.equal(rehabLoads.at(-1).kg - rehabLoads[0].kg, 5.5);
});

test('search includes nested rich text, record links, notes, categories, and dates', () => {
  const nested = { ...day('2026-11-15', entry), entry: { ...entry, body: { type: 'doc', content: [
    { type: 'bulletList', content: [{ type: 'listItem', content: [{ type: 'paragraph', content: [
      { type: 'text', text: 'Quiet fingers' }, { type: 'hardBreak' },
      { type: 'recordPill', attrs: { id: 'goal', label: 'Christmas goal', category: 'goal' } },
    ] }] }] },
  ] } } };
  assert.ok(dayMatches(nested, 'quiet fingers', [], '', ''));
  assert.ok(dayMatches(nested, 'christmas', [], '', ''));
  assert.ok(dayMatches(seedDays[0], 'hips in', ['climb'], '2026-11-15', '2026-11-15'));
  assert.equal(dayMatches(seedDays[0], '', [], '', '2026-11-14'), false);
  assert.equal(dayMatches(seedDays[1], '', ['goal'], '', ''), false);
});
