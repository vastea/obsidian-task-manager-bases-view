import {
	type BasesAllOptions,
	type BasesEntry,
	type BasesPropertyId,
	type BasesViewConfig,
	type QueryController,
	type TFile,
	BasesView,
	Menu,
} from "obsidian";
import { mount, unmount } from "svelte";
import Board from "./Board.svelte";
import { type KanbanColumn, type KanbanContext, setKanbanState } from "./state.svelte";
import { isWritable, propertyName, writeProperty } from "../shared/frontmatter-writer";
import { openDetail } from "../shared/open-detail";
import { colorForIndex, colorForName, neutralColor, parsePredefined } from "../shared/palette";
import { columnId, readKanbanState, writeKanbanCollapsed } from "../shared/view-config";
import { t } from "../i18n.svelte";

export const TM_KANBAN_VIEW = "tm-kanban";

/** BasesViewConfig exposes groupBy at runtime but types it as `{}` in the public d.ts. */
function getNativeGroupBy(config: BasesViewConfig): BasesPropertyId | null {
	const groupBy = (config as unknown as { groupBy?: { property?: string } }).groupBy;
	return normalizePropertyId(groupBy?.property);
}

/** Ensure a property id carries a type prefix; treat a bare name as `note.*`. */
function normalizePropertyId(raw: string | null | undefined): BasesPropertyId | null {
	if (!raw) return null;
	if (raw.startsWith("note.") || raw.startsWith("file.") || raw.startsWith("formula.")) {
		return raw as BasesPropertyId;
	}
	return `note.${raw}`;
}

export function kanbanViewOptions(config: BasesViewConfig): BasesAllOptions[] {
	const usingPredefined = () => config.get("usePredefinedColumns") === true;
	return [
		{
			type: "toggle",
			key: "usePredefinedColumns",
			displayName: t("optUsePredefined"),
			default: false,
		},
		{
			type: "group",
			displayName: t("optPredefinedGroup"),
			shouldHide: () => !usingPredefined(),
			items: [
				{
					type: "multitext",
					key: "predefinedValues",
					displayName: t("optPredefinedValues"),
				},
				{
					type: "multitext",
					key: "doneStatuses",
					displayName: t("optDoneStatuses"),
					default: ["done"],
				},
			],
		},
		{
			type: "text",
			key: "archiveValue",
			displayName: t("optArchiveValue"),
			placeholder: "archived",
		},
	];
}

export class KanbanView extends BasesView {
	type = TM_KANBAN_VIEW;
	private containerEl: HTMLElement;
	private component: Record<string, unknown> | null = null;

	constructor(controller: QueryController, containerEl: HTMLElement) {
		super(controller);
		this.containerEl = containerEl;
	}

	override onload(): void {
		this.containerEl.addClass("tm-kanban-root");
		this.component = mount(Board, { target: this.containerEl });
	}

	override onunload(): void {
		if (this.component) {
			void unmount(this.component);
			this.component = null;
		}
		this.containerEl.empty();
		this.containerEl.removeClass("tm-kanban-root");
	}

	onDataUpdated(): void {
		const usePredefined = this.config.get("usePredefinedColumns") === true;
		const properties = this.data.properties;

		const context: KanbanContext = {
			properties,
			renderContext: this.app.renderContext,
			dragEnabled: false, // set below depending on mode
			openDetail: (file, evt) => openDetail(this.app, file, evt),
			moveCard: () => {},
			createCard: () => {},
			archiveAll: () => {},
			toggleCollapse: (column) => {
				writeKanbanCollapsed(this.config, column.id, !column.collapsed);
				// Re-render with the new collapsed state.
				this.onDataUpdated();
			},
		};

		if (usePredefined) {
			this.buildPredefined(context);
		} else {
			this.buildNative(context);
		}
	}

	private buildPredefined(context: KanbanContext): void {
		// Predefined mode still groups through Bases: we consume `data.groupedData`
		// (Bases applies filters + group-by) and only use the predefined values to
		// order / colour / flag the columns, matching on each group's key value.
		const groups = this.data.groupedData;
		const noGrouping = groups.length === 1 && groups[0] !== undefined && !groups[0].hasKey();
		if (noGrouping) {
			// No Bases group-by configured → can't build predefined columns.
			context.dragEnabled = false;
			setKanbanState({ mode: "ungrouped", columns: [], context });
			return;
		}

		const groupProp = getNativeGroupBy(this.config); // for write-back only
		const predefinedRaw = (this.config.get("predefinedValues") as string[] | undefined) ?? [];
		const doneStatuses = ((this.config.get("doneStatuses") as string[] | undefined) ?? ["done"]).map((s) =>
			s.trim(),
		);
		const writable = isWritable(groupProp);
		context.dragEnabled = writable;

		context.moveCard = (file, column) => {
			if (!writable || !groupProp) return;
			void writeProperty(this.app, file, groupProp, column.writeValue);
		};
		context.createCard = (column) => {
			if (!column.canCreate || !groupProp) return;
			void this.createFileForView(undefined, (fm: Record<string, unknown>) => {
				const parsed = propertyName(groupProp);
				if (parsed && column.writeValue !== null) fm[parsed] = column.writeValue;
			});
		};

		// Index Bases groups by their key string; collect null-key entries aside.
		const byKey = new Map<string, BasesEntry[]>();
		const nullEntries: BasesEntry[] = [];
		for (const g of groups) {
			if (g.hasKey()) byKey.set(g.key?.toString() ?? "", g.entries);
			else nullEntries.push(...g.entries);
		}

		const stored = readKanbanState(this.config);
		const archiveValue = this.archiveValue();
		const defs = predefinedRaw.map((raw) => parsePredefined(raw)).filter((d) => d.value.length > 0);
		const usedKeys = new Set<string>();

		const columns: KanbanColumn[] = defs.map((d, i) => {
			const id = columnId(d.value);
			const isDone = doneStatuses.includes(d.value);
			const color = (d.color && colorForName(d.color)) || colorForIndex(i);
			usedKeys.add(d.value);
			return {
				id,
				label: d.value,
				writeValue: d.value,
				color,
				entries: byKey.get(d.value) ?? [],
				collapsed: stored.collapsed[id] ?? false, // predefined default expanded
				isDone,
				droppable: writable,
				canCreate: writable,
				canArchiveAll: isDone && writable && !!archiveValue && d.value !== archiveValue,
			};
		});

		// Any Bases groups not named in predefinedValues, plus the null group,
		// fall into a collapsed Uncategorized column.
		const other: BasesEntry[] = [...nullEntries];
		for (const [key, entries] of byKey) {
			if (!usedKeys.has(key)) other.push(...entries);
		}
		const otherId = columnId(null);
		columns.push({
			id: otherId,
			label: t("uncategorized"),
			writeValue: null,
			color: neutralColor(),
			entries: other,
			collapsed: stored.collapsed[otherId] ?? true,
			isDone: false,
			droppable: writable, // dropping here clears the property
			canCreate: false,
			canArchiveAll: false,
		});

		this.attachContextMenu(context, columns, groupProp, writable);
		setKanbanState({ mode: "predefined", columns, context });
	}

	private archiveValue(): string {
		return ((this.config.get("archiveValue") as string | undefined) ?? "").trim();
	}

	/** Right-click card menu + the "archive all" column action. */
	private attachContextMenu(
		context: KanbanContext,
		columns: KanbanColumn[],
		groupProp: BasesPropertyId | null,
		writable: boolean,
	): void {
		if (!writable || !groupProp) return;
		const archiveValue = this.archiveValue();

		context.archiveAll = (column: KanbanColumn) => {
			if (!archiveValue) return;
			void (async () => {
				for (const entry of column.entries) {
					await writeProperty(this.app, entry.file, groupProp, archiveValue);
				}
			})();
		};

		context.contextMenu = (file: TFile, evt: MouseEvent) => {
			const menu = new Menu();
			for (const col of columns) {
				if (!col.droppable) continue;
				menu.addItem((item) =>
					item
						.setTitle(col.writeValue === null ? t("clearGroup") : `${t("moveTo")} ${col.label}`)
						.setIcon("arrow-right")
						.onClick(() => context.moveCard(file, col)),
				);
			}
			if (archiveValue) {
				menu.addSeparator();
				menu.addItem((item) =>
					item
						.setTitle(t("archive"))
						.setIcon("archive")
						.onClick(() => void writeProperty(this.app, file, groupProp, archiveValue)),
				);
			}
			menu.showAtMouseEvent(evt);
		};
	}

	private buildNative(context: KanbanContext): void {
		const groups = this.data.groupedData;
		const noGrouping = groups.length === 1 && groups[0] !== undefined && !groups[0].hasKey();
		if (noGrouping) {
			context.dragEnabled = false;
			setKanbanState({ mode: "ungrouped", columns: [], context });
			return;
		}

		const groupProp = getNativeGroupBy(this.config);
		const writable = isWritable(groupProp);
		context.dragEnabled = writable;
		context.moveCard = (file, column) => {
			if (!writable || !groupProp) return;
			void writeProperty(this.app, file, groupProp, column.writeValue);
		};
		context.createCard = (column) => {
			if (!column.canCreate || !groupProp) return;
			void this.createFileForView(undefined, (fm: Record<string, unknown>) => {
				const parsed = propertyName(groupProp);
				if (parsed && column.writeValue !== null) fm[parsed] = column.writeValue;
			});
		};

		const stored = readKanbanState(this.config);
		const archiveValue = this.archiveValue();
		const doneStatuses = ((this.config.get("doneStatuses") as string[] | undefined) ?? ["done"]).map((s) =>
			s.trim(),
		);
		const columns: KanbanColumn[] = groups
			.filter((g) => g.hasKey() || g.entries.length > 0)
			.map((g, i) => {
				const hasKey = g.hasKey();
				const label = hasKey ? (g.key?.toString() ?? "") : t("uncategorized");
				const id = columnId(hasKey ? label : null);
				const isDone = hasKey && doneStatuses.includes(label);
				return {
					id,
					label,
					writeValue: hasKey ? label : null,
					color: hasKey ? colorForIndex(i) : neutralColor(),
					entries: g.entries,
					collapsed: stored.collapsed[id] ?? !hasKey, // uncategorised collapsed by default
					isDone,
					droppable: writable,
					canCreate: writable && hasKey,
					canArchiveAll: isDone && writable && !!archiveValue && label !== archiveValue,
				};
			})
			.sort((a, b) => {
				const an = a.writeValue === null ? 1 : 0;
				const bn = b.writeValue === null ? 1 : 0;
				return an - bn;
			});

		this.attachContextMenu(context, columns, groupProp, writable);
		setKanbanState({ mode: "grouped", columns, context });
	}
}
