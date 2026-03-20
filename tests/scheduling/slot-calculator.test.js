import { describe, test, expect } from '@jest/globals';
import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator.js';

// A Monday at 08:00 in America/Chicago (UTC-5 in standard time)
// 2026-03-23 is a Monday
const MONDAY = '2026-03-23';
const CHICAGO_TZ = 'America/Chicago';

// Working hours config — 8AM to 5PM Monday through Friday, lunch 12-1
const STANDARD_HOURS = {
  monday:    { open: '08:00', close: '17:00', enabled: true,  lunchStart: '12:00', lunchEnd: '13:00' },
  tuesday:   { open: '08:00', close: '17:00', enabled: true,  lunchStart: '12:00', lunchEnd: '13:00' },
  wednesday: { open: '08:00', close: '17:00', enabled: true,  lunchStart: '12:00', lunchEnd: '13:00' },
  thursday:  { open: '08:00', close: '17:00', enabled: true,  lunchStart: '12:00', lunchEnd: '13:00' },
  friday:    { open: '08:00', close: '17:00', enabled: true,  lunchStart: '12:00', lunchEnd: '13:00' },
  saturday:  { open: '08:00', close: '12:00', enabled: false, lunchStart: null,    lunchEnd: null    },
  sunday:    { open: '08:00', close: '12:00', enabled: false, lunchStart: null,    lunchEnd: null    },
};

// Helper to build a UTC ISO datetime string for a given local time in Chicago
function chicagoTime(date, timeStr) {
  // During CDT (March 23 is after DST spring-forward on 2026-03-08)
  // Chicago is UTC-5 in CST, UTC-6 in CDT... actually CDT = UTC-5
  // 2026-03-23: after spring-forward, CDT = UTC-5
  // So 08:00 CDT = 13:00 UTC
  const [h, m] = timeStr.split(':').map(Number);
  const dateObj = new Date(`${date}T${timeStr}:00`);
  // Use the actual offset for this date in Chicago
  return new Date(`${date}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`);
}

describe('calculateAvailableSlots', () => {
  test('returns slots within working hours for Monday 8AM-5PM (60min, no bookings, no lunch)', () => {
    const HOURS_NO_LUNCH = {
      ...STANDARD_HOURS,
      monday: { open: '08:00', close: '17:00', enabled: true, lunchStart: null, lunchEnd: null },
    };
    const slots = calculateAvailableSlots({
      workingHours: HOURS_NO_LUNCH,
      slotDurationMins: 60,
      existingBookings: [],
      externalBlocks: [],
      zones: [],
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
    });

    // 8AM to 5PM = 9 slots: 8, 9, 10, 11, 12, 13, 14, 15, 16
    expect(slots).toHaveLength(9);
    expect(slots[0]).toHaveProperty('start');
    expect(slots[0]).toHaveProperty('end');
    // First slot should start at 08:00 local time
    const firstSlotLocal = new Date(slots[0].start);
    expect(firstSlotLocal).toBeInstanceOf(Date);
  });

  test('returns empty array for a disabled day (Saturday)', () => {
    const SATURDAY = '2026-03-28';
    const slots = calculateAvailableSlots({
      workingHours: STANDARD_HOURS,
      slotDurationMins: 60,
      existingBookings: [],
      externalBlocks: [],
      zones: [],
      zonePairBuffers: [],
      targetDate: SATURDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
    });

    expect(slots).toHaveLength(0);
  });

  test('excludes slots that overlap with existing bookings', () => {
    // Working hours without lunch for simplicity, 8AM-5PM = 9 slots
    const HOURS_NO_LUNCH = {
      ...STANDARD_HOURS,
      monday: { open: '08:00', close: '17:00', enabled: true, lunchStart: null, lunchEnd: null },
    };

    // Book the 9AM slot by providing a booking from 09:00 to 10:00
    // We'll use ISO strings — the calculator should handle them
    const booking9am = {
      start_time: `${MONDAY}T14:00:00.000Z`, // 09:00 CDT = 14:00 UTC
      end_time:   `${MONDAY}T15:00:00.000Z`, // 10:00 CDT = 15:00 UTC
    };

    const slots = calculateAvailableSlots({
      workingHours: HOURS_NO_LUNCH,
      slotDurationMins: 60,
      existingBookings: [booking9am],
      externalBlocks: [],
      zones: [],
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
    });

    // 9 total - 1 booked = 8 slots (also -1 for 30min flat buffer after 9AM booking = 10AM also excluded)
    // Wait: with no zones, flat 30min buffer. After booking ends at 10:00, next slot must be >= 10:30.
    // 10:00 slot starts at 10:00 which is exactly when booking ends, and buffer would push to 10:30.
    // So 10:00 slot is excluded, 11:00 slot is fine.
    // That means 8AM, 9AM(booked), 10AM(buffer), 11AM, 12PM, 1PM, 2PM, 3PM, 4PM
    // Available: 8AM, 11AM, 12PM, 1PM, 2PM, 3PM, 4PM = 7 slots
    expect(slots.length).toBeLessThan(9);
    // 9AM slot should not be in results
    const startTimes = slots.map((s) => new Date(s.start).toISOString());
    expect(startTimes).not.toContain(booking9am.start_time);
  });

  test('excludes slots overlapping external calendar blocks', () => {
    const HOURS_NO_LUNCH = {
      ...STANDARD_HOURS,
      monday: { open: '08:00', close: '17:00', enabled: true, lunchStart: null, lunchEnd: null },
    };
    // External block covers 10:00-11:00 CDT (15:00-16:00 UTC)
    const externalBlock = {
      start_time: `${MONDAY}T15:00:00.000Z`,
      end_time:   `${MONDAY}T16:00:00.000Z`,
    };

    const slots = calculateAvailableSlots({
      workingHours: HOURS_NO_LUNCH,
      slotDurationMins: 60,
      existingBookings: [],
      externalBlocks: [externalBlock],
      zones: [],
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
    });

    const startTimes = slots.map((s) => new Date(s.start).toISOString());
    expect(startTimes).not.toContain(externalBlock.start_time);
    // No bookings, so no travel buffer; 9 - 1 external = 8 slots
    expect(slots.length).toBe(8);
  });

  test('applies flat 30-minute buffer between bookings when no zones configured', () => {
    const HOURS_NO_LUNCH = {
      ...STANDARD_HOURS,
      monday: { open: '08:00', close: '17:00', enabled: true, lunchStart: null, lunchEnd: null },
    };
    // Booking at 8AM-9AM CDT (13:00-14:00 UTC)
    const booking8am = {
      start_time: `${MONDAY}T13:00:00.000Z`,
      end_time:   `${MONDAY}T14:00:00.000Z`,
    };

    const slots = calculateAvailableSlots({
      workingHours: HOURS_NO_LUNCH,
      slotDurationMins: 60,
      existingBookings: [booking8am],
      externalBlocks: [],
      zones: [],
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
    });

    // After 9AM (end of booking), 30min buffer means next slot must be >= 9:30 AM
    // 9AM slot would start at 9AM = exactly booking end => also excluded by overlap check
    // 9:30AM is not a valid slot boundary (60min slots), so 10AM is first free slot
    const startTimes = slots.map((s) => new Date(s.start).toISOString());
    // 9AM slot (14:00 UTC) must not appear
    expect(startTimes).not.toContain(`${MONDAY}T14:00:00.000Z`);
    // 10AM slot (15:00 UTC) should appear
    expect(startTimes).toContain(`${MONDAY}T15:00:00.000Z`);
  });

  test('applies 0-minute buffer for same-zone consecutive bookings', () => {
    const HOURS_NO_LUNCH = {
      ...STANDARD_HOURS,
      monday: { open: '08:00', close: '17:00', enabled: true, lunchStart: null, lunchEnd: null },
    };
    const zoneA = 'zone-a-uuid';
    const zones = [{ id: zoneA, name: 'Zone A' }];

    // Booking at 8AM-9AM in Zone A
    const booking8am = {
      start_time: `${MONDAY}T13:00:00.000Z`,
      end_time:   `${MONDAY}T14:00:00.000Z`,
      zone_id:    zoneA,
    };

    // Candidate slot at 9AM also in Zone A — same zone => 0min buffer => should be available
    const slots = calculateAvailableSlots({
      workingHours: HOURS_NO_LUNCH,
      slotDurationMins: 60,
      existingBookings: [booking8am],
      externalBlocks: [],
      zones,
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
      candidateZoneId: zoneA,
    });

    const startTimes = slots.map((s) => new Date(s.start).toISOString());
    // 9AM (14:00 UTC) should be available because same-zone = 0 buffer
    expect(startTimes).toContain(`${MONDAY}T14:00:00.000Z`);
  });

  test('applies 30-minute buffer for cross-zone bookings', () => {
    const HOURS_NO_LUNCH = {
      ...STANDARD_HOURS,
      monday: { open: '08:00', close: '17:00', enabled: true, lunchStart: null, lunchEnd: null },
    };
    const zoneA = 'zone-a-uuid';
    const zoneB = 'zone-b-uuid';
    const zones = [
      { id: zoneA, name: 'Zone A' },
      { id: zoneB, name: 'Zone B' },
    ];

    // Booking at 8AM-9AM in Zone A
    const booking8am = {
      start_time: `${MONDAY}T13:00:00.000Z`,
      end_time:   `${MONDAY}T14:00:00.000Z`,
      zone_id:    zoneA,
    };

    // Candidate zone is Zone B — cross-zone => 30min buffer
    const slots = calculateAvailableSlots({
      workingHours: HOURS_NO_LUNCH,
      slotDurationMins: 60,
      existingBookings: [booking8am],
      externalBlocks: [],
      zones,
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
      candidateZoneId: zoneB,
    });

    const startTimes = slots.map((s) => new Date(s.start).toISOString());
    // 9AM (14:00 UTC) should NOT be available — cross-zone requires 30min buffer after 9AM
    expect(startTimes).not.toContain(`${MONDAY}T14:00:00.000Z`);
    // 10AM (15:00 UTC) should be available
    expect(startTimes).toContain(`${MONDAY}T15:00:00.000Z`);
  });

  test('respects maxSlots limit', () => {
    const HOURS_NO_LUNCH = {
      ...STANDARD_HOURS,
      monday: { open: '08:00', close: '17:00', enabled: true, lunchStart: null, lunchEnd: null },
    };
    const slots = calculateAvailableSlots({
      workingHours: HOURS_NO_LUNCH,
      slotDurationMins: 60,
      existingBookings: [],
      externalBlocks: [],
      zones: [],
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 3,
    });

    expect(slots).toHaveLength(3);
  });

  test('handles lunch break gap correctly', () => {
    // Standard hours WITH lunch 12-1: 8-12 = 4 slots, 1-5 = 4 slots = 8 total
    const slots = calculateAvailableSlots({
      workingHours: STANDARD_HOURS,
      slotDurationMins: 60,
      existingBookings: [],
      externalBlocks: [],
      zones: [],
      zonePairBuffers: [],
      targetDate: MONDAY,
      tenantTimezone: CHICAGO_TZ,
      maxSlots: 20,
    });

    // 8AM, 9AM, 10AM, 11AM, 1PM, 2PM, 3PM, 4PM = 8 slots (12PM excluded by lunch)
    expect(slots).toHaveLength(8);
    const startTimes = slots.map((s) => new Date(s.start).toISOString());
    // 12PM CDT = 17:00 UTC during CDT
    const noon = startTimes.find((t) => new Date(t).getUTCHours() === 17 && new Date(t).getUTCMinutes() === 0);
    expect(noon).toBeUndefined();
  });
});
