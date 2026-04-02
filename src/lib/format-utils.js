import { format } from 'date-fns';

/**
 * Format a numeric value as USD currency string.
 * @param {number|string|null} value
 * @returns {string}
 */
export function formatAmount(value) {
  return '$' + Number(value || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Format an ISO date string as "MMM d, yyyy". Returns em-dash for falsy input.
 * @param {string|null} dateStr
 * @returns {string}
 */
export function formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  try {
    return format(new Date(dateStr), 'MMM d, yyyy');
  } catch {
    return '\u2014';
  }
}
