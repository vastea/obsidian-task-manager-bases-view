import type { App, TFile } from "obsidian";
import { type ColumnColor, colorForName } from "../shared/palette";
import { getRawFrontmatterByName } from "../shared/entry-accessor";

/** Resolved visual style for one bar: a fill colour (null = theme accent) and text flags. */
export interface BarStyle {
	color: ColumnColor | null;
	textColor: ColumnColor | null;
	strike: boolean;
	underline: boolean;
	bold: boolean;
	italic: boolean;
}

/**
 * One parsed rule line. `value === null` is the bare `property` form, where the
 * note's own value of that property is taken as the output.
 */
interface Rule {
	prop: string;
	value: string | null;
	output: string | null;
}

const TEXT_FLAGS = ["strike", "underline", "bold", "italic"] as const;
const RESET = "none";

/**
 * Parse a colour/text rule list. Fields are `|`-separated:
 * `property|value|output` (match rule) or a bare `property` (the note supplies
 * the output). Lines with two fields, or an empty property, are dropped.
 */
export function parseRules(raw: string[]): Rule[] {
	const rules: Rule[] = [];
	for (const line of raw) {
		const parts = line.split("|").map((p) => p.trim());
		const prop = parts[0];
		if (!prop) continue;
		if (parts.length === 1) {
			rules.push({ prop, value: null, output: null });
		} else if (parts.length >= 3) {
			rules.push({ prop, value: parts[1] ?? "", output: parts[2] ?? "" });
		}
	}
	return rules;
}

/** Whether a frontmatter value equals the rule value (case-insensitive; list membership). */
function matches(raw: unknown, value: string): boolean {
	if (raw === undefined || raw === null || raw === "") return false;
	const target = value.toLowerCase();
	if (Array.isArray(raw)) return raw.some((v) => String(v).trim().toLowerCase() === target);
	return String(raw).trim().toLowerCase() === target;
}

/**
 * The output string a rule contributes for a note, or null when it does not
 * apply. Match rules yield their fixed output; bare rules yield the note's own
 * property value (arrays joined by space, so a YAML list of flags works).
 */
function outputFor(app: App, file: TFile, rule: Rule): string | null {
	if (rule.value !== null) {
		return matches(getRawFrontmatterByName(app, file, rule.prop), rule.value) ? (rule.output ?? "") : null;
	}
	const raw = getRawFrontmatterByName(app, file, rule.prop);
	if (raw === undefined || raw === null || raw === "") return null;
	return Array.isArray(raw) ? raw.map((v) => String(v).trim()).join(" ") : String(raw).trim();
}

/** First matching colour rule wins (top→bottom). `none` and no match both mean the theme accent. */
function resolveColor(app: App, file: TFile, rules: Rule[]): ColumnColor | null {
	for (const rule of rules) {
		const out = outputFor(app, file, rule);
		if (out === null) continue;
		if (out.toLowerCase() === RESET) return null;
		const color = colorForName(out);
		if (color) return color;
		// An unresolvable colour is not a winning match — keep looking.
	}
	return null;
}

/** First matching text rule wins (top→bottom). Its space-separated flags define the whole set. */
function resolveText(
	app: App,
	file: TFile,
	rules: Rule[],
): Pick<BarStyle, "strike" | "underline" | "bold" | "italic"> {
	const off = { strike: false, underline: false, bold: false, italic: false };
	for (const rule of rules) {
		const out = outputFor(app, file, rule);
		if (out === null) continue;
		const tokens = out.toLowerCase().split(/\s+/).filter(Boolean);
		if (tokens.includes(RESET)) return off;
		const flags = TEXT_FLAGS.filter((f) => tokens.includes(f));
		if (flags.length === 0) continue; // no valid flag → not a winning match
		return {
			strike: flags.includes("strike"),
			underline: flags.includes("underline"),
			bold: flags.includes("bold"),
			italic: flags.includes("italic"),
		};
	}
	return off;
}

/** Resolve a note's bar style from the colour, text-colour and text rule lists, or null when nothing applies. */
export function resolveBarStyle(
	app: App,
	file: TFile,
	colorRules: Rule[],
	textColorRules: Rule[],
	textRules: Rule[],
): BarStyle | null {
	const color = resolveColor(app, file, colorRules);
	const textColor = resolveColor(app, file, textColorRules);
	const text = resolveText(app, file, textRules);
	if (!color && !textColor && !text.strike && !text.underline && !text.bold && !text.italic) return null;
	return { color, textColor, ...text };
}
