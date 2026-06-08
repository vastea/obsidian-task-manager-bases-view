import type { TFile } from "obsidian";

export interface KanbanDrag {
	file: TFile;
	sourceColumnId: string;
}

let drag = $state<KanbanDrag | null>(null);

export function getKanbanDrag(): KanbanDrag | null {
	return drag;
}

export function setKanbanDrag(next: KanbanDrag | null): void {
	drag = next;
}
