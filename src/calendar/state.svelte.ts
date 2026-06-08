export interface CalEntry {
	dayIndex: number; // 0..6
	lineIndex: number; // line in the day's note
	startMinutes: number;
	endMinutes: number;
	link: string | null;
	note: string;
	category: string | null;
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
	/** Delete the log line backing this block. */
	deleteBlock: (entry: CalEntry) => void;
	gotoPrev: () => void;
	gotoNext: () => void;
	gotoToday: () => void;
}

export interface CalState {
	title: string;
	days: CalDay[];
	entries: CalEntry[];
	hourHeight: number;
	context: CalContext | null;
}

let state = $state<CalState>({ title: "", days: [], entries: [], hourHeight: 40, context: null });

export function getCalState(): CalState {
	return state;
}

export function setCalState(next: CalState): void {
	state = next;
}
