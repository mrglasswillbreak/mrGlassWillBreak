# Profile graphics

The banner and charts are SVG files served from this repository. They use dark green gradients, a faint grid, lime/blue accents, and CSS animation without scripts, external fonts, or third-party image services. Bars and donut segments draw in during a 12-second cycle, then hold for reading. Numeric labels stay fixed. The banner and summary use gentle accent motion. `prefers-reduced-motion: reduce` disables all animation; complete static geometry remains available when animation is unsupported.

`scripts/update-stats.mjs` uses GitHub's REST API for public repositories, stars, followers, and language byte counts, and GraphQL for the contribution calendar. It does not publish private repository names or code. Repository and language totals exclude private repositories and forks; archived original public repositories remain included. Contributions use the calendar returned by GitHub, including GitHub's visibility and attribution rules. Language percentages describe repository composition, not proficiency, and include an Other category when more than six languages are present.

`scripts/activity.mjs` derives the activity details from dated calendar entries. Recent contributions cover the UTC refresh date and the previous 29 days. Active days and the longest consecutive-day streak cover the returned calendar, not lifetime activity; zero or missing dates break a streak. The monthly chart shows the latest 12 calendar months, with the current month highlighted and explicitly partial. Future dates are excluded. `scripts/graphics.mjs` renders the charts; the language donut and bars share the same byte-weighted percentages.

The [Refresh profile graphics workflow](../.github/workflows/profile-stats.yml) runs daily at 06:23 UTC, on generator changes, or manually from the Actions tab. GitHub can delay scheduled runs or disable schedules on inactive public repositories; the images show their last successful update date. The workflow uses the built-in `GITHUB_TOKEN` with `contents: write` to save only generated SVGs. No personal access token, paid service, or additional package is required. API failures fail the workflow and preserve the previous charts.

To validate locally with Node.js 22:

```sh
node --test scripts/update-stats.test.mjs
```

To regenerate, supply a GitHub token through the `GH_TOKEN` environment variable, then run:

```sh
node scripts/update-stats.mjs
```

Do not commit credentials. To change the appearance, edit `assets/banner.svg` or `scripts/graphics.mjs`. The README intentionally leaves project highlights to GitHub's pinned repositories and links to the portfolio for case studies.
