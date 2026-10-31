import { summarizeActivity } from './activity.mjs';

const palette = ['#d3ef93', '#8db8ef', '#e7ca87', '#c7b59d', '#a7c6be', '#e7aa73', '#888f82'];
export const escapeXml = value => String(value).replace(/[<>&"']/g, char => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' })[char]);
const number = value => new Intl.NumberFormat('en-US').format(value);
const label = (x, y, value, size = 16, color = '#eef2e8', extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" ${extra}>${escapeXml(value)}</text>`;
const muted = '#a5b39d';

// Static SVG geometry is the complete chart. Animation is progressive enhancement.
// No scripts, foreignObject, external fonts, or external resources are needed.
const motion = `<style>
  .bar { transform-box: fill-box; transform-origin: left center; animation: grow 12s cubic-bezier(.2,.7,.2,1) infinite; }
  .column { transform-box: fill-box; transform-origin: center bottom; animation: rise 12s cubic-bezier(.2,.7,.2,1) infinite; }
  .ring { animation: draw 12s cubic-bezier(.2,.7,.2,1) infinite; }
  .signal { animation: signal 6s ease-in-out infinite; }
  .trace { stroke-dasharray: 70 770; animation: trace 12s linear infinite; }
  @keyframes grow { 0%,4% { transform: scaleX(.02); } 22%,100% { transform: scaleX(1); } }
  @keyframes rise { 0%,4% { transform: scaleY(.02); } 22%,100% { transform: scaleY(1); } }
  @keyframes draw { 0%,4% { stroke-dasharray: 0 var(--circumference); } 22%,100% { stroke-dasharray: var(--segment); } }
  @keyframes signal { 0%,100% { opacity: .35; } 50% { opacity: 1; } }
  @keyframes trace { from { stroke-dashoffset: 840; } to { stroke-dashoffset: 0; } }
  @media (prefers-reduced-motion: reduce) { .bar,.column,.ring,.signal,.trace { animation: none !important; } }
</style>`;

function panel(title, description, height, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="840" height="${height}" viewBox="0 0 840 ${height}" role="img" aria-labelledby="title desc">
<title id="title">${escapeXml(title)}</title><desc id="desc">${escapeXml(description)}</desc>
<defs>
  <linearGradient id="surface" x2="1" y2="1"><stop stop-color="#182319"/><stop offset="1" stop-color="#0d1413"/></linearGradient>
  <linearGradient id="lime" x2="0" y2="1"><stop stop-color="#e0f6b1"/><stop offset="1" stop-color="#799e58"/></linearGradient>
  <linearGradient id="blue" x2="0" y2="1"><stop stop-color="#b2d2ff"/><stop offset="1" stop-color="#538cbb"/></linearGradient>
  <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse"><path d="M28 0H0V28" fill="none" stroke="#354534" stroke-opacity=".16"/></pattern>
</defs>${motion}
<rect x="1" y="1" width="838" height="${height - 2}" rx="20" fill="url(#surface)" stroke="#344334"/>
<rect x="2" y="2" width="836" height="${height - 4}" rx="20" fill="url(#grid)"/>
<path d="M24 1H816" stroke="#d3ef93" stroke-opacity=".7" class="trace"/>
<g font-family="Arial, Helvetica, sans-serif">${body}</g></svg>\n`;
}

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
  if (!Number.isInteger(calendar.totalContributions) || calendar.totalContributions < 0) throw new Error('Missing contribution total');
  const original = repositories.filter(repo => !repo.private && !repo.fork);
  const stars = original.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const activity = summarizeActivity(calendar, updated);
  const metrics = [[calendar.totalContributions, 'Contributions', 'Past year', '#d3ef93'], [original.length, 'Public repos', 'Original repositories', '#8db8ef'], [stars, 'Stars earned', 'On those repositories', '#e7ca87'], [followers, 'Followers', 'GitHub community', '#a7c6be']];
  const overview = panel('GitHub at a glance', metrics.map(([value, name]) => `${name}: ${number(value)}`).join('. '), 236,
    label(28, 34, '01 / GITHUB AT A GLANCE', 12, '#d3ef93', 'letter-spacing="2"') +
    label(812, 34, `Updated ${updated} UTC`, 12, muted, 'text-anchor="end"') +
    label(28, 68, 'Building, one contribution at a time.', 24) +
    metrics.map(([value, name, detail, color], index) => {
      const x = 28 + index * 200;
      return `<rect x="${x}" y="92" width="184" height="116" rx="12" fill="#111b17" stroke="#314332"/>` +
        `<circle class="signal" style="animation-delay:${index * .5}s" cx="${x + 161}" cy="110" r="3" fill="${color}"/>` +
        label(x + 16, 140, number(value), 34, color, 'font-weight="600"') + label(x + 16, 168, name, 15) + label(x + 16, 190, detail, 12, muted);
    }).join(''));

  const maximum = Math.max(1, ...activity.months.map(month => month.total));
  const scale = Math.max(4, Math.ceil(maximum / (maximum > 100 ? 100 : 10)) * (maximum > 100 ? 100 : 10));
  const baseline = 356, graphHeight = 164;
  const grid = Array.from({ length: 5 }, (_, index) => {
    const y = baseline - index * graphHeight / 4;
    return `<path d="M65 ${y}H802" stroke="#354534" stroke-dasharray="3 6"/>` + label(52, y + 4, number(Math.round(scale * index / 4)), 11, muted, 'text-anchor="end"');
  }).join('');
  const bars = activity.months.map((month, index) => {
    const x = 79 + index * 60;
    const height = month.total / scale * graphHeight;
    return `<rect x="${x}" y="192" width="34" height="164" rx="5" fill="#d3ef93" opacity=".025"/>` +
      `<rect class="column" style="animation-delay:${(index * .06).toFixed(2)}s" x="${x}" y="${baseline - height}" width="34" height="${height}" rx="5" fill="url(#${index === 11 ? 'blue' : 'lime'})"><title>${escapeXml(`${month.label} ${month.year}: ${number(month.total)} contributions`)}</title></rect>` +
      label(x + 17, baseline - height - 10, number(month.total), 12, index === 11 ? '#b2d2ff' : '#d3ef93', 'text-anchor="middle"') +
      label(x + 17, 378, month.label, 12, muted, 'text-anchor="middle"') +
      ((index === 0 || month.label === 'Jan') ? label(x + 17, 395, month.year, 10, muted, 'text-anchor="middle"') : '');
  }).join('');
  const rhythm = panel('Monthly contribution activity', `Last 30 days: ${number(activity.recent)} contributions. Active days: ${activity.activeDays}. Longest streak in the returned calendar: ${activity.longestStreak} days. ${activity.months.map(m => `${m.label} ${m.year}: ${m.total} contributions`).join('. ')}.`, 442,
    label(28, 34, '02 / CONTRIBUTION RHYTHM', 12, '#d3ef93', 'letter-spacing="2"') +
    label(28, 68, 'The shape of a year’s work.', 24) +
    [[activity.recent, 'CONTRIBUTIONS / LAST 30 DAYS'], [activity.activeDays, 'ACTIVE DAYS / PAST YEAR'], [activity.longestStreak, 'BEST STREAK / DAYS IN A ROW']].map(([value, name], index) => {
      const x = 28 + index * 270;
      return label(x, 112, number(value), 30, index === 0 ? '#8db8ef' : '#eef2e8') + label(x, 138, name, 10, muted, 'letter-spacing=".8"');
    }).join('') + grid + bars + label(28, 423, 'Monthly contributions · latest 12 months · the blue bar is the current month so far', 12, muted));

  const languages = summarizeLanguages(original);
  const languageCount = new Set(original.flatMap(repo => Object.entries(repo.languages).filter(([, bytes]) => bytes > 0).map(([name]) => name))).size;
  let offset = 0;
  const circumference = 2 * Math.PI * 91;
  const rings = languages.map((language, index) => {
    const length = language.percent / 100 * circumference;
    const dash = `${length.toFixed(4)} ${(circumference - length).toFixed(4)}`;
    const ring = `<circle class="ring" style="--circumference:${circumference.toFixed(4)};--segment:${dash};animation-delay:${(index * .08).toFixed(2)}s" cx="170" cy="224" r="91" fill="none" stroke="${palette[index]}" stroke-width="20" stroke-dasharray="${dash}" stroke-dashoffset="${-offset}" transform="rotate(-90 170 224)"><title>${escapeXml(`${language.name}: ${language.percent.toFixed(1)}%`)}</title></circle>`;
    offset += length;
    return ring;
  }).join('');
  const languageChart = panel('Languages across public repositories', 'Language share by GitHub-reported code bytes in owned, non-fork public repositories. This measures repository composition, not proficiency.', 410,
    label(28, 34, '03 / THE CODE PALETTE', 12, '#d3ef93', 'letter-spacing="2"') + label(28, 68, 'Different tools. Shared curiosity.', 24) +
    `<circle cx="170" cy="224" r="91" fill="none" stroke="#293b2d" stroke-width="20"/>` + rings +
    label(170, 218, languageCount, 46, '#eef2e8', 'text-anchor="middle" font-weight="600"') + label(170, 246, 'LANGUAGES', 11, muted, 'text-anchor="middle" letter-spacing="2"') +
    label(170, 352, 'Public · original repositories', 12, muted, 'text-anchor="middle"') +
    (languages.length ? languages.map((language, index) => {
      const y = 110 + index * 38;
      return `<circle cx="330" cy="${y - 5}" r="4" fill="${palette[index]}"/>` + label(344, y, language.name, 14) + label(802, y, `${language.percent.toFixed(1)}%`, 14, palette[index], 'text-anchor="end"') +
        `<rect x="324" y="${y + 10}" width="478" height="5" rx="2.5" fill="#293b2d"/><rect class="bar" style="animation-delay:${(index * .08).toFixed(2)}s" x="324" y="${y + 10}" width="${(language.percent * 4.78).toFixed(2)}" height="5" rx="2.5" fill="${palette[index]}"/>`;
    }).join('') : label(324, 200, 'No language data available yet.', 16, muted)) +
    label(28, 389, 'Share of repository code bytes · a view of the code, not a proficiency score', 12, muted));
  return { 'overview-animated.svg': overview, 'languages-animated.svg': languageChart, 'activity-animated.svg': rhythm };
}
