import {
	type BasesAllOptions,
	type BasesEntry,
	type BasesViewConfig,
	type QueryController,
	BasesView,
} from "obsidian";
import { mount, unmount } from "svelte";
import Timeline from "./Timeline.svelte";
import type TaskManagerPlugin from "../main";
import {
	type TimelineAxisSegment,
	type TimelineAxisTier,
	type TimelineContext,
	type TimelineLane,
	type TimelineRow,
	type TimelineScale,
	setTimelineState,
} from "./state.svelte";
import { getDate } from "../shared/entry-accessor";
import { isWritable, writeProperty } from "../shared/frontmatter-writer";
import { openDetail } from "../shared/open-detail";
import { getLocale, t } from "../i18n.svelte";
import {
	addDays,
	addMonths,
	dayDiff,
	endOfMonth,
	formatISODate,
	startOfDay,
	startOfMonth,
	startOfWeekMonday,
} from "../shared/date-util";

export const TM_TIMELINE_VIEW = "tm-timeline";

/** Width (px) of one cell at zoom 100%, per scale. */
const PX_DEFAULT: Record<TimelineScale, number> = { day: 48, week: 154, month: 244, quarter: 274, year: 365 };


export function timelineViewOptions(config: BasesViewConfig): BasesAllOptions[] {
	const options: BasesAllOptions[] = [
		{
			type: "group",
			displayName: t("optDates"),
			items: [
				{
					type: "property",
					key: "startProp",
					displayName: t("optStartProp"),
					placeholder: t("optProperty"),
					filter: (prop) => !prop.startsWith("file."),
				},
				{
					type: "property",
					key: "endProp",
					displayName: t("optEndProp"),
					placeholder: t("optProperty"),
					filter: (prop) => !prop.startsWith("file."),
				},
			],
		},
		{
			type: "dropdown",
			key: "scale",
			displayName: t("optScale"),
			default: "week",
			options: {
				day: t("scaleDay"),
				week: t("scaleWeek"),
				month: t("scaleMonth"),
				quarter: t("scaleQuarter"),
				year: t("scaleYear"),
			},
		},
		{
			type: "group",
			displayName: t("optSize"),
			items: [
				{
					type: "dropdown",
					key: "rangePadding",
					displayName: t("optPadding"),
					default: "default",
					options: {
						default: t("rangeDefault"),
						moderate: t("rangeModerate"),
						fit: t("rangeFit"),
					},
				},
				{
					type: "toggle",
					key: "autoZoom",
					displayName: t("optAutoZoom"),
					default: false,
				},
				{
					type: "slider",
					key: "zoom",
					displayName: t("optZoom"),
					default: 100,
					min: 10,
					max: 200,
					step: 5,
					instant: true,
					shouldHide: () => config.get("autoZoom") === true,
				},
				{
					type: "toggle",
					key: "ignoreMaxUnits",
					displayName: t("optIgnoreMaxUnits"),
					default: false,
				},
			],
		},
	];
	return options;
}

export class TimelineView extends BasesView {
	type = TM_TIMELINE_VIEW;
	private containerEl: HTMLElement;
	private component: Record<string, unknown> | null = null;
	private resizeObserver: ResizeObserver | null = null;
	private ready = false;

	constructor(
		controller: QueryController,
		containerEl: HTMLElement,
		private plugin: TaskManagerPlugin,
	) {
		super(controller);
		this.containerEl = containerEl;
	}

	override onload(): void {
		this.containerEl.addClass("tm-timeline-root");
		this.component = mount(Timeline, { target: this.containerEl });
		// Recompute density (fit-to-pane) when the view is resized.
		this.resizeObserver = new ResizeObserver(() => {
			if (this.ready) this.onDataUpdated();
		});
		this.resizeObserver.observe(this.containerEl);
		// A new theme can change the header font, so the measured labels expire.
		this.registerEvent(
			this.app.workspace.on("css-change", () => {
				clearLabelWidths();
				if (this.ready) this.onDataUpdated();
			}),
		);
	}

	/** Width of the sticky label gutter, as the stylesheet defines it. */
	private labelGutterWidth(): number {
		const declared = getComputedStyle(this.containerEl).getPropertyValue("--tm-tl-label-width");
		return Number.parseFloat(declared) || 0;
	}

	override onunload(): void {
		this.resizeObserver?.disconnect();
		this.resizeObserver = null;
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}
		this.containerEl.empty();
		this.containerEl.removeClass("tm-timeline-root");
	}

	onDataUpdated(): void {
		const startProp = this.config.getAsPropertyId("startProp");
		const endProp = this.config.getAsPropertyId("endProp");
		const scale = ((this.config.get("scale") as TimelineScale | undefined) ?? "week");
		const autoZoom = this.config.get("autoZoom") === true;
		const rawZoom = this.config.get("zoom");
		// Percentage of the scale's default density.
		const zoom = rawZoom == null ? 100 : Number(rawZoom);
		// Cells the header may draw, unless this timeline waives the constraint.
		const ignoreMaxUnits = this.config.get("ignoreMaxUnits") === true;
		const maxUnits = ignoreMaxUnits ? Infinity : this.plugin.settings.maxUnits;
		const rangePadding = (this.config.get("rangePadding") as string | undefined) ?? "default";
		// Drop values equal to the option defaults so the .base stays minimal.
		if (this.config.get("rangePadding") === "default") this.config.set("rangePadding", null);
		if (this.config.get("autoZoom") === false) this.config.set("autoZoom", null);
		if (rawZoom != null && zoom === 100) this.config.set("zoom", null);

		const writeEnabled = isWritable(startProp) && isWritable(endProp);
		// Filled in once the range is final; the context closures read it lazily so
		// bars and the track share one origin and one span.
		const geom = { start: new Date(), units: 0 };
		const clamp = (offset: number) => Math.min(Math.max(offset, 0), geom.units);
		const context: TimelineContext = {
			properties: this.data.properties,
			renderContext: this.app.renderContext,
			writeEnabled,
			openDetail: (file, evt) => openDetail(this.app, file, evt),
			write: (file, changes) => {
				if (startProp && "start" in changes && isWritable(startProp)) {
					void writeProperty(this.app, file, startProp, changes.start ? formatISODate(changes.start) : null);
				}
				if (endProp && "end" in changes && isWritable(endProp)) {
					void writeProperty(this.app, file, endProp, changes.end ? formatISODate(changes.end) : null);
				}
			},
			snap: (d) => (this.plugin.settings.snapToGrid ? startOfUnit(d, scale) : d),
			snapEnd: (d) => (this.plugin.settings.snapToGrid ? endOfUnit(d, scale) : d),
			offsetOf: (d) => clamp(offsetOf(d, geom.start, scale)),
			dateAt: (offset) => dateAt(clamp(offset), geom.start, scale),
			isOutside: (d) => {
				const raw = offsetOf(d, geom.start, scale);
				return raw < 0 || raw > geom.units;
			},
		};

		if (!startProp && !endProp) {
			this.ready = true;
			setTimelineState({
				hasRange: false,
				scale,
				pxPerUnit: 1,
				rangeStart: new Date(),
				totalUnits: 0,
				todayOffset: 0,
				tiers: [],
				lanes: [],
				context,
				message: t("timelineChooseDates"),
			});
			return;
		}

		const makeRow = (entry: BasesEntry): TimelineRow => ({
			file: entry.file,
			title: entry.file.basename,
			start: startProp ? getDate(this.app, entry, startProp) : null,
			end: endProp ? getDate(this.app, entry, endProp) : null,
		});

		// Lanes follow Bases grouping: consume `data.groupedData` directly.
		const groups = this.data.groupedData;
		const grouped = !(groups.length === 1 && groups[0] !== undefined && !groups[0].hasKey());
		const lanes: TimelineLane[] = [];
		const allRows: TimelineRow[] = [];
		if (grouped) {
			for (const g of groups) {
				const label = g.hasKey() ? (g.key?.toString() ?? "") : "—";
				const id = g.hasKey() ? label : "__tm_null__";
				const rows = g.entries.map(makeRow);
				allRows.push(...rows);
				lanes.push({ id, label, rows });
			}
		} else {
			const rows = (groups[0]?.entries ?? this.data.data).map(makeRow);
			allRows.push(...rows);
			lanes.push({ id: "__all__", label: null, rows });
		}

		// Determine date range across all set ends.
		let min: Date | null = null;
		let max: Date | null = null;
		for (const row of allRows) {
			for (const d of [row.start, row.end]) {
				if (!d) continue;
				if (!min || d < min) min = startOfDay(d);
				if (!max || d > max) max = startOfDay(d);
			}
		}
		const today = startOfDay(new Date());
		if (!min || !max) {
			min = today;
			max = today;
		}
		// Fixed, padded window per scale (not just min..max) so there's always
		// room to browse / drag around the tasks.
		let rangeStart: Date;
		let rangeEnd: Date;
		if (rangePadding === "fit") {
			// Trim to exactly the item span, aligned to whole scale units.
			rangeStart = startOfUnit(min, scale);
			rangeEnd = endOfUnit(max, scale);
		} else if (rangePadding === "moderate") {
			// The fit span plus one whole unit of padding on each side.
			rangeStart = addUnits(min, scale, -1);
			rangeEnd = endOfUnit(addUnits(max, scale, 1), scale);
		} else if (scale === "week") {
			rangeStart = addDays(startOfWeekMonday(min), -3 * 7);
			rangeEnd = addDays(startOfWeekMonday(max), 3 * 7 + 6);
		} else if (scale === "day") {
			rangeStart = addDays(min, -7);
			rangeEnd = addDays(max, 14);
		} else if (scale === "month") {
			rangeStart = addMonths(startOfMonth(min), -3);
			rangeEnd = endOfMonth(addMonths(startOfMonth(max), 3));
		} else {
			rangeStart = addUnits(min, scale, -1);
			rangeEnd = endOfUnit(addUnits(max, scale, 1), scale);
		}
		let totalUnits = Math.max(1, offsetOf(addDays(rangeEnd, 1), rangeStart, scale));
		// Over the budget, narrow the range to the window holding the most rows;
		// the rest clamp to its edges.
		if (totalUnits > maxUnits) {
			rangeStart = bestWindowStart(allRows, maxUnits, scale);
			rangeEnd = addDays(addUnits(rangeStart, scale, maxUnits), -1);
			totalUnits = maxUnits;
		}
		let tiers = buildTiers(rangeStart, totalUnits, scale);

		// Lower bound on the density: how wide a cell must be for the widest label
		// of a tier to fit that tier's narrowest cell.
		const rows = TIER_ORDER.slice(0, TIER_ORDER.indexOf(scale) + 1);
		let minPxPerUnit = 1;
		for (const row of rows) {
			const labels = possibleLabels(row, rangeStart, rangeEnd);
			measureLabels(this.containerEl, labels);
			const widest = labels.reduce((w, l) => Math.max(w, labelWidths.get(l) ?? 0), 0);
			minPxPerUnit = Math.max(minPxPerUnit, widest / (MIN_ATOMS[scale][row] ?? 1));
		}

		const labelWidth = this.labelGutterWidth();
		const viewportWidth = this.containerEl.clientWidth;
		const densityFor = (tot: number): number => {
			if (autoZoom) {
				const fit = tot > 0 && viewportWidth > labelWidth ? (viewportWidth - labelWidth) / tot : 0;
				return Math.max(minPxPerUnit, fit);
			}
			return Math.max(minPxPerUnit, (PX_DEFAULT[scale] * zoom) / 100);
		};
		let pxPerUnit = densityFor(totalUnits);

		// A clipped first/last cell is too narrow for its label because it is cut
		// off, not because the density is too low — so grow the range, in whole
		// scale units to keep it aligned.
		if (viewportWidth > labelWidth) {
			const unitsToFit = (seg: TimelineAxisSegment): number => {
				const missing = (labelWidths.get(seg.label) ?? 0) / pxPerUnit - seg.units;
				return missing > 0 ? Math.ceil(missing) : 0;
			};
			let unitsStart = 0;
			let unitsEnd = 0;
			for (const tier of tiers) {
				const first = tier.segments[0];
				const last = tier.segments[tier.segments.length - 1];
				if (first) unitsStart = Math.max(unitsStart, unitsToFit(first));
				if (last) unitsEnd = Math.max(unitsEnd, unitsToFit(last));
			}
			if (unitsStart > 0 || unitsEnd > 0) {
				if (unitsStart > 0) rangeStart = addUnits(rangeStart, scale, -unitsStart);
				if (unitsEnd > 0) rangeEnd = endOfUnit(addUnits(rangeEnd, scale, unitsEnd), scale);
				totalUnits = Math.max(1, offsetOf(addDays(rangeEnd, 1), rangeStart, scale));
				tiers = buildTiers(rangeStart, totalUnits, scale);
				pxPerUnit = densityFor(totalUnits);
			}
		}
		geom.start = rangeStart;
		geom.units = totalUnits;
		const todayOffset = offsetOf(today, rangeStart, scale);
		this.ready = true;

		setTimelineState({
			hasRange: true,
			scale,
			pxPerUnit,
			rangeStart,
			totalUnits,
			todayOffset,
			tiers,
			lanes,
			context,
			message: null,
		});
	}
}

// Header tiers stack coarsest-first; a scale shows every level down to itself.
const TIER_ORDER: TimelineScale[] = ["year", "quarter", "month", "week", "day"];

/**
 * Fewest units a tier's cell can span, per scale. The atom's own row is 1 by
 * definition; coarser rows vary, so their minimum binds. Day counts only appear
 * where the atom is a day: a month spans at least 28 days, a quarter 90, a year
 * 365. Elsewhere the nesting is exact — a week is 7 days, a quarter 3 months, a
 * year 12 months.
 */
const MIN_ATOMS: Record<TimelineScale, Partial<Record<TimelineScale, number>>> = {
	day: { day: 1, week: 7, month: 28, quarter: 90, year: 365 },
	week: { week: 1, month: 28 / 7, quarter: 90 / 7, year: 365 / 7 },
	month: { month: 1, quarter: 3, year: 12 },
	quarter: { quarter: 1, year: 4 },
	year: { year: 1 },
};

/** Label of a header segment starting at `d`, per tier. */
const LABEL_OF: Record<TimelineScale, (d: Date) => string> = {
	year: (d) => `${d.getFullYear()}`,
	quarter: (d) => `Q${Math.floor(d.getMonth() / 3) + 1}`,
	month: (d) => d.toLocaleDateString(getLocale(), { month: "short" }),
	week: (d) => `${d.getDate()}`,
	day: (d) => `${d.getDate()}`,
};

/**
 * Every label a tier can render. Sampling one leap year covers each value of the
 * day/week/month/quarter cycles whatever `LABEL_OF` makes of them; the year tier
 * has no cycle, so its labels come from the range.
 */
function possibleLabels(unit: TimelineScale, rangeStart: Date, rangeEnd: Date): string[] {
	const labels = new Set<string>();
	if (unit === "year") {
		for (let y = rangeStart.getFullYear(); y <= rangeEnd.getFullYear(); y++) {
			labels.add(LABEL_OF.year(new Date(y, 0, 1)));
		}
		return [...labels];
	}
	const end = new Date(2025, 0, 1);
	for (let d = new Date(2024, 0, 1); d < end; d = addUnits(d, unit, 1)) labels.add(LABEL_OF[unit](d));
	return [...labels];
}

const labelWidths = new Map<string, number>();

/** Drop measured label widths; call when the font could have changed. */
function clearLabelWidths(): void {
	labelWidths.clear();
}

/**
 * On-screen width of each label, measured with the real header style so font,
 * theme and script are accounted for. Measured once per distinct label.
 */
function measureLabels(container: HTMLElement, labels: string[]): void {
	const missing = labels.filter((l) => !labelWidths.has(l));
	if (missing.length === 0) return;
	const probe = container.createDiv({ cls: "tm-tl-measure" });
	const spans = missing.map((l) => probe.createSpan({ cls: "tm-tl-seg-label", text: l }));
	spans.forEach((span, i) => labelWidths.set(missing[i] as string, span.offsetWidth));
	probe.remove();
}

/** First day of the scale unit containing d (also the snap-to-grid target). */
function startOfUnit(d: Date, scale: TimelineScale): Date {
	if (scale === "year") return new Date(d.getFullYear(), 0, 1);
	if (scale === "quarter") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
	if (scale === "month") return startOfMonth(d);
	if (scale === "week") return startOfWeekMonday(d);
	return startOfDay(d);
}

/** Start of the unit n whole units away from the one containing d. */
function addUnits(d: Date, scale: TimelineScale, n: number): Date {
	const s = startOfUnit(d, scale);
	if (scale === "year") return new Date(s.getFullYear() + n, 0, 1);
	if (scale === "quarter") return addMonths(s, 3 * n);
	if (scale === "month") return addMonths(s, n);
	if (scale === "week") return addDays(s, 7 * n);
	return addDays(s, n);
}

/** Last day of the scale unit containing d. */
function endOfUnit(d: Date, scale: TimelineScale): Date {
	return addDays(addUnits(d, scale, 1), -1);
}

/** Whole units from `from` to `to`; both must start a unit. */
function unitsBetween(from: Date, to: Date, scale: TimelineScale): number {
	const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
	if (scale === "year") return to.getFullYear() - from.getFullYear();
	if (scale === "quarter") return months / 3;
	if (scale === "month") return months;
	if (scale === "week") return dayDiff(to, from) / 7;
	return dayDiff(to, from);
}

/**
 * Offset of `d` from `rangeStart` in scale units: whole units plus the fraction
 * through the unit holding `d`. A unit is one cell wide however many days it has,
 * so days only ever enter as that fraction.
 */
function offsetOf(d: Date, rangeStart: Date, scale: TimelineScale): number {
	const unitStart = startOfUnit(d, scale);
	const unitDays = dayDiff(addUnits(unitStart, scale, 1), unitStart);
	const fraction = unitDays > 0 ? dayDiff(d, unitStart) / unitDays : 0;
	return unitsBetween(rangeStart, unitStart, scale) + fraction;
}

/** Start of the `maxUnits`-wide window holding the most rows whole, unit-aligned. */
function bestWindowStart(rows: TimelineRow[], maxUnits: number, scale: TimelineScale): Date {
	const spans = rows
		.map((r) => ({ from: r.start ?? r.end, to: r.end ?? r.start }))
		.filter((s): s is { from: Date; to: Date } => s.from !== null && s.to !== null)
		.sort((a, b) => a.from.getTime() - b.from.getTime());
	let best = startOfUnit(spans[0]?.from ?? new Date(), scale);
	let bestCount = -1;
	for (const candidate of spans) {
		const from = startOfUnit(candidate.from, scale);
		const to = addUnits(from, scale, maxUnits);
		const count = spans.filter((s) => s.from >= from && s.to < to).length;
		if (count > bestCount) {
			bestCount = count;
			best = from;
		}
	}
	return best;
}

/** The date at `offset` scale units from `rangeStart`; inverse of `offsetOf`. */
function dateAt(offset: number, rangeStart: Date, scale: TimelineScale): Date {
	const whole = Math.floor(offset);
	const unitStart = addUnits(rangeStart, scale, whole);
	const unitDays = dayDiff(addUnits(unitStart, scale, 1), unitStart);
	return addDays(unitStart, Math.round((offset - whole) * unitDays));
}

/**
 * Stacked header rows, coarsest first: a scale shows every level down to itself
 * (year → +quarter → +month → +week → +day). Each tier groups the days sharing a
 * unit into one labelled segment; the first and last are clipped to the range.
 */
function buildTiers(rangeStart: Date, totalUnits: number, scale: TimelineScale): TimelineAxisTier[] {
	const tierFor = (unit: TimelineScale): TimelineAxisTier => {
		const segments: TimelineAxisSegment[] = [];
		let cursor = startOfUnit(rangeStart, unit);
		for (;;) {
			const from = offsetOf(cursor, rangeStart, scale);
			if (from >= totalUnits) break;
			const next = addUnits(cursor, unit, 1);
			const start = Math.max(from, 0);
			const end = Math.min(offsetOf(next, rangeStart, scale), totalUnits);
			segments.push({ label: LABEL_OF[unit](cursor), unitOffset: start, units: end - start });
			cursor = next;
		}
		return { segments };
	};
	return TIER_ORDER.slice(0, TIER_ORDER.indexOf(scale) + 1).map(tierFor);
}
