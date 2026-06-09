import { type BasesViewConfig } from "obsidian";

/**
 * View-local state lives in the Bases view config (physically inside the
 * `.base` file), never in plugin.saveData — a single global blob can't tell
 * multiple boards apart. Only user-changed values are persisted.
 */

export const EMPTY_SENTINEL = "__tm_empty__";
export const NULL_SENTINEL = "__tm_null__";

export interface KanbanState {
	/** columnId → collapsed?  Only user-touched columns are recorded. */
	collapsed: Record<string, boolean>;
}

const KANBAN_STATE_KEY = "tmKanbanState";

/** Stable id for a column from its (possibly empty/null) key. */
export function columnId(key: string | null): string {
	if (key === null) return NULL_SENTINEL;
	if (key === "") return EMPTY_SENTINEL;
	return key;
}

export function readKanbanState(config: BasesViewConfig): KanbanState {
	const raw = config.get(KANBAN_STATE_KEY);
	if (raw && typeof raw === "object" && "collapsed" in raw) {
		const collapsed = (raw as { collapsed?: unknown }).collapsed;
		if (collapsed && typeof collapsed === "object") {
			return { collapsed: collapsed as Record<string, boolean> };
		}
	}
	return { collapsed: {} };
}

export function writeKanbanCollapsed(config: BasesViewConfig, id: string, collapsed: boolean): void {
	const state = readKanbanState(config);
	state.collapsed[id] = collapsed;
	config.set(KANBAN_STATE_KEY, state);
}
