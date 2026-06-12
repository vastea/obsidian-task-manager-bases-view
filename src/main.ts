import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, type TaskManagerSettings, TaskManagerSettingTab } from "./settings";
import { setLocale, t } from "./i18n.svelte";
import { KanbanView, TM_KANBAN_VIEW, kanbanViewOptions } from "./kanban/kanban-view";
import { TimelineView, TM_TIMELINE_VIEW, timelineViewOptions } from "./timeline/timeline-view";
import { CalendarView, TM_CALENDAR_VIEW } from "./calendar/calendar-view";
import { DailyNotesInfoModal } from "./calendar/daily-notes-modal";

export default class TaskManagerPlugin extends Plugin {
	settings: TaskManagerSettings = DEFAULT_SETTINGS;

	/** Ribbon element for the calendar, kept so we can remove it when toggled off. */
	private calendarRibbon: HTMLElement | null = null;

	private static readonly CALENDAR_COMMAND_ID = "open-weekly-log";

	async onload(): Promise<void> {
		await this.loadSettings();

		if (this.settings.enableKanban) {
			const ok = this.registerBasesView(TM_KANBAN_VIEW, {
				name: "Kanban",
				icon: "square-kanban",
				factory: (controller, containerEl) => new KanbanView(controller, containerEl),
				options: kanbanViewOptions,
			});
			if (!ok) new Notice(t("kanbanRegisterFail"));
		}

		if (this.settings.enableTimeline) {
			const ok = this.registerBasesView(TM_TIMELINE_VIEW, {
				name: "Timeline",
				icon: "gantt-chart",
				factory: (controller, containerEl) => new TimelineView(controller, containerEl),
				options: timelineViewOptions,
			});
			if (!ok) new Notice(t("timelineRegisterFail"));
		}

		// The leaf-view *type* is always registered (registering it has no visible
		// effect and there is no public API to unregister it). The user-facing
		// entry points — ribbon + command — are what we toggle on/off live.
		this.registerView(TM_CALENDAR_VIEW, (leaf) => new CalendarView(leaf, this));
		if (this.settings.enableCalendar) this.enableCalendarFeature();

		this.addSettingTab(new TaskManagerSettingTab(this.app, this));
	}

	/** Add the calendar's ribbon icon + command (idempotent). Driven live from settings. */
	enableCalendarFeature(): void {
		// Ribbon and command are added/removed together, so the ribbon's presence is
		// the single "already enabled" signal — guard both on it to stay idempotent.
		if (this.calendarRibbon) return;
		this.calendarRibbon = this.addRibbonIcon("calendar-clock", t("openWeeklyLog"), () =>
			void this.activateCalendar(),
		);
		this.addCommand({
			id: TaskManagerPlugin.CALENDAR_COMMAND_ID,
			// Command names are read once at registration; keep English + localized.
			name: "Open weekly log / 打开周历日志",
			callback: () => void this.activateCalendar(),
		});
	}

	/** Remove the calendar's entry points and close any open calendar leaves. */
	disableCalendarFeature(): void {
		this.calendarRibbon?.remove();
		this.calendarRibbon = null;
		this.removeCommand(`${this.manifest.id}:${TaskManagerPlugin.CALENDAR_COMMAND_ID}`);
		for (const leaf of this.app.workspace.getLeavesOfType(TM_CALENDAR_VIEW)) leaf.detach();
	}

	private async activateCalendar(): Promise<void> {
		// Remind which daily-note config the view uses, every time it's opened,
		// until the user opts out (here or via the settings toggle).
		if (this.settings.dailyNotesReminder) {
			new DailyNotesInfoModal(this.app, {
				onDontRemind: () => {
					this.settings.dailyNotesReminder = false;
					void this.saveSettings();
				},
			}).open();
		}
		const { workspace } = this.app;
		const existing = workspace.getLeavesOfType(TM_CALENDAR_VIEW);
		let leaf: WorkspaceLeaf | null;
		if (existing.length > 0 && existing[0]) {
			leaf = existing[0];
		} else {
			leaf = workspace.getLeaf(true);
			await leaf.setViewState({ type: TM_CALENDAR_VIEW, active: true });
		}
		await workspace.revealLeaf(leaf);
	}

	async loadSettings(): Promise<void> {
		const data = (await this.loadData()) as Partial<TaskManagerSettings> | null;
		this.settings = Object.assign({}, DEFAULT_SETTINGS, data);
		setLocale(this.settings.language);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Live-update any open calendar views (categories, week start, log
		// section, …). Kanban/Timeline on/off toggles still need a reload.
		for (const leaf of this.app.workspace.getLeavesOfType(TM_CALENDAR_VIEW)) {
			const view = leaf.view;
			if (view instanceof CalendarView) view.rerender();
		}
	}
}
