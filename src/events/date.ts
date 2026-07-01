// Date helpers for the events domain: slug derivation + strict calendar validation.

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** Derive a slug like "jul-2025" from a YYYY-MM-DD date. */
export function slugFromDate(date: string): string {
  const [year, month] = date.split('-');
  return `${MONTHS[Number(month) - 1] ?? month}-${year}`;
}

/**
 * True only for a real YYYY-MM-DD calendar date. Unlike `Date.parse` — which
 * silently rolls overflow (2025-02-30 → Mar 2) — this rejects impossible days
 * by round-tripping the parsed parts through a UTC Date.
 */
export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const dt = new Date(Date.UTC(year, month - 1, day));
  return dt.getUTCFullYear() === year && dt.getUTCMonth() === month - 1 && dt.getUTCDate() === day;
}
