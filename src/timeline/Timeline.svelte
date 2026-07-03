<script lang="ts">
	import { getTimelineState } from "./state.svelte";
	import { t } from "../i18n.svelte";
	import Bar from "./Bar.svelte";

	const tl = $derived(getTimelineState());

	let scrollEl = $state<HTMLDivElement | null>(null);
	let scrolledFor = "";

	// Width of the sticky label gutter (see .tm-tl-corner / .tm-tl-rowlabel).
	const LABEL_WIDTH = 180;

	// Density is computed in the view (label-fit + pane-fit + size slider).
	const pxPerDay = $derived(tl.pxPerDay);
	const trackWidth = $derived(tl.totalDays * pxPerDay);

	// Scroll to "today" once per range so the relevant window is in view.
	$effect(() => {
		// Only auto-scroll once per range (not when the size/density changes), so
		// adjusting the size slider keeps the current scroll position.
		const key = `${tl.rangeStart.getTime()}`;
		if (!scrollEl || !tl.hasRange || scrolledFor === key) return;
		scrolledFor = key;
		// When the whole track fits the pane there is nothing to scroll.
		if (trackWidth <= scrollEl.clientWidth - LABEL_WIDTH) return;
		const target = Math.max(0, tl.todayOffset * pxPerDay - 160);
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
					{#each tl.tiers[tl.tiers.length - 1]?.segments ?? [] as seg (seg.dayOffset)}
						<div class="tm-tl-gridline" style:left="{seg.dayOffset * pxPerDay}px"></div>
					{/each}
				</div>
				<div class="tm-tl-header">
					<div class="tm-tl-corner"></div>
					<div class="tm-tl-axis" style:width="{trackWidth}px">
						{#each tl.tiers as tier, ti (ti)}
							<div class="tm-tl-tier">
								{#each tier.segments as seg (seg.dayOffset)}
									<div
										class="tm-tl-seg"
										style:left="{seg.dayOffset * pxPerDay}px"
										style:width="{seg.days * pxPerDay}px"
									>
										<span class="tm-tl-seg-label">{seg.label}</span>
									</div>
								{/each}
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
									pxPerDay={pxPerDay}
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
