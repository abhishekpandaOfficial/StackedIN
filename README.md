# Abhishek Studio

A living publishing dashboard for the technical writing at
[pandaabhishek.substack.com](https://pandaabhishek.substack.com/).

## What the site does

- Tracks the complete Substack catalogue in a searchable post library.
- Organises articles into content pillars, modules, tags, and structured series.
- Shows portfolio counts, coverage, recent additions, and learning-path views.
- Checks Substack automatically every six hours through GitHub Actions.
- Classifies newly discovered posts with deterministic topic rules.
- Supports private Substack analytics CSV imports for article views and shares.
- Stores imported analytics only in the current browser.

## Automatic Substack sync

The sync workflow runs every six hours and can also be run manually from the
GitHub Actions tab. It calls the sync script, which:

1. Reads the Substack archive API.
2. Falls back to the publication RSS feed if necessary.
3. Merges discovered posts with `data/posts.seed.json`.
4. Preserves curated taxonomy for known posts.
5. Writes the deployable catalogue to `public/posts.json`.
6. Commits catalogue changes, which triggers the Pages deployment.

The refresh button reloads the most recently deployed snapshot. The scheduled
workflow discovers brand-new Substack posts.

## Local development

Run `npm ci`, then `npm run sync:offline`, followed by `npm run dev`.
Use `npm run sync:substack` when the machine has unrestricted internet access.

## Production build

Run `npm run build`. GitHub Pages is deployed by the existing deployment
workflow from the `master` branch.

## Private analytics import

Substack view and share counts are not public feed data. Export a CSV from
Substack and import it from **Analytics**. Recommended columns are `title`,
`views`, `shares`, and `url`. Imported values stay in browser storage and are
never committed.
