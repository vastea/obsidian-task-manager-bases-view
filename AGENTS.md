# AGENTS.md

Guidance for AI agents (Claude Code and others) working in this repository.

> The workspace root has another `../AGENTS.md` / `../CLAUDE.md` describing the
> sibling reference projects and a Bases API cheat sheet; this file covers only
> this plugin.

## What this is

Task Manager Bases View — an Obsidian task-management plugin offering three views:

| View | Implemented as | Data source |
|------|----------------|-------------|
| **tm-kanban** | `BasesView` (`registerBasesView`) | Bases query result + group-by |
| **tm-timeline** | `BasesView` (`registerBasesView`) | Bases query result (start/end date properties) |
| **tm-calendar** | `ItemView` (`registerView` + ribbon/command) | Scans daily notes directly, **bypassing Bases** |

**Core design principle: the plugin only renders. It owns no data model and
hard-codes no field names.** Grouping, filtering and sorting for kanban/timeline
are all done by Bases; which property is the group key / start / end date comes
from the user's choice in the Bases view options. Calendar is the sole exception
(it has its own daily-log format convention).

Requires **Obsidian 1.10.2+** (the Bases view API). `isDesktopOnly: true`.

## Common commands

```bash
npm run dev          # esbuild watch (inline sourcemap, unminified)
npm run build        # svelte-check type-check + production build (minified, writes main.js)
npm run svelte-check # type-check only, no bundling
npm run version      # version-bump.mjs syncs manifest.json / versions.json
```

- **No test framework.** The only way to verify a running build is manual
  testing: copy `main.js` / `manifest.json` / `styles.css` into
  `<Vault>/.obsidian/plugins/task-manager-bases-view/`, reload Obsidian, enable.
- **No lint script.** Type-checking is via `svelte-check` (CI runs `npm run build`).
- For a sanity check after editing, run `npm run build` (includes the type-check),
  not just `dev`.
- CI (`.github/workflows/ci.yml`) runs `npm run build` on Node 24; pushing a
  tag triggers `release.yml`, which builds, attests and publishes the artifacts.

## Tech stack notes

- **Svelte 5 + runes**, compiled by `esbuild-svelte` during the esbuild bundle
  step; CSS is bundled into `main.js` via `injected` mode.
- Files holding Svelte runtime state use the `.svelte.ts` suffix (e.g.
  `state.svelte.ts`, `i18n.svelte.ts`) so `$state` runes get compiled. Plain
  logic uses `.ts`.
- `tsconfig` enables `strict` + `noUncheckedIndexedAccess` +
  `verbatimModuleSyntax` — type imports must be written `import type` /
  `import { type X }`.
- `obsidian`, `electron`, `@codemirror/*`, `@lezer/*` and Node built-ins are
  external (not bundled).

## Architecture

### Uniform shape of each view

`main.ts` only does lifecycle orchestration: it registers the three views per the
settings toggles and mounts the settings tab. Each view lives in its own
directory (`src/kanban/`, `src/timeline/`, `src/calendar/`) with the same
internal structure:

- **`*-view.ts`** — the view class (`BasesView` or `ItemView`). It mounts the
  Svelte component with `mount(Component, { target })` in `onload`/`onOpen` and
  unmounts it in `onunload`/`onClose`; it "translates" Bases data/config into
  view-agnostic plain data + callbacks pushed into state; and it defines
  `*ViewOptions` (the options shown in the Bases toolbar).
- **`state.svelte.ts`** — a module-level `$state` signal plus getter/setter. The
  view class computes data then calls `setXxxState({...})`; the Svelte component
  reads `getXxxState()` and renders reactively. **This is the only bridge between
  the view class and the Svelte component.**
- **`*.svelte`** — pure presentation + interaction (drag, right-click menu
  triggers). It hands "write-back" requests back to the view class through the
  `context` callbacks stored in state.

> Key constraint (from the Bases API): **never hold a long-lived reference to
> `this.data` (`BasesQueryResult`)** — Bases replaces `this.data` wholesale and
> calls `onDataUpdated()` when data changes. Re-read `this.data` / `this.config`
> and recompute state on every `onDataUpdated`.

### `src/shared/` — cross-view logic

- **`entry-accessor.ts`** — safe reads from a `BasesEntry`. Important
  distinction: **rendering** goes through `Value` (`getValue`/`getString`, so
  Bases formatting applies); when a **concrete JS value** is needed (group key,
  date) read the file frontmatter directly (`getRawFrontmatter`/`getGroupKey`/
  `getDate`) because it is stable and unambiguous.
- **`frontmatter-writer.ts`** — the **single write-back exit**. It writes only
  `note.*` properties (`isWritable` check; `file.*`/`formula.*` are not user
  frontmatter, so they are read-only and their drag/edit affordances must be
  disabled). `writeProperty` uses `app.fileManager.processFrontMatter`; passing
  `undefined`/`null`/`""` deletes the key.
- **`view-config.ts`** — view-local state (e.g. kanban column collapse) is stored
  in the **Bases view config** (physically inside the `.base` file), not
  `plugin.saveData` — a single global blob can't distinguish multiple boards.
  `columnId` uses sentinels for null/empty keys.
- **`open-detail.ts`** — clicking a task opens the note in a right-hand split
  ("view on the left, detail on the right"). It reuses one detail leaf to avoid
  endless splits; mod-click bypasses reuse and opens a new tab. **There is no
  custom detail view — the note itself is the detail panel.**
- **`file-suggest.ts`** — `FileSuggest extends AbstractInputSuggest<TFile>`,
  filename autocomplete for a text input (used by the calendar log-block modal's
  "Link task" field). Filters markdown files by basename/path, prefix matches
  first.
- **`confirm-modal.ts`** — `ConfirmModal`, a generic yes/no dialog (used by the
  kanban done-column "archive all" action to confirm before bulk write-back).
- Others: `palette.ts` (`value|color` colour scheme, shared by kanban/calendar),
  `date-util.ts`, `section-parser.ts`, `value-render.ts`, `icon.ts`.

### The two kanban modes (`kanban-view.ts`)

- **native (default)**: columns come directly from Bases `data.groupedData`
  (group-by configured by the user in the Bases toolbar).
- **predefined**: the user lists the column values (`value|color`) plus
  `doneStatuses` + `archiveValue` in the view options. **It still groups through
  Bases** — the predefined values only order/colour/flag the columns, matched by
  group key; unmatched groups and the null group fall into a collapsed
  Uncategorized column.

Both modes get the group property via `BasesViewConfig.groupBy` (present at
runtime but typed as `{}` in the d.ts — see the cast in `getNativeGroupBy`), used
only for write-back.

### Drag vs click (timeline & calendar)

A recurring concern: a drag must not be mistaken for a click (which opens the
note). Both `timeline/Bar.svelte` and `calendar/LogBlock.svelte` use a
`pointerMoved` flag set once the pointer crosses a small pixel threshold
(`DRAG_THRESHOLD_PX`); the click handler consumes that flag to suppress the
trailing click. **Do not** rely on the drag-delta being non-zero in the click
handler — `pointerup` resets it before the `click` event fires.

`timeline/Bar.svelte` additionally holds an **optimistic date override**
(`pendingStart`/`pendingEnd`) after a commit until fresh query data lands, so the
bar doesn't snap back to its old geometry during the write→requery round-trip.
A fresh drag computes its delta off these effective dates, not the stale row, so
pressing the bar mid-flight doesn't jump it back. A timeout clears the hold if
the write never produces a data update.

### What's special about calendar (`calendar/`)

It bypasses Bases and scans daily notes directly. Convention: list items under a
section (default `## Log`) are time blocks, formatted
`HH:MM-HH:MM (Category) [[wikilink]] note`. Read/write is in `log-io.ts`,
debounced-refreshed via `vault.on(modify/create/delete/rename)`. Cross-file
conventions (journal folder, date format, week start, log section, back-link)
all live in `settings.ts`; after a settings change, `saveSettings` calls
`rerender()` on any open calendar for a live refresh (view on/off toggles still
need a reload).

`WeekGrid.svelte` renders only the configured hour window
(`dayStartHour`/`dayEndHour`, default 0–24) and derives `hourHeight` by splitting
the measured viewport height across the visible hours (floored at `MIN_HOUR_PX`),
so a narrow window fills the screen with taller cells. Block geometry and
drag clamps are all relative to the window start.

### Settings page (`settings.ts`)

The tab follows the official Obsidian dual-support path while 1.13 remains an
insider build: `getSettingDefinitions()` provides searchable declarative
settings on 1.13+, while `display()` delegates to the imperative renderer on
1.10.2–1.12. Keep both implementations in sync when changing a setting.

The declarative path uses `visible` predicates and `refreshDomState()` for
dependent fields. The legacy renderer builds dependent fields once and toggles
their setting elements, avoiding full re-renders that steal focus. Both paths
gate calendar and timeline groups by their view toggles, with additional gates
for the back-reference section and category list.

Demo screenshots used by the READMEs live in `docs/images/` (`kanban-1`,
`timeline-2`, `calendar-1`, `settings-2`).

## i18n

`i18n.svelte.ts` holds one `dict` (en/zh/de); `t(key)` returns the string for the
current locale. The locale is a `$state` signal — strings in Svelte templates
update live when the language changes; plain-TS callers (menus, modals, Bases
view options, Notices) read the current value on use. **Command names are read
once at registration**, so `main.ts` hard-codes them with both the English and
localized label separated by a slash. Add new strings in all three languages.

## Conventions

- Always register listeners/timers via `this.registerEvent` /
  `this.registerDomEvent` / `this.registerInterval` so nothing leaks on unmount.
- `manifest.json`'s `id` (`task-manager-bases-view`) is stable once published —
  never change it; same for command IDs. Bump `minAppVersion` when adopting a
  newer API.
- Do not commit `node_modules/` or `main.js` (build artifact).
- UI copy uses sentence case; navigation uses arrow notation
  (**Settings → Community plugins**).
