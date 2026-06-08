import { type App, Modal, Setting } from "obsidian";
import type { Category } from "../settings";
import { formatTime } from "../shared/section-parser";
import { t as tr } from "../i18n.svelte";

export interface LogModalResult {
	note: string;
	link: string | null;
	category: string | null;
}

export interface LogModalOptions {
	startMinutes: number;
	endMinutes: number;
	categories: Category[];
	onSubmit: (result: LogModalResult) => void;
}

function stripBrackets(s: string): string {
	return s.replace(/^\[\[/, "").replace(/\]\]$/, "").trim();
}

/** Modal for creating a calendar log block: description + optional link + category. */
export class LogBlockModal extends Modal {
	private opts: LogModalOptions;
	private result: LogModalResult = { note: "", link: null, category: null };
	private submitted = false;

	constructor(app: App, opts: LogModalOptions) {
		super(app);
		this.opts = opts;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("tm-log-modal");
		contentEl.createEl("h3", { text: tr("newLogBlock") });
		contentEl.createEl("div", {
			cls: "tm-log-modal-time",
			text: `${formatTime(this.opts.startMinutes)} – ${formatTime(this.opts.endMinutes)}`,
		});

		new Setting(contentEl).setName(tr("description")).addText((text) => {
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
			.addText((text) =>
				text.setPlaceholder(tr("taskTitlePlaceholder")).onChange((v) => {
					const val = v.trim();
					this.result.link = val ? stripBrackets(val) : null;
				}),
			);

		if (this.opts.categories.length > 0) {
			new Setting(contentEl).setName(tr("category")).addDropdown((d) => {
				d.addOption("", tr("none"));
				for (const c of this.opts.categories) d.addOption(c.name, c.name);
				d.onChange((v) => (this.result.category = v || null));
			});
		}

		new Setting(contentEl)
			.addButton((b) =>
				b
					.setButtonText(tr("create"))
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
		if (this.submitted) this.opts.onSubmit(this.result);
	}
}
