import { fromZonedTime } from 'date-fns-tz';

/**
 * Day/month boundaries in a tenant's LOCAL timezone, returned as UTC ISO strings
 * for `created_at >= ...` / `paid_at >= ...` timestamptz comparisons.
 *
 * Fixes the UTC off-by-a-day for non-UTC tenants (2026-06-12 audit M18): a US
 * tenant past UTC-midnight (e.g. 7pm EST) would otherwise have "today" already
 * rolled forward, undercounting today's activity.
 *
 * @param {string|null|undefined} timezone IANA tz (e.g. 'America/New_York'); falls back to UTC.
 * @returns {{ timezone: string, todayStartISO: string, monthStartISO: string }}
 */
export function tenantDayBoundaries(timezone) {
  const tz = timezone || 'UTC';
  let ymd;
  try {
    // en-CA formats as YYYY-MM-DD; this is "now" expressed in the tenant's tz.
    ymd = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());
  } catch {
    // Invalid tz string — degrade to UTC rather than throw.
    const utc = new Date().toISOString().slice(0, 10);
    return {
      timezone: 'UTC',
      todayStartISO: `${utc}T00:00:00.000Z`,
      monthStartISO: `${utc.slice(0, 8)}01T00:00:00.000Z`,
    };
  }
  const monthYmd = `${ymd.slice(0, 8)}01`;
  return {
    timezone: tz,
    todayStartISO: fromZonedTime(`${ymd}T00:00:00`, tz).toISOString(),
    monthStartISO: fromZonedTime(`${monthYmd}T00:00:00`, tz).toISOString(),
  };
}
