<script lang="ts">
	import { setTooltip } from "obsidian";
	import type { TimelineContext, TimelineRow } from "./state.svelte";
	import { addDays, dayDiff, formatISODate, sameDay } from "../shared/date-util";
	import { icon } from "../shared/icon";
	import { t } from "../i18n.svelte";

	/** Show `text` as an Obsidian tooltip while the pointer is over `el`. */
	function tooltip(el: HTMLElement, text: string) {
		setTooltip(el, text, { delay: 300 });
		return {
			update(next: string) {
				setTooltip(el, next, { delay: 300 });
			},
		};
	}

	let {
		row,
		pxPerUnit,
		totalUnits,
		context,
	}: { row: TimelineRow; pxPerUnit: number; totalUnits: number; context: TimelineContext } = $props();

	type Mode = "move" | "start" | "end";
	/** Placement of a bar; an omitted width lets it shrink-wrap its label. */
	type Geom = { left?: number; right?: number; width?: number };

	let dragMode = $state<Mode | null>(null);
	/** Live drag offset, in scale units. */
	let dragDelta = $state(0);
	// True once the pointer moves past a small threshold → treat as drag, not click.
	let pointerMoved = false;
	const DRAG_THRESHOLD_PX = 4;

	// After a commit, hold the new dates until the write round-trips and fresh
	// query data arrives, so the bar doesn't snap back during the write→requery
	// window. Holding dates (not a delta) lets a fresh drag start from the held
	// position instead of the stale row data.
	let pendingStart = $state<Date | null>(null);
	let pendingEnd = $state<Date | null>(null);
	let hasPending = $state(false);
	let pendingTimer: ReturnType<typeof setTimeout> | null = null;
	// Safety net: drop the optimistic hold if the write fails (data never updates).
	const COMMIT_HOLD_MS = 3000;

	// Effective dates: the optimistic override while held, else the real row data.
	const effStart = $derived(hasPending ? pendingStart : row.start);
	const effEnd = $derived(hasPending ? pendingEnd : row.end);

	const kind = $derived(
		effStart && effEnd ? "bar" : effStart ? "milestone-start" : effEnd ? "milestone-end" : "none",
	);

	// Base geometry from the effective dates (without the live drag preview). The
	// end offset is the day *after* the end date, so the bar covers that day.
	const baseStart = $derived(effStart ? context.offsetOf(effStart) : null);
	const baseEnd = $derived(effEnd ? context.offsetOf(addDays(effEnd, 1)) : null);

	const geom = $derived(computeGeom(kind, baseStart, baseEnd, dragMode, dragDelta, pxPerUnit));

	// Clamped to an edge: that end's real date lies beyond the range. Each end is
	// judged on its own; a milestone's single date serves as both.
	const firstDate = $derived(effStart ?? effEnd);
	const lastDate = $derived(effEnd ?? effStart);
	const firstOffset = $derived(baseStart ?? baseEnd);
	const lastOffset = $derived(baseEnd ?? baseStart);
	const outsideBefore = $derived(!!firstDate && context.isOutside(firstDate) && firstOffset === 0);
	const outsideAfter = $derived(!!lastDate && context.isOutside(lastDate) && lastOffset === totalUnits);
	const outside = $derived(outsideBefore || outsideAfter);

	// A gesture takes its delta from one end's date. A clamped one is not where
	// the item is, so that gesture is off the table.
	const startClamped = $derived(!!firstDate && context.isOutside(firstDate));
	const endClamped = $derived(!!lastDate && context.isOutside(lastDate));
	const dates = $derived(
		[effStart, effEnd].filter((d): d is Date => d !== null).map(formatISODate).join(" – "),
	);
	const tip = $derived(
		outside ? `${row.title}\n${t("barOutside")} ${outsideBefore ? "←" : "→"} ${dates}` : row.title,
	);

	// Re-runs whenever the row's dates change (each query update yields fresh Date
	// objects). Once the persisted data lands, release the optimistic hold so the
	// bar follows real data — by then the row already reflects the committed move.
	$effect(() => {
		void row.start;
		void row.end;
		clearPending();
	});

	function setPending(start: Date | null, end: Date | null) {
		pendingStart = start;
		pendingEnd = end;
		hasPending = true;
		if (pendingTimer !== null) clearTimeout(pendingTimer);
		pendingTimer = setTimeout(clearPending, COMMIT_HOLD_MS);
	}

	function clearPending() {
		hasPending = false;
		pendingStart = null;
		pendingEnd = null;
		if (pendingTimer !== null) {
			clearTimeout(pendingTimer);
			pendingTimer = null;
		}
	}

	// Clear any pending hold timer when the bar unmounts.
	$effect(() => () => {
		if (pendingTimer !== null) clearTimeout(pendingTimer);
	});

	function computeGeom(
		k: string,
		s: number | null,
		e: number | null,
		mode: Mode | null,
		delta: number,
		px: number,
	): Geom | null {
		if (k === "none") return null;
		if (k === "bar" && s !== null && e !== null) {
			let start = s;
			let end = e;
			if (mode === "move") {
				start += delta;
				end += delta;
			} else if (mode === "start") {
				start = Math.min(s + delta, e);
			} else if (mode === "end") {
				end = Math.max(e + delta, s);
			}
			// Wholly outside: both ends clamp onto the same edge. Park it there
			// without a width, so it takes just what its label needs.
			if (end - start <= 0) return start <= 0 ? { left: 0 } : { right: 0 };
			return { left: start * px, width: (end - start) * px };
		}
		// Milestone: single point.
		const at = (s ?? e ?? 0) + (mode === "move" ? delta : 0);
		return { left: at * px, width: px };
	}

	function startDrag(mode: Mode, event: PointerEvent) {
		if (!context.writeEnabled) return;
		if (mode === "end" ? endClamped : startClamped) return;
		event.preventDefault();
		event.stopPropagation();
		dragMode = mode;
		dragDelta = 0;
		pointerMoved = false;
		const startX = event.clientX;

		const onMove = (e: PointerEvent) => {
			const dx = e.clientX - startX;
			if (Math.abs(dx) > DRAG_THRESHOLD_PX) pointerMoved = true;
			// Don't shift until the gesture is a real drag, so a still press
			// (select) doesn't jitter the bar.
			dragDelta = pointerMoved ? dx / pxPerUnit : 0;
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			commit(mode, dragDelta);
			dragMode = null;
			dragDelta = 0;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}

	/** The date `delta` scale units away from `d`, snapped as a start. */
	function shiftedStart(d: Date, delta: number): Date {
		return context.snap(context.dateAt(context.rawOffsetOf(d) + delta));
	}

	/** The date `delta` scale units away from `d`, snapped as an inclusive end. */
	function shiftedEnd(d: Date, delta: number): Date {
		return context.snapEnd(context.dateAt(context.rawOffsetOf(d) + delta));
	}

	function commit(mode: Mode, delta: number) {
		if (delta === 0) return;
		// Base the move off the *effective* dates (which may be an optimistic hold
		// from a previous, not-yet-persisted drag), not the stale row data.
		const s = effStart;
		const e = effEnd;
		if (kind === "bar" && s && e) {
			if (mode === "move") {
				// Snap the start to the grid, then shift the end by the same amount
				// so the bar keeps its duration.
				const ns = shiftedStart(s, delta);
				if (sameDay(ns, s)) return;
				const ne = addDays(e, dayDiff(ns, s));
				context.write(row.file, { start: ns, end: ne });
				setPending(ns, ne);
			} else if (mode === "start") {
				let ns = shiftedStart(s, delta);
				if (ns > e) ns = e;
				if (sameDay(ns, s)) return;
				context.write(row.file, { start: ns });
				setPending(ns, e);
			} else if (mode === "end") {
				let ne = shiftedEnd(e, delta);
				if (ne < s) ne = s;
				if (sameDay(ne, e)) return;
				context.write(row.file, { end: ne });
				setPending(s, ne);
			}
		} else if (kind === "milestone-start" && s) {
			const ns = shiftedStart(s, delta);
			if (sameDay(ns, s)) return;
			context.write(row.file, { start: ns });
			setPending(ns, null);
		} else if (kind === "milestone-end" && e) {
			const ne = shiftedEnd(e, delta);
			if (sameDay(ne, e)) return;
			context.write(row.file, { end: ne });
			setPending(null, ne);
		}
	}

	function openOnClick(event: MouseEvent) {
		// Suppress the click that follows a drag (any real pointer movement).
		if (pointerMoved) {
			pointerMoved = false;
			return;
		}
		context.openDetail(row.file, event);
	}
</script>

{#if geom}
	{#if kind === "bar"}
		<div
			class="tm-bar"
			class:is-dragging={dragMode !== null}
			class:is-outside={outside}
			class:is-start-clamped={startClamped}
			class:is-outside-after={outsideAfter}
			style:left={geom.left != null ? `${geom.left}px` : null}
			style:right={geom.right != null ? `${geom.right}px` : null}
			style:width={geom.width != null ? `${geom.width}px` : null}
			role="button"
			tabindex="0"
			aria-label={row.title}
			use:tooltip={tip}
			onpointerdown={(e) => startDrag("move", e)}
			onclick={openOnClick}
			onkeydown={(e) => (e.key === "Enter" ? context.openDetail(row.file, e) : null)}
		>
			{#if context.writeEnabled && !startClamped}
				<span class="tm-bar-handle tm-bar-handle-start" role="presentation" onpointerdown={(e) => startDrag("start", e)}></span>
			{/if}
			{#if context.writeEnabled && !endClamped}
				<span class="tm-bar-handle tm-bar-handle-end" role="presentation" onpointerdown={(e) => startDrag("end", e)}></span>
			{/if}
			{#if outsideBefore}
				<span class="tm-bar-outside" use:icon={"chevron-left"}></span>
			{/if}
			{#if outside}
				<span class="tm-bar-outside" use:icon={"alert-triangle"}></span>
			{/if}
			<span class="tm-bar-label">{row.title}</span>
			{#if outsideAfter}
				<span class="tm-bar-outside" use:icon={"chevron-right"}></span>
			{/if}
		</div>
	{:else}
		<div
			class="tm-milestone"
			class:is-dragging={dragMode !== null}
			class:is-outside={outside}
			class:is-start-clamped={startClamped}
			style:left={geom.left != null ? `${geom.left}px` : null}
			style:right={geom.right != null ? `${geom.right}px` : null}
			role="button"
			tabindex="0"
			aria-label={row.title}
			use:tooltip={tip}
			onpointerdown={(e) => startDrag("move", e)}
			onclick={openOnClick}
			onkeydown={(e) => (e.key === "Enter" ? context.openDetail(row.file, e) : null)}
		>
			{#if outsideBefore}
				<span class="tm-bar-outside" use:icon={"chevron-left"}></span>
			{/if}
			<span class="tm-milestone-dot"></span>
			{#if outsideAfter}
				<span class="tm-bar-outside" use:icon={"chevron-right"}></span>
			{/if}
			{#if outside}
				<span class="tm-bar-outside" use:icon={"alert-triangle"}></span>
			{/if}
			<span class="tm-milestone-label">{row.title}</span>
		</div>
	{/if}
{/if}
