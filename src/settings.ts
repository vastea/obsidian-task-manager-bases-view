import { type App, PluginSettingTab, Setting } from "obsidian";
import type TaskManagerPlugin from "./main";
import { type Lang, setLocale, t } from "./i18n.svelte";

export type WeekStart = "sunday" | "monday";

export interface TaskManagerSettings {
	/** UI language. */
	language: Lang;

	/** Per-view registration toggles. */
	enableKanban: boolean;
	enableTimeline: boolean;
	enableCalendar: boolean;

	/** Calendar-only, cross-file conventions. */
	journalFolder: string;
	dateFormat: string;
	weekStart: WeekStart;
	logSection: string;

	/** When creating a log block, also append a back-reference into the linked task. */
	logBacklink: boolean;
	/** Section heading used for the back-reference inside the linked task. */
	logBacklinkSection: string;

	/** Time-block categories (colour-coded). When off, blocks use the default colour. */
	categoriesEnabled: boolean;
	/** One "name|color" per line; color is any CSS colour (e.g. #e57373). */
	categoriesText: string;
}

export const DEFAULT_SETTINGS: TaskManagerSettings = {
	language: "en",
	enableKanban: true,
	enableTimeline: true,
	enableCalendar: true,
	journalFolder: "Journal",
	dateFormat: "YYYY-MM-DD",
	weekStart: "monday",
	logSection: "Log",
	logBacklink: false,
	logBacklinkSection: "Log",
	categoriesEnabled: false,
	categoriesText: "",
};

export interface Category {
	name: string;
	color: string;
}

/** Parse the "name|color" lines into category definitions. */
export function parseCategories(text: string): Category[] {
	return text
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const idx = line.indexOf("|");
			if (idx === -1) return { name: line, color: "" };
			return { name: line.slice(0, idx).trim(), color: line.slice(idx + 1).trim() };
		})
		.filter((c) => c.name.length > 0);
}

export class TaskManagerSettingTab extends PluginSettingTab {
	plugin: TaskManagerPlugin;

	constructor(app: App, plugin: TaskManagerPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		const reloadNotice = (setting: Setting) => {
			setting.descEl.createDiv({ cls: "tm-setting-reload-note", text: t("setReloadNote") });
		};

		new Setting(containerEl)
			.setName(t("setLanguage"))
			.setDesc(t("setLanguageDesc"))
			.addDropdown((d) =>
				d
					.addOption("en", "English")
					.addOption("zh", "中文")
					.setValue(this.plugin.settings.language)
					.onChange(async (v) => {
						this.plugin.settings.language = v as Lang;
						setLocale(v as Lang);
						await this.plugin.saveSettings();
						this.display(); // re-render settings labels in the new language
					}),
			);

		new Setting(containerEl).setName(t("setViews")).setHeading();

		const kanban = new Setting(containerEl)
			.setName(t("setKanban"))
			.setDesc(t("setKanbanDesc"))
			.addToggle((tg) =>
				tg.setValue(this.plugin.settings.enableKanban).onChange(async (v) => {
					this.plugin.settings.enableKanban = v;
					await this.plugin.saveSettings();
				}),
			);
		reloadNotice(kanban);

		const timeline = new Setting(containerEl)
			.setName(t("setTimeline"))
			.setDesc(t("setTimelineDesc"))
			.addToggle((tg) =>
				tg.setValue(this.plugin.settings.enableTimeline).onChange(async (v) => {
					this.plugin.settings.enableTimeline = v;
					await this.plugin.saveSettings();
				}),
			);
		reloadNotice(timeline);

		const calendar = new Setting(containerEl)
			.setName(t("setCalendar"))
			.setDesc(t("setCalendarDesc"))
			.addToggle((tg) =>
				tg.setValue(this.plugin.settings.enableCalendar).onChange(async (v) => {
					this.plugin.settings.enableCalendar = v;
					await this.plugin.saveSettings();
				}),
			);
		reloadNotice(calendar);

		new Setting(containerEl).setName(t("setCalendarHeading")).setHeading();

		new Setting(containerEl)
			.setName(t("setJournalFolder"))
			.setDesc(t("setJournalFolderDesc"))
			.addText((tx) =>
				tx
					.setPlaceholder("Journal")
					.setValue(this.plugin.settings.journalFolder)
					.onChange(async (v) => {
						this.plugin.settings.journalFolder = v.trim();
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("setDateFormat"))
			.setDesc(t("setDateFormatDesc"))
			.addText((tx) =>
				tx
					.setPlaceholder("YYYY-MM-DD")
					.setValue(this.plugin.settings.dateFormat)
					.onChange(async (v) => {
						this.plugin.settings.dateFormat = v.trim() || "YYYY-MM-DD";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("setFirstDay"))
			.addDropdown((d) =>
				d
					.addOption("monday", t("setMonday"))
					.addOption("sunday", t("setSunday"))
					.setValue(this.plugin.settings.weekStart)
					.onChange(async (v) => {
						this.plugin.settings.weekStart = v as WeekStart;
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("setLogSection"))
			.setDesc(t("setLogSectionDesc"))
			.addText((tx) =>
				tx
					.setPlaceholder("Log")
					.setValue(this.plugin.settings.logSection)
					.onChange(async (v) => {
						this.plugin.settings.logSection = v.trim() || "Log";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName(t("setBacklink"))
			.setDesc(t("setBacklinkDesc"))
			.addToggle((tg) =>
				tg.setValue(this.plugin.settings.logBacklink).onChange(async (v) => {
					this.plugin.settings.logBacklink = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(t("setBacklinkSection"))
			.setDesc(t("setBacklinkSectionDesc"))
			.addText((tx) =>
				tx
					.setPlaceholder("Log")
					.setValue(this.plugin.settings.logBacklinkSection)
					.onChange(async (v) => {
						this.plugin.settings.logBacklinkSection = v.trim() || "Log";
						await this.plugin.saveSettings();
					}),
			);

		new Setting(containerEl).setName(t("setCategoriesHeading")).setHeading();

		new Setting(containerEl)
			.setName(t("setEnableCategories"))
			.setDesc(t("setEnableCategoriesDesc"))
			.addToggle((tg) =>
				tg.setValue(this.plugin.settings.categoriesEnabled).onChange(async (v) => {
					this.plugin.settings.categoriesEnabled = v;
					await this.plugin.saveSettings();
				}),
			);

		new Setting(containerEl)
			.setName(t("setCategories"))
			.setDesc(t("setCategoriesDesc"))
			.addTextArea((tx) => {
				tx
					.setPlaceholder("Dev|blue\nMeeting|rgb(224,164,88)\nBreak|#7bbf6a")
					.setValue(this.plugin.settings.categoriesText)
					.onChange(async (v) => {
						this.plugin.settings.categoriesText = v;
						await this.plugin.saveSettings();
					});
				tx.inputEl.rows = 4;
			});
	}
}
