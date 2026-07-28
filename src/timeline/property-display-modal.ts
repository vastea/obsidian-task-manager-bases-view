import { type App, Modal, Setting } from "obsidian";
import { t } from "../i18n.svelte";

/** Guidance shown when a timeline switches to property-based labels. */
export class TimelinePropertyDisplayModal extends Modal {
	onOpen(): void {
		const { contentEl } = this;
		contentEl.createEl("h3", { text: t("timelinePropertyHintTitle") });
		contentEl.createEl("p", { text: t("timelinePropertyHintBody") });
		new Setting(contentEl).addButton((button) =>
			button
				.setButtonText(t("gotIt"))
				.setCta()
				.onClick(() => this.close()),
		);
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
