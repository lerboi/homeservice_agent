# Phase 27: Country-Aware Onboarding & Number Provisioning - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the current Contact step (Step 4) with a "Your Details" step collecting user name, personal phone number, and country (Singapore/US/Canada). Country determines phone number provisioning: Singapore assigns from a pre-purchased `phone_inventory` table (limited slots with availability checking), US/Canada provisions dynamically via Twilio API. Remove the test call step from the onboarding wizard — provisioning happens after checkout success, users can test from dashboard settings later. Plan selection cards are NOT modified in this phase (separate effort will handle pricing page → onboarding entry point rewiring).

</domain>

<decisions>
## Implementation Decisions

### Contact Step → "Your Details" Restructure
- **D-01:** Step title changes from "Contact Details" to "Your Details"
- **D-02:** Three fields collected: full name, personal phone number, and country — all required
- **D-03:** Country selector is a dropdown (not radio cards) with 3 options: Singapore, United States, Canada
- **D-04:** Phone field auto-prefixes country code based on country selection (+65 for SG, +1 for US/CA) — user types only the local number
- **D-05:** New DB columns on `tenants`: `owner_name` (text, required), `country` (text, required — 'SG', 'US', 'CA')

### Singapore Slot Handling
- **D-06:** Show remaining available count when user selects Singapore — e.g., "3 Singapore numbers available"
- **D-07:** Availability check fires immediately on country selection (not on step submit) — fast feedback so user can switch country
- **D-08:** When all SG numbers are assigned (zero available), block onboarding for SG with waitlist option — user enters email to be notified when a slot opens
- **D-09:** New `phone_inventory` table: `{ id, phone_number, country, status (available/assigned/retired), assigned_tenant_id, created_at }`

### Number Provisioning Flow
- **D-10:** Provisioning happens AFTER checkout success (not during onboarding steps) — prevents wasting numbers on abandoned signups
- **D-11:** For Singapore: checkout success webhook assigns an available number from `phone_inventory` (status: available → assigned, set assigned_tenant_id)
- **D-12:** For US/Canada: checkout success webhook provisions a number directly via Twilio API (not Retell)
- **D-13:** Test call step is REMOVED from the onboarding wizard — users can test their AI from dashboard settings after onboarding completes
- **D-14:** New wizard flow: Auth → Profile → Services → Your Details → Plan Selection → Checkout → Dashboard (test call step removed, 5 visible steps instead of 6)
- **D-15:** Wizard card width increased from `max-w-lg` (512px) to `max-w-2xl` (672px) — all existing onboarding steps (Profile, Services, Plan Selection, Checkout Success) must be reviewed and adjusted to look good at the wider width. The layout change is in `src/app/onboarding/layout.js`.

### Claude's Discretion
- Waitlist implementation details (simple DB table or email service integration)
- Twilio API configuration for US/CA number purchase (area code selection, number type)
- How the provisioned number gets wired to Retell after Twilio purchase (for US/CA)
- Error handling and retry logic for Twilio provisioning failures
- Whether SG availability count uses a real-time query or a cached count
- Phone number format validation per country

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Onboarding Flow
- `src/app/onboarding/contact/page.js` — Current Contact step being replaced with "Your Details"
- `src/app/onboarding/layout.js` — Wizard layout with step counter (needs step count update: 6 → 5)
- `src/app/onboarding/test-call/page.js` — Test call step being removed from wizard
- `src/components/onboarding/TestCallPanel.js` — Test call component (stays for dashboard settings use, removed from onboarding)
- `src/hooks/useWizardSession.js` — Session persistence pattern for new fields

### API Routes
- `src/app/api/onboarding/sms-confirm/route.js` — Current contact save route (needs name + country addition)
- `src/app/api/onboarding/provision-number/route.js` — Current Retell provisioning (being replaced with country-aware Twilio/inventory logic)
- `src/app/api/onboarding/test-call/route.js` — Test call trigger (no longer called from onboarding)
- `src/app/api/stripe/webhook/route.js` — Checkout success webhook (needs provisioning logic added)

### Database
- `supabase/migrations/` — Existing migrations; new migration for phone_inventory table + tenants columns

### Pricing Data
- `src/app/(public)/pricing/pricingData.js` — Tier definitions (plan selection cards NOT modified in this phase)

### Middleware
- `src/middleware.js` — Auth guards and onboarding_complete redirect logic

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- **useWizardSession hook**: Existing sessionStorage-backed state persistence — will be used for new `owner_name`, `country` fields with `gsd_onboarding_` prefix
- **shadcn Select component**: Dropdown component for country selector
- **shadcn Input/Label/Button**: Already used in contact page, will be reused for name field
- **Design tokens**: Heritage Copper palette (#C2410C, #0F172A, #F5F5F4, #475569) — consistent with existing onboarding steps

### Established Patterns
- **API route structure**: POST handlers in `src/app/api/onboarding/*` — new routes follow same pattern
- **Supabase service role client**: Used for admin-level DB operations (provisioning, inventory management)
- **Migration naming**: Sequential `NNN_feature_name.sql` with RLS policies

### Integration Points
- **Stripe webhook handler** (`/api/stripe/webhook`): `checkout.session.completed` event needs provisioning logic added — after setting onboarding_complete, also provision number based on tenant's country
- **Onboarding layout**: Step count update from 6 to 5, pathname mapping update for progress bar
- **Dashboard settings**: TestCallPanel already supports `context='settings'` — no change needed for post-onboarding test call access

</code_context>

<specifics>
## Specific Ideas

- The "Your Details" step should feel like a natural continuation of the wizard — same card style, same Heritage Copper accent, same button patterns as Profile and Services steps
- SG availability count should update in real-time when country is selected (API call on dropdown change)
- The waitlist for SG should be simple — just collect email and notify when a number becomes available (admin retires or adds a new number)
- Removing the test call step shortens the wizard and moves provisioning cost to after payment confirmation — better unit economics

</specifics>

<deferred>
## Deferred Ideas

- **Pricing page → onboarding entry point rewiring**: User selects plan on pricing page, carries selection into onboarding, final step is just CC entry. Separate effort, not part of Phase 27.
- **Simplified plan selection cards**: Removing feature lists from onboarding plan cards — deferred to the pricing page rewiring effort above.

</deferred>

---

*Phase: 27-country-aware-onboarding-and-number-provisioning*
*Context gathered: 2026-03-26*
