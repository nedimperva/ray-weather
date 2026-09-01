# Forecast Pilot Changelog

## [1.2.0] - 2026-08-30

First release to treat Linux as a first-class target rather than a port.

### Added

- **Weather Watch**, a `no-view` command running every 30 minutes. It notifies
  once about each new or escalated weather alert and once when rain is expected
  within 90 minutes, and refreshes the status file. On Linux these are real
  desktop notifications delivered whether or not the launcher is open; on Raycast,
  which has no notification API, the command updates its own subtitle instead.
- **Status file** at `${XDG_STATE_HOME:-~/.local/state}/forecast-pilot/current.json`,
  written atomically on every watcher run. Its `text`, `alt`, `tooltip`, and
  `class` fields match Waybar's custom-module contract, so any bar can consume
  it. See [docs/linux.md](docs/linux.md#status-file).
- **Alert Notifications** and **Rain Notifications** preferences. Alerts default
  to severe and extreme only; turning them off still refreshes the status file.
- **A `location` argument on Search Weather**, so it can be launched pre-filled
  from a keybind, a deeplink, or `vicinae cmd launch`.
- **Set Weekend Plan as Wallpaper** on Share Forecast and Weekend Planner. The
  action only appears where the host reports a working wallpaper backend.
- `npm run build:vicinae` now produces a proper Vicinae manifest — Linux as the
  platform, Vicinae's schema, and no `menu-bar` command — derived from
  `package.json` at build time rather than kept as a second file.
- `docs/linux.md` and `docs/development.md`, and a rewritten README organised
  around per-platform install and use.

### Changed

- The **Menu Bar Display** preference is now **Status Display**: it drives both
  the macOS menu bar title and the Linux status file text. Existing settings are
  preserved.
- Menu bar title formatting moved into a shared, tested `buildStatusText`.
- `useDefaultLocation` now delegates to a plain `readDefaultLocation`, so
  headless commands resolve the default location the same way views do.
- The weekend image is written through one shared helper instead of being
  duplicated across actions.

### Fixed

- The Vicinae bundle no longer ships `menu-bar-weather`, a command Vicinae can
  never load.

## [1.1.0]

- Linux and Vicinae support: image export now finds a usable font on any
  distribution via fontconfig with a trial render, and reveal-in-file-manager
  resolves `showInFinder` or `showInFileBrowser` depending on the host.
- Weekend image sharing and store screenshots.
- Improved weather list readability.
