import { type App, type TFile, moment, normalizePath } from "obsidian";
import type { TaskManagerSettings } from "../settings";
import {
	type LogEntry,
	findSectionByScan,
	formatLogLine,
	formatTime,
	parseLogText,
} from "../shared/section-parser";

/**
 * All file IO for the weekly-log calendar: locating / creating daily notes and
 * reading / writing the log section. The only body convention is the log
 * section format defined in shared/section-parser.
 */

export function dailyNotePath(date: Date, settings: TaskManagerSettings): string {
	const name = moment(date).format(settings.dateFormat);
	const folder = settings.journalFolder.trim().replace(/\/+$/, "");
	return normalizePath(folder ? `${folder}/${name}.md` : `${name}.md`);
}

export function getDailyNote(app: App, date: Date, settings: TaskManagerSettings): TFile | null {
	return app.vault.getFileByPath(dailyNotePath(date, settings));
}

export async function ensureDailyNote(app: App, date: Date, settings: TaskManagerSettings): Promise<TFile> {
	const path = dailyNotePath(date, settings);
	const existing = app.vault.getFileByPath(path);
	if (existing) return existing;

	const folder = settings.journalFolder.trim().replace(/\/+$/, "");
	if (folder && !app.vault.getFolderByPath(normalizePath(folder))) {
		await app.vault.createFolder(normalizePath(folder));
	}
	return app.vault.create(path, "");
}

export async function readDayEntries(
	app: App,
	date: Date,
	settings: TaskManagerSettings,
): Promise<LogEntry[]> {
	const file = getDailyNote(app, date, settings);
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
	const file = await ensureDailyNote(app, date, settings);
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
	settings: TaskManagerSettings,
	lineIndex: number,
): Promise<void> {
	const file = getDailyNote(app, date, settings);
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
	settings: TaskManagerSettings,
	lineIndex: number,
	startMinutes: number,
	endMinutes: number,
): Promise<void> {
	const file = getDailyNote(app, date, settings);
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

function insertLineIntoSection(text: string, sectionName: string, line: string): string {
	const lines = text.split("\n");
	const range = findSectionByScan(lines, sectionName);
	if (range) {
		// Insert after the last non-empty body line of the section.
		let insertAt = range.bodyEnd;
		while (insertAt > range.bodyStart && (lines[insertAt - 1] ?? "").trim() === "") {
			insertAt--;
		}
		lines.splice(insertAt, 0, line);
		return lines.join("\n");
	}
	// No section: append heading + line at end of file.
	const trimmed = text.replace(/\s*$/, "");
	const prefix = trimmed.length > 0 ? `${trimmed}\n\n` : "";
	return `${prefix}## ${sectionName}\n${line}\n`;
}
