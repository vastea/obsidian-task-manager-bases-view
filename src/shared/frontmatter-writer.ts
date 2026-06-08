import { type App, type BasesPropertyId, type TFile, Notice, parsePropertyId } from "obsidian";
import { t } from "../i18n.svelte";

/**
 * Frontmatter is the only thing the plugin writes back, and only for `note.*`
 * properties (file/formula properties are not user frontmatter, so they are
 * read-only — drag/edit affordances must be disabled for them).
 */

/** Only note.* properties live in user frontmatter and can be written. */
export function isWritable(propId: BasesPropertyId | null): boolean {
	if (!propId) return false;
	try {
		return parsePropertyId(propId).type === "note";
	} catch {
		return false;
	}
}

/** The bare frontmatter key for a note.* property (e.g. note.status → status). */
export function propertyName(propId: BasesPropertyId): string | null {
	try {
		const parsed = parsePropertyId(propId);
		return parsed.type === "note" ? parsed.name : null;
	} catch {
		return null;
	}
}

/**
 * Set or delete a single frontmatter key. Passing `undefined`/`null` deletes it.
 * Returns true on success. Failures surface a Notice and resolve to false so the
 * UI can stay quiet (the subsequent onDataUpdated will reconcile state anyway).
 */
export async function writeProperty(
	app: App,
	file: TFile,
	propId: BasesPropertyId,
	value: unknown,
): Promise<boolean> {
	const name = propertyName(propId);
	if (!name) return false;
	try {
		await app.fileManager.processFrontMatter(file, (fm: Record<string, unknown>) => {
			if (value === undefined || value === null || value === "") {
				delete fm[name];
			} else {
				fm[name] = value;
			}
		});
		return true;
	} catch {
		new Notice(`${t("writeFailed")}: "${file.basename}"`);
		return false;
	}
}
