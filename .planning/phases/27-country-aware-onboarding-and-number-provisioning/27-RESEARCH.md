# Phase 27: Country-Aware Onboarding & Number Provisioning - Research

**Researched:** 2026-03-26
**Domain:** Onboarding wizard restructure, country-aware phone number provisioning (Retell API, SG inventory table)
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Contact Step Restructure**
- D-01: Step title changes from "Contact Details" to "Your Details"
- D-02: Three fields collected: full name, personal phone number, and country — all required
- D-03: Country selector is a dropdown (not radio cards) with 3 options: Singapore, United States, Canada
- D-04: Phone field auto-prefixes country code based on country selection (+65 for SG, +1 for US/CA) — user types only the local number
- D-05: New DB columns on `tenants`: `owner_name` (text, required), `country` (text, required — 'SG', 'US', 'CA')

**Singapore Slot Handling**
- D-06: Show remaining available count when user selects Singapore — e.g., "3 Singapore numbers available"
- D-07: Availability check fires immediately on country selection (not on step submit) — fast feedback
- D-08: When all SG numbers are assigned (zero available), block onboarding for SG with waitlist option — user enters email to be notified when a slot opens
- D-09: New `phone_inventory` table: `{ id, phone_number, country, status (available/assigned/retired), assigned_tenant_id, created_at }`

**Number Provisioning Flow**
- D-10: Provisioning happens AFTER checkout success — prevents wasting numbers on abandoned signups
- D-11: For Singapore: checkout success webhook assigns an available number from `phone_inventory` (status: available → assigned, set assigned_tenant_id)
- D-12: For US/Canada: checkout success webhook provisions a number directly via Twilio API (not Retell)
- D-13: Test call step is REMOVED from the onboarding wizard
- D-14: New wizard flow: Auth → Profile → Services → Your Details → Plan Selection → Checkout → Dashboard (5 visible steps instead of 6)

### Claude's Discretion
- Waitlist implementation details (simple DB table or email service integration)
- Twilio API configuration for US/CA number purchase (area code selection, number type)
- How the provisioned number gets wired to Retell after Twilio purchase (for US/CA)
- Error handling and retry logic for Twilio provisioning failures
- Whether SG availability count uses a real-time query or a cached count
- Phone number format validation per country

### Deferred Ideas (OUT OF SCOPE)
- Pricing page → onboarding entry point rewiring: User selects plan on pricing page, carries selection into onboarding. Separate effort.
- Simplified plan selection cards: Removing feature lists from onboarding plan cards — deferred to pricing page rewiring effort.
</user_constraints>

---

## Summary

Phase 27 restructures the onboarding wizard's Contact step into a "Your Details" step that collects owner name, personal phone, and country. Country drives a branching provisioning strategy: Singapore pulls from a pre-purchased `phone_inventory` table with real-time availability feedback; US/Canada provisions dynamically at checkout success time. The test call step is removed entirely, shortening the wizard from 6 to 5 steps.

**Key discovery:** D-12 says "provision via Twilio API (not Retell)" — however, the Retell SDK's `phoneNumber.create()` already supports `country_code: 'US' | 'CA'` natively. This means the cleanest path for US/CA provisioning is `retell.phoneNumber.create({ country_code: 'US' })`, which has Retell handle Twilio coordination internally. This avoids managing Twilio SIP trunking, TwiML configuration, and the Retell `phoneNumber.import()` flow. Claude's Discretion covers "how the provisioned number gets wired to Retell after Twilio purchase" — using `retell.phoneNumber.create()` eliminates this wiring step entirely. This recommendation should be surfaced to the planner.

The wizard layout changes (step counter 6→5, pathname mapping) are well-understood from the existing `layout.js` code. The `useWizardSession` hook readily supports the two new fields (`owner_name`, `country`). The `sms-confirm` route receives a straightforward extension. The Stripe webhook `handleCheckoutCompleted` function is the surgical injection point for provisioning logic.

**Primary recommendation:** Use `retell.phoneNumber.create({ country_code: 'US' | 'CA' })` for US/CA provisioning (Retell handles Twilio internally), and implement a `phone_inventory` table with row-level locking (`FOR UPDATE SKIP LOCKED`) for Singapore assignment to prevent race conditions.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| retell-sdk | 5.x (installed) | US/CA number provisioning + Retell binding | Already in codebase; `create({ country_code })` handles US/CA natively |
| twilio | 5.13.0 (installed) | NOT needed for provisioning if Retell path used | Existing SMS client; no additional install needed |
| @supabase/supabase-js | ^2.99.2 (installed) | `phone_inventory` table queries, tenant updates | Already the DB layer |
| shadcn/ui Select | Already installed | Country dropdown (D-03) | `select.jsx` confirmed present in `/src/components/ui/` |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| shadcn/ui Input | Already installed | Name field + phone number field | Existing pattern in contact/page.js |
| useWizardSession hook | N/A (internal) | Session persistence for `owner_name`, `country`, `phone` fields | Same `gsd_onboarding_` prefix pattern used for all wizard steps |
| Resend | Installed | Waitlist notification email when SG number opens | Only if waitlist email needed; can be simple DB-only in v1 |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `retell.phoneNumber.create({ country_code })` | Twilio API + `retell.phoneNumber.import()` | Twilio path requires purchasing number, configuring SIP trunk, then importing with `termination_uri` — 3-step process vs 1. Retell's `create()` is simpler and already the pattern used in `provision-number/route.js`. |
| Real-time DB count for SG availability | Cached Redis count | DB count query is fast (<5ms) and correct; Redis adds infrastructure for no gain at current scale |
| Full waitlist table | Simple `phone_inventory_waitlist` table | Waitlist is low-volume — a simple table with email + created_at is sufficient |

---

## Architecture Patterns

### Recommended Project Structure

New/modified files for this phase:

```
src/app/onboarding/
├── layout.js                        MODIFY — step counter 6→5, remove test-call pathname mapping
├── contact/page.js                  REPLACE — "Your Details" step (name + phone + country)
├── test-call/page.js                REMOVE from wizard — page file stays for settings context
src/app/api/onboarding/
├── sms-confirm/route.js             MODIFY — accept owner_name + country + phone
├── sg-availability/route.js         NEW — GET: return available SG number count
├── provision-number/route.js        DEPRECATE (no longer called from onboarding wizard)
├── test-call/route.js               DEPRECATE (no longer called from onboarding wizard)
src/app/api/stripe/
├── webhook/route.js                 MODIFY — handleCheckoutCompleted adds provisioning logic
supabase/migrations/
├── 011_country_provisioning.sql     NEW — phone_inventory table + tenants.owner_name + tenants.country
```

### Pattern 1: Wizard Step Replacement

**What:** Replace the existing Contact step (`contact/page.js`) wholesale — do not extend it.
**When to use:** Step collects completely different fields; extending the old file would leave dead code.

```js
// Source: src/app/onboarding/contact/page.js (existing pattern to follow)
'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWizardSession } from '@/hooks/useWizardSession';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function OnboardingStepYourDetails() {
  const [ownerName, setOwnerName] = useWizardSession('owner_name', '');
  const [country, setCountry] = useWizardSession('country', '');
  const [phone, setPhone] = useWizardSession('phone', '');
  const [sgAvailable, setSgAvailable] = useState(null); // null = not checked yet

  async function handleCountryChange(val) {
    setCountry(val);
    if (val === 'SG') {
      const res = await fetch('/api/onboarding/sg-availability');
      const data = await res.json();
      setSgAvailable(data.available_count);
    } else {
      setSgAvailable(null);
    }
  }
  // ...
}
```

### Pattern 2: Country Code Auto-Prefix

**What:** Phone input prefixes are driven by the country selection; user types only local digits.
**When to use:** D-04 — reduces user error, ensures E.164-compatible stored values.

```js
// D-04 implementation pattern
const COUNTRY_CONFIG = {
  SG: { prefix: '+65', placeholder: '9123 4567' },
  US: { prefix: '+1', placeholder: '(555) 000-0000' },
  CA: { prefix: '+1', placeholder: '(555) 000-0000' },
};

function buildE164(country, localNumber) {
  const config = COUNTRY_CONFIG[country];
  const digits = localNumber.replace(/\D/g, '');
  return `${config.prefix}${digits}`;
}
```

### Pattern 3: Singapore Inventory Assignment (with race protection)

**What:** Use PostgreSQL `SELECT ... FOR UPDATE SKIP LOCKED` to assign SG numbers atomically.
**When to use:** D-11 — checkout webhook may fire concurrently for multiple SG tenants; SKIP LOCKED prevents double-assignment.

```sql
-- Inside a transaction in the checkout webhook handler
BEGIN;
SELECT id, phone_number
FROM phone_inventory
WHERE country = 'SG' AND status = 'available'
ORDER BY created_at ASC
LIMIT 1
FOR UPDATE SKIP LOCKED;
-- Then UPDATE status = 'assigned', assigned_tenant_id = $tenant_id
COMMIT;
```

In Supabase JS with service role client, this requires a raw SQL RPC function since the JS client doesn't expose `FOR UPDATE SKIP LOCKED` natively:

```sql
-- Migration: create_assign_sg_number RPC
CREATE OR REPLACE FUNCTION assign_sg_number(p_tenant_id uuid)
RETURNS TABLE(phone_number text) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  UPDATE phone_inventory
  SET status = 'assigned', assigned_tenant_id = p_tenant_id
  WHERE id = (
    SELECT id FROM phone_inventory
    WHERE country = 'SG' AND status = 'available'
    ORDER BY created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING phone_inventory.phone_number;
END;
$$;
```

### Pattern 4: Wizard Layout Step Counter Update

**What:** `layout.js` maps pathnames to step numbers 1–N and shows "Step X of N".
**Current:** Steps mapped 1–5 with `TOTAL_STEPS = 5`, but the onboarding-flow skill says "Step X of 6". The layout.js code shows `TOTAL_STEPS = 5` — this is the correct current code value.

Pathname → step mapping change required:

```js
// CURRENT layout.js getStep() — test-call at step 4
if (pathname === '/onboarding/test-call') return 4;

// PHASE 27 — remove test-call mapping, keep 5 total
// Auth (/auth/signin) is pre-wizard
// Step 1: /onboarding (profile)
// Step 2: /onboarding/services
// Step 3: /onboarding/contact  ← "Your Details" renamed but same path
// Step 4: /onboarding/plan
// Step 5: /onboarding/checkout-success
const TOTAL_STEPS = 5; // UNCHANGED — test-call was never tracked in TOTAL_STEPS
```

**Critical finding:** The current `layout.js` already shows `TOTAL_STEPS = 5` and does NOT include `test-call` in that count. The test-call page appears at step 4 in the *old* skill doc, but the current layout code maps it as an extra step after the 5-step count. The actual change is: remove the `test-call` pathname entry from `getStep()` and update the routing so contact → plan (skip test-call).

### Pattern 5: US/CA Provisioning via Retell (Recommended Path)

**What:** Use `retell.phoneNumber.create({ country_code: 'US' | 'CA' })` — Retell internally uses Twilio and returns a wired number.
**Why:** The `phoneNumber.create()` API accepts `country_code: 'US' | 'CA'` (verified from type definitions). The number is created already bound to Retell's infrastructure. No SIP trunk setup or `import()` needed.

```js
// In handleCheckoutCompleted (stripe webhook)
async function provisionUSCA(tenantId, country) {
  const countryCode = country === 'CA' ? 'CA' : 'US';
  const phoneNumber = await retell.phoneNumber.create({ country_code: countryCode });
  await supabase
    .from('tenants')
    .update({ retell_phone_number: phoneNumber.phone_number })
    .eq('id', tenantId);
  return phoneNumber.phone_number;
}
```

### Anti-Patterns to Avoid

- **Provisioning during onboarding steps (before checkout):** D-10 explicitly forbids this. Numbers provisioned before checkout completion are wasted if the user abandons checkout.
- **Checking SG availability on step submit instead of country change:** D-07 requires immediate feedback on country select, not on form submit.
- **Checking availability without locking:** Two users both see "1 available" and both proceed — a race condition. Always assign inside a transaction with `FOR UPDATE SKIP LOCKED`.
- **Using `retell.phoneNumber.import()` for US/CA:** Requires manual Twilio account management, SIP trunk creation, and passing `termination_uri`. The `create()` method is simpler and already the existing pattern.
- **Storing local phone number instead of E.164:** The `owner_phone` field stores E.164 format (verified in existing code). New fields must follow the same convention.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Concurrent SG number assignment | Custom flag-and-check | PostgreSQL `FOR UPDATE SKIP LOCKED` RPC | Without DB-level locking, concurrent checkout webhooks can both see the same "available" number and double-assign |
| Country dropdown | Custom styled select | shadcn `Select` (already installed, `select.jsx` confirmed) | Consistent with rest of wizard UI; already imported in other components |
| Session state for new fields | LocalStorage or cookie | `useWizardSession('owner_name', '')` | Existing pattern; `clearWizardSession()` handles cleanup; SSR-safe |
| Phone number E.164 formatting | Regex replacement | `buildE164(country, localNumber)` helper (simple, in-component) | Short enough to hand-write; no library needed for 3 country codes |

**Key insight:** The only complex part is concurrent SG assignment — everything else is wiring existing patterns to new UI fields.

---

## Common Pitfalls

### Pitfall 1: Test-Call Step Removal Routing Gap
**What goes wrong:** `contact/page.js` still routes to `/onboarding/test-call` after submit, but the test-call page no longer appears in the wizard flow.
**Why it happens:** The existing `handleContinue()` in `contact/page.js` pushes to `/onboarding/test-call`.
**How to avoid:** Update the `router.push` target to `/onboarding/plan` in the new Your Details page.
**Warning signs:** User submits Your Details and sees the test-call UI mid-wizard.

### Pitfall 2: `layout.js` Step Counter Mismatch
**What goes wrong:** Progress bar shows wrong percentage if `getStep()` still maps `/onboarding/test-call` to a step number.
**Why it happens:** The `getStep()` function hardcodes pathname→number mappings.
**How to avoid:** Remove the `/onboarding/test-call` entry from `getStep()`. Verify TOTAL_STEPS stays 5 (it's already 5 in current code; skill doc says 6 but that's outdated).
**Warning signs:** Progress bar jumps backwards when going from contact to plan.

### Pitfall 3: SG Race Condition on Concurrent Checkouts
**What goes wrong:** Two SG users complete checkout at the same second; both webhooks query `available` inventory and find the last slot; both try to assign it → double assignment.
**Why it happens:** Without a transaction lock, SELECT + UPDATE is not atomic.
**How to avoid:** Use the `assign_sg_number` RPC function (SECURITY DEFINER, `FOR UPDATE SKIP LOCKED`).
**Warning signs:** `phone_inventory` row has two `assigned_tenant_id` values (impossible if RPC is used, but check via constraint: `assigned_tenant_id` should be UNIQUE on `status = 'assigned'` rows).

### Pitfall 4: Provisioning in Stripe Webhook Without SG Number Guard
**What goes wrong:** Checkout webhook fires for an SG tenant but all inventory is gone (race between availability check at step 3 and actual checkout minutes later).
**Why it happens:** Availability check fires at step 3 (D-07), but checkout happens later. More SG tenants could fill up inventory between those moments.
**How to avoid:** `assign_sg_number` RPC returns NULL if no slots available. The webhook handler must check for NULL and set a `provisioning_failed` flag on the tenant (for admin follow-up), not throw an error.
**Warning signs:** Tenant has `onboarding_complete = true` but no `retell_phone_number` assigned.

### Pitfall 5: Skill File Out of Sync
**What goes wrong:** `onboarding-flow` skill still documents the 6-step flow with test-call, leading future agents astray.
**Why it happens:** Skill files must be manually updated per CLAUDE.md instructions.
**How to avoid:** Include onboarding-flow skill update as an explicit task in the plan.
**Warning signs:** Future phase plans reference `/onboarding/test-call` as a wizard step.

### Pitfall 6: `owner_name` and `country` Not Passed to Stripe Webhook
**What goes wrong:** Checkout webhook reads `tenant.country` to determine provisioning strategy, but `country` wasn't saved to the tenant row before checkout.
**Why it happens:** If `sms-confirm` route doesn't save `country` to the DB, the webhook has no way to know which provisioning path to take.
**How to avoid:** The `sms-confirm` route (modified to accept `owner_name` + `country`) must save both fields to `tenants` before the user proceeds to plan selection.
**Warning signs:** `handleCheckoutCompleted` reads `tenant.country` and gets NULL, falls into wrong branch.

---

## Code Examples

Verified patterns from codebase inspection:

### Existing `provision-number` route (being replaced)
```js
// Source: src/app/api/onboarding/provision-number/route.js
const phoneNumber = await retell.phoneNumber.create({});
await supabase.from('tenants').update({ retell_phone_number: phoneNumber.phone_number }).eq('id', tenantId);
```

### Retell `phoneNumber.create()` with country (verified from SDK type definitions)
```js
// Source: node_modules/retell-sdk/resources/phone-number.d.ts
// country_code: 'US' | 'CA' — only these two are supported
await retell.phoneNumber.create({ country_code: 'US' });
await retell.phoneNumber.create({ country_code: 'CA' });
// No country_code = defaults to 'US'
// SG is NOT supported — must use inventory table
```

### Existing `handleCheckoutCompleted` injection point (verified from stripe/webhook/route.js)
```js
// Source: src/app/api/stripe/webhook/route.js
async function handleCheckoutCompleted(session) {
  const tenantId = session.metadata?.tenant_id;
  // Set onboarding_complete = true
  await supabase.from('tenants').update({ onboarding_complete: true }).eq('id', tenantId);
  // THIS IS WHERE provisioning logic is added after the above line
  // 1. Read tenant.country
  // 2. Branch: SG → assign_sg_number RPC, US/CA → retell.phoneNumber.create()
  // 3. Update tenants.retell_phone_number
}
```

### SG availability API (new route)
```js
// Source: new GET /api/onboarding/sg-availability/route.js
export async function GET() {
  const { count } = await supabase
    .from('phone_inventory')
    .select('*', { count: 'exact', head: true })
    .eq('country', 'SG')
    .eq('status', 'available');
  return Response.json({ available_count: count ?? 0 });
}
```

### `sms-confirm` route extension (existing → modified)
```js
// Source: src/app/api/onboarding/sms-confirm/route.js (current)
const { phone } = await request.json();
const updateFields = { owner_email: user.email };
if (phone?.trim()) updateFields.owner_phone = phone.trim();

// PHASE 27: extend to accept owner_name + country
const { phone, owner_name, country } = await request.json();
const updateFields = { owner_email: user.email };
if (phone?.trim()) updateFields.owner_phone = phone.trim();
if (owner_name?.trim()) updateFields.owner_name = owner_name.trim();
if (country) updateFields.country = country; // 'SG' | 'US' | 'CA'
```

### useWizardSession for new fields (verified from hook source)
```js
// Source: src/hooks/useWizardSession.js — prefix is gsd_onboarding_
const [ownerName, setOwnerName] = useWizardSession('owner_name', '');
const [country, setCountry] = useWizardSession('country', '');
// Stored as: gsd_onboarding_owner_name, gsd_onboarding_country
// clearWizardSession() removes all gsd_onboarding_* keys on checkout success
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `retell.phoneNumber.create({})` (no country param) | `retell.phoneNumber.create({ country_code: 'US' \| 'CA' })` | Retell SDK current | US/CA provisioning can use Retell's native path — no need for manual Twilio API |
| `inbound_agent_id` field on phoneNumber | `inbound_agents: [{ agent_id, weight }]` array | Retell SDK (deprecated notice) | Old field still works but deprecated as of 2026-03-31 per type definitions |

**Deprecated/outdated:**
- `retell.phoneNumber.create({}).inbound_agent_id`: Deprecated per `@deprecated` JSDoc in type definitions — use `inbound_agents: [{ agent_id, weight: 1 }]` instead. However, for provisioning in this phase, agent binding is handled separately (the provisioned number is saved to tenant, and Retell uses the inbound webhook to route calls — not agent_id binding at number creation time, per `handleInbound` in the Retell webhook route).

---

## Open Questions

1. **Does the `retell.phoneNumber.create()` path require an agent_id at creation time for inbound calls to work?**
   - What we know: `handleInbound` in the Retell webhook looks up `tenant by to_number` (using `retell_phone_number`). This implies Retell routes the call to the webhook, which then handles tenant lookup. The number does NOT need an agent_id pre-bound if the inbound webhook handles routing.
   - What's unclear: Whether `retell.phoneNumber.create({})` (the current pattern) binds any agent, or if Retell's inbound webhook receives ALL calls for all provisioned numbers.
   - Recommendation: The existing `provision-number/route.js` calls `retell.phoneNumber.create({})` with no agent binding and it works (evidenced by the current working test call flow). New provisioning should follow the same pattern.

2. **Waitlist: DB table only or email notification?**
   - What we know: D-08 says "user enters email to be notified when a slot opens." Claude's Discretion covers implementation.
   - What's unclear: Whether the waitlist needs automated email on slot open or just admin visibility.
   - Recommendation: Phase 27 implements a `phone_inventory_waitlist` table (`id, email, created_at, notified_at`). Email notification can be a manual admin step in v1 — automated notification is deferred as a future enhancement.

3. **`owner_phone` vs `personal_phone` naming — is the owner's personal phone (for notifications) the same field?**
   - What we know: Current `owner_phone` on `tenants` is used for test calls AND owner SMS notifications (see `notifications.js`). The new "Your Details" step is collecting the owner's personal phone as the notification number.
   - What's unclear: Whether the same `owner_phone` column covers both use cases or if a separate column is needed.
   - Recommendation: Reuse `owner_phone` — it's already the owner's personal contact number used for notifications. No new column needed for this field.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| retell-sdk | US/CA number provisioning | Yes | 5.x (installed) | — |
| twilio | Owner SMS (existing) | Yes | 5.13.0 (installed) | — |
| Supabase service role | `phone_inventory` writes, `assign_sg_number` RPC | Yes | — | — |
| shadcn Select | Country dropdown | Yes | `select.jsx` confirmed | — |
| RETELL_API_KEY | `retell.phoneNumber.create()` | Yes (set in .env.local) | — | — |
| TWILIO_ACCOUNT_SID / AUTH_TOKEN | Existing SMS only | Yes (set in .env.local) | — | — |

No blocking missing dependencies.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Manual verification + E2E flow test |
| Config file | None |
| Quick run command | `npm run dev` + manual wizard walkthrough |
| Full suite command | Complete onboarding flow for each country (SG/US/CA) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Notes |
|--------|----------|-----------|-------|
| D-01/02/03/04 | "Your Details" step renders with name, phone, country dropdown | Manual | Visual confirmation |
| D-05 | `tenants.owner_name` and `tenants.country` saved on step submit | Manual | Check DB row after submit |
| D-06/07 | SG availability count shown immediately on country select | Manual | Confirm API call fires on dropdown change |
| D-08 | SG waitlist shown when 0 available | Manual | Set all SG inventory to 'assigned', verify block UI |
| D-11 | SG number assigned from inventory after checkout | Manual | Simulate checkout.session.completed, verify phone_inventory row updated |
| D-12 | US/CA number provisioned via Retell after checkout | Manual | Verify `retell_phone_number` set on tenant after checkout |
| D-13 | Test call step absent from wizard navigation | Manual | Navigate wizard, confirm /onboarding/test-call not visited |
| D-14 | Wizard shows 5 steps, progress bar correct | Manual | Step counter shows "Step X of 5" throughout |

### Wave 0 Gaps
- [ ] Migration `011_country_provisioning.sql` — phone_inventory table + tenants columns + assign_sg_number RPC
- [ ] New API route: `GET /api/onboarding/sg-availability`

*(No automated test framework gaps — project uses manual verification pattern)*

---

## Project Constraints (from CLAUDE.md)

- Skill files must be kept in sync after changes: `onboarding-flow` skill MUST be updated after this phase
- Architecture changes must follow skill file guidance before and after
- `auth-database-multitenancy` skill references must be verified for any new migrations (new table needs tenant_id child RLS + service_role bypass)
- Supabase service role client (`src/lib/supabase.js`) for all webhook/server writes; SSR client for user-authenticated reads

---

## Sources

### Primary (HIGH confidence)
- `src/app/api/onboarding/provision-number/route.js` — Existing Retell provisioning pattern (inspected)
- `node_modules/retell-sdk/resources/phone-number.d.ts` — Retell phoneNumber.create() `country_code: 'US' | 'CA'` param (verified from installed SDK)
- `src/app/onboarding/layout.js` — Actual TOTAL_STEPS = 5, getStep() mapping (inspected)
- `src/app/api/stripe/webhook/route.js` — handleCheckoutCompleted injection point (inspected)
- `src/app/onboarding/contact/page.js` — Current Contact step code (inspected)
- `supabase/migrations/001_initial_schema.sql` — tenants table columns (inspected)
- `src/hooks/useWizardSession.js` — Session key prefix pattern (inspected)
- `.claude/skills/onboarding-flow/SKILL.md` — Full wizard architecture (inspected)
- `.claude/skills/auth-database-multitenancy/SKILL.md` — Migration patterns, RLS, three Supabase clients (inspected)

### Secondary (MEDIUM confidence)
- PostgreSQL `FOR UPDATE SKIP LOCKED` for concurrent row assignment — well-established pattern for inventory/queue dequeue

### Tertiary (LOW confidence)
- Retell inbound webhook routing without agent_id pre-binding — inferred from existing codebase behavior (provision-number creates number without agent binding, and test calls work), not verified against Retell API docs

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed, type definitions verified from node_modules
- Architecture: HIGH — all existing patterns inspected from source; only new patterns (SG inventory RPC) are MEDIUM
- Pitfalls: HIGH — race condition and step routing issues are directly observable from code

**Research date:** 2026-03-26
**Valid until:** 2026-04-26 (stable project, no fast-moving external APIs driving this)
