import { AbstractInputSuggest, type App, type TFile } from "obsidian";

/**
 * Filename autocomplete for a text input. Suggests markdown files whose
 * basename (or path) matches what the user has typed, ordered so prefix
 * matches come first. On pick it writes the chosen file's basename back into
 * the input and notifies the caller.
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
	private inputEl: HTMLInputElement;
	private onPick: (file: TFile) => void;

	constructor(app: App, inputEl: HTMLInputElement, onPick: (file: TFile) => void) {
		super(app, inputEl);
		this.inputEl = inputEl;
		this.onPick = onPick;
	}

	protected getSuggestions(query: string): TFile[] {
		const q = query.toLowerCase().trim();
		const files = this.app.vault.getMarkdownFiles();
		const matches = q ? files.filter((f) => f.basename.toLowerCase().includes(q) || f.path.toLowerCase().includes(q)) : files;
		return matches
			.sort((a, b) => {
				if (q) {
					const ap = a.basename.toLowerCase().startsWith(q) ? 0 : 1;
					const bp = b.basename.toLowerCase().startsWith(q) ? 0 : 1;
					if (ap !== bp) return ap - bp;
				}
				return a.basename.localeCompare(b.basename);
			})
			.slice(0, 50);
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createDiv({ cls: "tm-file-suggest-name", text: file.basename });
		if (file.parent && file.parent.path !== "/") {
			el.createDiv({ cls: "tm-file-suggest-path", text: file.path });
		}
	}

	selectSuggestion(file: TFile): void {
		this.inputEl.value = file.basename;
		this.onPick(file);
		this.close();
	}
}
