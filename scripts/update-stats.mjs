import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const username = 'mrglasswillbreak';
const output = fileURLToPath(new URL('../assets/generated/', import.meta.url));
const colors = ['#283025', '#50663d', '#7c9f54', '#a8ca72', '#d3ef93'];
const languageColors = ['#d3ef93', '#8db8ef', '#e7ca87', '#c7b59d', '#a7c6be', '#e7aa73', '#888f82'];
export const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
const number = value => new Intl.NumberFormat('en-US').format(value);
const label = (x, y, value, size = 16, color = '#eeefe7', extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${escapeXml(value)}</text>`;
const panel = (title, description, height, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${height}" viewBox="0 0 840 ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title><desc id="desc">${escapeXml(description)}</desc>
<rect x="1" y="1" width="838" height="${height - 2}" rx="16" fill="#101510" stroke="#30392c"/>
<g font-family="Arial, Helvetica, sans-serif">${body}</g></svg>\n`;

export function summarizeLanguages(repositories) {
  const totals = new Map();
  for (const repository of repositories) {
    if (repository.private || repository.fork) continue;
    for (const [language, bytes] of Object.entries(repository.languages)) {
      if (!Number.isFinite(bytes) || bytes < 0) throw new Error('Invalid language byte count');
      totals.set(language, (totals.get(language) ?? 0) + bytes);
    }
  }
  const sorted = [...totals].filter(([, bytes]) => bytes > 0).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const total = sorted.reduce((sum, [, bytes]) => sum + bytes, 0);
  const selected = sorted.slice(0, 6);
  if (sorted.length > 6) selected.push(['Other', sorted.slice(6).reduce((sum, [, bytes]) => sum + bytes, 0)]);
  return selected.map(([name, bytes]) => ({ name, bytes, percent: bytes / total * 100 }));
}

export function renderGraphics({ repositories, followers, calendar, updated }) {
  const original = repositories.filter(repo => !repo.private && !repo.fork);
  const stars = original.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const metrics = [[original.length, 'Public repos', 'Original repositories'], [stars, 'Stars earned', 'On those repositories'], [followers, 'Followers', 'GitHub community'], [calendar.totalContributions, 'Contributions', 'Calendar below']];
  const summary = panel('GitHub at a glance', metrics.map(([value, name]) => `${name}: ${number(value)}`).join('. '), 200,
    label(28, 36, 'GITHUB / AT A GLANCE', 14, '#d3ef93', 'letter-spacing="2"') +
    label(812, 36, `Updated ${updated} UTC`, 12, '#a4afa0', 'text-anchor="end"') +
    metrics.map(([value, name, detail], index) => {
      const x = 28 + index * 202;
      return (index ? `<path d="M${x - 16} 65v105" stroke="#30392c"/>` : '') + label(x, 109, number(value), 36) + label(x, 141, name, 16, '#d3ef93') + label(x, 165, detail, 12, '#a4afa0');
    }).join(''));

  const languages = summarizeLanguages(original);
  const languageHeight = Math.max(200, 114 + languages.length * 42);
  const languageChart = panel('Languages across public repositories', 'Language share by GitHub-reported code bytes in owned, non-fork public repositories. This measures repository composition, not proficiency.', languageHeight,
    label(28, 36, 'LANGUAGES / PUBLIC CODE', 14, '#d3ef93', 'letter-spacing="2"') +
    label(28, 63, 'Share of code bytes in original public repositories · not a skill rating', 14, '#a4afa0') +
    (languages.length ? languages.map((language, index) => {
      const y = 100 + index * 42;
      return label(28, y + 13, language.name, 16) + `<rect x="180" y="${y}" width="540" height="16" rx="4" fill="#283025"/><rect x="180" y="${y}" width="${(language.percent * 5.4).toFixed(2)}" height="16" rx="4" fill="${languageColors[index]}"/>` + label(812, y + 13, `${language.percent.toFixed(1)}%`, 16, '#eeefe7', 'text-anchor="end"');
    }).join('') : label(28, 120, 'No language data available yet.', 16, '#a4afa0')));

  const weeks = calendar.weeks;
  const days = weeks.flatMap(week => week.contributionDays);
  if (!days.length || !Number.isFinite(calendar.totalContributions)) throw new Error('Missing contribution calendar');
  const step = Math.min(14, 744 / weeks.length);
  const levels = { NONE: 0, FIRST_QUARTILE: 1, SECOND_QUARTILE: 2, THIRD_QUARTILE: 3, FOURTH_QUARTILE: 4 };
  const calendarBody = weeks.map((week, weekIndex) => week.contributionDays.map(day => {
    const x = 62 + weekIndex * step;
    const y = 105 + day.weekday * 15;
    const month = day.date.slice(8) <= '07' && day.weekday === 0
      ? label(x, 91, new Date(`${day.date}T12:00:00Z`).toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), 11, '#a4afa0') : '';
    if (!(day.contributionLevel in levels) || !Number.isFinite(day.contributionCount) || day.weekday < 0 || day.weekday > 6) throw new Error('Invalid contribution day');
    return month + `<rect x="${x.toFixed(2)}" y="${y}" width="${(step - 3).toFixed(2)}" height="12" rx="2" fill="${colors[levels[day.contributionLevel]]}"><title>${escapeXml(`${day.date}: ${number(day.contributionCount)} contributions`)}</title></rect>`;
  }).join('')).join('');
  const activity = panel('GitHub contribution activity', `${number(calendar.totalContributions)} contributions from ${days[0].date} to ${days.at(-1).date}. Counts follow GitHub contribution rules and visibility.`, 270,
    label(28, 36, 'ACTIVITY / A YEAR OF BUILDING', 14, '#d3ef93', 'letter-spacing="2"') +
    label(28, 63, `${number(calendar.totalContributions)} contributions · ${days[0].date} — ${days.at(-1).date}`, 14, '#a4afa0') +
    label(28, 130, 'Mon', 11, '#a4afa0') + label(28, 160, 'Wed', 11, '#a4afa0') + label(28, 190, 'Fri', 11, '#a4afa0') + calendarBody +
    label(28, 244, 'Activity follows GitHub contribution rules and visibility.', 12, '#a4afa0') +
    label(652, 244, 'Less', 12, '#a4afa0') + colors.map((color, index) => `<rect x="${688 + index * 16}" y="233" width="12" height="12" rx="2" fill="${color}"/>`).join('') + label(812, 244, 'More', 12, '#a4afa0', 'text-anchor="end"'));
  return { 'overview.svg': summary, 'languages.svg': languageChart, 'activity.svg': activity };
}

export async function updateStats({ token = process.env.GH_TOKEN, fetcher = fetch, directory = output } = {}) {
  if (!token) throw new Error('Set GH_TOKEN to a GitHub token; the workflow uses its built-in GITHUB_TOKEN.');
  async function request(route, body) {
    const response = await fetcher(`https://api.github.com/${route}`, {
      method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': `${username}-profile` },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) throw new Error(`GitHub request failed (${response.status}); existing graphics retained.`);
    const data = await response.json();
    if (data.errors) throw new Error('GitHub GraphQL request failed; existing graphics retained.');
    return data;
  }
  const [user, contributions] = await Promise.all([
    request(`users/${username}`),
    request('graphql', { query: `query { user(login: "${username}") { contributionsCollection { contributionCalendar { totalContributions weeks { contributionDays { date weekday contributionCount contributionLevel } } } } } }` }),
  ]);
  const repositories = [];
  for (let page = 1; ; page++) {
    const batch = await request(`users/${username}/repos?type=owner&per_page=100&page=${page}`);
    repositories.push(...batch.filter(repo => !repo.private && !repo.fork));
    if (batch.length < 100) break;
  }
  for (let offset = 0; offset < repositories.length; offset += 4) {
    await Promise.all(repositories.slice(offset, offset + 4).map(async repo => {
      repo.languages = await request(`repos/${username}/${encodeURIComponent(repo.name)}/languages`);
    }));
  }
  const graphics = renderGraphics({ repositories, followers: user.followers, calendar: contributions.data.user.contributionsCollection.contributionCalendar, updated: new Date().toISOString().slice(0, 10) });
  await mkdir(directory, { recursive: true });
  for (const [name, svg] of Object.entries(graphics)) await writeFile(path.join(directory, `${name}.tmp`), svg);
  for (const name of Object.keys(graphics)) await rename(path.join(directory, `${name}.tmp`), path.join(directory, name));
  console.log('Updated overview, language, and contribution graphics.');
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  updateStats().catch(error => { console.error(error.message); process.exitCode = 1; });
}
