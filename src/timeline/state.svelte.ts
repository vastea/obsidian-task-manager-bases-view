import type { BasesPropertyId, RenderContext, TFile } from "obsidian";

export type TimelineScale = "day" | "week" | "month" | "quarter" | "year";

export interface TimelineRow {
	file: TFile;
	title: string;
	/** Start/end as local-midnight Dates, or null when that end is unset. */
	start: Date | null;
	end: Date | null;
	/** True when neither date is set; the bar anchors at the range start. */
	undated: boolean;
}

export interface TimelineLane {
	id: string;
	label: string | null; // null = no grouping (flat)
	rows: TimelineRow[];
}

/** A labelled span within one header tier (e.g. a single month or quarter). */
export interface TimelineAxisSegment {
	label: string;
	/** Offset of the segment start from rangeStart, in scale units. */
	unitOffset: number;
	/** Segment length in scale units. */
	units: number;
}

/** One header row. Tiers stack coarsest-first (year, quarter, month, …). */
export interface TimelineAxisTier {
	segments: TimelineAxisSegment[];
}

export interface TimelineContext {
	properties: BasesPropertyId[];
	renderContext: RenderContext;
	/** start & end are both writable note.* properties → drag enabled. */
	writeEnabled: boolean;
	openDetail: (file: TFile, evt: MouseEvent | KeyboardEvent) => void;
	/** Persist new start/end for a row (only provided ends are written). */
	write: (file: TFile, changes: { start?: Date | null; end?: Date | null }) => void;
	/** Snap a start date to its grid unit's first day (identity when off). */
	snap: (d: Date) => Date;
	/** Snap an inclusive end date to its grid unit's last day (identity when off). */
	snapEnd: (d: Date) => Date;
	/** Offset of `d` from the range start, in scale units, clamped to the range. */
	offsetOf: (d: Date) => number;
	/** Unclamped offset used as the base for drag calculations. */
	rawOffsetOf: (d: Date) => number;
	/** The date at `offset` scale units from the range start; accepts offsets outside the range. */
	dateAt: (offset: number) => Date;
	/** Whether `d` falls outside the shown range, so `offsetOf` clamped it. */
	isOutside: (d: Date) => boolean;
}

export interface TimelineState {
	hasRange: boolean;
	scale: TimelineScale;
	/** Uniform horizontal density: pixels per scale unit. */
	pxPerUnit: number;
	rangeStart: Date;
	/** Length of the range in scale units. */
	totalUnits: number;
	/** Offset of "today" from rangeStart in scale units (for initial scroll). */
	todayOffset: number;
	/** Stacked header rows (coarsest first), one per granularity level. */
	tiers: TimelineAxisTier[];
	lanes: TimelineLane[];
	context: TimelineContext | null;
	message: string | null;
}

const EMPTY: TimelineState = {
	hasRange: false,
	scale: "week",
	pxPerUnit: 1,
	rangeStart: new Date(),
	totalUnits: 0,
	todayOffset: 0,
	tiers: [],
	lanes: [],
	context: null,
	message: null,
};

export interface TimelineStore {
	readonly value: TimelineState;
	set(next: TimelineState): void;
}

/** A reactive state holder scoped to one view instance. */
export function createTimelineStore(): TimelineStore {
	let state = $state<TimelineState>(EMPTY);
	return {
		get value() {
			return state;
		},
		set(next: TimelineState) {
			state = next;
		},
	};
}
