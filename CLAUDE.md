# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

A Netflix-style browsable archive of Transformers animated series. Vite + React 19 SPA with client-side routing via `react-router-dom` v7. Deployed to GitHub Pages at `/transformers-archive/` (see `vite.config.js` `base` and `App.jsx` `basename`); `vercel.json` rewrites everything to `/` for SPA fallback.

## Commands

```bash
npm run dev       # vite dev server
npm run build     # production build to dist/
npm run preview   # preview built bundle
npm run lint      # eslint (flat config, eslint.config.js)
```

No test harness is configured.

## Architecture

### Data layer — JSON-as-database with lazy dynamic imports

All content lives in `src/data/`, not an API:
- `series-index.json` — flat list of all series (slug, title, era, poster, counts, tags, synopsis). Used by HomePage and SearchPage.
- `eras.json` — the canonical era groupings referenced by `series-index.json[*].era`. HomePage renders one `SeriesRow` per era.
- `series/<slug>.json` — full series detail: seasons → episodes → `video.{youtube,dailymotion,other}`. One file per series, loaded on demand.
- `media-links.json` — supplementary media hub content.

`src/hooks/useSeriesData.js` is the only accessor. It uses **dynamic `import('../data/series/${slug}.json')` with module-level caches** (`seriesCache`, `indexCache`, `erasCache`), so each series JSON becomes its own code-split chunk and repeat visits are free. When adding a new series you must: (1) create `src/data/series/<slug>.json`, (2) add the entry to `series-index.json`, (3) ensure the `era` field matches an id in `eras.json`.

### Routing

`App.jsx` defines five routes under `basename="/transformers-archive"`:
- `/` → HomePage
- `/series/:slug`, `/series/:slug/characters`, `/series/:slug/media` → SeriesPage (the path segment picks the tab)
- `/about`, `/search`, `*` (NotFound)

`EpisodePage.jsx` exists but is **not currently wired into any route** — episode playback is driven from inside SeriesPage/EpisodesTab. If you add an episode route, it should be `/series/:slug/s:season/e:episode` based on `EpisodePage`'s `useParams` destructuring.

### Asset URL helper

Always use `assetUrl()` from `src/utils/assetUrl.js` for any path from the JSON data (posters, hero images, thumbnails, sounds, textures). It prefixes `import.meta.env.BASE_URL` so assets resolve correctly under the `/transformers-archive/` base in production. Bare `<img src="images/...">` will break on GitHub Pages.

### Video embedding

Episodes embed YouTube via `https://www.youtube-nocookie.com/embed/<id>?rel=0` in `EpisodePlayer.jsx` and the 3D-framed variant `TransformPlayer.jsx`. The YouTube ID is parsed from the stored URL via a shared regex (duplicated in both files). Fallbacks exist for `dailymotion` and `other` URL fields, plus a "Search on YouTube" link.

### 3D transform intro

`TransformPlayer.jsx` uses `three` + `gsap` to render a beveled mechanical frame around the video (see `bevelBox`, `makeGearGeo`). This is a heavy component — keep it dynamically loadable and avoid changing its geometry primitives without checking `plans/transformer-transition-animation_2026-03-16.md`.

### Styling

Plain CSS per component (`Foo.jsx` + `Foo.css`). Global tokens live in `src/styles/variables.css` imported by `global.css`. No CSS-in-JS, no Tailwind.

### Build / deploy

- Vite builds to `dist/` with base `/transformers-archive/`.
- `public/404.html` exists for GitHub Pages SPA fallback (redirect to `index.html`).
- `vercel.json` handles the equivalent rewrite when deployed to Vercel.

## Plans

Design docs live in `plans/<name>_<YYYY-MM-DD>.md`. See global rule `~/.claude/rules/plan-saving.md` — save any plan or analysis >1000 words there before returning.

## Editor tools

`tools/transform-editor.html` and `tools/transform-editor-v1.html` are standalone HTML utilities (opened directly in a browser) used to tune the 3D transform animation parameters. They are not part of the Vite build.
