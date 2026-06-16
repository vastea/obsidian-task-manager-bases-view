export interface CalEntry {
	dayIndex: number; // 0..6
	lineIndex: number; // line in the day's note
	startMinutes: number;
	endMinutes: number;
	link: string | null;
	note: string;
	/** Resolved category display name (colour stripped), or null. */
	category: string | null;
	/** Raw `(...)` token from the file, e.g. "Dev|#4c8bf5"; preserved across edits. */
	categoryToken: string | null;
	/** Resolved CSS colour for the block, or null → default accent. */
	color: string | null;
}

export interface CalDay {
	date: Date;
	isToday: boolean;
	hasNote: boolean;
}

export interface CalContext {
	/** Open the linked task (or the day's note) for an entry. */
	openEntry: (entry: CalEntry) => void;
	/** Create a new log block on a day (opens a modal to fill details). */
	createBlock: (dayIndex: number, startMinutes: number, endMinutes: number) => void;
	/** Move/resize an existing block to a new time on the same day. */
	updateBlock: (entry: CalEntry, startMinutes: number, endMinutes: number) => void;
	/** Open a modal to edit all of an existing block's fields (time/link/note/category). */
	editBlock: (entry: CalEntry) => void;
	/** Delete the log line backing this block. */
	deleteBlock: (entry: CalEntry) => void;
	gotoPrev: () => void;
	gotoNext: () => void;
	gotoToday: () => void;
	/** Jump the grid to the week containing an arbitrary date. */
	gotoDate: (date: Date) => void;
}

export interface CalState {
	title: string;
	days: CalDay[];
	entries: CalEntry[];
	hourHeight: number;
	/** Visible window, in minutes from midnight (default 0..1440). */
	dayStartMin: number;
	dayEndMin: number;
	/** Current local time, minutes from midnight; for the now-indicator line. */
	nowMinutes: number;
	/** Index into `days` that is today, or -1 when this week has no today. */
	todayIndex: number;
	context: CalContext | null;
}

let state = $state<CalState>({
	title: "",
	days: [],
	entries: [],
	hourHeight: 40,
	dayStartMin: 0,
	dayEndMin: 24 * 60,
	nowMinutes: 0,
	todayIndex: -1,
	context: null,
});

export function getCalState(): CalState {
	return state;
}

export function setCalState(next: CalState): void {
	state = next;
}
