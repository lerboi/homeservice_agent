/**
 * Master kill-switch for the tenant invoicing/estimates suite (v1).
 *
 * v1 ships with invoicing FROZEN per the 2026-07-04 audit ("Freeze. Don't
 * touch until a paying customer asks"): 0 live tenants have it enabled and
 * the core hypothesis being validated is the answer→triage→book→notify loop.
 * Before this flag existed the per-tenant toggle at /dashboard/more/features
 * was still live self-service, which meant the two invoicing crons had to
 * stay scheduled daily "just in case" — this flag closes the enable door so
 * the crons could be unscheduled without leaving a silent-breakage trap.
 *
 * Gated surface (mirrors the NEXT_PUBLIC_INTEGRATIONS_ENABLED pattern from
 * src/lib/integrations-enabled.js):
 *   - PATCH /api/tenant/features rejects `invoicing: true` (disable stays allowed)
 *   - /dashboard/more/features shows the toggle disabled ("Coming soon")
 *   - /api/cron/invoice-reminders + /api/cron/recurring-invoices no-op
 *
 * Re-enable checklist (the day a paying customer asks):
 *   1. Set NEXT_PUBLIC_INVOICING_ENABLED=true on Vercel.
 *   2. Re-add the two cron entries to vercel.json:
 *        { "path": "/api/cron/invoice-reminders",  "schedule": "0 9 * * *" }
 *        { "path": "/api/cron/recurring-invoices", "schedule": "0 8 * * *" }
 *      (Without them, reminders/late fees/overdue flips/recurring generation
 *      silently never run — the flag gate alone does NOT schedule anything.)
 *   3. Redeploy.
 *
 * Fail-closed: OFF unless the env var is explicitly the string "true".
 * Uses NEXT_PUBLIC_ so the same constant is readable in client components
 * (the features-page toggle) and on the server (route/cron gates).
 *
 * NOTE: this is a GLOBAL v1 switch, distinct from the per-tenant
 * `tenants.features_enabled.invoicing` flag in `features.js`. When both are
 * needed the per-tenant flag still decides which tenants see invoicing —
 * this switch only decides whether the feature can be enabled at all.
 */
export const INVOICING_ENABLED =
  process.env.NEXT_PUBLIC_INVOICING_ENABLED === 'true';
