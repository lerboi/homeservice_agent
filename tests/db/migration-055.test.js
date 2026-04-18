import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// jest.setup.js installs placeholder env vars so module-level Supabase clients
// don't throw at import time. Only run live-DB assertions when the env points
// at a real project (the placeholder URL is test.supabase.co + 'test-' / 'service-role' keys).
const isPlaceholder =
  !SUPABASE_URL ||
  SUPABASE_URL.includes('test.supabase.co') ||
  !SERVICE_KEY ||
  SERVICE_KEY === 'service-role' ||
  SERVICE_KEY.startsWith('test-');
const liveDb = isPlaceholder ? describe.skip : describe;

liveDb('Migration 055 — Jobber schedule mirror (live DB)', () => {
  const admin = createClient(SUPABASE_URL, SERVICE_KEY);

  it('calendar_events.provider CHECK admits jobber', async () => {
    const { error } = await admin.from('calendar_events').insert({
      tenant_id: '00000000-0000-0000-0000-000000000000',
      provider: 'jobber',
      external_id: 'test-mig-055',
      title: 'Test',
      start_time: new Date().toISOString(),
      end_time: new Date(Date.now() + 3600000).toISOString(),
    });
    expect(error?.message ?? '').not.toMatch(/check constraint/i);
  });

  it('accounting_credentials has jobber_bookable_user_ids column', async () => {
    const { error } = await admin
      .from('accounting_credentials')
      .select('jobber_bookable_user_ids')
      .limit(1);
    expect(error).toBeNull();
  });

  it('accounting_credentials has jobber_last_schedule_poll_at column', async () => {
    const { error } = await admin
      .from('accounting_credentials')
      .select('jobber_last_schedule_poll_at')
      .limit(1);
    expect(error).toBeNull();
  });

  it('appointments has jobber_visit_id column', async () => {
    const { error } = await admin
      .from('appointments')
      .select('jobber_visit_id')
      .limit(1);
    expect(error).toBeNull();
  });
});
