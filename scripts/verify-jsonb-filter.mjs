// Phase 53 Plan 05 Task 3 — Verify Assumption A1: JSONB filter syntax
// Usage: node --env-file=.env.local scripts/verify-jsonb-filter.mjs
import { createClient } from '@supabase/supabase-js';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing env vars');
  process.exit(1);
}
const supabase = createClient(url, key);

async function snapshotAll() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, business_name, features_enabled');
  if (error) throw error;
  return data;
}

async function queryEnabled() {
  const { data, error } = await supabase
    .from('tenants')
    .select('id, features_enabled')
    .eq('features_enabled->>invoicing', 'true');
  if (error) throw error;
  return data;
}

async function queryEnabledBooleanWrong() {
  // Negative control — boolean true (expected to return 0 rows)
  const { data, error } = await supabase
    .from('tenants')
    .select('id')
    .eq('features_enabled->>invoicing', true);
  if (error) return { error: error.message };
  return data;
}

const before = await snapshotAll();
console.log('=== STEP 0: Snapshot all tenants ===');
console.log(`Total tenants: ${before.length}`);
for (const t of before) {
  console.log(`  ${t.id}  ${t.business_name}  features_enabled=${JSON.stringify(t.features_enabled)}`);
}

console.log('\n=== STEP 1: Pick a tenant and enable invoicing ===');
const target = before[0];
if (!target) {
  console.log('No tenants in DB — cannot run verification.');
  process.exit(1);
}
const originalFlags = target.features_enabled;
console.log(`Target tenant: ${target.id}`);
console.log(`Original features_enabled: ${JSON.stringify(originalFlags)}`);

const enabledPayload = { ...(originalFlags || {}), invoicing: true };
const { error: upErr } = await supabase
  .from('tenants')
  .update({ features_enabled: enabledPayload })
  .eq('id', target.id);
if (upErr) throw upErr;
console.log(`Set features_enabled to: ${JSON.stringify(enabledPayload)}`);

try {
  console.log('\n=== STEP 2: Run enabled-tenant filter (string true) ===');
  const enabled = await queryEnabled();
  console.log(`Row count: ${enabled.length}`);
  for (const t of enabled) {
    console.log(`  ${t.id}  features_enabled=${JSON.stringify(t.features_enabled)}`);
  }
  const step2Match = enabled.some((t) => t.id === target.id);
  console.log(step2Match ? 'PASS: target tenant returned.' : 'FAIL: target tenant NOT returned.');

  console.log('\n=== STEP 3: Count enabled tenants ===');
  const { count, error: countErr } = await supabase
    .from('tenants')
    .select('*', { count: 'exact', head: true })
    .eq('features_enabled->>invoicing', 'true');
  if (countErr) throw countErr;
  console.log(`Count: ${count}`);

  console.log('\n=== STEP 3b: Negative control — boolean true instead of string ===');
  const negative = await queryEnabledBooleanWrong();
  if (Array.isArray(negative)) {
    console.log(`Row count with boolean true: ${negative.length} (expected 0 to confirm Pitfall 2)`);
  } else {
    console.log(`PostgREST rejected boolean: ${negative.error}`);
  }

  console.log('\n=== STEP 4: Disable flag and re-run filter ===');
  const disabledPayload = { ...(originalFlags || {}), invoicing: false };
  await supabase.from('tenants').update({ features_enabled: disabledPayload }).eq('id', target.id);
  const afterDisable = await queryEnabled();
  const stillThere = afterDisable.some((t) => t.id === target.id);
  console.log(`Target in enabled list after disable: ${stillThere} (expected false)`);
  console.log(`Enabled count after disable: ${afterDisable.length}`);
} finally {
  console.log('\n=== STEP 5: Restore original features_enabled ===');
  await supabase
    .from('tenants')
    .update({ features_enabled: originalFlags })
    .eq('id', target.id);
  console.log(`Restored to: ${JSON.stringify(originalFlags)}`);
}

console.log('\nDONE.');
