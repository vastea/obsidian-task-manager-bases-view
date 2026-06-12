<script lang="ts">
	import { Menu } from "obsidian";
	import type { CalContext, CalEntry } from "./state.svelte";
	import { formatTime } from "../shared/section-parser";
	import { t } from "../i18n.svelte";

	let {
		entry,
		hourHeight,
		context,
		col = 0,
		cols = 1,
		dayStartMin = 0,
		dayEndMin = 24 * 60,
	}: {
		entry: CalEntry;
		hourHeight: number;
		context: CalContext | null;
		col?: number;
		cols?: number;
		dayStartMin?: number;
		dayEndMin?: number;
	} = $props();

	// Horizontal placement for overlapping blocks (2px outer inset, 2% gutter).
	const leftPct = $derived((col / cols) * 100);
	const widthPct = $derived((1 / cols) * 100);

	const SNAP = 15;

	let dragOffset = $state(0); // minutes, applied during move
	let resizeDelta = $state(0); // minutes, applied to end during resize
	let dragging = $state(false);
	// True once the pointer moves past a small threshold → treat as drag, not
	// click. Consumed by onClick so a move/resize never opens the journal.
	let pointerMoved = false;
	const DRAG_THRESHOLD_PX = 4;

	// Positions are relative to the visible window's start, not midnight.
	const top = $derived(((entry.startMinutes + dragOffset - dayStartMin) / 60) * hourHeight);
	const height = $derived(
		Math.max(
			(SNAP / 60) * hourHeight,
			((entry.endMinutes - entry.startMinutes + resizeDelta) / 60) * hourHeight,
		),
	);
	// Below this height the multi-line column layout gets clipped to noise, so we
	// switch to a single horizontal line (time + ellipsised rest).
	const COMPACT_PX = 34;
	const compact = $derived(height <= COMPACT_PX);

	// Tooltip carries the full content (time + category + link + note) so a
	// clipped/compact block can still be read in full on hover.
	const label = $derived(
		`${formatTime(entry.startMinutes)}–${formatTime(entry.endMinutes)}` +
			(entry.category ? ` (${entry.category})` : "") +
			(entry.link ? ` ${entry.link}` : "") +
			(entry.note ? ` ${entry.note}` : ""),
	);

	function snap(min: number): number {
		return Math.round(min / SNAP) * SNAP;
	}

	function startMove(event: PointerEvent) {
		if (!context || event.button !== 0) return;
		event.stopPropagation();
		event.preventDefault();
		dragging = true;
		pointerMoved = false;
		const startY = event.clientY;
		const onMove = (e: PointerEvent) => {
			if (Math.abs(e.clientY - startY) > DRAG_THRESHOLD_PX) pointerMoved = true;
			const deltaMin = snap(((e.clientY - startY) / hourHeight) * 60);
			// Keep the whole block inside the visible window.
			const clamped = Math.max(dayStartMin - entry.startMinutes, Math.min(dayEndMin - entry.endMinutes, deltaMin));
			dragOffset = clamped;
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			if (dragOffset !== 0) {
				context?.updateBlock(entry, entry.startMinutes + dragOffset, entry.endMinutes + dragOffset);
			}
			dragOffset = 0;
			dragging = false;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}

	function startResize(event: PointerEvent) {
		if (!context || event.button !== 0) return;
		event.stopPropagation();
		event.preventDefault();
		dragging = true;
		pointerMoved = false;
		const startY = event.clientY;
		const onMove = (e: PointerEvent) => {
			if (Math.abs(e.clientY - startY) > DRAG_THRESHOLD_PX) pointerMoved = true;
			const deltaMin = snap(((e.clientY - startY) / hourHeight) * 60);
			resizeDelta = Math.max(SNAP - (entry.endMinutes - entry.startMinutes), Math.min(dayEndMin - entry.endMinutes, deltaMin));
		};
		const onUp = () => {
			window.removeEventListener("pointermove", onMove);
			window.removeEventListener("pointerup", onUp);
			if (resizeDelta !== 0) {
				context?.updateBlock(entry, entry.startMinutes, entry.endMinutes + resizeDelta);
			}
			resizeDelta = 0;
			dragging = false;
		};
		window.addEventListener("pointermove", onMove);
		window.addEventListener("pointerup", onUp);
	}

	function onClick(event: MouseEvent) {
		// Suppress the click that trails a move/resize drag; only a real single
		// click opens the journal at the log line.
		if (pointerMoved) {
			pointerMoved = false;
			return;
		}
		event.stopPropagation();
		context?.openEntry(entry);
	}

	function onContextMenu(event: MouseEvent) {
		if (!context) return;
		event.preventDefault();
		event.stopPropagation();
		const menu = new Menu();
		menu.addItem((i) => i.setTitle(t("openInJournal")).setIcon("file-text").onClick(() => context.openEntry(entry)));
		menu.addSeparator();
		menu.addItem((i) =>
			i
				.setTitle(t("deleteBlock"))
				.setIcon("trash")
				.onClick(() => context.deleteBlock(entry)),
		);
		menu.showAtMouseEvent(event);
	}
</script>

<div
	class="tm-cal-block"
	class:is-dragging={dragging}
	class:is-compact={compact}
	class:has-color={!!entry.color}
	style:top="{top}px"
	style:height="{height}px"
	style:left="calc({leftPct}% + 2px)"
	style:width="calc({widthPct}% - 4px)"
	style:--tm-block-color={entry.color}
	role="button"
	tabindex="0"
	title={label}
	onpointerdown={startMove}
	onclick={onClick}
	oncontextmenu={onContextMenu}
	onkeydown={(e) => (e.key === "Enter" ? context?.openEntry(entry) : null)}
>
	<span class="tm-cal-block-time">{formatTime(entry.startMinutes)}–{formatTime(entry.endMinutes)}</span>
	{#if entry.category}<span class="tm-cal-block-cat">{entry.category}</span>{/if}
	{#if entry.link}<span class="tm-cal-block-link">{entry.link}</span>{/if}
	{#if entry.note}<span class="tm-cal-block-note">{entry.note}</span>{/if}
	<span class="tm-cal-block-resize" onpointerdown={startResize} role="presentation"></span>
</div>
