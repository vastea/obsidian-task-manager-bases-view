<script lang="ts">
	import type { KanbanColumn, KanbanContext } from "./state.svelte";
	import { getKanbanDrag } from "./drag.svelte";
	import { icon } from "../shared/icon";
	import { t } from "../i18n.svelte";
	import Card from "./Card.svelte";

	let { column, context }: { column: KanbanColumn; context: KanbanContext } = $props();

	let isDropTarget = $state(false);
	let dragDepth = 0;

	function canAccept(): boolean {
		const drag = getKanbanDrag();
		return !!drag && column.droppable && drag.sourceColumnId !== column.id;
	}

	function onDragOver(event: DragEvent) {
		if (!canAccept()) return;
		event.preventDefault();
		if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
	}
	function onDragEnter(event: DragEvent) {
		if (!canAccept()) return;
		event.preventDefault();
		dragDepth++;
		isDropTarget = true;
	}
	function onDragLeave() {
		if (dragDepth > 0) dragDepth--;
		if (dragDepth === 0) isDropTarget = false;
	}
	function onDrop(event: DragEvent) {
		event.preventDefault();
		dragDepth = 0;
		isDropTarget = false;
		const drag = getKanbanDrag();
		if (!drag || !canAccept()) return;
		context.moveCard(drag.file, column);
	}
</script>

{#if column.collapsed}
	<!-- Collapsed → a thin vertical bar (saves space, reads clearly as collapsed). -->
	<button
		class="tm-column tm-column-collapsed"
		class:is-done={column.isDone}
		class:is-drop-target={isDropTarget}
		style:--tm-col-bg={column.color.bg}
		style:--tm-col-accent={column.color.accent}
		aria-label="Expand {column.label} column"
		onclick={() => context.toggleCollapse(column)}
		ondragover={onDragOver}
		ondragenter={onDragEnter}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<span class="tm-column-count">{column.entries.length}</span>
		<span class="tm-column-dot"></span>
		<span class="tm-column-vtitle">{column.label}</span>
	</button>
{:else}
	<section
		class="tm-column"
		class:is-done={column.isDone}
		class:is-drop-target={isDropTarget}
		style:--tm-col-bg={column.color.bg}
		style:--tm-col-accent={column.color.accent}
		role="group"
		aria-label="{column.label} column"
		ondragover={onDragOver}
		ondragenter={onDragEnter}
		ondragleave={onDragLeave}
		ondrop={onDrop}
	>
		<header class="tm-column-header">
			<div class="tm-column-heading">
				<span class="tm-column-dot"></span>
				<span class="tm-column-title">{column.label}</span>
				<span class="tm-column-count">{column.entries.length}</span>
			</div>
			<div class="tm-column-actions">
				{#if column.canArchiveAll}
					<button
						class="tm-icon-btn"
						aria-label={t("archiveAll")}
						title={t("archiveAll")}
						onclick={() => context.archiveAll(column)}
						use:icon={"archive"}
					></button>
				{/if}
				{#if column.canCreate}
					<button
						class="tm-icon-btn"
						aria-label="New work item"
						onclick={() => context.createCard(column)}
						use:icon={"plus"}
					></button>
				{/if}
				<button
					class="tm-icon-btn"
					aria-label="Collapse column"
					onclick={() => context.toggleCollapse(column)}
					use:icon={"chevrons-left-right"}
				></button>
			</div>
		</header>

		<div class="tm-column-body">
			{#each column.entries as entry (entry.file.path)}
				<Card {entry} {context} columnId={column.id} isDone={column.isDone} />
			{/each}
			{#if column.canCreate}
				<button class="tm-column-add" onclick={() => context.createCard(column)}>
					<span class="tm-column-add-icon" use:icon={"plus"}></span> {t("newItem")}
				</button>
			{/if}
		</div>
	</section>
{/if}
