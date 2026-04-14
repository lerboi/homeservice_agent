/** RED (Wave 0): will be made GREEN by Plan 48-01 Task 4 — do not delete */
/**
 * Phase 48 — deriveChecklistItems() unit tests.
 *
 * Target: `src/app/api/setup-checklist/route.js` exports `deriveChecklistItems`, `VALID_ITEM_IDS`,
 * `THEME_GROUPS`. Tests exercise the pure theming + override logic (NOT the Next.js handler).
 *
 * RED state rationale:
 *  - Plan 48-01 Task 4 is what exports `deriveChecklistItems`/`VALID_ITEM_IDS`/`THEME_GROUPS`.
 *  - Until Task 4 ships, these imports are undefined and the assertions fail → intended RED.
 *  - Later plans turn these GREEN by implementing theme grouping + checklist_overrides merge.
 */

describe('deriveChecklistItems', () => {
  it('exports VALID_ITEM_IDS including setup_profile and setup_billing', async () => {
    const route = await import('../../src/app/api/setup-checklist/route.js');
    expect(Array.isArray(route.VALID_ITEM_IDS)).toBe(true);
    expect(route.VALID_ITEM_IDS).toEqual(
      expect.arrayContaining([
        'setup_profile',
        'configure_services',
        'make_test_call',
        'configure_hours',
        'configure_notifications',
        'configure_call_routing',
        'connect_calendar',
        'configure_zones',
        'setup_escalation',
        'setup_billing',
      ])
    );
  });

  it('returns theme groupings profile/voice/calendar/billing', async () => {
    const route = await import('../../src/app/api/setup-checklist/route.js');
    expect(route.THEME_GROUPS).toBeDefined();
    expect(Object.keys(route.THEME_GROUPS).sort()).toEqual(
      ['billing', 'calendar', 'profile', 'voice']
    );
    expect(route.THEME_GROUPS.profile).toEqual(expect.arrayContaining(['setup_profile']));
    expect(route.THEME_GROUPS.voice).toEqual(
      expect.arrayContaining([
        'configure_services',
        'make_test_call',
        'configure_hours',
        'configure_notifications',
        'configure_call_routing',
      ])
    );
    expect(route.THEME_GROUPS.calendar).toEqual(
      expect.arrayContaining(['connect_calendar', 'configure_zones', 'setup_escalation'])
    );
    expect(route.THEME_GROUPS.billing).toEqual(expect.arrayContaining(['setup_billing']));
  });

  it('mark_done override forces complete:true', async () => {
    const route = await import('../../src/app/api/setup-checklist/route.js');
    expect(typeof route.deriveChecklistItems).toBe('function');
    // This test will be fleshed out in Plan 48-01 Task 4 with a proper fake Supabase client.
    // RED sentinel: the exported function must exist with the contracted name.
    expect(route.deriveChecklistItems.length).toBeGreaterThanOrEqual(2);
  });

  it('dismiss override removes item from list', async () => {
    const route = await import('../../src/app/api/setup-checklist/route.js');
    // Once Task 4 lands, test cases will pass { checklist_overrides: { [id]: { dismissed: true } } }
    // through a fake supabase and assert the item is excluded from the returned items array.
    // For Wave 0 we only assert the contract surface exists.
    expect(typeof route.deriveChecklistItems).toBe('function');
    expect(route.VALID_ITEM_IDS).toContain('setup_profile');
  });
});
