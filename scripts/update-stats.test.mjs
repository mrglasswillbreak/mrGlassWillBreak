import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { summarizeLanguages, renderGraphics, updateStats } from './update-stats.mjs';
import { summarizeActivity } from './activity.mjs';

test('language percentages exclude private repositories and forks, and retain the long tail', () => {
  const result = summarizeLanguages([
    { languages: { JavaScript: 300, TypeScript: 100, CSS: 50, HTML: 20, Python: 10, Shell: 10, Ruby: 5, Go: 5 } },
    { languages: { TypeScript: 500 }, private: true },
    { languages: { Python: 900 }, fork: true },
  ]);
  assert.equal(result[0].name, 'JavaScript');
  assert.equal(result[0].percent, 60);
  assert.equal(result.at(-1).name, 'Other');
  assert.equal(result.at(-1).percent, 2);
  assert.ok(Math.abs(result.reduce((sum, item) => sum + item.percent, 0) - 100) < 0.0001);
  assert.deepEqual(summarizeLanguages([{ languages: {} }]), []);
});

test('graphics escape labels and preserve zero-activity and partial-week calendars', () => {
  const graphics = renderGraphics({
    repositories: [{ languages: { 'A&B <code>': 12 }, stargazers_count: 3 }], followers: 0, updated: '2026-10-31',
    calendar: { totalContributions: 0, weeks: [{ contributionDays: [{ date: '2026-10-31', weekday: 6, contributionCount: 0, contributionLevel: 'NONE' }] }] },
  });
  assert.match(graphics['languages.svg'], /A&amp;B &lt;code&gt;/);
  assert.match(graphics['activity.svg'], /Oct 2026: 0 contributions/);
  assert.match(graphics['overview.svg'], /Stars earned: 3/);
  for (const svg of Object.values(graphics)) {
    assert.doesNotMatch(svg, /NaN|undefined|Infinity|<script|<foreignObject/);
    assert.match(svg, /prefers-reduced-motion: reduce/);
    assert.match(svg, /@keyframes/);
  }
});

test('activity handles year boundaries, missing days, partial months, and future dates', () => {
  const calendar = { weeks: [{ contributionDays: [
    { date: '2025-12-30', contributionCount: 2 },
    { date: '2025-12-31', contributionCount: 3 },
    { date: '2026-01-01', contributionCount: 4 },
    { date: '2026-01-03', contributionCount: 5 },
    { date: '2026-01-04', contributionCount: 0 },
    { date: '2026-01-06', contributionCount: 100 },
  ] }] };
  const result = summarizeActivity(calendar, '2026-01-05');
  assert.equal(result.activeDays, 4);
  assert.equal(result.longestStreak, 3);
  assert.equal(result.recent, 14);
  assert.equal(result.months.length, 12);
  assert.equal(result.months[0].key, '2025-02');
  assert.equal(result.months.at(-2).total, 5);
  assert.equal(result.months.at(-1).total, 9);
});

test('recent activity uses an inclusive 30-day UTC window and zero days break streaks', () => {
  const result = summarizeActivity({ weeks: [{ contributionDays: [
    { date: '2026-09-30', contributionCount: 100 },
    { date: '2026-10-01', contributionCount: 100 },
    { date: '2026-10-02', contributionCount: 3 },
    { date: '2026-10-03', contributionCount: 0 },
    { date: '2026-10-04', contributionCount: 5 },
    { date: '2026-10-31', contributionCount: 2 },
  ] }] }, '2026-10-31');
  assert.equal(result.recent, 10);
  assert.equal(result.longestStreak, 3);
  assert.equal(result.activeDays, 5);
  assert.throws(() => summarizeActivity({ weeks: [{ contributionDays: [{ date: '2026-02-30', contributionCount: 2 }] }] }, '2026-10-31'), /Invalid contribution day/);
});

test('failed API requests leave the last successful graphics intact', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'profile-stats-'));
  try {
    await writeFile(path.join(directory, 'overview.svg'), 'last successful graphic');
    await assert.rejects(updateStats({ token: 'test', directory, fetcher: async () => ({ ok: false, status: 503 }) }), /503/);
    assert.equal(await readFile(path.join(directory, 'overview.svg'), 'utf8'), 'last successful graphic');
  } finally {
    await rm(path.join(directory, 'overview.svg'), { force: true });
    await rmdir(directory);
  }
});
