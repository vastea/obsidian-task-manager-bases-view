import { type App, Modal, Setting } from "obsidian";
import type { Category } from "../settings";
import { formatTime } from "../shared/section-parser";
import { FileSuggest } from "../shared/file-suggest";
import { t as tr } from "../i18n.svelte";

export interface LogModalResult {
	startMinutes: number;
	endMinutes: number;
	note: string;
	link: string | null;
	/** Raw category token to write back, e.g. "Dev" or "Dev|#4c8bf5"; null → no category. */
	category: string | null;
}

export interface LogModalOptions {
	startMinutes: number;
	endMinutes: number;
	categories: Category[];
	onSubmit: (result: LogModalResult) => void;
	/** "create" (default) shows the create copy; "edit" pre-fills and shows edit copy. */
	mode?: "create" | "edit";
	/** Initial values, used in edit mode (and ignored when absent). */
	note?: string;
	link?: string | null;
	/** Initial raw category token (may carry an inline colour like "Dev|#4c8bf5"). */
	category?: string | null;
}

function stripBrackets(s: string): string {
	return s.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
}

/** Name part of a `(...)` category token, e.g. "Dev|#4c8bf5" → "Dev". */
function categoryName(token: string | null): string {
	return (token ?? "").split("|")[0]?.trim() ?? "";
}

/** Parse an "HH:MM" value (from a native time input) into minutes, or null. */
function parseTime(v: string): number | null {
	const m = /^(\d{1,2}):(\d{2})$/.exec(v.trim());
	if (!m) return null;
	const h = Number(m[1]);
	const min = Number(m[2]);
	if (h > 23 || min > 59) return null;
	return h * 60 + min;
}

/** Modal for creating or editing a calendar log block: time + description + optional link + category. */
export class LogBlockModal extends Modal {
	private opts: LogModalOptions;
	private result: LogModalResult;
	private submitted = false;

	constructor(app: App, opts: LogModalOptions) {
		super(app);
		this.opts = opts;
		// Pre-fill with the dragged time (create) or the existing block (edit). In
		// edit mode the category keeps its raw token so an inline colour survives a
		// save where the dropdown isn't touched.
		this.result = {
			startMinutes: opts.startMinutes,
			endMinutes: opts.endMinutes,
			note: opts.note ?? "",
			link: opts.link ?? null,
			category: opts.category ?? null,
		};
	}

	private get isEdit(): boolean {
		return this.opts.mode === "edit";
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("tm-log-modal");
		contentEl.createEl("h3", { text: this.isEdit ? tr("editLogBlock") : tr("newLogBlock") });

		// Editable start/end time, pre-filled from the drag. Native time inputs
		// use 24h "HH:MM" values regardless of display locale.
		new Setting(contentEl).setName(tr("time")).then((setting) => {
			setting.controlEl.addClass("tm-log-modal-times");
			const start = setting.controlEl.createEl("input", { type: "time" });
			start.value = formatTime(this.result.startMinutes);
			setting.controlEl.createSpan({ cls: "tm-log-modal-times-sep", text: "–" });
			const end = setting.controlEl.createEl("input", { type: "time" });
			end.value = formatTime(this.result.endMinutes);
			start.addEventListener("change", () => {
				const m = parseTime(start.value);
				if (m !== null) this.result.startMinutes = m;
			});
			end.addEventListener("change", () => {
				const m = parseTime(end.value);
				if (m !== null) this.result.endMinutes = m;
			});
		});

		new Setting(contentEl).setName(tr("description")).addText((text) => {
			text.setValue(this.result.note);
			text.setPlaceholder(tr("descPlaceholder")).onChange((v) => (this.result.note = v.trim()));
			const input = text.inputEl;
			input.addEventListener("keydown", (e) => {
				if (e.key === "Enter") {
					e.preventDefault();
					this.submitted = true;
					this.close();
				}
			});
			window.setTimeout(() => input.focus(), 0);
		});

		new Setting(contentEl)
			.setName(tr("linkTask"))
			.setDesc(tr("linkDesc"))
			.addText((text) => {
				if (this.result.link) text.setValue(this.result.link);
				text.setPlaceholder(tr("taskTitlePlaceholder")).onChange((v) => {
					const val = v.trim();
					this.result.link = val ? stripBrackets(val) : null;
				});
				// Filename autocomplete: filter notes as the user types; picking a
				// file fills its basename and sets it as the link target.
				new FileSuggest(this.app, text.inputEl, (file) => {
					this.result.link = file.basename;
				});
			});

		if (this.opts.categories.length > 0) {
			new Setting(contentEl).setName(tr("category")).addDropdown((d) => {
				d.addOption("", tr("none"));
				for (const c of this.opts.categories) d.addOption(c.name, c.name);
				// Pre-select by name. `result.category` keeps the raw token (with any
				// inline colour) until the user actually picks a different value, at
				// which point we switch to the plain name and drop the colour token.
				d.setValue(categoryName(this.result.category));
				d.onChange((v) => (this.result.category = v || null));
			});
		}

		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText(this.isEdit ? tr("save") : tr("create"))
					.setCta()
					.onClick(() => {
						this.submitted = true;
						this.close();
					}),
			)
			.addButton((b) => b.setButtonText(tr("cancel")).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
		if (this.submitted) {
			// Guard against an inverted/zero range after manual editing.
			if (this.result.endMinutes <= this.result.startMinutes) {
				this.result.endMinutes = Math.min(24 * 60, this.result.startMinutes + 15);
			}
			this.opts.onSubmit(this.result);
		}
	}
}
