<script lang="ts">
	import type { TimelineContext, TimelineRow } from "./state.svelte";
	import { addDays, dayDiff } from "../shared/date-util";

	let {
		row,
		rangeStart,
		pxPerDay,
		context,
	}: { row: TimelineRow; rangeStart: Date; pxPerDay: number; context: TimelineContext } = $props();

	type Mode = "move" | "start" | "end";

	let dragMode = $state<Mode | null>(null);
	let dragDeltaDays = $state(0);
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

	// Base geometry from the effective dates (without the live drag preview).
	const baseStartDay = $derived(effStart ? dayDiff(effStart, rangeStart) : null);
	const baseEndDay = $derived(effEnd ? dayDiff(effEnd, rangeStart) : null);

	const geom = $derived(computeGeom(kind, baseStartDay, baseEndDay, dragMode, dragDeltaDays, pxPerDay));

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
	): { left: number; width: number } | null {
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
			return { left: start * px, width: Math.max(px, (end - start + 1) * px) };
		}
		// Milestone: single point.
		const day = (s ?? e ?? 0) + (mode === "move" ? delta : 0);
		return { left: day * px, width: px };
	}

	function startDrag(mode: Mode, event: PointerEvent) {
		if (!context.writeEnabled) return;
		event.preventDefault();
		event.stopPropagation();
		dragMode = mode;
		dragDeltaDays = 0;
		pointerMoved = false;
		const startX = event.clientX;

		const onMove = (e: PointerEvent) => {
			const dx = e.clientX - startX;
			if (Math.abs(dx) > DRAG_THRESHOLD_PX) pointerMoved = true;
			// Don't shift by a whole day until the gesture is a real drag, so a
			// still press (select) doesn't jitter the bar by a cell.
			dragDeltaDays = pointerMoved ? Math.round(dx / pxPerDay) : 0;
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			commit(mode, dragDeltaDays);
			dragMode = null;
			dragDeltaDays = 0;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
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
				const ns = context.snap(addDays(s, delta));
				const ne = addDays(e, dayDiff(ns, s));
				context.write(row.file, { start: ns, end: ne });
				setPending(ns, ne);
			} else if (mode === "start") {
				let ns = context.snap(addDays(s, delta));
				if (ns > e) ns = e;
				context.write(row.file, { start: ns });
				setPending(ns, e);
			} else if (mode === "end") {
				let ne = context.snap(addDays(e, delta));
				if (ne < s) ne = s;
				context.write(row.file, { end: ne });
				setPending(s, ne);
			}
		} else if (kind === "milestone-start" && s) {
			const ns = context.snap(addDays(s, delta));
			context.write(row.file, { start: ns });
			setPending(ns, null);
		} else if (kind === "milestone-end" && e) {
			const ne = context.snap(addDays(e, delta));
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
			style:left="{geom.left}px"
			style:width="{geom.width}px"
			role="button"
			tabindex="0"
			title={row.title}
			onpointerdown={(e) => startDrag("move", e)}
			onclick={openOnClick}
			onkeydown={(e) => (e.key === "Enter" ? context.openDetail(row.file, e) : null)}
		>
			{#if context.writeEnabled}
				<span class="tm-bar-handle tm-bar-handle-start" role="presentation" onpointerdown={(e) => startDrag("start", e)}></span>
				<span class="tm-bar-handle tm-bar-handle-end" role="presentation" onpointerdown={(e) => startDrag("end", e)}></span>
			{/if}
			<span class="tm-bar-label">{row.title}</span>
		</div>
	{:else}
		<div
			class="tm-milestone"
			class:is-dragging={dragMode !== null}
			style:left="{geom.left}px"
			role="button"
			tabindex="0"
			title={row.title}
			onpointerdown={(e) => startDrag("move", e)}
			onclick={openOnClick}
			onkeydown={(e) => (e.key === "Enter" ? context.openDetail(row.file, e) : null)}
		>
			<span class="tm-milestone-dot"></span>
			<span class="tm-milestone-label">{row.title}</span>
		</div>
	{/if}
{/if}
