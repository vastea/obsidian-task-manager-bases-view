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
	}: { entry: CalEntry; hourHeight: number; context: CalContext | null; col?: number; cols?: number } =
		$props();

	// Horizontal placement for overlapping blocks (2px outer inset, 2% gutter).
	const leftPct = $derived((col / cols) * 100);
	const widthPct = $derived((1 / cols) * 100);

	const SNAP = 15;
	const DAY_MIN = 24 * 60;

	let dragOffset = $state(0); // minutes, applied during move
	let resizeDelta = $state(0); // minutes, applied to end during resize
	let dragging = $state(false);

	const top = $derived(((entry.startMinutes + dragOffset) / 60) * hourHeight);
	const height = $derived(
		Math.max(
			(SNAP / 60) * hourHeight,
			((entry.endMinutes - entry.startMinutes + resizeDelta) / 60) * hourHeight,
		),
	);
	const label = $derived(
		`${formatTime(entry.startMinutes)}–${formatTime(entry.endMinutes)}${entry.link ? " " + entry.link : ""}`,
	);

	function snap(min: number): number {
		return Math.round(min / SNAP) * SNAP;
	}

	function startMove(event: PointerEvent) {
		if (!context || event.button !== 0) return;
		event.stopPropagation();
		event.preventDefault();
		dragging = true;
		const startY = event.clientY;
		const onMove = (e: PointerEvent) => {
			const deltaMin = snap(((e.clientY - startY) / hourHeight) * 60);
			const clamped = Math.max(-entry.startMinutes, Math.min(DAY_MIN - entry.endMinutes, deltaMin));
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
		const startY = event.clientY;
		const onMove = (e: PointerEvent) => {
			const deltaMin = snap(((e.clientY - startY) / hourHeight) * 60);
			resizeDelta = Math.max(SNAP - (entry.endMinutes - entry.startMinutes), Math.min(DAY_MIN - entry.endMinutes, deltaMin));
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
		if (dragOffset !== 0 || resizeDelta !== 0) return;
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
