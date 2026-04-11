import { describe, test, expect } from '@jest/globals';
import { calculateAvailableSlots } from '@/lib/scheduling/slot-calculator.js';

// April 13, 2026 is a Monday.
// Chicago is in CDT (UTC-5) during April.
// 09:00 CDT = 14:00 UTC, 12:00 CDT = 17:00 UTC, 13:00 CDT = 18:00 UTC, 17:00 CDT = 22:00 UTC
const TARGET_DATE = '2026-04-13'; // Monday
const CHICAGO_TZ = 'America/Chicago';

const WORKING_HOURS = {
  monday:    { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  tuesday:   { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  wednesday: { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  thursday:  { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  friday:    { open: '09:00', close: '17:00', enabled: true,  lunchStart: null, lunchEnd: null },
  saturday:  { open: '09:00', close: '17:00', enabled: false, lunchStart: null, lunchEnd: null },
  sunday:    { open: '09:00', close: '17:00', enabled: false, lunchStart: null, lunchEnd: null },
};

const BASE_PARAMS = {
  workingHours: WORKING_HOURS,
  slotDurationMins: 60,
  existingBookings: [],
  zones: [],
  zonePairBuffers: [],
  tenantTimezone: CHICAGO_TZ,
  maxSlots: 50,
};

describe('calculateAvailableSlots — time block exclusion', () => {
  test('time block from 12:00-13:00 CT excludes the overlapping 12:00 slot', () => {
    // 12:00 CDT = 17:00 UTC, 13:00 CDT = 18:00 UTC
    const externalBlocks = [
      {
        start_time: '2026-04-13T17:00:00Z',
        end_time: '2026-04-13T18:00:00Z',
      },
    ];

    const slots = calculateAvailableSlots({
      ...BASE_PARAMS,
      externalBlocks,
      targetDate: TARGET_DATE,
    });

    // Without the block: 9,10,11,12,13,14,15,16 = 8 slots
    // With the 12:00 block: 9,10,11,13,14,15,16 = 7 slots
    expect(slots.length).toBe(7);

    // No slot should start within the blocked window [17:00Z, 18:00Z)
    const blockStart = new Date('2026-04-13T17:00:00Z').getTime();
    const blockEnd = new Date('2026-04-13T18:00:00Z').getTime();
    for (const slot of slots) {
      const slotStart = new Date(slot.start).getTime();
      const slotEnd = new Date(slot.end).getTime();
      // Slot must not overlap with block: no slot [slotStart, slotEnd) overlaps [blockStart, blockEnd)
      const overlaps = slotStart < blockEnd && slotEnd > blockStart;
      expect(overlaps).toBe(false);
    }
  });

  test('without time blocks, 12:00 CT slot is available (8 slots total)', () => {
    const slots = calculateAvailableSlots({
      ...BASE_PARAMS,
      externalBlocks: [],
      targetDate: TARGET_DATE,
    });

    // 9AM to 5PM with 60-min slots = 8 slots: 9,10,11,12,13,14,15,16
    expect(slots.length).toBe(8);

    // Slot starting at 12:00 CDT = 17:00 UTC should be present
    const noonSlot = slots.find((s) => s.start === '2026-04-13T17:00:00.000Z');
    expect(noonSlot).toBeDefined();
  });

  test('all-day time block returns no available slots for that day', () => {
    // Covers the entire working window: 09:00 CDT (14:00 UTC) to 17:00 CDT (22:00 UTC)
    const externalBlocks = [
      {
        start_time: '2026-04-13T14:00:00Z',
        end_time: '2026-04-13T22:00:00Z',
      },
    ];

    const slots = calculateAvailableSlots({
      ...BASE_PARAMS,
      externalBlocks,
      targetDate: TARGET_DATE,
    });

    expect(slots).toHaveLength(0);
  });
});
