import { type App, type TFile } from "obsidian";

/**
 * The weekly-log calendar is the *only* feature that parses note body content
 * (everything else is frontmatter). It reads a single configurable section
 * (default "Log") whose list items look like:
 *
 *   ## Log
 *   - 14:00-15:00 [[Some task]] note text
 *   - 16:00-16:30
 *
 * Each item: `HH:MM-HH:MM` (24h) → optional `[[wikilink]]` → optional note.
 */

export interface LogEntry {
	/** Minutes from midnight. */
	startMinutes: number;
	endMinutes: number;
	start: string; // "HH:MM"
	end: string; // "HH:MM"
	category: string | null; // optional "(category)" token
	link: string | null; // inner wikilink text, e.g. "Some task"
	note: string;
	/** Line index within the whole file (0-based), for in-place edits. */
	lineIndex: number;
}

const LOG_LINE_RE = /^\s*[-*]\s+(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})\s*(.*)$/;
const CATEGORY_RE = /^\(([^)]+)\)\s*(.*)$/;
const WIKILINK_RE = /^\[\[([^\]]+)\]\]\s*(.*)$/;

export function formatTime(minutes: number): string {
	const h = Math.floor(minutes / 60);
	const m = minutes % 60;
	return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function toMinutes(h: string, m: string): number {
	return Number(h) * 60 + Number(m);
}

/** Parse a single line; returns null if it isn't a log item. */
export function parseLogLine(line: string, lineIndex: number): LogEntry | null {
	const match = LOG_LINE_RE.exec(line);
	if (!match) return null;
	const [, sh, sm, eh, em, rest] = match;
	let remainder = (rest ?? "").trim();

	// Optional leading "(category)".
	let category: string | null = null;
	const catMatch = CATEGORY_RE.exec(remainder);
	if (catMatch) {
		category = (catMatch[1] ?? "").trim() || null;
		remainder = (catMatch[2] ?? "").trim();
	}

	let link: string | null = null;
	let note = remainder;
	const linkMatch = WIKILINK_RE.exec(remainder);
	if (linkMatch) {
		// Use only the target side of an aliased link for the value.
		link = (linkMatch[1] ?? "").split("|")[0]?.trim() ?? null;
		note = (linkMatch[2] ?? "").trim();
	}
	return {
		startMinutes: toMinutes(sh ?? "0", sm ?? "0"),
		endMinutes: toMinutes(eh ?? "0", em ?? "0"),
		start: `${(sh ?? "0").padStart(2, "0")}:${sm ?? "00"}`,
		end: `${(eh ?? "0").padStart(2, "0")}:${em ?? "00"}`,
		category,
		link,
		note,
		lineIndex,
	};
}

/** Render a LogEntry-ish object back to a markdown list item. */
export function formatLogLine(
	start: string,
	end: string,
	link: string | null,
	note: string,
	category: string | null = null,
): string {
	let line = `- ${start}-${end}`;
	if (category) line += ` (${category})`;
	if (link) line += ` [[${link}]]`;
	if (note) line += ` ${note}`;
	return line;
}

export interface SectionRange {
	/** Line index of the heading itself, or -1 if the section is absent. */
	headingLine: number;
	/** First body line index of the section (exclusive of heading). */
	bodyStart: number;
	/** One-past-last body line index of the section. */
	bodyEnd: number;
}

/**
 * Locate the named section in a file's text using the metadata cache headings.
 * Returns null when the heading is absent.
 */
export function findSection(app: App, file: TFile, lines: string[], sectionName: string): SectionRange | null {
	const cache = app.metadataCache.getFileCache(file);
	const headings = cache?.headings ?? [];
	const target = sectionName.trim().toLowerCase();

	let headingIdx = -1;
	let headingLevel = 0;
	for (const h of headings) {
		if (h.heading.trim().toLowerCase() === target) {
			headingIdx = h.position.start.line;
			headingLevel = h.level;
			break;
		}
	}
	if (headingIdx === -1) return null;

	// Body runs until the next heading of equal-or-higher level, else EOF.
	let bodyEnd = lines.length;
	for (const h of headings) {
		if (h.position.start.line > headingIdx && h.level <= headingLevel) {
			bodyEnd = h.position.start.line;
			break;
		}
	}
	return { headingLine: headingIdx, bodyStart: headingIdx + 1, bodyEnd };
}

const HEADING_RE = /^(#{1,6})\s+(.*?)\s*$/;

/**
 * Locate the named section by scanning the text for a markdown heading. Used
 * for writes, where the metadata cache may be stale right after create/modify.
 */
export function findSectionByScan(lines: string[], sectionName: string): SectionRange | null {
	const target = sectionName.trim().toLowerCase();
	let headingIdx = -1;
	let headingLevel = 0;
	for (let i = 0; i < lines.length; i++) {
		const m = HEADING_RE.exec(lines[i] ?? "");
		if (m && (m[2] ?? "").trim().toLowerCase() === target) {
			headingIdx = i;
			headingLevel = (m[1] ?? "#").length;
			break;
		}
	}
	if (headingIdx === -1) return null;

	let bodyEnd = lines.length;
	for (let i = headingIdx + 1; i < lines.length; i++) {
		const m = HEADING_RE.exec(lines[i] ?? "");
		if (m && (m[1] ?? "#").length <= headingLevel) {
			bodyEnd = i;
			break;
		}
	}
	return { headingLine: headingIdx, bodyStart: headingIdx + 1, bodyEnd };
}

/** Parse every log entry in the named section, scanning the raw text. */
export function parseLogText(text: string, sectionName: string): LogEntry[] {
	const lines = text.split("\n");
	const range = findSectionByScan(lines, sectionName);
	if (!range) return [];
	const entries: LogEntry[] = [];
	for (let i = range.bodyStart; i < range.bodyEnd; i++) {
		const parsed = parseLogLine(lines[i] ?? "", i);
		if (parsed) entries.push(parsed);
	}
	return entries;
}

/** Parse every log entry inside the named section. */
export function parseLogSection(app: App, file: TFile, text: string, sectionName: string): LogEntry[] {
	const lines = text.split("\n");
	const range = findSection(app, file, lines, sectionName);
	if (!range) return [];
	const entries: LogEntry[] = [];
	for (let i = range.bodyStart; i < range.bodyEnd; i++) {
		const parsed = parseLogLine(lines[i] ?? "", i);
		if (parsed) entries.push(parsed);
	}
	return entries;
}
