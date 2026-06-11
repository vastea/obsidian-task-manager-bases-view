# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.1] - 2026-06-11

### Fixed
- **Kanban — card property readability.** Each property now shows its name as
  `name: value` (friendly name from the Base config), one property per line.
  Bases-rendered values (dates, links) are flattened to the same font-size and
  line-height as text rows, so rows are evenly spaced instead of dates standing
  out taller.
- Internal: avoid an unsafe `any` when normalising the status value for the
  changelog entry.

### Changed
- **Kanban — card styling.** Added a divider between the card title and its
  properties; the card corner radius now matches the column (`--radius-m`).

## [0.4.0] - 2026-06-11

### Added
- **Kanban — status-change changelog.** A new opt-in "Record changelog" view
  option. When enabled, moving a card (drag, or right-click → "Move to") appends
  a `- yyyy-MM-dd old->new` list item under a configurable body section
  ("Changelog section heading", default `Changelog`), creating the section when
  absent. No entry is written when the status is unchanged. The old value is
  captured during the frontmatter write before it is overwritten.

### Changed
- **Settings — calendar section grouping.** "Time-block categories" was a
  top-level heading peer to the calendar settings; it is now nested under a
  single renamed **Weekly log calendar settings** heading.
- **Internal — shared section insert.** The calendar's body list-insert helper
  (`insertLineIntoSection`) moved into `shared/section-parser` so the calendar
  back-reference and the kanban changelog share one implementation.

## [0.3.0] - 2026-06-10

Weekly-log calendar polish. Presentation-layer only — no data model, field
conventions, or new dependencies; everything stays local wall-clock time.

### Added
- **Calendar — current-time indicator.** A red now-line is drawn across today's
  column at the local time, updating every minute. It is hidden when the visible
  week has no today or when now falls outside the configured day window.
- **Calendar — jump to date.** Click the toolbar title to reveal a native date
  picker and jump the grid to the week containing any date (respects the
  Monday/Sunday week-start setting).
- **Calendar — editable block time.** The new-block modal now shows editable
  start/end time inputs pre-filled from the drag, so an imprecise drag can be
  corrected before creating (confirmation optional).

### Changed
- **Calendar — time-block card polish.** Consistent radius/padding, a muted time
  line with a prominent title, a category chip, single-line ellipsis for long
  titles, and a subtle hover highlight. Drag/click behaviour is unchanged.
- **Calendar — hour-axis alignment.** Every hour label sits consistently just
  below its gridline (first to last), the grid is flush under the header, and a
  single full-width closing line keeps the gutter and day columns aligned.
- **Calendar — log spacing.** A blank line is kept between the section heading and
  the first record when writing the daily log and the task back-reference.

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

[Unreleased]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.4.1...HEAD
[0.4.1]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.4.0...0.4.1
[0.4.0]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.3.0...0.4.0
[0.3.0]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.2.1...0.3.0
[0.2.1]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.2.0...0.2.1
[0.2.0]: https://github.com/vastea/obsidian-task-manager-bases-view/compare/0.1.0...0.2.0
[0.1.0]: https://github.com/vastea/obsidian-task-manager-bases-view/releases/tag/0.1.0
