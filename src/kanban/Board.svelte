<script lang="ts">
	import { getKanbanState } from "./state.svelte";
	import { t } from "../i18n.svelte";
	import Column from "./Column.svelte";

	const state = $derived(getKanbanState());
</script>

<div class="tm-kanban">
	{#if state.mode === "ungrouped"}
		<div class="tm-empty">{t("emptyGroupByHint")}</div>
	{:else if state.columns.length === 0 || !state.context}
		<div class="tm-empty">{t("emptyNoColumns")}</div>
	{:else}
		{@const ctx = state.context}
		{#each state.columns as column (column.id)}
			<Column {column} context={ctx} />
		{/each}
	{/if}
</div>
