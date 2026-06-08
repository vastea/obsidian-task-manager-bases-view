import { type App, type BasesEntry, type BasesPropertyId, type Value, parsePropertyId } from "obsidian";

/**
 * Safe reads from a BasesEntry / its backing frontmatter.
 *
 * Rule of thumb: rendering goes through `Value` (so Bases formatting applies),
 * but anything we need as a concrete JS value (dates for the timeline, the raw
 * group key for bucketing) is read off the file frontmatter, which is stable
 * and unambiguous. The plugin never hard-codes property names — callers pass
 * the BasesPropertyId the user chose in the view options.
 */

export function getValue(entry: BasesEntry, propId: BasesPropertyId): Value | null {
	try {
		return entry.getValue(propId);
	} catch {
		return null;
	}
}

/** String form of a property value, or null when empty/missing. */
export function getString(entry: BasesEntry, propId: BasesPropertyId): string | null {
	const value = getValue(entry, propId);
	if (!value || !value.isTruthy()) return null;
	const s = value.toString();
	return s.length > 0 ? s : null;
}

/** Raw frontmatter value for a `note.*` property, read straight from the cache. */
export function getRawFrontmatter(app: App, entry: BasesEntry, propId: BasesPropertyId): unknown {
	const parsed = parsePropertyId(propId);
	if (parsed.type !== "note") return undefined;
	const fm = app.metadataCache.getFileCache(entry.file)?.frontmatter;
	return fm ? fm[parsed.name] : undefined;
}

/**
 * Bucket key used to group an entry by a property. We read the raw frontmatter
 * value (not the rendered Value) so the comparison against user-supplied
 * predefined column values is exact.
 */
export function getGroupKey(app: App, entry: BasesEntry, propId: BasesPropertyId): string | null {
	const raw = getRawFrontmatter(app, entry, propId);
	if (raw === undefined || raw === null || raw === "") return null;
	if (Array.isArray(raw)) {
		// Multi-value property: first non-empty wins for column placement.
		const first = raw.find((v) => v !== undefined && v !== null && v !== "");
		return first === undefined ? null : String(first);
	}
	return String(raw);
}

/** Parse a frontmatter date-ish value into a local-midnight Date (date-only). */
export function getDate(app: App, entry: BasesEntry, propId: BasesPropertyId): Date | null {
	const raw = getRawFrontmatter(app, entry, propId);
	return parseDateValue(raw);
}

export function parseDateValue(raw: unknown): Date | null {
	if (raw === undefined || raw === null || raw === "") return null;
	if (raw instanceof Date) return isNaN(raw.getTime()) ? null : raw;

	const str = String(raw).trim();
	// Date-only "YYYY-MM-DD" → build in local time to avoid UTC day shift.
	const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
	if (dateOnly) {
		const y = Number(dateOnly[1]);
		const m = Number(dateOnly[2]);
		const d = Number(dateOnly[3]);
		return new Date(y, m - 1, d);
	}
	const parsed = new Date(str);
	return isNaN(parsed.getTime()) ? null : parsed;
}
