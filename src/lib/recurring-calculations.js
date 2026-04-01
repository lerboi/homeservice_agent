import { addWeeks, addMonths, addYears } from 'date-fns';

/**
 * Calculate the next occurrence date from start_date to avoid drift.
 * Always computes from start_date + N*interval, not from currentNextDate + interval.
 *
 * Uses UTC midnight to avoid timezone offset issues when converting back to YYYY-MM-DD.
 *
 * @param {string} startDate - Original start date (YYYY-MM-DD)
 * @param {string} frequency - weekly|monthly|quarterly|annually
 * @param {string} currentNextDate - The current next_date being processed (YYYY-MM-DD), used as "today" reference
 * @returns {string} Next occurrence date (YYYY-MM-DD)
 */
export function calculateNextDate(startDate, frequency, currentNextDate) {
  // Parse as UTC to prevent timezone-related date shifts
  const start = parseUTCDate(startDate);
  const reference = parseUTCDate(currentNextDate);

  const addFn = {
    weekly: (d, n) => addWeeks(d, n),
    monthly: (d, n) => addMonths(d, n),
    quarterly: (d, n) => addMonths(d, n * 3),
    annually: (d, n) => addYears(d, n),
  };

  let next = start;
  let n = 0;
  while (next <= reference) {
    n++;
    next = addFn[frequency](start, n);
  }
  return formatUTCDate(next);
}

/** Parse YYYY-MM-DD as a UTC midnight Date */
function parseUTCDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date to YYYY-MM-DD using its UTC components */
function formatUTCDate(date) {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
