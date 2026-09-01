# Development

Forecast Pilot targets two hosts from one source tree: **Raycast** on macOS and
Windows, **Vicinae** on Linux. Vicinae serves its own implementation of
`@raycast/api` at runtime, so almost everything is shared; this document covers
the parts that are not.

---

## Contents

- [Setup](#setup)
- [Scripts](#scripts)
- [Project layout](#project-layout)
- [The two-manifest strategy](#the-two-manifest-strategy)
- [Using host-specific APIs](#using-host-specific-apis)
- [Adding a command](#adding-a-command)
- [Testing](#testing)
- [Store screenshots](#store-screenshots)

---

## Setup

```bash
npm install
```

Node 18 or newer. Building for Vicinae additionally needs a Vicinae install; the
`vici` CLI ships with the `@vicinae/api` dev dependency.

---

## Scripts

| Script | What it does |
| --- | --- |
| `npm test` | Vitest over the pure logic modules |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | Raycast lint: manifest, icons, metadata, ESLint, Prettier |
| `npm run fix-lint` | The above, with autofix |
| `npm run dev` | Raycast development mode, hot reload |
| `npm run build` | Raycast build |
| `npm run build:vicinae` | Vicinae build, installs into the Vicinae extension directory |

`npm run lint` validates the author online, so it can fail on an offline machine
even when TypeScript and ESLint pass.

---

## Project layout

```text
src/
  components/          Shared views and action groups
  hooks/               Data fetching, storage, favorites, default location
  utils/               Forecast parsing, formatting, decisions, host APIs
  <command>.tsx        One file per command, named exactly as in the manifest
scripts/
  build-vicinae.mjs    Vicinae build wrapper
  render_screenshots.py Store screenshot generator
docs/
  linux.md             Vicinae and Linux integration guide
  development.md       This file
```

### Notable modules

**Forecast and decisions**

- `buildDailyForecast` — met.no timeseries into daily summaries, with per-day max
  UV and rain probability
- `buildComfortScore` — a 0-100 outdoor comfort score
- `buildDecisionTags` — `Rain likely`, `Windy`, `High UV`, `Great outside`
- `buildShouldIDecisions` — the umbrella, jacket, walk, and drive answers
- `buildPackingSuggestions` — the travel packing command

**Data access**

- `useWeatherData` — one hook bundling forecast, alerts, and air quality, with
  alerts mapped to the days they cover
- `useCachedFetch` — user-agent headers, previous data, local cache fallback,
  staleness, and pruning
- `readDefaultLocation` / `useDefaultLocation` — pinned location, then first
  favorite. The plain function exists because headless commands cannot use hooks.

**Cross-host**

- `utils/hostApi.ts` — the only module that touches Vicinae-specific APIs
- `utils/revealFile.ts` — `showInFinder` on Raycast, `showInFileBrowser` on
  Vicinae
- `utils/statusText.ts` — the one-line summary, shared by the menu bar title and
  the Linux status file
- `utils/weatherWatch.ts` — pure decision logic for the background watcher
- `utils/statusFile.ts` — atomic status file writes

---

## The two-manifest strategy

`package.json` is the **Raycast** manifest. It is what `ray lint` and the Raycast
store validate, so it may only contain fields and values Raycast understands —
`platforms` cannot include `Linux`, and Vicinae-only fields like
`disabledByDefault` are not allowed.

Vicinae needs a different manifest: `Linux` as the platform, its own schema URL,
and no `menu-bar` command, because Vicinae has no menu bar.

`scripts/build-vicinae.mjs` resolves this without a second checked-in manifest:

1. Read `package.json`.
2. Run `vici build`, which compiles every command and copies `package.json` into
   the output bundle.
3. Overwrite the copy in the bundle with the Vicinae-flavoured manifest.
4. Delete the bundles of any command that was dropped.

One source of truth, no drift. If you add a field only one host understands, put
the transform in `toVicinaeManifest()` rather than branching the source manifest.

---

## Using host-specific APIs

Two rules, both learned the hard way.

### 1. Never feature-detect on `@raycast/api`

Vicinae proxies unknown properties on its `@raycast/api` module to a stub that
throws *when called*. A missing symbol is therefore truthy, and this silently
picks the wrong branch:

```ts
// WRONG: on Vicinae, api.showInFinder is a throwing proxy, never undefined
const reveal = api.showInFinder ?? api.showInFileBrowser;
```

Detect the host instead, via `isVicinae()` in `utils/hostApi.ts`, which checks
for `environment.vicinaeVersion`.

### 2. Never `import` from `@vicinae/api` at module scope

Raycast's bundler would inline the whole package into the macOS and Windows
build, where it cannot work. Vicinae marks it external and its patched `require`
resolves it at runtime.

`utils/hostApi.ts` is the single place that bridges this, with an indirect
`require` guarded by a host check. Everything else imports from `hostApi`:

```ts
import { canSetWallpaper, setWallpaper } from "../utils/hostApi";

if (canSetWallpaper()) {
  await setWallpaper(filePath, "Contain");
}
```

`canSetWallpaper()` and friends go through Vicinae's `environment.canAccess()`,
so they answer "can this actually work here", not merely "is this Vicinae" — a
desktop with no wallpaper backend answers no. Gate UI on them so Vicinae-only
actions never render as dead clicks.

To add another Vicinae-only capability, extend `hostApi.ts` with a `can…()`
predicate and a wrapper; do not reach for `@vicinae/api` anywhere else.

---

## Adding a command

1. Add an entry to `commands` in `package.json`. `name` must match the source
   filename exactly.
2. Create `src/<name>.tsx` for a view command, or `src/<name>.ts` for a
   `no-view` one.
3. Export the component or async function as the **default** export.
4. `npm run lint` to validate the manifest, then build for whichever host you are
   testing.

### Command arguments

Declared arguments arrive as `props.arguments`, and a deeplink's `fallbackText`
as `props.fallbackText`. On Vicinae both are reachable from outside the launcher:

| Invocation | Where it lands |
| --- | --- |
| `vicinae cmd launch <id> Sarajevo` | `arguments.location`, launch type `commandLine` |
| `vicinae cmd launch <id> --query Mostar` | `fallbackText`, launch type `commandLine` |
| `vicinae://launch/@owner/ext/cmd?fallbackText=Konjic` | `fallbackText`, launch type `userInitiated` |

Handle all three, as `search-weather.tsx` does:

```ts
const initialQuery = (
  props.arguments?.location ??
  props.fallbackText ??
  ""
).trim();
```

### Background commands

A `no-view` command with an `interval` runs on a schedule on both hosts. Check
`environment.launchType === LaunchType.Background` to distinguish a scheduled run
from a manual one, and keep the two paths honest: notifications and file writes
in the background, toasts only when a person is watching.

Vicinae logs its scheduler, which is the fastest way to confirm registration:

```bash
vicinae logs | grep IntervalScheduler
```

`Worker … exited with code 1` after a `no-view` run is normal teardown, not an
error.

### Where the logic should live

Command files should do I/O and rendering only. Decision logic belongs in
`src/utils/` as a pure function taking a `now` and returning a result — that is
what makes it testable. `buildWatchReport` is the model: the command fetches,
calls it, and writes what it returns.

---

## Testing

```bash
npm test
```

Vitest covers the pure modules: forecast parsing, comfort scoring, alerts, UV,
the weekend planner, the share image, the status text, and the watcher digest.
`@raycast/api` is aliased to a small stub in `test/raycast-api-stub.ts`, so a
module that imports anything beyond `Color` from it needs the stub extended, or —
better — the logic extracted into a module that does not import it at all.

Anything time-dependent must take `now` as a parameter rather than calling
`Date.now()`, so tests can pin it.

---

## Store screenshots

Raycast store screenshots live in `metadata/` as `forecast-pilot-{n}.png` at
2000x1250. The committed images are generated mockups:

```bash
pip install Pillow
python3 scripts/render_screenshots.py
```

For a real submission, replace them with captures from Raycast's built-in Window
Capture, which exports at the same size.
