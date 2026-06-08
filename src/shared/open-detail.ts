import { type App, type TFile, type WorkspaceLeaf, Keymap } from "obsidian";

/**
 * Clicking a task opens its file in a right-hand split, keeping "view on the
 * left, detail on the right". We reuse one detail leaf so repeated clicks don't
 * spawn endless splits; mod-click bypasses reuse and opens a new tab/window.
 *
 * There is no custom detail view — the note itself is the detail panel.
 */

let detailLeaf: WorkspaceLeaf | null = null;

function leafIsAlive(app: App, leaf: WorkspaceLeaf | null): leaf is WorkspaceLeaf {
	if (!leaf) return false;
	let found = false;
	app.workspace.iterateAllLeaves((l) => {
		if (l === leaf) found = true;
	});
	return found;
}

export function openDetail(
	app: App,
	file: TFile,
	evt?: MouseEvent | KeyboardEvent | null,
	line?: number,
): void {
	const eState = line !== undefined ? { line } : undefined;
	const modEvent = Keymap.isModEvent(evt ?? null);
	if (modEvent) {
		// New tab / split / window per the user's modifier — don't reuse.
		void app.workspace.openLinkText(file.path, "", modEvent, eState ? { eState } : undefined);
		return;
	}

	if (leafIsAlive(app, detailLeaf)) {
		void detailLeaf.openFile(file, { active: true, eState });
		void app.workspace.revealLeaf(detailLeaf);
		return;
	}

	const leaf = app.workspace.getLeaf("split", "vertical");
	detailLeaf = leaf;
	void leaf.openFile(file, { active: true, eState });
}
