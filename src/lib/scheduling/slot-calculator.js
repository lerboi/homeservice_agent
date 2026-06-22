import { addMinutes, parseISO } from 'date-fns';
import { toZonedTime, fromZonedTime } from 'date-fns-tz';

/**
 * Day-of-week key names matching the workingHours config shape.
 */
const DAY_KEYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Parse a "HH:MM" time string into { hours, minutes }.
 */
function parseTime(timeStr) {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return { hours, minutes };
}

/**
 * Build a UTC Date from a local date string ("YYYY-MM-DD") and a local time string ("HH:MM")
 * in the given IANA timezone.
 */
function localTimeToUTC(dateStr, timeStr, timezone) {
  const { hours, minutes } = parseTime(timeStr);
  // Construct a local datetime string and convert to UTC via fromZonedTime
  const localDatetime = new Date(`${dateStr}T${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
  return fromZonedTime(localDatetime, timezone);
}

/**
 * Check whether two intervals [aStart, aEnd) and [bStart, bEnd) overlap.
 * Uses exclusive end: start < other.end && end > other.start
 */
function intervalsOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && aEnd > bStart;
}

const MS_PER_DAY = 86400000;

/**
 * Expand an all-day busy row to tenant-local day bounds.
 *
 * All-day events are stored with date-only payloads that Postgres widens to
 * UTC-midnight timestamptz, so the nominal calendar date is the UTC date
 * portion of the stored timestamp — comparing the raw timestamps blocks the
 * wrong local hours for any non-UTC tenant.
 *
 * Returns [00:00 tenant-local of the first day, 00:00 tenant-local of the
 * day after the last day). Ends that land exactly on a UTC midnight (after
 * the start) follow the Google/Outlook exclusive-end convention — that
 * midnight already IS the day-after boundary; any other end time means the
 * event runs into that day, so the boundary is the following day.
 *
 * @param {Date} start - stored start_time
 * @param {Date} end   - stored end_time
 * @param {string} timezone - tenant IANA timezone
 * @returns {{ start: Date, end: Date }} UTC bounds of the tenant-local days
 */
function expandAllDayInterval(start, end, timezone) {
  const startDateStr = start.toISOString().slice(0, 10);

  const endsAtUtcMidnight = end.getTime() % MS_PER_DAY === 0;
  const exclusiveEnd =
    endsAtUtcMidnight && end > start
      ? end
      : new Date(Math.floor(end.getTime() / MS_PER_DAY) * MS_PER_DAY + MS_PER_DAY);
  const endDateStr = exclusiveEnd.toISOString().slice(0, 10);

  return {
    start: fromZonedTime(`${startDateStr}T00:00:00`, timezone),
    end: fromZonedTime(`${endDateStr}T00:00:00`, timezone),
  };
}

/**
 * Resolve the travel buffer in minutes between the last booking and a candidate slot.
 *
 * Logic:
 * - If zones array is empty (no zones configured): the tenant's default buffer
 * - If last booking has no zone_id or candidate has no zone: the default buffer (cross-zone)
 * - If last booking's zone_id === candidateZoneId: 0-min buffer (same zone)
 * - If different zones: look up zonePairBuffers; default buffer if no entry
 *
 * `defaultBufferMins` is the owner-adjustable tenant-wide buffer
 * (tenants.travel_buffer_mins, M16 P2; default 30 = pre-P2 behavior). The
 * zone-differentiated branches stay dormant — zone_id is always null today —
 * so in practice this returns `defaultBufferMins`.
 *
 * @param {string|null} lastBookingZoneId
 * @param {string|null} candidateZoneId
 * @param {Array}  zones            Array of { id, name } zone objects
 * @param {Array}  zonePairBuffers  Array of { zone_a_id, zone_b_id, buffer_mins }
 * @param {number} [defaultBufferMins=30] Tenant-wide default travel buffer
 * @returns {number} buffer in minutes
 */
function getTravelBufferMins(lastBookingZoneId, candidateZoneId, zones, zonePairBuffers, defaultBufferMins = 30) {
  // No zones configured at all — flat default buffer
  if (!zones || zones.length === 0) {
    return defaultBufferMins;
  }

  // No zone info on one or both sides — treat as cross-zone (default buffer)
  if (!lastBookingZoneId || !candidateZoneId) {
    return defaultBufferMins;
  }

  // Same zone — no buffer
  if (lastBookingZoneId === candidateZoneId) {
    return 0;
  }

  // Different zones — look for a custom buffer entry
  if (zonePairBuffers && zonePairBuffers.length > 0) {
    const pair = zonePairBuffers.find(
      (p) =>
        (p.zone_a_id === lastBookingZoneId && p.zone_b_id === candidateZoneId) ||
        (p.zone_a_id === candidateZoneId && p.zone_b_id === lastBookingZoneId)
    );
    if (pair) {
      return pair.buffer_mins;
    }
  }

  // Default cross-zone buffer
  return defaultBufferMins;
}

/**
 * Calculate available booking slots for a given date.
 *
 * @param {object} config
 * @param {object} config.workingHours      - Day-keyed working hours config
 * @param {number} config.slotDurationMins  - Slot length in minutes (e.g., 60)
 * @param {Array}  config.existingBookings  - Array of { start_time, end_time, zone_id? } (ISO strings)
 * @param {Array}  config.externalBlocks    - Array of { start_time, end_time, is_all_day? } (ISO strings)
 * @param {Array}  config.zones             - Array of { id, name } zone objects
 * @param {Array}  config.zonePairBuffers   - Array of { zone_a_id, zone_b_id, buffer_mins }
 * @param {string} config.targetDate        - "YYYY-MM-DD" date string
 * @param {string} config.tenantTimezone    - IANA timezone (e.g., "America/Chicago")
 * @param {number} config.maxSlots          - Maximum slots to return
 * @param {string} [config.candidateZoneId] - Zone ID for the candidate booking (for buffer calc)
 * @param {number} [config.travelBufferMins=30] - Owner-adjustable tenant-wide travel buffer in
 *   minutes (tenants.travel_buffer_mins, M16 P2; default 30 = pre-P2 behavior). Enforced on BOTH
 *   sides of every existing booking (forward + backward).
 * @returns {Array<{ start: string, end: string }>} Available slots as ISO strings
 */
export function calculateAvailableSlots({
  workingHours,
  slotDurationMins,
  existingBookings = [],
  externalBlocks = [],
  zones = [],
  zonePairBuffers = [],
  targetDate,
  tenantTimezone,
  maxSlots = 10,
  candidateZoneId = null,
  travelBufferMins = 30,
}) {
  // Determine the day of week from the target date
  // Parse as local midnight to get correct day-of-week
  const [year, month, day] = targetDate.split('-').map(Number);
  // Create a date object representing midnight in the tenant timezone to get the correct weekday
  const localMidnight = fromZonedTime(new Date(year, month - 1, day, 0, 0, 0), tenantTimezone);
  // Get the weekday in the tenant's local timezone
  const zonedMidnight = toZonedTime(localMidnight, tenantTimezone);
  const dayKey = DAY_KEYS[zonedMidnight.getDay()];

  const dayConfig = workingHours?.[dayKey];

  // Day off or missing config — no slots
  if (!dayConfig || !dayConfig.enabled) {
    return [];
  }

  const { open, close, lunchStart, lunchEnd } = dayConfig;

  // Convert working hours to UTC Date objects
  const windowStart = localTimeToUTC(targetDate, open, tenantTimezone);
  const windowEnd = localTimeToUTC(targetDate, close, tenantTimezone);

  // If the entire working window is in the past, no slots are possible
  // (mirrors the Python twin in livekit-agent slot_calculator.py)
  const now = new Date();
  if (windowEnd <= now) {
    return [];
  }

  // Lunch block in UTC (if configured)
  const lunchStartUTC = lunchStart ? localTimeToUTC(targetDate, lunchStart, tenantTimezone) : null;
  const lunchEndUTC = lunchEnd ? localTimeToUTC(targetDate, lunchEnd, tenantTimezone) : null;

  // Parse existing bookings to Date objects
  const parsedBookings = existingBookings.map((b) => ({
    start: new Date(b.start_time),
    end: new Date(b.end_time),
    zone_id: b.zone_id || null,
  }));

  // Parse external blocks to Date objects.
  // All-day rows are stored as UTC-midnight timestamps — expand them to
  // tenant-local day bounds so they block the correct local hours.
  const parsedBlocks = externalBlocks.map((b) => {
    const start = new Date(b.start_time);
    const end = new Date(b.end_time);
    if (b.is_all_day) {
      return expandAllDayInterval(start, end, tenantTimezone);
    }
    return { start, end };
  });

  const available = [];
  let cursor = new Date(windowStart);

  // Skip past slots when calculating for today — don't offer times that have already passed
  if (cursor < now && now < windowEnd) {
    // Only advance if we're within today's working window
    // Check if targetDate is actually today in the tenant timezone
    const zonedNow = toZonedTime(now, tenantTimezone);
    const todayStr = `${zonedNow.getFullYear()}-${String(zonedNow.getMonth() + 1).padStart(2, '0')}-${String(zonedNow.getDate()).padStart(2, '0')}`;
    if (targetDate === todayStr) {
      // Round cursor up to the next slot-grid-aligned boundary
      // so offered times match the clean grid (9:00, 10:00, etc.)
      const elapsedMs = now - windowStart;
      const slotMs = slotDurationMins * 60000;
      const slotsElapsed = Math.ceil(elapsedMs / slotMs);
      cursor = new Date(windowStart.getTime() + slotsElapsed * slotMs);
    }
  }

  while (cursor < windowEnd && available.length < maxSlots) {
    const slotStart = new Date(cursor);
    const slotEnd = addMinutes(slotStart, slotDurationMins);

    // Slot must fit within the working window
    if (slotEnd > windowEnd) {
      break;
    }

    // Skip slots that overlap with the lunch break
    if (lunchStartUTC && lunchEndUTC) {
      if (intervalsOverlap(slotStart, slotEnd, lunchStartUTC, lunchEndUTC)) {
        cursor = addMinutes(cursor, slotDurationMins);
        continue;
      }
    }

    // Check overlap with existing bookings
    const bookedOverlap = parsedBookings.some((b) =>
      intervalsOverlap(slotStart, slotEnd, b.start, b.end)
    );
    if (bookedOverlap) {
      cursor = addMinutes(cursor, slotDurationMins);
      continue;
    }

    // Check overlap with external calendar blocks
    const externalOverlap = parsedBlocks.some((b) =>
      intervalsOverlap(slotStart, slotEnd, b.start, b.end)
    );
    if (externalOverlap) {
      cursor = addMinutes(cursor, slotDurationMins);
      continue;
    }

    // Travel buffer check (BACKWARD): find the last booking that ends before
    // this slot starts; require travel time after it before this slot may begin.
    const bookingsBefore = parsedBookings.filter((b) => b.end <= slotStart);
    if (bookingsBefore.length > 0) {
      // Find the one that ends latest
      const lastBooking = bookingsBefore.reduce((latest, b) =>
        b.end > latest.end ? b : latest
      );

      const bufferMins = getTravelBufferMins(
        lastBooking.zone_id,
        candidateZoneId,
        zones,
        zonePairBuffers,
        travelBufferMins
      );

      if (bufferMins > 0) {
        const earliestStart = addMinutes(lastBooking.end, bufferMins);
        if (slotStart < earliestStart) {
          cursor = addMinutes(cursor, slotDurationMins);
          continue;
        }
      }
    }

    // Travel buffer check (FORWARD, M16 P2): find the earliest booking that
    // starts at/after this slot ends; require travel time after this slot before
    // that booking begins. Mirrors the backward case so the buffer is symmetric
    // on both sides of every booking (coordinate-free datetime math).
    const bookingsAfter = parsedBookings.filter((b) => b.start >= slotEnd);
    if (bookingsAfter.length > 0) {
      // Find the one that starts earliest
      const nextBooking = bookingsAfter.reduce((earliest, b) =>
        b.start < earliest.start ? b : earliest
      );

      const bufferMins = getTravelBufferMins(
        nextBooking.zone_id,
        candidateZoneId,
        zones,
        zonePairBuffers,
        travelBufferMins
      );

      if (bufferMins > 0) {
        const latestEnd = addMinutes(nextBooking.start, -bufferMins);
        if (slotEnd > latestEnd) {
          cursor = addMinutes(cursor, slotDurationMins);
          continue;
        }
      }
    }

    // Slot passes all checks
    available.push({
      start: slotStart.toISOString(),
      end: slotEnd.toISOString(),
    });

    cursor = addMinutes(cursor, slotDurationMins);
  }

  return available;
}
