import type { CalEntry } from "./state.svelte";

/**
 * Side-by-side layout for overlapping time blocks (like a day calendar).
 *
 * Blocks that overlap in time are split into columns so they sit next to each
 * other instead of stacking on top. `col` is the 0-based column for a block and
 * `cols` is the total columns in that block's overlap cluster, so a renderer can
 * place it at `left = col/cols`, `width = 1/cols`.
 */

export interface BlockLayout {
	col: number;
	cols: number;
}

export function layoutDay(entries: CalEntry[]): Map<number, BlockLayout> {
	const result = new Map<number, BlockLayout>();
	const sorted = [...entries].sort(
		(a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes,
	);

	let cluster: CalEntry[] = [];
	let clusterEnd = -1;

	const flush = () => {
		if (cluster.length === 0) return;
		// Greedy column assignment within the cluster.
		const colEnds: number[] = []; // last end time per column
		const colOf = new Map<number, number>();
		for (const e of cluster) {
			let placed = -1;
			for (let c = 0; c < colEnds.length; c++) {
				if ((colEnds[c] ?? 0) <= e.startMinutes) {
					placed = c;
					break;
				}
			}
			if (placed === -1) {
				placed = colEnds.length;
				colEnds.push(e.endMinutes);
			} else {
				colEnds[placed] = e.endMinutes;
			}
			colOf.set(e.lineIndex, placed);
		}
		const cols = colEnds.length;
		for (const e of cluster) {
			result.set(e.lineIndex, { col: colOf.get(e.lineIndex) ?? 0, cols });
		}
		cluster = [];
		clusterEnd = -1;
	};

	for (const e of sorted) {
		if (cluster.length > 0 && e.startMinutes >= clusterEnd) {
			// No overlap with the running cluster → close it.
			flush();
		}
		cluster.push(e);
		clusterEnd = Math.max(clusterEnd, e.endMinutes);
	}
	flush();

	return result;
}
