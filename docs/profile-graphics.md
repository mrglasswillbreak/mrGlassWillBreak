# Profile graphics

The banner and charts are SVG files served from this repository. They match the dark green and lime palette of the portfolio and require no third-party image service at view time.

`scripts/update-stats.mjs` uses GitHub's REST API for public repositories, stars, followers, and language byte counts, and GraphQL for the contribution calendar. It does not publish private repository names or code. Repository and language totals exclude private repositories and forks; archived original public repositories remain included. Contributions use the calendar returned by GitHub, including GitHub's visibility and attribution rules. Language percentages describe repository composition, not proficiency, and include an Other category when more than six languages are present.

The [Refresh profile graphics workflow](../.github/workflows/profile-stats.yml) runs daily at 06:23 UTC, on generator changes, or manually from the Actions tab. GitHub can delay scheduled runs or disable schedules on inactive public repositories; the images show their last successful update date. The workflow uses the built-in `GITHUB_TOKEN` with `contents: write` to save only generated SVGs. No personal access token, paid service, or additional package is required. API failures fail the workflow and preserve the previous charts.

To validate locally with Node.js 22:

```sh
node --test scripts/update-stats.test.mjs
```

To regenerate, supply a GitHub token through the `GH_TOKEN` environment variable, then run:

```sh
node scripts/update-stats.mjs
```

Do not commit credentials. To change the appearance, edit `assets/banner.svg` or the renderer in `scripts/update-stats.mjs`.
