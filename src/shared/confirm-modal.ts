import { type App, Modal, Setting } from "obsidian";

export interface ConfirmOptions {
	title: string;
	message: string;
	confirmText: string;
	cancelText: string;
	/** When true, the confirm button is styled as destructive. */
	danger?: boolean;
	onConfirm: () => void;
}

/** A yes/no confirmation dialog. */
export class ConfirmModal extends Modal {
	private opts: ConfirmOptions;

	constructor(app: App, opts: ConfirmOptions) {
		super(app);
		this.opts = opts;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: this.opts.title });
		contentEl.createEl("p", { text: this.opts.message });

		new Setting(contentEl)
			.addButton((b) => {
				b.setButtonText(this.opts.confirmText).onClick(() => {
					this.close();
					this.opts.onConfirm();
				});
				if (this.opts.danger) b.buttonEl.addClass("mod-warning");
				else b.setCta();
			})
			.addButton((b) => b.setButtonText(this.opts.cancelText).onClick(() => this.close()));
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
