import type { BasesPropertyId, RenderContext, TFile } from "obsidian";

export type TimelineScale = "day" | "week" | "month" | "quarter" | "year";

export interface TimelineRow {
	file: TFile;
	title: string;
	/** Start/end as local-midnight Dates, or null when that end is unset. */
	start: Date | null;
	end: Date | null;
}

export interface TimelineLane {
	id: string;
	label: string | null; // null = no grouping (flat)
	rows: TimelineRow[];
}

/** A labelled span within one header tier (e.g. a single month or quarter). */
export interface TimelineAxisSegment {
	label: string;
	/** Day offset of the segment start from rangeStart. */
	dayOffset: number;
	/** Segment length in days. */
	days: number;
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
	/** Snap a date to the current grid unit (identity when snapping is off). */
	snap: (d: Date) => Date;
}

export interface TimelineState {
	hasRange: boolean;
	scale: TimelineScale;
	/** Uniform px/day density (computed in the view: labels-fit, pane-fit, size). */
	pxPerDay: number;
	rangeStart: Date;
	totalDays: number;
	/** Day offset of "today" from rangeStart (for initial scroll). */
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
	pxPerDay: 1,
	rangeStart: new Date(),
	totalDays: 0,
	todayOffset: 0,
	tiers: [],
	lanes: [],
	context: null,
	message: null,
};

let state = $state<TimelineState>(EMPTY);

export function getTimelineState(): TimelineState {
	return state;
}

export function setTimelineState(next: TimelineState): void {
	state = next;
}
