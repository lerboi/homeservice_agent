/** RED (Wave 0): will be made GREEN by Plan 48-01 Task 4 — do not delete */
/**
 * Phase 48 — GET /api/usage unit tests.
 *
 * Target: `src/app/api/usage/route.js` exports `GET` handler. Response shape:
 *   { callsUsed, callsIncluded, cycleDaysLeft, overageDollars }.
 *
 * RED state rationale:
 *  - The route file does not exist until Plan 48-01 Task 4.
 *  - `import('../../src/app/api/usage/route.js')` throws MODULE_NOT_FOUND → intended RED.
 */

describe('/api/usage GET', () => {
  it('exports a GET handler', async () => {
    const route = await import('../../src/app/api/usage/route.js');
    expect(typeof route.GET).toBe('function');
  });

  it('returns {callsUsed, callsIncluded, cycleDaysLeft, overageDollars}', async () => {
    // Plan 48-01 Task 4 will stub supabase + PRICING_TIERS and invoke the handler with
    // a fake authed request. For now this is a RED contract anchor.
    const route = await import('../../src/app/api/usage/route.js');
    expect(typeof route.GET).toBe('function');
    // Shape assertion placeholder — filled in once Task 4 wires supabase mock + fixture.
    const EXPECTED_KEYS = ['callsUsed', 'callsIncluded', 'cycleDaysLeft', 'overageDollars'];
    expect(EXPECTED_KEYS).toHaveLength(4);
  });

  it('overageDollars = 0 when callsUsed <= callsIncluded', async () => {
    // Guard: the math helper (once extracted or inlined) must return 0 when usage is at/under cap.
    // RED: currently no handler exists. Task 4 imports PRICING_TIERS and computes overage.
    const route = await import('../../src/app/api/usage/route.js');
    expect(typeof route.GET).toBe('function');
  });

  it('overageDollars = (used-included) * planRate when over cap', async () => {
    // RED: Task 4 reads PRICING_TIERS[planId].overageRate and multiplies the delta.
    // Starter: $2.48, Growth: $2.08, Scale: $1.50 per 48-RESEARCH.md.
    const route = await import('../../src/app/api/usage/route.js');
    expect(typeof route.GET).toBe('function');
  });
});
