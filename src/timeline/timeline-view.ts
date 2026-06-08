import {
	type BasesAllOptions,
	type BasesEntry,
	type BasesViewConfig,
	type QueryController,
	BasesView,
} from "obsidian";
import { mount, unmount } from "svelte";
import Timeline from "./Timeline.svelte";
import {
	type TimelineAxisTick,
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

const PX_PER_DAY: Record<TimelineScale, number> = { day: 48, week: 22, month: 8 };

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
			options: { day: t("scaleDay"), week: t("scaleWeek"), month: t("scaleMonth") },
		},
	];
}

export class TimelineView extends BasesView {
	type = TM_TIMELINE_VIEW;
	private containerEl: HTMLElement;
	private component: Record<string, unknown> | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.containerEl = containerEl;
	}

	override onload(): void {
		this.containerEl.addClass("tm-timeline-root");
		this.component = mount(Timeline, { target: this.containerEl });
	}

	override onunload(): void {
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
		const pxPerDay = PX_PER_DAY[scale];

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
		};

		if (!startProp && !endProp) {
			setTimelineState({
				hasRange: false,
				scale,
				pxPerDay,
				rangeStart: new Date(),
				totalDays: 0,
				todayOffset: 0,
				ticks: [],
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
		if (scale === "month") {
			rangeStart = addMonths(startOfMonth(min), -3);
			rangeEnd = endOfMonth(addMonths(startOfMonth(max), 3));
		} else if (scale === "week") {
			rangeStart = addDays(startOfWeekMonday(min), -3 * 7);
			rangeEnd = addDays(startOfWeekMonday(max), 3 * 7 + 6);
		} else {
			rangeStart = addDays(min, -7);
			rangeEnd = addDays(max, 14);
		}
		// Cap the visible span per scale so a stray outlier date can't balloon the
		// track to an unusable width (keeps the start, trims the far tail).
		const MAX_DAYS: Record<TimelineScale, number> = { day: 120, week: 560, month: 1460 };
		let totalDays = Math.max(1, dayDiff(rangeEnd, rangeStart) + 1);
		if (totalDays > MAX_DAYS[scale]) {
			totalDays = MAX_DAYS[scale];
			rangeEnd = addDays(rangeStart, totalDays - 1);
		}
		const todayOffset = dayDiff(today, rangeStart);

		const ticks = buildTicks(rangeStart, totalDays, scale);

		setTimelineState({
			hasRange: true,
			scale,
			pxPerDay,
			rangeStart,
			totalDays,
			todayOffset,
			ticks,
			lanes,
			context,
			message: null,
		});
	}
}

function buildTicks(rangeStart: Date, totalDays: number, scale: TimelineScale): TimelineAxisTick[] {
	const ticks: TimelineAxisTick[] = [];
	for (let i = 0; i < totalDays; i++) {
		const d = addDays(rangeStart, i);
		if (scale === "day") {
			ticks.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, dayOffset: i, major: d.getDate() === 1 });
		} else if (scale === "week") {
			// Tick at each Monday.
			if (d.getDay() === 1 || i === 0) {
				ticks.push({ label: `${d.getMonth() + 1}/${d.getDate()}`, dayOffset: i, major: d.getDate() <= 7 });
			}
		} else {
			// month: tick at 1st of each month.
			if (d.getDate() === 1 || i === 0) {
				ticks.push({ label: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, dayOffset: i, major: true });
			}
		}
	}
	return ticks;
}
