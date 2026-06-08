import type { BasesPropertyId, RenderContext, TFile } from "obsidian";

export type TimelineScale = "day" | "week" | "month";

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

export interface TimelineAxisTick {
	label: string;
	/** Day offset from rangeStart. */
	dayOffset: number;
	/** Emphasised tick (e.g. month boundary). */
	major: boolean;
}

export interface TimelineContext {
	properties: BasesPropertyId[];
	renderContext: RenderContext;
	/** start & end are both writable note.* properties → drag enabled. */
	writeEnabled: boolean;
	openDetail: (file: TFile, evt: MouseEvent | KeyboardEvent) => void;
	/** Persist new start/end for a row (only provided ends are written). */
	write: (file: TFile, changes: { start?: Date | null; end?: Date | null }) => void;
}

export interface TimelineState {
	hasRange: boolean;
	scale: TimelineScale;
	pxPerDay: number;
	rangeStart: Date;
	totalDays: number;
	/** Day offset of "today" from rangeStart (for initial scroll). */
	todayOffset: number;
	ticks: TimelineAxisTick[];
	lanes: TimelineLane[];
	context: TimelineContext | null;
	message: string | null;
}

const EMPTY: TimelineState = {
	hasRange: false,
	scale: "week",
	pxPerDay: 24,
	rangeStart: new Date(),
	totalDays: 0,
	todayOffset: 0,
	ticks: [],
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
