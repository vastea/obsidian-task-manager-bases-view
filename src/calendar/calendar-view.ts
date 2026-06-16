import { type WorkspaceLeaf, ItemView, Notice, debounce } from "obsidian";
import { mount, unmount } from "svelte";
import WeekGrid from "./WeekGrid.svelte";
import { type CalContext, type CalDay, type CalEntry, getCalState, setCalState } from "./state.svelte";
import {
	dailyNotesPluginEnabled,
	deleteLogLine,
	findDailyNote,
	insertLog,
	readDayEntries,
	updateLogEntry,
	updateLogTime,
} from "./log-io";
import { LogBlockModal } from "./log-modal";
import { type Category, parseCategories } from "../settings";
import { addDays, sameDay, startOfDay } from "../shared/date-util";
import { colorForName } from "../shared/palette";
import { openDetail } from "../shared/open-detail";
import { t } from "../i18n.svelte";
import type TaskManagerPlugin from "../main";

export const TM_CALENDAR_VIEW = "tm-calendar";

const HOUR_HEIGHT = 40;

/** Resolve a colour token (named like "blue" or raw CSS like "#4c8bf5") to a CSS colour. */
function resolveColor(raw: string): string | null {
	if (!raw) return null;
	const c = colorForName(raw);
	return c ? c.accent : raw;
}

export class CalendarView extends ItemView {
	private plugin: TaskManagerPlugin;
	private weekStart: Date;
	private component: Record<string, unknown> | null = null;
	private refreshDebounced: () => void;

	constructor(leaf: WorkspaceLeaf, plugin: TaskManagerPlugin) {
		super(leaf);
		this.plugin = plugin;
		this.weekStart = this.computeWeekStart(new Date());
		this.refreshDebounced = debounce(() => void this.refresh(), 250, true);
	}

	getViewType(): string {
		return TM_CALENDAR_VIEW;
	}

	getDisplayText(): string {
		return t("weeklyLog");
	}

	getIcon(): string {
		return "calendar-clock";
	}

	protected async onOpen(): Promise<void> {
		this.contentEl.addClass("tm-calendar-root");
		this.component = mount(WeekGrid, { target: this.contentEl });

		// Re-read when the vault changes (debounced).
		this.registerEvent(this.app.vault.on("modify", this.refreshDebounced));
		this.registerEvent(this.app.vault.on("create", this.refreshDebounced));
		this.registerEvent(this.app.vault.on("delete", this.refreshDebounced));
		this.registerEvent(this.app.vault.on("rename", this.refreshDebounced));

		// Advance the now-indicator line once a minute (cleaned up on unload).
		this.registerInterval(window.setInterval(() => this.updateNow(), 60000));

		await this.refresh();

		// The weekly log reads/writes daily notes via the core Daily notes plugin.
		// If it isn't enabled there's nowhere to store logs — tell the user, but
		// never touch their core-plugin config ourselves.
		if (!dailyNotesPluginEnabled()) {
			new Notice(t("calendarNeedsDailyNotes"), 10000);
		}
	}

	protected async onClose(): Promise<void> {
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}
		this.contentEl.empty();
		this.contentEl.removeClass("tm-calendar-root");
	}

	private computeWeekStart(date: Date): Date {
		const d = startOfDay(date);
		const day = d.getDay(); // 0 = Sunday
		const offset = this.plugin.settings.weekStart === "monday" ? (day + 6) % 7 : day;
		return addDays(d, -offset);
	}

	/**
	 * Resolve a `(category)` token into a display name + colour.
	 * The token may carry an inline colour like `Dev|#4c8bf5` (same `name|color`
	 * scheme as the kanban predefined values — named colour or any CSS colour);
	 * otherwise the colour falls back to the matching settings category.
	 * Whole feature is gated by "Enable categories".
	 */
	private resolveCategory(token: string | null): { name: string | null; color: string | null } {
		if (!token || !this.plugin.settings.categoriesEnabled) return { name: null, color: null };
		const idx = token.indexOf("|");
		const name = (idx === -1 ? token : token.slice(0, idx)).trim() || null;
		let color: string | null = null;
		if (idx !== -1) {
			color = resolveColor(token.slice(idx + 1).trim());
		} else if (name) {
			const cat = this.categories().find((c) => c.name.toLowerCase() === name.toLowerCase());
			if (cat && cat.color) color = resolveColor(cat.color);
		}
		return { name, color };
	}

	private categories(): Category[] {
		return this.plugin.settings.categoriesEnabled
			? parseCategories(this.plugin.settings.categoriesText)
			: [];
	}

	/** Live-refresh this view when global settings change (debounced). */
	rerender(): void {
		this.refreshDebounced();
	}

	private context(): CalContext {
		return {
			openEntry: (entry) => this.openEntry(entry),
			createBlock: (dayIndex, start, end) => this.createBlock(dayIndex, start, end),
			updateBlock: (entry, start, end) => void this.updateBlock(entry, start, end),
			editBlock: (entry) => this.editBlock(entry),
			deleteBlock: (entry) => void this.deleteBlock(entry),
			gotoPrev: () => {
				this.weekStart = addDays(this.weekStart, -7);
				void this.refresh();
			},
			gotoNext: () => {
				this.weekStart = addDays(this.weekStart, 7);
				void this.refresh();
			},
			gotoToday: () => {
				this.weekStart = this.computeWeekStart(new Date());
				void this.refresh();
			},
			gotoDate: (date) => {
				this.weekStart = this.computeWeekStart(date);
				void this.refresh();
			},
		};
	}

	/**
	 * Recompute just the now-indicator position (minute tick) without rescanning
	 * notes; merge it into the existing state so the line advances live.
	 */
	private updateNow(): void {
		const s = getCalState();
		const now = new Date();
		const nowMinutes = now.getHours() * 60 + now.getMinutes();
		const todayIndex = s.days.findIndex((d) => d.isToday);
		setCalState({ ...s, nowMinutes, todayIndex });
	}

	private async refresh(): Promise<void> {
		const settings = this.plugin.settings;
		const today = startOfDay(new Date());
		const days: CalDay[] = [];
		const entries: CalEntry[] = [];

		for (let i = 0; i < 7; i++) {
			const date = addDays(this.weekStart, i);
			const dayEntries = await readDayEntries(this.app, date, settings);
			days.push({
				date,
				isToday: sameDay(date, today),
				hasNote: dayEntries.length > 0,
			});
			for (const e of dayEntries) {
				const { name, color } = this.resolveCategory(e.category);
				entries.push({
					dayIndex: i,
					lineIndex: e.lineIndex,
					startMinutes: e.startMinutes,
					endMinutes: e.endMinutes,
					link: e.link,
					note: e.note,
					category: name,
					categoryToken: e.category,
					color,
				});
			}
		}

		const weekEnd = addDays(this.weekStart, 6);
		const title = `${fmt(this.weekStart)} – ${fmt(weekEnd)}`;
		// Visible time window (whole hours → minutes), with a safe fallback.
		const startH = settings.dayStartHour ?? 0;
		const endH = settings.dayEndHour ?? 24;
		const dayStartMin = Math.max(0, Math.min(23, startH)) * 60;
		const dayEndMin = Math.max(startH + 1, Math.min(24, endH)) * 60;
		const now = new Date();
		const nowMinutes = now.getHours() * 60 + now.getMinutes();
		const todayIndex = days.findIndex((d) => d.isToday);
		setCalState({
			title,
			days,
			entries,
			hourHeight: HOUR_HEIGHT,
			dayStartMin,
			dayEndMin,
			nowMinutes,
			todayIndex,
			context: this.context(),
		});
	}

	private openEntry(entry: CalEntry): void {
		// A time block lives in the day's journal note — open that note at the
		// log line (not the task the line happens to link to).
		const date = addDays(this.weekStart, entry.dayIndex);
		const dayNote = findDailyNote(date);
		if (dayNote) openDetail(this.app, dayNote, null, entry.lineIndex);
	}

	private createBlock(dayIndex: number, start: number, end: number): void {
		const date = addDays(this.weekStart, dayIndex);
		// Open a modal to fill the description / link / category before writing.
		new LogBlockModal(this.app, {
			startMinutes: start,
			endMinutes: end,
			categories: this.categories(),
			onSubmit: (result) => {
				void (async () => {
					try {
						await insertLog(this.app, date, this.plugin.settings, result.startMinutes, result.endMinutes, {
							link: result.link,
							note: result.note,
							category: result.category,
						});
						await this.refresh();
					} catch (e) {
						new Notice(t("logWriteFail"));
						console.error("tm-calendar: failed to write log", e);
					}
				})();
			},
		}).open();
	}

	private async updateBlock(entry: CalEntry, start: number, end: number): Promise<void> {
		const date = addDays(this.weekStart, entry.dayIndex);
		await updateLogTime(this.app, date, entry.lineIndex, start, end, this.plugin.settings);
		await this.refresh();
	}

	/** Open the log modal pre-filled with an existing block, then write a full update. */
	private editBlock(entry: CalEntry): void {
		const date = addDays(this.weekStart, entry.dayIndex);
		new LogBlockModal(this.app, {
			mode: "edit",
			startMinutes: entry.startMinutes,
			endMinutes: entry.endMinutes,
			note: entry.note,
			link: entry.link,
			category: entry.categoryToken,
			categories: this.categories(),
			onSubmit: (result) => {
				void (async () => {
					try {
						const ok = await updateLogEntry(
							this.app,
							date,
							this.plugin.settings,
							{
								lineIndex: entry.lineIndex,
								startMinutes: entry.startMinutes,
								endMinutes: entry.endMinutes,
								link: entry.link,
								note: entry.note,
							},
							{
								startMinutes: result.startMinutes,
								endMinutes: result.endMinutes,
								note: result.note,
								link: result.link,
								category: result.category,
							},
						);
						if (!ok) new Notice(t("logEntryGone"));
						await this.refresh();
					} catch (e) {
						new Notice(t("logWriteFail"));
						console.error("tm-calendar: failed to edit log", e);
					}
				})();
			},
		}).open();
	}

	private async deleteBlock(entry: CalEntry): Promise<void> {
		const date = addDays(this.weekStart, entry.dayIndex);
		await deleteLogLine(this.app, date, entry.lineIndex, this.plugin.settings);
		await this.refresh();
	}
}

function fmt(d: Date): string {
	return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
