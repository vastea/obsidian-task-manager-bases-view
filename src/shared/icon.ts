import { setIcon } from "obsidian";

/** Svelte action: render a Lucide icon (by id) into the node. */
export function icon(node: HTMLElement, name: string) {
	setIcon(node, name);
	return {
		update(next: string) {
			node.empty();
			setIcon(node, next);
		},
		destroy() {
			node.empty();
		},
	};
}
