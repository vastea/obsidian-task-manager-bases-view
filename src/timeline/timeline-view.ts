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

// Horizontal density (px per day) is derived from the size slider in the view;
// see Timeline.svelte. `scale` only controls the tick granularity below.

export function timelineViewOptions(_config: BasesViewConfig): BasesAllOptions[] {
	return [
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
		{
			type: "slider",
			key: "cellSize",
			displayName: t("optSize"),
			default: 180,
			min: 0,
			max: 180,
			step: 4,
			instant: true,
		},
	];
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
		const rawCell = this.config.get("cellSize");
		// "fit" (stored as a readable string) and 0 both mean fit.
		const cellSize = rawCell == null ? 180 : rawCell === "fit" ? 0 : Number(rawCell);
		const rangePadding = (this.config.get("rangePadding") as string | undefined) ?? "default";
		// Keep the .base clean/readable: drop defaults (max → removed → falls back to
		// the option default) and store the fit end as "fit" instead of 0.
		if (this.config.get("rangePadding") === "default") this.config.set("rangePadding", null);
		if (rawCell === 0) this.config.set("cellSize", "fit");
		else if (rawCell != null && rawCell !== "fit" && Number(rawCell) === 180) this.config.set("cellSize", null);

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
			snap: (d) => {
				if (!this.plugin.settings.snapToGrid) return d;
				if (scale === "year") return new Date(d.getFullYear(), 0, 1);
				if (scale === "quarter") return new Date(d.getFullYear(), Math.floor(d.getMonth() / 3) * 3, 1);
				if (scale === "month") return startOfMonth(d);
				if (scale === "week") return startOfWeekMonday(d);
				return startOfDay(d);
			},
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
			// Trim to exactly the item span (rounded to the scale unit).
			if (scale === "day") {
				rangeStart = startOfDay(min);
				rangeEnd = startOfDay(max);
			} else if (scale === "week") {
				rangeStart = startOfWeekMonday(min);
				rangeEnd = addDays(startOfWeekMonday(max), 6);
			} else {
				rangeStart = startOfMonth(min);
				rangeEnd = endOfMonth(max);
			}
		} else if (rangePadding === "moderate") {
			// Light padding, aligned to the unit.
			if (scale === "day") {
				rangeStart = addDays(min, -3);
				rangeEnd = addDays(max, 6);
			} else if (scale === "week") {
				rangeStart = addDays(startOfWeekMonday(min), -7);
				rangeEnd = addDays(startOfWeekMonday(max), 13);
			} else if (scale === "quarter") {
				rangeStart = addMonths(startOfMonth(min), -(min.getMonth() % 3));
				rangeEnd = endOfMonth(addMonths(startOfMonth(max), 2 - (max.getMonth() % 3)));
			} else if (scale === "year") {
				rangeStart = addMonths(startOfMonth(min), -min.getMonth());
				rangeEnd = endOfMonth(addMonths(startOfMonth(max), 11 - max.getMonth()));
			} else {
				rangeStart = addMonths(startOfMonth(min), -1);
				rangeEnd = endOfMonth(addMonths(startOfMonth(max), 1));
			}
		} else {
			// "default": the unchanged upstream padding (day/week/month). The new
			// quarter/year scales have no upstream window, so they get a sensible one.
			if (scale === "week") {
				rangeStart = addDays(startOfWeekMonday(min), -3 * 7);
				rangeEnd = addDays(startOfWeekMonday(max), 3 * 7 + 6);
			} else if (scale === "day") {
				rangeStart = addDays(min, -7);
				rangeEnd = addDays(max, 14);
			} else if (scale === "year") {
				rangeStart = addMonths(startOfMonth(min), -min.getMonth());
				rangeEnd = endOfMonth(addMonths(startOfMonth(max), 11 - max.getMonth()));
			} else {
				// month & quarter → ±3 months, like the upstream month window.
				rangeStart = addMonths(startOfMonth(min), -3);
				rangeEnd = endOfMonth(addMonths(startOfMonth(max), 3));
			}
		}
		// Cover the whole padded span so the header/grid always reach as far as the
		// bars (no capping — at "fit" the density shrinks to keep it on screen).
		let totalDays = Math.max(1, dayDiff(rangeEnd, rangeStart) + 1);
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

		// Size slider maps 0 = fit (labels-fit / pane-fit) → 100 = the original
		// upstream density per scale. The tooltip's 0..100 is that interpolation.
		const LABEL_WIDTH = 180;
		const MAX_CELL = 180;
		const PX_ORIG: Record<TimelineScale, number> = { day: 48, week: 22, month: 8, quarter: 3, year: 1 };
		const viewportWidth = this.containerEl.clientWidth;
		const densityFor = (tot: number): number => {
			// MAX = the original upstream density per scale.
			if (cellSize >= MAX_CELL) return Math.max(minPxPerDay, PX_ORIG[scale]);
			// 0 = fit: fill the pane (never below what labels need).
			if (cellSize <= 0) {
				const fit = tot > 0 && viewportWidth > LABEL_WIDTH ? (viewportWidth - LABEL_WIDTH) / tot : 0;
				return Math.max(minPxPerDay, fit);
			}
			// Explicit target px per cell — only floored by the label minimum so every
			// slider step has an effect (no fit-to-pane dead zone at the low end).
			return Math.max(minPxPerDay, cellSize / DAYS_PER_UNIT[scale]);
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
