<script lang="ts">
	import { getTimelineState } from "./state.svelte";
	import { t } from "../i18n.svelte";
	import Bar from "./Bar.svelte";

	const tl = $derived(getTimelineState());

	let scrollEl = $state<HTMLDivElement | null>(null);
	let hasAutoScrolled = false;

	const pxPerUnit = $derived(tl.pxPerUnit);
	const trackWidth = $derived(tl.totalUnits * pxPerUnit);

	// Scroll to "today" once when this view first receives a range. Subsequent
	// range changes come from data updates or drag commits and must preserve the
	// user's current focus instead of snapping back to today.
	$effect(() => {
		if (!scrollEl || !tl.hasRange || hasAutoScrolled) return;
		hasAutoScrolled = true;
		// When the whole track fits the pane there is nothing to scroll.
		if (scrollEl.scrollWidth <= scrollEl.clientWidth) return;
		const target = Math.max(0, tl.todayOffset * pxPerUnit - 160);
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
					{#each tl.tiers[tl.tiers.length - 1]?.segments ?? [] as seg (seg.unitOffset)}
						<div class="tm-tl-gridline" style:left="{seg.unitOffset * pxPerUnit}px"></div>
					{/each}
				</div>
				<div class="tm-tl-header">
					<div class="tm-tl-corner"></div>
					<div class="tm-tl-axis" style:width="{trackWidth}px">
						{#each tl.tiers as tier, ti (ti)}
							<div class="tm-tl-tier">
								{#each tier.segments as seg (seg.unitOffset)}
									<div
										class="tm-tl-seg"
										style:left="{seg.unitOffset * pxPerUnit}px"
										style:width="{seg.units * pxPerUnit}px"
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
								<Bar {row} {pxPerUnit} totalUnits={tl.totalUnits} context={ctx} />
							</div>
						</div>
					{/each}
				{/each}
			</div>
		</div>
	{/if}
</div>
