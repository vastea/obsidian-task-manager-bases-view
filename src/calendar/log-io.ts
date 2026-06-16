import { type App, type TFile, moment } from "obsidian";
import {
	appHasDailyNotesPluginLoaded,
	createDailyNote,
	getAllDailyNotes,
	getDailyNote as getDailyNoteForMoment,
	getDailyNoteSettings,
} from "obsidian-daily-notes-interface";
import type { TaskManagerSettings } from "../settings";
import {
	type LogEntry,
	formatLogLine,
	formatTime,
	insertLineIntoSection,
	parseLogLine,
	parseLogText,
} from "../shared/section-parser";

/**
 * All file IO for the weekly-log calendar. Daily-note location/creation is
 * delegated to the core Daily notes plugin (via obsidian-daily-notes-interface),
 * so the folder / filename format / template are a single source of truth and
 * nested folders + templates are handled for us. The only body convention this
 * file owns is the log section format defined in shared/section-parser.
 */

/** Whether the core Daily notes plugin (or Periodic Notes) is available. */
export function dailyNotesPluginEnabled(): boolean {
	return appHasDailyNotesPluginLoaded();
}

export interface DailyNotesConfig {
	enabled: boolean;
	folder: string;
	format: string;
	template: string;
}

/** Current daily-note config (folder/format/template) as resolved by the core plugin. */
export function dailyNotesConfig(): DailyNotesConfig {
	const s = getDailyNoteSettings();
	return {
		enabled: appHasDailyNotesPluginLoaded(),
		folder: s?.folder ?? "",
		format: s?.format ?? "",
		template: s?.template ?? "",
	};
}

/** Find an existing daily note for the date, or null. */
export function findDailyNote(date: Date): TFile | null {
	if (!appHasDailyNotesPluginLoaded()) return null;
	return getDailyNoteForMoment(moment(date), getAllDailyNotes()) ?? null;
}

/** Find or create the daily note for the date (recursively creates folders + applies the template). */
export async function ensureDailyNote(date: Date): Promise<TFile> {
	const existing = findDailyNote(date);
	if (existing) return existing;
	if (!appHasDailyNotesPluginLoaded()) throw new Error("Daily notes plugin is not enabled");
	const created = await createDailyNote(moment(date));
	if (!created) throw new Error("Failed to create daily note");
	return created;
}

export async function readDayEntries(
	app: App,
	date: Date,
	settings: TaskManagerSettings,
): Promise<LogEntry[]> {
	const file = findDailyNote(date);
	if (!file) return [];
	const text = await app.vault.cachedRead(file);
	return parseLogText(text, settings.logSection).sort((a, b) => a.startMinutes - b.startMinutes);
}

export interface LogDraft {
	link?: string | null;
	note?: string;
	category?: string | null;
}

/** Insert a new log line into the day's note (creating note/section as needed). */
export async function insertLog(
	app: App,
	date: Date,
	settings: TaskManagerSettings,
	startMinutes: number,
	endMinutes: number,
	draft: LogDraft = {},
): Promise<void> {
	const file = await ensureDailyNote(date);
	const link = draft.link ?? null;
	const line = formatLogLine(
		formatTime(startMinutes),
		formatTime(endMinutes),
		link,
		draft.note ?? "",
		draft.category ?? null,
	);
	await app.vault.process(file, (text) => insertLineIntoSection(text, settings.logSection, line));

	// Optional back-reference into the linked task.
	if (settings.logBacklink && link) {
		await writeBacklink(app, settings, link, date, startMinutes, endMinutes, draft.note ?? "");
	}
}

/** Date + time-range prefix of a back-reference record; used to locate it for in-place edits. */
function backlinkPrefix(date: Date, startMinutes: number, endMinutes: number): string {
	const day = moment(date).format("YYYY-MM-DD");
	return `- ${day} ${formatTime(startMinutes)}-${formatTime(endMinutes)}`;
}

/** Full back-reference record line (prefix + optional note). */
function backlinkRecord(date: Date, startMinutes: number, endMinutes: number, note: string): string {
	return `${backlinkPrefix(date, startMinutes, endMinutes)}${note ? ` ${note}` : ""}`;
}

/** Append a record under a heading inside the linked task note. */
async function writeBacklink(
	app: App,
	settings: TaskManagerSettings,
	link: string,
	date: Date,
	startMinutes: number,
	endMinutes: number,
	note: string,
): Promise<void> {
	const target = app.metadataCache.getFirstLinkpathDest(link, "");
	if (!target) return;
	const record = backlinkRecord(date, startMinutes, endMinutes, note);
	await app.vault.process(target, (text) =>
		insertLineIntoSection(text, settings.logBacklinkSection, record),
	);
}

/**
 * Keep the back-reference in the linked task in step with a moved / resized /
 * deleted block. The existing record is matched by its date + *old* time range
 * (the note is ignored, so a hand-edited note still matches); `next === null`
 * removes the record, otherwise it is rewritten to the new time / note.
 * No-op when back-references are off, the link is empty, the task or the record
 * can't be found.
 */
async function syncBacklink(
	app: App,
	settings: TaskManagerSettings,
	link: string | null,
	date: Date,
	oldStart: number,
	oldEnd: number,
	next: { startMinutes: number; endMinutes: number; note: string } | null,
): Promise<void> {
	if (!settings.logBacklink || !link) return;
	const target = app.metadataCache.getFirstLinkpathDest(link, "");
	if (!target) return;
	const prefix = backlinkPrefix(date, oldStart, oldEnd);
	await app.vault.process(target, (text) => {
		const lines = text.split("\n");
		const idx = lines.findIndex((l) => l.trimStart().startsWith(prefix));
		if (idx === -1) return text;
		if (next === null) {
			lines.splice(idx, 1);
		} else {
			lines[idx] = backlinkRecord(date, next.startMinutes, next.endMinutes, next.note);
		}
		return lines.join("\n");
	});
}

/** Delete a log line by its line index in the day's note (and its back-reference). */
export async function deleteLogLine(
	app: App,
	date: Date,
	lineIndex: number,
	settings: TaskManagerSettings,
): Promise<void> {
	const file = findDailyNote(date);
	if (!file) return;
	let removed: LogEntry | null = null;
	await app.vault.process(file, (text) => {
		const lines = text.split("\n");
		if (lineIndex < 0 || lineIndex >= lines.length) return text;
		removed = parseLogLine(lines[lineIndex] ?? "", lineIndex);
		lines.splice(lineIndex, 1);
		return lines.join("\n");
	});
	// Drop the matching back-reference in the linked task, if any.
	if (removed) {
		const r: LogEntry = removed;
		await syncBacklink(app, settings, r.link, date, r.startMinutes, r.endMinutes, null);
	}
}

/** Replace the time on an existing log line (used when dragging a block); keeps the back-reference in step. */
export async function updateLogTime(
	app: App,
	date: Date,
	lineIndex: number,
	startMinutes: number,
	endMinutes: number,
	settings: TaskManagerSettings,
): Promise<void> {
	const file = findDailyNote(date);
	if (!file) return;
	let old: LogEntry | null = null;
	await app.vault.process(file, (text) => {
		const lines = text.split("\n");
		const line = lines[lineIndex];
		if (line === undefined) return text;
		// Keep the existing category / link / note, only rewrite the time range.
		const parsed = parseLogLine(line, lineIndex);
		if (!parsed) return text;
		old = parsed;
		lines[lineIndex] = formatLogLine(
			formatTime(startMinutes),
			formatTime(endMinutes),
			parsed.link,
			parsed.note,
			parsed.category,
		);
		return lines.join("\n");
	});
	// Move the matching back-reference in the linked task to the new time.
	if (old) {
		const o: LogEntry = old;
		await syncBacklink(app, settings, o.link, date, o.startMinutes, o.endMinutes, {
			startMinutes,
			endMinutes,
			note: o.note,
		});
	}
}
