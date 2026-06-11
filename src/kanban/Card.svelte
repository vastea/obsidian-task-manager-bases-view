<script lang="ts">
	import type { BasesEntry, BasesPropertyId } from "obsidian";
	import type { KanbanContext } from "./state.svelte";
	import { setKanbanDrag } from "./drag.svelte";
	import { renderValue } from "../shared/value-render";

	let {
		entry,
		context,
		columnId,
		isDone = false,
	}: { entry: BasesEntry; context: KanbanContext; columnId: string; isDone?: boolean } = $props();

	let isDragging = $state(false);
	// Set when an HTML5 drag begins so the trailing click doesn't open the file.
	let dragHappened = false;

	function isInteractive(target: EventTarget | null): boolean {
		const el = target as HTMLElement | null;
		return !!el?.closest("a, button, input, select, textarea, .internal-link");
	}

	function onPointerDown() {
		// Fresh interaction — clear the drag guard before any dragstart fires.
		dragHappened = false;
	}

	function onClick(event: MouseEvent) {
		if (dragHappened) {
			dragHappened = false;
			return;
		}
		if (isInteractive(event.target)) return;
		context.openDetail(entry.file, event);
	}
	function onKeydown(event: KeyboardEvent) {
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			context.openDetail(entry.file, event);
		}
	}
	function onContextMenu(event: MouseEvent) {
		if (!context.contextMenu) return;
		event.preventDefault();
		context.contextMenu(entry.file, event);
	}
	function onDragStart(event: DragEvent) {
		if (!context.dragEnabled || !event.dataTransfer) {
			event.preventDefault();
			return;
		}
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", entry.file.path);
		isDragging = true;
		dragHappened = true;
		setKanbanDrag({ file: entry.file, sourceColumnId: columnId });
	}
	function onDragEnd() {
		isDragging = false;
		setKanbanDrag(null);
	}
</script>

<div
	class="tm-card"
	class:is-dragging={isDragging}
	class:is-done={isDone}
	role="button"
	tabindex="0"
	draggable={context.dragEnabled}
	onpointerdown={onPointerDown}
	onclick={onClick}
	oncontextmenu={onContextMenu}
	onkeydown={onKeydown}
	ondragstart={onDragStart}
	ondragend={onDragEnd}
>
	<div class="tm-card-title">{entry.file.basename}</div>
	{#if context.properties.length > 0}
		<div class="tm-card-props">
			{#each context.properties as propId (propId)}
				{@const value = entry.getValue(propId as BasesPropertyId)}
				{#if value && value.isTruthy()}
					<span class="tm-card-prop">
						<span class="tm-card-prop-name">{context.propertyLabel(propId as BasesPropertyId)}:</span>
						<span class="tm-card-prop-value" use:renderValue={{ entry, propId, ctx: context.renderContext }}></span>
					</span>
				{/if}
			{/each}
		</div>
	{/if}
</div>
