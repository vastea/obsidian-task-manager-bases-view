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

	const kind = $derived(
		row.start && row.end ? "bar" : row.start ? "milestone-start" : row.end ? "milestone-end" : "none",
	);

	// Base geometry (without drag preview).
	const baseStartDay = $derived(row.start ? dayDiff(row.start, rangeStart) : null);
	const baseEndDay = $derived(row.end ? dayDiff(row.end, rangeStart) : null);

	const geom = $derived(computeGeom(kind, baseStartDay, baseEndDay, dragMode, dragDeltaDays, pxPerDay));

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
			dragDeltaDays = Math.round(dx / pxPerDay);
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
		if (kind === "bar" && row.start && row.end) {
			if (mode === "move") {
				context.write(row.file, { start: addDays(row.start, delta), end: addDays(row.end, delta) });
			} else if (mode === "start") {
				let ns = addDays(row.start, delta);
				if (ns > row.end) ns = row.end;
				context.write(row.file, { start: ns });
			} else if (mode === "end") {
				let ne = addDays(row.end, delta);
				if (ne < row.start) ne = row.start;
				context.write(row.file, { end: ne });
			}
		} else if (kind === "milestone-start" && row.start) {
			context.write(row.file, { start: addDays(row.start, delta) });
		} else if (kind === "milestone-end" && row.end) {
			context.write(row.file, { end: addDays(row.end, delta) });
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
