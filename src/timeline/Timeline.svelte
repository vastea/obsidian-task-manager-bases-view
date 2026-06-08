<script lang="ts">
	import { getTimelineState } from "./state.svelte";
	import { t } from "../i18n.svelte";
	import Bar from "./Bar.svelte";

	const tl = $derived(getTimelineState());
	const trackWidth = $derived(tl.totalDays * tl.pxPerDay);

	let scrollEl = $state<HTMLDivElement | null>(null);
	let scrolledFor = "";

	// Scroll to "today" once per range so the relevant window is in view.
	$effect(() => {
		const key = `${tl.rangeStart.getTime()}:${tl.pxPerDay}`;
		if (!scrollEl || !tl.hasRange || scrolledFor === key) return;
		scrolledFor = key;
		const target = Math.max(0, tl.todayOffset * tl.pxPerDay - 160);
		scrollEl.scrollLeft = target;
	});
</script>

<div class="tm-timeline">
	{#if !tl.hasRange || !tl.context}
		<div class="tm-empty">{tl.message ?? t("emptyNoData")}</div>
	{:else}
		{@const ctx = tl.context}
		<div class="tm-tl-scroll" bind:this={scrollEl}>
			<div class="tm-tl-content">
				<!-- Full-height grid lines (per cell boundary) so bar spans are readable. -->
				<div class="tm-tl-grid">
					{#each tl.ticks as tick (tick.dayOffset)}
						<div
							class="tm-tl-gridline"
							class:is-major={tick.major}
							style:left="{tick.dayOffset * tl.pxPerDay}px"
						></div>
					{/each}
				</div>
				<div class="tm-tl-header">
					<div class="tm-tl-corner"></div>
					<div class="tm-tl-axis" style:width="{trackWidth}px">
						{#each tl.ticks as tick (tick.dayOffset)}
							<div
								class="tm-tl-tick"
								class:is-major={tick.major}
								style:left="{tick.dayOffset * tl.pxPerDay}px"
							>
								<span class="tm-tl-tick-label">{tick.label}</span>
							</div>
						{/each}
					</div>
				</div>

				{#each tl.lanes as lane (lane.id)}
					{#if lane.label !== null}
						<div class="tm-tl-lane-label">
							<span class="tm-tl-lane-label-text">{lane.label}</span>
						</div>
					{/if}
					{#each lane.rows as row (row.file.path)}
						<div class="tm-tl-row">
							<div
								class="tm-tl-rowlabel"
								role="button"
								tabindex="0"
								onclick={(e) => ctx.openDetail(row.file, e)}
								onkeydown={(e) => (e.key === "Enter" ? ctx.openDetail(row.file, e) : null)}
							>
								{row.title}
							</div>
							<div class="tm-tl-track" style:width="{trackWidth}px">
								<Bar
									{row}
									rangeStart={tl.rangeStart}
									pxPerDay={tl.pxPerDay}
									context={ctx}
								/>
							</div>
						</div>
					{/each}
				{/each}
			</div>
		</div>
	{/if}
</div>
