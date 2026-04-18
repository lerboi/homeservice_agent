/**
 * Pure-function helpers for CopyToJobberSection — extracted so they can be
 * unit-tested without a JSX parser. Re-exported by CopyToJobberSection.jsx.
 */

function formatDateTimeLong(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function durationMins(start, end) {
  if (!start || !end) return '—';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (Number.isNaN(ms)) return '—';
  return String(Math.round(ms / 60000));
}

/**
 * Build the 6-line pasteable text block (UI-SPEC §3 + §Copywriting).
 * Used by both the in-flyout Copy button and the post-booking email template.
 *
 * @param {object|null} appointment
 * @returns {string}
 */
export function buildJobberPasteBlock(appointment) {
  if (!appointment) return '';
  return [
    `Client: ${appointment.caller_name ?? '—'}`,
    `Phone: ${appointment.caller_phone ?? '—'}`,
    `Address: ${appointment.service_address ?? '—'}`,
    `Start: ${formatDateTimeLong(appointment.start_time)}`,
    `Duration: ${durationMins(appointment.start_time, appointment.end_time)} min`,
    `Notes: ${appointment.notes ?? '—'}`,
  ].join('\n');
}
