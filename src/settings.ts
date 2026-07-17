import { type App, type DropdownComponent, PluginSettingTab, Setting, type SettingDefinitionItem } from "obsidian";
import type TaskManagerPlugin from "./main";
import { type Lang, setLocale, t } from "./i18n.svelte";

export type WeekStart = "sunday" | "monday";

/** Fewest cells a timeline header may be budgeted. */
export const MIN_MAX_UNITS = 48;
/** Cells a timeline header is budgeted unless the setting raises it. */
export const DEFAULT_MAX_UNITS = 120;

export interface TaskManagerSettings {
	/** UI language. */
	language: Lang;

	/** Per-view registration toggles. */
	enableKanban: boolean;
	enableTimeline: boolean;
	enableCalendar: boolean;

	/** Timeline: drag/resize snaps to the current scale's grid unit (drag only). */
	snapToGrid: boolean;
	/**
	 * Timeline: most cells a header may draw. Raising it buys a wider timeline at
	 * a render cost, and {@link MIN_MAX_UNITS} is the floor. A single timeline can
	 * waive the constraint in its view options.
	 */
	maxUnits: number;

	/** Calendar-only, cross-file conventions. */
	/**
	 * Whether to show the daily-notes config reminder when the calendar opens.
	 * On by default; there is no settings toggle — the only way to turn it off is
	 * the modal's "Don't remind again" button. Closing the modal keeps it on.
	 */
	dailyNotesReminder: boolean;
	weekStart: WeekStart;
	logSection: string;

	/** Visible time window in the weekly grid, in whole hours (0..24, start < end). */
	dayStartHour: number;
	dayEndHour: number;

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
	// On by default. The weekly log needs the core Daily notes plugin; when it's
	// missing the view surfaces a Notice rather than silently disappearing. We keep
	// this true so an update never removes the ribbon/command from existing users
	// who used the calendar on defaults without ever persisting settings.
	enableCalendar: true,
	snapToGrid: false,
	maxUnits: DEFAULT_MAX_UNITS,
	dailyNotesReminder: true,
	weekStart: "monday",
	logSection: "Log",
	dayStartHour: 0,
	dayEndHour: 24,
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

	getSettingDefinitions(): SettingDefinitionItem<keyof TaskManagerSettings>[] {
		const reloadDesc = (description: string): DocumentFragment =>
			createFragment((fragment) => {
				fragment.append(description);
				fragment.createDiv({ cls: "tm-setting-reload-note", text: t("setReloadNote") });
			});
		const hourLabel = (hour: number): string => String(hour).padStart(2, "0") + ":00";
		const hourOptions = (first: number, last: number): Record<string, string> => {
			const options: Record<string, string> = {};
			for (let hour = first; hour <= last; hour++) options[String(hour)] = hourLabel(hour);
			return options;
		};

		return [
			{
				name: t("setLanguage"),
				desc: t("setLanguageDesc"),
				control: {
					type: "dropdown",
					key: "language",
					defaultValue: DEFAULT_SETTINGS.language,
					options: { en: "English", zh: "中文", de: "Deutsch" },
				},
			},
			{
				type: "group",
				heading: t("setViews"),
				items: [
					{
						name: t("setKanban"),
						desc: reloadDesc(t("setKanbanDesc")),
						control: { type: "toggle", key: "enableKanban", defaultValue: true },
					},
					{
						name: t("setTimeline"),
						desc: reloadDesc(t("setTimelineDesc")),
						control: { type: "toggle", key: "enableTimeline", defaultValue: true },
					},
					{
						name: t("setCalendar"),
						desc: t("setCalendarDesc"),
						control: { type: "toggle", key: "enableCalendar", defaultValue: true },
					},
				],
			},
			{
				type: "group",
				heading: t("setTimelineHeading"),
				visible: () => this.plugin.settings.enableTimeline,
				items: [
					{
						name: t("setSnap"),
						desc: t("setSnapDesc"),
						control: { type: "toggle", key: "snapToGrid", defaultValue: false },
					},
					{
						name: t("setMaxUnits"),
						desc: reloadDesc(t("setMaxUnitsDesc")),
						control: {
							type: "number",
							key: "maxUnits",
							defaultValue: DEFAULT_MAX_UNITS,
							placeholder: String(DEFAULT_MAX_UNITS),
							min: MIN_MAX_UNITS,
							step: 1,
						},
					},
				],
			},
			{
				type: "group",
				heading: t("setCalendarHeading"),
				visible: () => this.plugin.settings.enableCalendar,
				items: [
					{ name: t("dailyNotesTitle"), desc: t("setDailyNotesHint") },
					{
						name: t("setFirstDay"),
						control: {
							type: "dropdown",
							key: "weekStart",
							defaultValue: DEFAULT_SETTINGS.weekStart,
							options: { monday: t("setMonday"), sunday: t("setSunday") },
						},
					},
					{
						name: t("setDayStart"),
						desc: t("setDayWindowDesc"),
						control: {
							type: "dropdown",
							key: "dayStartHour",
							defaultValue: String(DEFAULT_SETTINGS.dayStartHour),
							options: hourOptions(0, 23),
						},
					},
					{
						name: t("setDayEnd"),
						control: {
							type: "dropdown",
							key: "dayEndHour",
							defaultValue: String(DEFAULT_SETTINGS.dayEndHour),
							options: hourOptions(1, 24),
						},
					},
					{
						name: t("setLogSection"),
						desc: t("setLogSectionDesc"),
						control: { type: "text", key: "logSection", defaultValue: "Log", placeholder: "Log" },
					},
					{
						name: t("setBacklink"),
						desc: t("setBacklinkDesc"),
						control: { type: "toggle", key: "logBacklink", defaultValue: false },
					},
					{
						name: t("setBacklinkSection"),
						desc: t("setBacklinkSectionDesc"),
						visible: () => this.plugin.settings.logBacklink,
						control: { type: "text", key: "logBacklinkSection", defaultValue: "Log", placeholder: "Log" },
					},
					{
						name: t("setEnableCategories"),
						desc: t("setEnableCategoriesDesc"),
						control: { type: "toggle", key: "categoriesEnabled", defaultValue: false },
					},
					{
						name: t("setCategories"),
						desc: t("setCategoriesDesc"),
						visible: () => this.plugin.settings.categoriesEnabled,
						control: {
							type: "textarea",
							key: "categoriesText",
							defaultValue: "",
							placeholder: "Dev|blue\nMeeting|rgb(224,164,88)\nBreak|#7bbf6a",
							rows: 4,
						},
					},
				],
			},
		];
	}

	getControlValue(key: string): unknown {
		if (key === "dayStartHour" || key === "dayEndHour") {
			return String(this.plugin.settings[key]);
		}
		return this.plugin.settings[key as keyof TaskManagerSettings];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		let rebuild = false;
		let refreshVisibility = false;
		let calendarEnabled: boolean | null = null;

		switch (key) {
			case "language":
				if (value !== "en" && value !== "zh" && value !== "de") return;
				this.plugin.settings.language = value;
				setLocale(value);
				rebuild = true;
				break;
			case "enableKanban":
				if (typeof value !== "boolean") return;
				this.plugin.settings.enableKanban = value;
				break;
			case "enableTimeline":
				if (typeof value !== "boolean") return;
				this.plugin.settings.enableTimeline = value;
				refreshVisibility = true;
				break;
			case "enableCalendar":
				if (typeof value !== "boolean") return;
				this.plugin.settings.enableCalendar = value;
				calendarEnabled = value;
				refreshVisibility = true;
				break;
			case "snapToGrid":
				if (typeof value !== "boolean") return;
				this.plugin.settings.snapToGrid = value;
				break;
			case "maxUnits":
				if (typeof value !== "number" || !Number.isFinite(value)) return;
				this.plugin.settings.maxUnits = Math.max(Math.trunc(value), MIN_MAX_UNITS);
				break;
			case "weekStart":
				if (value !== "monday" && value !== "sunday") return;
				this.plugin.settings.weekStart = value;
				break;
			case "dayStartHour": {
				const start = Number(value);
				if (!Number.isInteger(start) || start < 0 || start > 23) return;
				this.plugin.settings.dayStartHour = start;
				if (this.plugin.settings.dayEndHour <= start) this.plugin.settings.dayEndHour = start + 1;
				rebuild = true;
				break;
			}
			case "dayEndHour": {
				const end = Number(value);
				if (!Number.isInteger(end) || end < 1 || end > 24) return;
				this.plugin.settings.dayEndHour = end;
				if (this.plugin.settings.dayStartHour >= end) this.plugin.settings.dayStartHour = end - 1;
				rebuild = true;
				break;
			}
			case "logSection":
				if (typeof value !== "string") return;
				this.plugin.settings.logSection = value.trim() || "Log";
				break;
			case "logBacklink":
				if (typeof value !== "boolean") return;
				this.plugin.settings.logBacklink = value;
				refreshVisibility = true;
				break;
			case "logBacklinkSection":
				if (typeof value !== "string") return;
				this.plugin.settings.logBacklinkSection = value.trim() || "Log";
				break;
			case "categoriesEnabled":
				if (typeof value !== "boolean") return;
				this.plugin.settings.categoriesEnabled = value;
				refreshVisibility = true;
				break;
			case "categoriesText":
				if (typeof value !== "string") return;
				this.plugin.settings.categoriesText = value;
				break;
			default:
				return;
		}

		await this.plugin.saveSettings();
		if (calendarEnabled === true) this.plugin.enableCalendarFeature();
		else if (calendarEnabled === false) this.plugin.disableCalendarFeature();

		// These methods exist only on 1.13+, which is also the only version that
		// invokes this declarative control writer. Keep the legacy class loadable
		// on 1.10.2–1.12 by accessing them through a local compatibility shape.
		const declarativeTab = this as unknown as { update(): void; refreshDomState(): void };
		if (rebuild) declarativeTab.update();
		else if (refreshVisibility) declarativeTab.refreshDomState();
	}

	display(): void {
		this.renderLegacySettings();
	}

	private renderLegacySettings(): void {
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
					.addOption("de", "Deutsch")
					.setValue(this.plugin.settings.language)
					.onChange(async (v) => {
						this.plugin.settings.language = v as Lang;
						setLocale(v as Lang);
						await this.plugin.saveSettings();
						this.renderLegacySettings(); // re-render labels in Obsidian before 1.13
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
					setTimelineVisible(v);
				}),
			);
		reloadNotice(timeline);

		// Calendar entry points toggle live — no plugin reload needed, so no notice.
		new Setting(containerEl)
			.setName(t("setCalendar"))
			.setDesc(t("setCalendarDesc"))
			.addToggle((tg) =>
				tg.setValue(this.plugin.settings.enableCalendar).onChange(async (v) => {
					this.plugin.settings.enableCalendar = v;
					await this.plugin.saveSettings();
					// The daily-notes reminder is shown when the view opens, not here.
					if (v) this.plugin.enableCalendarFeature();
					else this.plugin.disableCalendarFeature();
					setCalendarVisible(v);
				}),
			);

		// All timeline settings are gathered here so they can be hidden in one go
		// when the timeline view is disabled.
		const timelineEls: HTMLElement[] = [];
		const tl = (s: Setting): Setting => (timelineEls.push(s.settingEl), s);

		tl(new Setting(containerEl).setName(t("setTimelineHeading")).setHeading());

		// Snap-to-grid is read live by open timelines (drag only), no reload.
		tl(
			new Setting(containerEl)
				.setName(t("setSnap"))
				.setDesc(t("setSnapDesc"))
				.addToggle((tg) =>
					tg.setValue(this.plugin.settings.snapToGrid).onChange(async (v) => {
						this.plugin.settings.snapToGrid = v;
						await this.plugin.saveSettings();
					}),
				),
		);

		const maxUnits = tl(
			new Setting(containerEl)
				.setName(t("setMaxUnits"))
				.setDesc(t("setMaxUnitsDesc"))
				.addText((tx) =>
					tx
						.setPlaceholder(`${DEFAULT_MAX_UNITS}`)
						.setValue(`${this.plugin.settings.maxUnits}`)
						.onChange(async (v) => {
							// Anything unreadable rests on the default, anything too
							// small on the floor.
							const typed = Number.parseInt(v, 10);
							this.plugin.settings.maxUnits = Number.isFinite(typed)
								? Math.max(typed, MIN_MAX_UNITS)
								: DEFAULT_MAX_UNITS;
							await this.plugin.saveSettings();
						}),
				),
		);
		reloadNotice(maxUnits);

		const setTimelineVisible = (v: boolean) => {
			for (const el of timelineEls) el.toggle(v);
		};
		setTimelineVisible(this.plugin.settings.enableTimeline);

		// All calendar settings are gathered here so they can be hidden in one go
		// when the calendar view is disabled.
		const calendarEls: HTMLElement[] = [];
		const cal = (s: Setting): Setting => (calendarEls.push(s.settingEl), s);

		cal(new Setting(containerEl).setName(t("setCalendarHeading")).setHeading());

		// Daily-note folder / filename format / template now come from the core
		// Daily notes plugin (single source of truth); just point the user there.
		cal(new Setting(containerEl).setDesc(t("setDailyNotesHint")));

		cal(
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
				),
		);

		// Whole-hour window, clamped so start < end. The counterpart dropdown is
		// updated in place to avoid a full re-render.
		const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;
		let startDd: DropdownComponent | null = null;
		let endDd: DropdownComponent | null = null;
		cal(
			new Setting(containerEl)
				.setName(t("setDayStart"))
				.setDesc(t("setDayWindowDesc"))
				.addDropdown((d) => {
					startDd = d;
					for (let h = 0; h <= 23; h++) d.addOption(String(h), hourLabel(h));
					d.setValue(String(this.plugin.settings.dayStartHour)).onChange(async (v) => {
						const start = Number(v);
						this.plugin.settings.dayStartHour = start;
						if (this.plugin.settings.dayEndHour <= start) {
							this.plugin.settings.dayEndHour = Math.min(24, start + 1);
							endDd?.setValue(String(this.plugin.settings.dayEndHour));
						}
						await this.plugin.saveSettings();
					});
				}),
		);

		cal(
			new Setting(containerEl)
				.setName(t("setDayEnd"))
				.addDropdown((d) => {
					endDd = d;
					for (let h = 1; h <= 24; h++) d.addOption(String(h), hourLabel(h));
					d.setValue(String(this.plugin.settings.dayEndHour)).onChange(async (v) => {
						const end = Number(v);
						this.plugin.settings.dayEndHour = end;
						if (this.plugin.settings.dayStartHour >= end) {
							this.plugin.settings.dayStartHour = Math.max(0, end - 1);
							startDd?.setValue(String(this.plugin.settings.dayStartHour));
						}
						await this.plugin.saveSettings();
					});
				}),
		);

		cal(
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
				),
		);

		cal(
			new Setting(containerEl)
				.setName(t("setBacklink"))
				.setDesc(t("setBacklinkDesc"))
				.addToggle((tg) =>
					tg.setValue(this.plugin.settings.logBacklink).onChange(async (v) => {
						this.plugin.settings.logBacklink = v;
						await this.plugin.saveSettings();
						backlinkSection.settingEl.toggle(v);
					}),
				),
		);

		// Shown only when back-references are on.
		const backlinkSection = cal(
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
				),
		);

		cal(
			new Setting(containerEl)
				.setName(t("setEnableCategories"))
				.setDesc(t("setEnableCategoriesDesc"))
				.addToggle((tg) =>
					tg.setValue(this.plugin.settings.categoriesEnabled).onChange(async (v) => {
						this.plugin.settings.categoriesEnabled = v;
						await this.plugin.saveSettings();
						categoryList.settingEl.toggle(v);
					}),
				),
		);

		// Shown only when categories are on.
		const categoryList = cal(
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
				}),
		);

		// Hide the whole calendar group when its view is off; the two dependent
		// fields additionally respect their own toggle.
		const setCalendarVisible = (v: boolean) => {
			for (const el of calendarEls) el.toggle(v);
			backlinkSection.settingEl.toggle(v && this.plugin.settings.logBacklink);
			categoryList.settingEl.toggle(v && this.plugin.settings.categoriesEnabled);
		};
		setCalendarVisible(this.plugin.settings.enableCalendar);
	}
}
