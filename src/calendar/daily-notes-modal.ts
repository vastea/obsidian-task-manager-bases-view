import { type App, Modal, Setting } from "obsidian";
import { dailyNotesConfig } from "./log-io";
import { t } from "../i18n.svelte";

/** Obsidian's settings opener is an undocumented internal API; access it defensively. */
interface AppWithSettings extends App {
	setting?: {
		open(): void;
		openTabById(id: string): void;
	};
}

/**
 * Shown when the weekly-log calendar is enabled: confirms which daily-note
 * folder / format / template the view will use (all owned by the core Daily
 * notes plugin), and offers a shortcut to that plugin's settings. Purely
 * informational — it never changes the user's config.
 */
export class DailyNotesInfoModal extends Modal {
	private readonly onDontRemind?: () => void;

	constructor(app: App, opts?: { onDontRemind?: () => void }) {
		super(app);
		this.onDontRemind = opts?.onDontRemind;
	}

	onOpen(): void {
		const { contentEl } = this;
		contentEl.addClass("tm-daily-notes-modal");
		contentEl.createEl("h3", { text: t("dailyNotesTitle") });

		const cfg = dailyNotesConfig();
		if (!cfg.enabled) {
			contentEl.createEl("p", { text: t("dailyNotesDisabled") });
		} else {
			contentEl.createEl("p", { text: t("dailyNotesIntro") });
			const list = contentEl.createEl("ul", { cls: "tm-daily-notes-list" });
			const row = (label: string, value: string) => {
				const li = list.createEl("li");
				li.createEl("strong", { text: `${label}: ` });
				li.appendText(value);
			};
			row(t("dailyNotesFolderLabel"), cfg.folder || t("dailyNotesVaultRoot"));
			row(t("dailyNotesFormatLabel"), cfg.format);
			row(t("dailyNotesTemplateLabel"), cfg.template || t("none"));
		}

		// Two actions only. Closing the modal (X / Esc / click-away) is the implicit
		// "got it" — it doesn't persist anything, so the reminder shows again next
		// time. Only "Don't remind again" opts out for good.
		const buttons = new Setting(contentEl).addButton((b) =>
			b.setButtonText(t("dailyNotesOpenSettings")).setCta().onClick(() => this.openDailyNotesSettings()),
		);
		if (this.onDontRemind) {
			buttons.addButton((b) =>
				b
					.setButtonText(t("dailyNotesDontRemind"))
					.onClick(() => {
						this.onDontRemind?.();
						this.close();
					}),
			);
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}

	private openDailyNotesSettings(): void {
		const setting = (this.app as AppWithSettings).setting;
		try {
			setting?.open();
			setting?.openTabById("daily-notes");
		} catch {
			// Internal API moved/renamed — the in-modal text still tells the user where to go.
		}
		this.close();
	}
}
