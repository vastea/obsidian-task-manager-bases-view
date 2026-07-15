import {
	type BasesAllOptions,
	type BasesEntry,
	type BasesOptions,
	type BasesViewConfig,
	type QueryController,
	BasesView,
} from "obsidian";
import { mount, unmount } from "svelte";
import Timeline from "./Timeline.svelte";
import type TaskManagerPlugin from "../main";
import {
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
import { t } from "../i18n.svelte";
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

// Horizontal density (px per day) is computed in onDataUpdated below from the
// scale's default density and the zoom slider (or the pane width when
// "auto zoom" is on). `scale` only controls the tick granularity.

// Upstream density (px per day) per scale — what zoom = 100% renders at. The
// day/week/month values are the unchanged upstream constants; quarter/year are
// this plugin's additions.
const PX_DEFAULT: Record<TimelineScale, number> = { day: 48, week: 22, month: 8, quarter: 3, year: 1 };

// Cap the visible span per scale so a stray outlier date can't balloon the
// track (and the per-day tier loop) to an unusable size. day/week/month are
// the unchanged upstream caps; quarter/year get proportional ones (~40 units).
const MAX_DAYS: Record<TimelineScale, number> = { day: 120, week: 560, month: 1460, quarter: 3660, year: 14600 };

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
	];
	// Zoom controls density only — independent of the "padding: fit" range option:
	// padding picks WHICH range is shown, zoom picks HOW densely it is drawn. With
	// "auto zoom" on the density is computed from the pane width, so the manual
	// slider is meaningless and only offered when auto zoom is off.
	const zoomItems: BasesOptions[] = [
		{
			type: "toggle",
			key: "autoZoom",
			displayName: t("optAutoZoom"),
			default: false,
		},
	];
	if (config.get("autoZoom") !== true) {
		zoomItems.push({
			type: "slider",
			key: "zoom",
			displayName: t("optZoom"),
			default: 100,
			min: 10,
			max: 200,
			step: 5,
			instant: true,
		});
	}
	options.push({ type: "group", displayName: t("optZoom"), items: zoomItems });
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
		// Zoom is a percentage of the scale's default density; 100 = upstream look.
		const zoom = rawZoom == null ? 100 : Number(rawZoom);
		const rangePadding = (this.config.get("rangePadding") as string | undefined) ?? "default";
		// Keep the .base clean/readable: drop values that equal the option defaults
		// (removed → falls back to the option default).
		if (this.config.get("rangePadding") === "default") this.config.set("rangePadding", null);
		if (this.config.get("autoZoom") === false) this.config.set("autoZoom", null);
		if (rawZoom != null && zoom === 100) this.config.set("zoom", null);

		const writeEnabled = isWritable(startProp) && isWritable(endProp);
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
		};

		if (!startProp && !endProp) {
			this.ready = true;
			setTimelineState({
				hasRange: false,
				scale,
				pxPerDay: 1,
				rangeStart: new Date(),
				totalDays: 0,
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
			// "default": the unchanged upstream padding per scale (day/week/month).
			rangeStart = addDays(startOfWeekMonday(min), -3 * 7);
			rangeEnd = addDays(startOfWeekMonday(max), 3 * 7 + 6);
		} else if (scale === "day") {
			rangeStart = addDays(min, -7);
			rangeEnd = addDays(max, 14);
		} else if (scale === "month") {
			rangeStart = addMonths(startOfMonth(min), -3);
			rangeEnd = endOfMonth(addMonths(startOfMonth(max), 3));
		} else {
			// The new quarter/year scales have no upstream window → moderate's.
			rangeStart = addUnits(min, scale, -1);
			rangeEnd = endOfUnit(addUnits(max, scale, 1), scale);
		}
		// Upstream outlier guard: cap the span so one stray date can't balloon the
		// track to an unusable width (keeps the start, trims the far tail).
		let totalDays = Math.max(1, dayDiff(rangeEnd, rangeStart) + 1);
		if (totalDays > MAX_DAYS[scale]) {
			totalDays = MAX_DAYS[scale];
			rangeEnd = addDays(rangeStart, totalDays - 1);
		}
		let tiers = buildTiers(rangeStart, totalDays, scale);

		// Uniform density: the widest label in each tier must fit a full unit cell
		// (proportional). The finest tier usually dominates, but a long coarse label
		// can raise it too. This is the slider's low end (fit is applied in the view).
		const order2: TimelineScale[] = ["year", "quarter", "month", "week", "day"];
		const units = order2.slice(0, order2.indexOf(scale) + 1);
		let minPxPerDay = 1;
		tiers.forEach((tier, ti) => {
			const unit = units[ti] ?? scale;
			let widest = 0;
			for (const s of tier.segments) widest = Math.max(widest, labelPx(s.label));
			minPxPerDay = Math.max(minPxPerDay, widest / DAYS_PER_UNIT[unit]);
		});

		// Density: with "auto zoom" on it is derived from the pane width (the whole
		// range fills the pane); otherwise it is the scale's default density scaled
		// linearly by the zoom slider, so the mapping is strictly monotonic (bigger
		// zoom → bigger cells) and 100% reproduces the upstream look. Both are
		// floored by what labels need. Density is independent of rangePadding:
		// padding decides which range is shown, auto/zoom only how densely it is drawn.
		const LABEL_WIDTH = 180;
		const viewportWidth = this.containerEl.clientWidth;
		const densityFor = (tot: number): number => {
			if (autoZoom) {
				const fit = tot > 0 && viewportWidth > LABEL_WIDTH ? (viewportWidth - LABEL_WIDTH) / tot : 0;
				return Math.max(minPxPerDay, fit);
			}
			return Math.max(minPxPerDay, (PX_DEFAULT[scale] * zoom) / 100);
		};
		let pxPerDay = densityFor(totalDays);

		// Only once the layout width is known: if a partial first/last cell's label
		// does not fit at the *actual* density, extend the range by whole finest-scale
		// units until it does. No extension when everything already fits.
		if (rangePadding !== "default" && viewportWidth > LABEL_WIDTH) {
			const step = Math.max(1, Math.round(DAYS_PER_UNIT[scale]));
			let extraStart = 0;
			let extraEnd = 0;
			for (const tier of tiers) {
				const first = tier.segments[0];
				const last = tier.segments[tier.segments.length - 1];
				if (first) extraStart = Math.max(extraStart, Math.ceil(labelPx(first.label) / pxPerDay) - first.days);
				if (last) extraEnd = Math.max(extraEnd, Math.ceil(labelPx(last.label) / pxPerDay) - last.days);
			}
			extraStart = extraStart > 0 ? Math.ceil(extraStart / step) * step : 0;
			extraEnd = extraEnd > 0 ? Math.ceil(extraEnd / step) * step : 0;
			if (extraStart > 0 || extraEnd > 0) {
				rangeStart = addDays(rangeStart, -extraStart);
				totalDays += extraStart + extraEnd;
				tiers = buildTiers(rangeStart, totalDays, scale);
				pxPerDay = densityFor(totalDays);
			}
		}
		const todayOffset = dayDiff(today, rangeStart);
		this.ready = true;

		setTimelineState({
			hasRange: true,
			scale,
			pxPerDay,
			rangeStart,
			totalDays,
			todayOffset,
			tiers,
			lanes,
			context,
			message: null,
		});
	}
}

const DAYS_PER_UNIT: Record<TimelineScale, number> = { day: 1, week: 7, month: 30.44, quarter: 91.31, year: 365.25 };
// Rough on-screen width (px) of a header label — proportional font, so an estimate.
const labelPx = (s: string) => s.length * 6.5 + 8;

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

// Stacked header rows. Levels accumulate with granularity: year → +quarter →
// +month → +week → +day, coarsest on top. Each tier groups consecutive days
// that share a unit into one labelled segment.
function buildTiers(rangeStart: Date, totalDays: number, scale: TimelineScale): TimelineAxisTier[] {
	const shortMonth = (d: Date) => d.toLocaleDateString(undefined, { month: "short" });
	const segmentsBy = (keyOf: (d: Date) => string, labelOf: (d: Date) => string): TimelineAxisTier => {
		const segments: { label: string; dayOffset: number; days: number }[] = [];
		let curKey: string | null = null;
		for (let i = 0; i < totalDays; i++) {
			const d = addDays(rangeStart, i);
			const k = keyOf(d);
			if (k !== curKey) {
				segments.push({ label: labelOf(d), dayOffset: i, days: 1 });
				curKey = k;
			} else {
				const last = segments[segments.length - 1];
				if (last) last.days++;
			}
		}
		return { segments };
	};
	const tierFor: Record<TimelineScale, () => TimelineAxisTier> = {
		year: () => segmentsBy((d) => `${d.getFullYear()}`, (d) => `${d.getFullYear()}`),
		quarter: () =>
			segmentsBy((d) => `${d.getFullYear()}-${Math.floor(d.getMonth() / 3)}`, (d) => `Q${Math.floor(d.getMonth() / 3) + 1}`),
		month: () => segmentsBy((d) => `${d.getFullYear()}-${d.getMonth()}`, (d) => shortMonth(d)),
		week: () => segmentsBy((d) => `${startOfWeekMonday(d).getTime()}`, (d) => `${startOfWeekMonday(d).getDate()}`),
		day: () => segmentsBy((d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`, (d) => `${d.getDate()}`),
	};
	const order: TimelineScale[] = ["year", "quarter", "month", "week", "day"];
	const idx = order.indexOf(scale);
	return order.slice(0, idx + 1).map((lvl) => tierFor[lvl]());
}
