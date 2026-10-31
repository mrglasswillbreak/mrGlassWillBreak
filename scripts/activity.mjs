const DAY = 86_400_000;
const dateKey = value => new Date(value).toISOString().slice(0, 10);

export function summarizeActivity(calendar, asOf) {
  const end = Date.parse(`${asOf}T00:00:00Z`);
  if (!Number.isFinite(end)) throw new Error('Invalid activity date');
  const daily = new Map();
  for (const day of calendar.weeks.flatMap(week => week.contributionDays)) {
    const timestamp = Date.parse(`${day.date}T00:00:00Z`);
    if (!Number.isFinite(timestamp) || dateKey(timestamp) !== day.date || !Number.isInteger(day.contributionCount) || day.contributionCount < 0) throw new Error('Invalid contribution day');
    if (timestamp <= end) daily.set(day.date, day.contributionCount);
  }
  const days = [...daily].sort(([a], [b]) => a.localeCompare(b));
  if (!days.length) throw new Error('Missing contribution calendar');
  let activeDays = 0, longestStreak = 0, run = 0, previous = null;
  for (const [date, count] of days) {
    const timestamp = Date.parse(`${date}T00:00:00Z`);
    if (count > 0) {
      activeDays++;
      run = previous !== null && timestamp - previous === DAY ? run + 1 : 1;
      longestStreak = Math.max(longestStreak, run);
    } else run = 0;
    previous = timestamp;
  }
  let recent = 0;
  for (let offset = 0; offset < 30; offset++) recent += daily.get(dateKey(end - offset * DAY)) ?? 0;
  const current = new Date(end);
  const months = Array.from({ length: 12 }, (_, index) => {
    const date = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth() - 11 + index, 1));
    const key = date.toISOString().slice(0, 7);
    return {
      key,
      label: date.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }),
      year: date.getUTCFullYear(),
      total: days.reduce((sum, [day, count]) => sum + (day.startsWith(key) ? count : 0), 0),
    };
  });
  return { recent, activeDays, longestStreak, months, firstDate: days[0][0], lastDate: days.at(-1)[0] };
}
