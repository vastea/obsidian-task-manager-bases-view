import { Notice, Plugin, type WorkspaceLeaf } from "obsidian";
import { DEFAULT_SETTINGS, type TaskManagerSettings, TaskManagerSettingTab } from "./settings";
import { setLocale, t } from "./i18n.svelte";
import { KanbanView, TM_KANBAN_VIEW, kanbanViewOptions } from "./kanban/kanban-view";
import { TimelineView, TM_TIMELINE_VIEW, timelineViewOptions } from "./timeline/timeline-view";
import { CalendarView, TM_CALENDAR_VIEW } from "./calendar/calendar-view";

export default class TaskManagerPlugin extends Plugin {
	settings: TaskManagerSettings = DEFAULT_SETTINGS;

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

		if (this.settings.enableCalendar) {
			this.registerView(TM_CALENDAR_VIEW, (leaf) => new CalendarView(leaf, this));
			this.addRibbonIcon("calendar-clock", t("openWeeklyLog"), () => void this.activateCalendar());
			this.addCommand({
				id: "open-weekly-log",
				// Command names are read once at registration; keep English + localized.
				name: "Open weekly log / 打开周历日志",
				callback: () => void this.activateCalendar(),
			});
		}

		this.addSettingTab(new TaskManagerSettingTab(this.app, this));
	}

	private async activateCalendar(): Promise<void> {
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
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
		setLocale(this.settings.language);
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
		// Live-update any open calendar views (categories, journal path, week
		// start, log section, …). View on/off toggles still need a reload.
		for (const leaf of this.app.workspace.getLeavesOfType(TM_CALENDAR_VIEW)) {
			const view = leaf.view;
			if (view instanceof CalendarView) view.rerender();
		}
	}
}
