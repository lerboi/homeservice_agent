/**
 * Master kill-switch for the Xero/Jobber "Business Integrations" surface (v1).
 *
 * v1 ships with these integrations DISABLED. We're validating the core
 * answer→triage→book→notify loop first; the accounting/CRM integrations are a
 * second-order differentiator, not part of that hypothesis. The code stays
 * in-tree (dormant) so this flag can be flipped back on the day a paying
 * customer asks for it — no rebuild required.
 *
 * See `My Prompts/Jobber-Xero-Disable.md` for the full rationale, the exact
 * surface that is gated, and the re-enable checklist.
 *
 * Fail-closed: OFF unless the env var is explicitly the string "true".
 * Uses NEXT_PUBLIC_ so the same constant is readable in client components (the
 * "Coming soon" UI) and on the server (route/cron/page gates).
 *
 * NOTE: this is a GLOBAL v1 switch, distinct from the per-tenant
 * `tenants.features_enabled` flags in `features.js`. When we re-enable, we can
 * move to per-tenant gating there if we want a staged rollout.
 */
export const INTEGRATIONS_ENABLED =
  process.env.NEXT_PUBLIC_INTEGRATIONS_ENABLED === 'true';
