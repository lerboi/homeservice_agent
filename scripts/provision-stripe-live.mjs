/**
 * Provision Voco's Stripe billing config in LIVE mode (mirror of the test setup).
 *
 * Creates (idempotently — safe to re-run):
 *   - 1 Billing Meter "voco_calls" (sum aggregation, customer key=stripe_customer_id, value key=value)
 *   - 3 Products: Starter / Growth / Scale
 *   - 9 Prices: {plan} x {monthly, annual, overage}
 *   - (optional) 1 Webhook endpoint with the 9 events the app handles
 *
 * Idempotency: products matched by metadata.voco_plan; prices matched by lookup_key;
 * meter matched by event_name. Re-running reuses existing objects and never duplicates.
 *
 * Usage (PowerShell):
 *   $env:STRIPE_LIVE_SECRET_KEY="sk_live_..."; node scripts/provision-stripe-live.mjs
 * Dry run (prints planned actions, creates nothing):
 *   $env:STRIPE_LIVE_SECRET_KEY="sk_live_..."; node scripts/provision-stripe-live.mjs --dry-run
 * Also create the live webhook endpoint (prints its signing secret):
 *   $env:STRIPE_LIVE_SECRET_KEY="sk_live_..."; $env:STRIPE_WEBHOOK_URL="https://app.voco.live/api/stripe/webhook"; node scripts/provision-stripe-live.mjs
 */
import Stripe from 'stripe';

const KEY = process.env.STRIPE_LIVE_SECRET_KEY;
const DRY_RUN = process.argv.includes('--dry-run');
const WEBHOOK_URL = process.env.STRIPE_WEBHOOK_URL || null;

if (!KEY) {
  console.error('✗ Set STRIPE_LIVE_SECRET_KEY (sk_live_...) in the environment first.');
  process.exit(1);
}
if (!KEY.startsWith('sk_live_')) {
  console.error('✗ Refusing to run: STRIPE_LIVE_SECRET_KEY is not an sk_live_ key. This script is for LIVE mode only.');
  process.exit(1);
}

// Pin the same API version the app uses (Basil — required for Billing Meters + flexible billing).
const stripe = new Stripe(KEY, { apiVersion: '2025-06-30.basil' });

// ── Desired config — mirrors the test account exactly ────────────────────────
const PLANS = [
  { key: 'starter', name: 'Starter', description: 'For solo operators — 40 calls/month',
    monthly: 9900,  annual: 94800,  overage: 248, overageNick: 'Starter Overage — $2.48 per call beyond 40/mo' },
  { key: 'growth',  name: 'Growth',  description: 'For growing crews — 120 calls/month',
    monthly: 24900, annual: 238800, overage: 208, overageNick: 'Growth Overage — $2.08 per call beyond 120/mo' },
  { key: 'scale',   name: 'Scale',   description: 'For multi-crew operations — 400 calls/month',
    monthly: 59900, annual: 574800, overage: 150, overageNick: 'Scale Overage — $1.50 per call beyond 400/mo' },
];

const WEBHOOK_EVENTS = [
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.paused',
  'customer.subscription.resumed',
  'customer.subscription.trial_will_end',
  'invoice.paid',
  'invoice.payment_failed',
];

const log = (...a) => console.log(...a);
const plan = (msg) => log(`${DRY_RUN ? '[dry-run] would ' : ''}${msg}`);

async function getOrCreateMeter() {
  const existing = (await stripe.billing.meters.list({ status: 'active', limit: 100 })).data
    .find((m) => m.event_name === 'voco_calls');
  if (existing) { log(`✓ meter voco_calls exists: ${existing.id}`); return existing.id; }
  plan('create meter voco_calls');
  if (DRY_RUN) return 'mtr_DRYRUN';
  const m = await stripe.billing.meters.create({
    display_name: 'Voco Calls',
    event_name: 'voco_calls',
    default_aggregation: { formula: 'sum' },
    customer_mapping: { type: 'by_id', event_payload_key: 'stripe_customer_id' },
    value_settings: { event_payload_key: 'value' },
  });
  log(`✓ created meter voco_calls: ${m.id}`);
  return m.id;
}

async function getOrCreateProduct(p) {
  const found = (await stripe.products.search({ query: `metadata['voco_plan']:'${p.key}'`, limit: 1 })).data[0];
  if (found) { log(`✓ product ${p.name} exists: ${found.id}`); return found.id; }
  plan(`create product ${p.name}`);
  if (DRY_RUN) return `prod_DRYRUN_${p.key}`;
  const prod = await stripe.products.create({
    name: p.name, description: p.description, metadata: { voco_plan: p.key },
  });
  log(`✓ created product ${p.name}: ${prod.id}`);
  return prod.id;
}

async function getOrCreatePrice(lookupKey, params) {
  const found = (await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1 })).data[0];
  if (found) { log(`✓ price ${lookupKey} exists: ${found.id}`); return found.id; }
  plan(`create price ${lookupKey} (${params.unit_amount}c ${params.recurring.interval}${params.recurring.usage_type === 'metered' ? ' metered' : ''})`);
  if (DRY_RUN) return `price_DRYRUN_${lookupKey}`;
  const price = await stripe.prices.create({ ...params, lookup_key: lookupKey });
  log(`✓ created price ${lookupKey}: ${price.id}`);
  return price.id;
}

async function getOrCreateWebhook(url) {
  const existing = (await stripe.webhookEndpoints.list({ limit: 100 })).data.find((w) => w.url === url);
  if (existing) {
    log(`✓ webhook endpoint exists: ${existing.id} (secret only shown at creation — rotate in Dashboard if unknown)`);
    return null;
  }
  plan(`create webhook endpoint ${url}`);
  if (DRY_RUN) return null;
  const wh = await stripe.webhookEndpoints.create({ url, enabled_events: WEBHOOK_EVENTS });
  log(`✓ created webhook endpoint: ${wh.id}`);
  return wh.secret; // whsec_... — shown only once
}

async function main() {
  const acct = await stripe.accounts.retrieve();
  log(`Account: ${acct.id} | charges_enabled=${acct.charges_enabled} | live mode`);
  if (!acct.charges_enabled) {
    log('⚠ charges_enabled=false — products/prices/meter can still be created, but you cannot CHARGE until the account is activated (business details + bank).');
  }
  log(DRY_RUN ? '── DRY RUN — nothing will be created ──' : '── Creating live billing config ──');

  const meterId = await getOrCreateMeter();
  const ids = {};

  for (const p of PLANS) {
    const productId = await getOrCreateProduct(p);
    ids[`STRIPE_PRICE_${p.key.toUpperCase()}`] = await getOrCreatePrice(`voco_${p.key}_monthly`, {
      product: productId, currency: 'usd', unit_amount: p.monthly, recurring: { interval: 'month' },
    });
    ids[`STRIPE_PRICE_${p.key.toUpperCase()}_ANNUAL`] = await getOrCreatePrice(`voco_${p.key}_annual`, {
      product: productId, currency: 'usd', unit_amount: p.annual, recurring: { interval: 'year' },
    });
    ids[`STRIPE_PRICE_${p.key.toUpperCase()}_OVERAGE`] = await getOrCreatePrice(`voco_${p.key}_overage`, {
      product: productId, currency: 'usd', unit_amount: p.overage, nickname: p.overageNick,
      recurring: { interval: 'month', usage_type: 'metered', meter: meterId },
    });
  }

  let whSecret = null;
  if (WEBHOOK_URL) whSecret = await getOrCreateWebhook(WEBHOOK_URL);

  log('\n────────────────────────────────────────────────────────');
  log('Paste these LIVE values into Vercel (Production env):');
  log('────────────────────────────────────────────────────────');
  for (const [k, v] of Object.entries(ids)) log(`${k}=${v}`);
  if (whSecret) log(`STRIPE_WEBHOOK_SECRET=${whSecret}`);
  log('# plus: STRIPE_SECRET_KEY=sk_live_...  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...');
  log(`# meter id (for reference): ${meterId}`);
  log('────────────────────────────────────────────────────────');
  if (DRY_RUN) log('\n(dry run — re-run without --dry-run to actually create)');
}

main().catch((e) => { console.error('✗ Failed:', e.message); process.exit(1); });
