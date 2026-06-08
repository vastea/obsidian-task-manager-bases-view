/**
 * Theme-friendly soft colours for kanban columns / timeline lanes.
 *
 * Colours are derived from HSL hues at low saturation/high lightness so they
 * read as gentle tints in both light and dark themes (we lean on alpha over a
 * theme background rather than hard-coding light/dark variants). A column either
 * gets a colour by position, or by a named colour carried in a predefined value
 * (`todo|blue`).
 */

export interface ColumnColor {
	/** Background tint for the column / card accent. */
	bg: string;
	/** Stronger accent for the header bar / left border. */
	accent: string;
}

const NAMED_HUES: Record<string, number> = {
	red: 4,
	orange: 30,
	yellow: 48,
	green: 140,
	teal: 168,
	cyan: 190,
	blue: 212,
	indigo: 244,
	purple: 270,
	pink: 326,
	gray: 0,
	grey: 0,
};

// Distinct hues walked by column position when no named colour is given.
const HUE_CYCLE = [212, 140, 270, 30, 326, 190, 48, 244, 168, 4];

function colorFromHue(hue: number, gray = false): ColumnColor {
	if (gray) {
		return {
			bg: "hsla(0, 0%, 50%, 0.10)",
			accent: "hsla(0, 0%, 50%, 0.55)",
		};
	}
	return {
		bg: `hsla(${hue}, 60%, 55%, 0.12)`,
		accent: `hsla(${hue}, 60%, 55%, 0.85)`,
	};
}

/** Colour for the Nth column by position. */
export function colorForIndex(index: number): ColumnColor {
	const hue = HUE_CYCLE[index % HUE_CYCLE.length] ?? 212;
	return colorFromHue(hue);
}

/**
 * Resolve a colour token from a `value|color` predefined entry.
 * Accepts a known colour name (blue, red, …) or any raw CSS colour (#4c8bf5,
 * rgb(...), hsl(...), or a CSS named colour) — the latter via color-mix so we
 * still get a soft background tint plus a solid accent.
 */
export function colorForName(name: string): ColumnColor | null {
	const raw = name.trim();
	if (!raw) return null;
	const key = raw.toLowerCase();
	if (key in NAMED_HUES) {
		const hue = NAMED_HUES[key] ?? 0;
		return colorFromHue(hue, key === "gray" || key === "grey");
	}
	// Treat anything else as a raw CSS colour.
	return {
		bg: `color-mix(in srgb, ${raw} 14%, transparent)`,
		accent: raw,
	};
}

/** Neutral colour used for the uncategorised / null column. */
export function neutralColor(): ColumnColor {
	return colorFromHue(0, true);
}

/**
 * Split a predefined value entry into its label and optional colour:
 * `"todo|blue"` → { value: "todo", color: "blue" }.
 */
export function parsePredefined(entry: string): { value: string; color: string | null } {
	const idx = entry.indexOf("|");
	if (idx === -1) return { value: entry.trim(), color: null };
	return {
		value: entry.slice(0, idx).trim(),
		color: entry.slice(idx + 1).trim() || null,
	};
}
