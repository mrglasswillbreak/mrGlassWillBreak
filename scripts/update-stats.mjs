import { mkdir, writeFile, rename } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { renderGraphics } from './graphics.mjs';
export { renderGraphics, summarizeLanguages, escapeXml } from './graphics.mjs';

const username = 'mrglasswillbreak';
const output = fileURLToPath(new URL('../assets/generated/', import.meta.url));

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
