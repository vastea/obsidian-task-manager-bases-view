/** Small date helpers shared by timeline / calendar (no moment dependency). */

export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Local-midnight copy of a date. */
export function startOfDay(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Whole-day difference a - b (both treated as local midnights). */
export function dayDiff(a: Date, b: Date): number {
	return Math.round((startOfDay(a).getTime() - startOfDay(b).getTime()) / MS_PER_DAY);
}

export function addDays(d: Date, days: number): Date {
	const next = startOfDay(d);
	next.setDate(next.getDate() + days);
	return next;
}

/** Format as YYYY-MM-DD in local time. */
export function formatISODate(d: Date): string {
	const y = d.getFullYear();
	const m = String(d.getMonth() + 1).padStart(2, "0");
	const day = String(d.getDate()).padStart(2, "0");
	return `${y}-${m}-${day}`;
}

export function sameDay(a: Date, b: Date): boolean {
	return dayDiff(a, b) === 0;
}

export function startOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function endOfMonth(d: Date): Date {
	return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}

export function addMonths(d: Date, n: number): Date {
	return new Date(d.getFullYear(), d.getMonth() + n, d.getDate());
}

/** Monday-based start of the week for a date. */
export function startOfWeekMonday(d: Date): Date {
	const day = startOfDay(d);
	return addDays(day, -((day.getDay() + 6) % 7));
}
