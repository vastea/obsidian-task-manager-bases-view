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
	parseLogText,
} from "../shared/section-parser";

/**
 * All file IO for the weekly-log calendar. Daily-note location/creation is
 * delegated to the core Daily notes plugin (via obsidian-daily-notes-interface),
 * so the folder / filename format / template are a single source of truth and
 * nested folders + templates are handled for us. The only body convention this
 * file owns is the log section format defined in shared/section-parser.
 */

/** Thrown when a write needs a daily note but the core plugin is unavailable. */
export class DailyNotesUnavailableError extends Error {}

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
	if (!appHasDailyNotesPluginLoaded()) throw new DailyNotesUnavailableError();
	const created = await createDailyNote(moment(date));
	if (!created) throw new DailyNotesUnavailableError();
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
	const day = moment(date).format("YYYY-MM-DD");
	const record = `- ${day} ${formatTime(startMinutes)}-${formatTime(endMinutes)}${note ? ` ${note}` : ""}`;
	await app.vault.process(target, (text) =>
		insertLineIntoSection(text, settings.logBacklinkSection, record),
	);
}

/** Delete a log line by its line index in the day's note. */
export async function deleteLogLine(
	app: App,
	date: Date,
	lineIndex: number,
): Promise<void> {
	const file = findDailyNote(date);
	if (!file) return;
	await app.vault.process(file, (text) => {
		const lines = text.split("\n");
		if (lineIndex < 0 || lineIndex >= lines.length) return text;
		lines.splice(lineIndex, 1);
		return lines.join("\n");
	});
}

/** Replace the time on an existing log line (used when dragging a block). */
export async function updateLogTime(
	app: App,
	date: Date,
	lineIndex: number,
	startMinutes: number,
	endMinutes: number,
): Promise<void> {
	const file = findDailyNote(date);
	if (!file) return;
	await app.vault.process(file, (text) => {
		const lines = text.split("\n");
		const old = lines[lineIndex];
		if (old === undefined) return text;
		// Keep the existing category / link / note, only rewrite the time range.
		const { link, note, category } = reparseLine(old);
		lines[lineIndex] = formatLogLine(
			formatTime(startMinutes),
			formatTime(endMinutes),
			link,
			note,
			category,
		);
		return lines.join("\n");
	});
}

function reparseLine(line: string): { link: string | null; note: string; category: string | null } {
	const entries = parseLogText(`## __tmp__\n${line}`, "__tmp__");
	const first = entries[0];
	if (first) return { link: first.link, note: first.note, category: first.category };
	return { link: null, note: "", category: null };
}
