<script lang="ts">
	import { getCalState } from "./state.svelte";
	import { layoutDay } from "./layout";
	import { t, weekdayShort } from "../i18n.svelte";
	import LogBlock from "./LogBlock.svelte";

	const cal = $derived(getCalState());

	// Entries for a day, each annotated with its overlap column / column count.
	function dayBlocks(dayIndex: number) {
		const es = cal.entries.filter((e) => e.dayIndex === dayIndex);
		const lay = layoutDay(es);
		return es.map((entry) => {
			const l = lay.get(entry.lineIndex) ?? { col: 0, cols: 1 };
			return { entry, col: l.col, cols: l.cols };
		});
	}
	const hours = Array.from({ length: 24 }, (_, i) => i);

	const SNAP = 15; // minutes
	function snap(min: number): number {
		return Math.max(0, Math.min(24 * 60, Math.round(min / SNAP) * SNAP));
	}

	// Drag-to-create cal.
	let creating = $state<{ dayIndex: number; startMin: number; endMin: number } | null>(null);

	function yToMinutes(clientY: number, columnEl: HTMLElement): number {
		const rect = columnEl.getBoundingClientRect();
		return ((clientY - rect.top) / cal.hourHeight) * 60;
	}

	function onColumnPointerDown(event: PointerEvent, dayIndex: number) {
		if (event.button !== 0) return;
		const columnEl = event.currentTarget as HTMLElement;
		// Anchor where the pointer went down; the drag may go up or down.
		const anchor = snap(yToMinutes(event.clientY, columnEl));
		creating = { dayIndex, startMin: anchor, endMin: anchor + SNAP };

		const onMove = (e: PointerEvent) => {
			if (!creating) return;
			const m = snap(yToMinutes(e.clientY, columnEl));
			const lo = Math.min(anchor, m);
			const hi = Math.max(anchor, m);
			creating = { dayIndex, startMin: lo, endMin: Math.max(hi, lo + SNAP) };
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			if (creating && cal.context && creating.endMin > creating.startMin) {
				cal.context.createBlock(creating.dayIndex, creating.startMin, creating.endMin);
			}
			creating = null;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}
</script>

<div class="tm-cal">
	<header class="tm-cal-toolbar">
		<div class="tm-cal-nav">
			<button onclick={() => cal.context?.gotoPrev()} aria-label={t("prevWeek")}>‹</button>
			<button onclick={() => cal.context?.gotoToday()}>{t("today")}</button>
			<button onclick={() => cal.context?.gotoNext()} aria-label={t("nextWeek")}>›</button>
		</div>
		<span class="tm-cal-title">{cal.title}</span>
	</header>

	<div class="tm-cal-scroll">
		<div class="tm-cal-dayhead">
			<div class="tm-cal-gutter-head"></div>
			{#each cal.days as day, i (i)}
				<div class="tm-cal-daycol-head" class:is-today={day.isToday}>
					<span class="tm-cal-dow">{weekdayShort(day.date.getDay())}</span>
					<span class="tm-cal-dom">{day.date.getMonth() + 1}/{day.date.getDate()}</span>
				</div>
			{/each}
		</div>

		<div class="tm-cal-body">
		<div class="tm-cal-gutter">
			{#each hours as h (h)}
				<div class="tm-cal-hour" style:height="{cal.hourHeight}px">
					<span class="tm-cal-hour-label">{String(h).padStart(2, "0")}:00</span>
				</div>
			{/each}
		</div>

		{#each cal.days as day, dayIndex (dayIndex)}
			<div
				class="tm-cal-daycol"
				class:is-today={day.isToday}
				style:height="{24 * cal.hourHeight}px"
				role="presentation"
				onpointerdown={(e) => onColumnPointerDown(e, dayIndex)}
			>
				{#each hours as h (h)}
					<div class="tm-cal-slot" style:height="{cal.hourHeight}px"></div>
				{/each}

				{#each dayBlocks(dayIndex) as b (b.entry.lineIndex)}
					<LogBlock
						entry={b.entry}
						col={b.col}
						cols={b.cols}
						hourHeight={cal.hourHeight}
						context={cal.context}
					/>
				{/each}

				{#if creating && creating.dayIndex === dayIndex}
					<div
						class="tm-cal-block is-preview"
						style:top="{(creating.startMin / 60) * cal.hourHeight}px"
						style:height="{((creating.endMin - creating.startMin) / 60) * cal.hourHeight}px"
					></div>
				{/if}
			</div>
		{/each}
		</div>
	</div>
</div>
