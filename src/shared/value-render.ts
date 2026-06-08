import { type BasesEntry, type BasesPropertyId, type RenderContext } from "obsidian";
import { getValue } from "./entry-accessor";

/**
 * Unified Value rendering. We always go through `Value.renderTo` so links,
 * dates, checkboxes etc. render exactly as Bases renders them elsewhere.
 */

export interface RenderArgs {
	entry: BasesEntry;
	propId: BasesPropertyId;
	ctx: RenderContext;
}

/** Svelte action: render a property's Value into the node, re-render on change. */
export function renderValue(node: HTMLElement, args: RenderArgs) {
	function paint(a: RenderArgs) {
		node.empty();
		const value = getValue(a.entry, a.propId);
		if (value && value.isTruthy()) {
			value.renderTo(node, a.ctx);
		}
	}
	paint(args);
	return {
		update(next: RenderArgs) {
			paint(next);
		},
		destroy() {
			node.empty();
		},
	};
}
