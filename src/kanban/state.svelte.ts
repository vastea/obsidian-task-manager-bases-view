import type { BasesEntry, BasesPropertyId, RenderContext, TFile } from "obsidian";
import type { ColumnColor } from "../shared/palette";

export interface KanbanColumn {
	id: string;
	/** Display label for the header. */
	label: string;
	/** The frontmatter value this column writes when a card is dropped (null = clear). */
	writeValue: string | null;
	color: ColumnColor;
	entries: BasesEntry[];
	collapsed: boolean;
	isDone: boolean;
	/** Cards can be dropped here (group property is writable and column has a value). */
	droppable: boolean;
	/** New-card button is enabled. */
	canCreate: boolean;
	/** Show the "archive all" button (done column + writable + archive value set). */
	canArchiveAll: boolean;
}

export interface KanbanContext {
	properties: BasesPropertyId[];
	renderContext: RenderContext;
	/** True when the group property is a writable note.* property. */
	dragEnabled: boolean;
	openDetail: (file: TFile, evt: MouseEvent | KeyboardEvent) => void;
	moveCard: (file: TFile, column: KanbanColumn) => void;
	createCard: (column: KanbanColumn) => void;
	toggleCollapse: (column: KanbanColumn) => void;
	/** Archive every card in the column (sets the group property to the archive value). */
	archiveAll: (column: KanbanColumn) => void;
	/** Right-click menu (move to column / archive). */
	contextMenu?: (file: TFile, evt: MouseEvent) => void;
}

export interface KanbanState {
	mode: "predefined" | "grouped" | "ungrouped";
	columns: KanbanColumn[];
	context: KanbanContext | null;
}

let state = $state<KanbanState>({ mode: "ungrouped", columns: [], context: null });

export function getKanbanState(): KanbanState {
	return state;
}

export function setKanbanState(next: KanbanState): void {
	state = next;
}
