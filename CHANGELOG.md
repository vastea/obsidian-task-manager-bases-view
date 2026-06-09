# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.1] - 2026-06-09

### Fixed
- Declared `minAppVersion` raised to `1.10.2` to match the `createFileForView`
  API used by the kanban view (community-plugin validation).
- Replaced the deprecated `ButtonComponent.setWarning()` with the `mod-warning`
  class in the confirmation dialog.
- Removed `!important` from card-property styles (raised selector specificity
  instead) and tightened a couple of `any`-typed reads.
- Release workflow now attaches build-provenance attestations to the assets.

## [0.2.0] - 2026-06-09

### Added
- **Calendar — custom day window.** New "Day starts at" / "Day ends at" settings
  (default `00:00–24:00`). The weekly grid renders only the chosen hours and
  splits the viewport height across them, so a narrow window (e.g. `09:00–18:00`)
  shows taller cells and larger blocks.
- **Calendar — filename autocomplete.** The new-block modal's "Link task" field
  suggests notes by filename as you type (`FileSuggest`).
- **Kanban — archive-all confirmation.** The done column's "archive all" action
  now asks for confirmation before bulk-writing the archive value.
- **Settings — calendar group gating.** All weekly-log-calendar settings are
  shown only while the calendar view is enabled, keeping the settings page tidy.

### Changed
- **Settings update in place.** Toggling fields no longer re-renders the whole
  settings page (no lost focus); dependent fields collapse/expand via visibility,
  and the paired day-window dropdowns update each other.
- Documentation refreshed (`AGENTS.md`) and README screenshots added.
- Source comments simplified.

### Fixed
- **Timeline drag.** A bar no longer snaps back to its old geometry during the
  write→requery round-trip after a drag; starting a fresh drag mid-flight no
  longer jumps it back; a still press (select) no longer jitters the bar by a day.
- **Calendar drag vs click.** Dragging or resizing a time block no longer opens
  the journal — only a genuine single click does.
- **Kanban collapsed column.** The vertical column title no longer renders blurry.

## [0.1.0]

Initial release.

### Added
- **tm-kanban** Bases view — columns from a Bases group-by or predefined columns,
  per-column tints, done columns with archive-all, drag between columns,
  right-click to move/archive, collapsible columns.
- **tm-timeline** Bases view — Gantt bars and milestone dots from start/end date
  properties, grouped lanes or a flat list, drag to reschedule, day/week/month
  scales.
- **tm-calendar** leaf view — a weekly time grid built from daily-note log blocks,
  drag to create, right-click to delete, optional colour-coded categories and
  back-references.
- English / 中文 localisation, switchable in settings.

[Unreleased]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.2.1...HEAD
[0.2.1]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/vastea/obsidian-task-manager-bases-view/releases/tag/0.1.0
