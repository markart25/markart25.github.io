# markfolio

My project portfolio, built with **Astro + React**, deployed on **GitHub Pages**.
It pulls every public repo from my GitHub at build time and gives each one its own
page — and it themes itself from the wallpaper, **pywal-style**.

## How it works

- `scripts/extract-palette.mjs` runs before every build: it reads `public/wallpaper.jpg`,
  k-means-clusters the colours, and writes the site's whole colour scheme
  (`src/styles/palette.css`) plus a matching favicon. **Change the wallpaper → the
  whole site re-themes.** No config.
- `src/lib/github.ts` fetches all public repos (plus commit counts and READMEs) from
  the GitHub API at build time. Forks are skipped, and so is anything listed in
  `excludeRepos` in `src/config.ts`.
- Each repo gets a generated page at `/p/<name>/` with its stats, topics, my
  hand-written notes (if any), and its rendered README.
- `.github/workflows/deploy.yml` rebuilds the site on every push **and once a day on
  a cron** — so a brand-new public repo appears on the site within 24h automatically
  (or instantly via *Actions → build & deploy → Run workflow*).
- If the GitHub API is unreachable (rate limits, school wifi), the build falls back to
  the bundled `src/data/snapshot.json` instead of failing.

## Run it locally

```sh
npm install
npm run dev        # extracts the palette, then starts astro dev
```

> Heads up: `npm install` may fail behind SSL-intercepting filters (Securly etc.).
> Do the first install at home or on a hotspot — after that, builds run fine offline
> thanks to the snapshot fallback.

## Change the wallpaper

Drop any image at `public/wallpaper.jpg` (or `.png` / `.jpeg`, same name) and rebuild.
That's it — accent colours, background tint, and favicon all re-derive from it.

## Make it yours

Everything user-facing lives in **`src/config.ts`**: username, tagline, tech-stack
icons (skillicons.dev ids), and the repo exclude list.

Per-repo blurbs live in **`src/content/notes/<repo>.md`** — create a file named after
any repo and it appears as a "field notes" callout on that repo's page. Delete one to
remove it. Repos without a notes file still get a full auto-generated page.

## Deploy to GitHub Pages

1. Create a repo — name it **`<username>.github.io`** to serve at the root URL, or
   anything else to serve at `/<repo>/` (the base path is detected automatically).
2. Push this folder to `main`.
3. In the repo: **Settings → Pages → Source → GitHub Actions**.
4. Done. Every push and every daily cron run redeploys with fresh repo data.

## Stack

Astro 5 (static output) · React 19 island for the sortable grid (commits ⇄ stars) ·
no CSS framework, just custom properties generated from the wallpaper ·
JetBrains Mono + Inter, self-hosted via Fontsource.
