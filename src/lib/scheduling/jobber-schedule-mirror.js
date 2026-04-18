/**
 * Phase 57 — Jobber schedule mirror mapper + upsert helper.
 *
 * Pure-function layer. No Next.js imports. Consumed by:
 *   - /api/webhooks/jobber (Plan 57-03) — VISIT_x, ASSIGNMENT_x, JOB_UPDATE branch
 *   - /api/cron/poll-jobber-visits (Plan 57-04) — 15-min delta poll fallback
 *   - /api/integrations/jobber/bookable-users PATCH (Plan 57-04) — diff-sync rebuild
 *
 * @module scheduling/jobber-schedule-mirror
 */

const MIRRORED_STATUSES = new Set(['SCHEDULED', 'IN_PROGRESS']);

function normalizeStatus(s) {
  return String(s ?? '').toUpperCase().replace(/-/g, '_');
}

/**
 * Pure mapper — returns calendar_events row for upsert, or null if visit should
 * NOT be mirrored (wrong status, missing times, or filtered out by bookable set).
 *
 * Bookable-set semantics (CONTEXT D-01, D-04, D-05):
 *   bookableUserIds === null   → not configured yet; mirror everything (assigned + unassigned)
 *   bookableUserIds is array   → assigned visits MUST intersect; unassigned ALWAYS pass
 *
 * @param {object} args
 * @param {string} args.tenantId
 * @param {object} args.visit                 Jobber visit node
 * @param {string[]|null} args.bookableUserIds
 * @param {string|null} args.clientName
 * @returns {object|null} calendar_events row or null
 */
export function jobberVisitToCalendarEvent({ tenantId, visit, bookableUserIds, clientName }) {
  if (!visit?.id || !visit?.startAt || !visit?.endAt) return null;
  if (!MIRRORED_STATUSES.has(normalizeStatus(visit.visitStatus))) return null;

  const assignees = visit.assignedUsers?.nodes ?? [];
  const assigneeIds = assignees.map((u) => u.id);
  const isUnassigned = assigneeIds.length === 0;

  if (!isUnassigned && Array.isArray(bookableUserIds)) {
    const intersects = assigneeIds.some((id) => bookableUserIds.includes(id));
    if (!intersects) return null;
  }
  // Unassigned visits ALWAYS pass (D-05); null bookable set always mirrors.

  const assigneeName = assignees[0]?.name?.full ?? (isUnassigned ? 'Unassigned' : 'Team');
  const title = `Jobber: ${clientName ?? 'Visit'} — ${assigneeName}`;

  return {
    tenant_id: tenantId,
    provider: 'jobber',
    external_id: visit.id,
    title,
    start_time: visit.startAt,
    end_time: visit.endAt,
    is_all_day: false,
    appointment_id: null,
    conflict_dismissed: false,
    synced_at: new Date().toISOString(),
  };
}

/**
 * Upsert-or-delete a single Jobber visit into the tenant's calendar_events mirror.
 * Mapper decides direction; the upsert is idempotent on (tenant_id, provider, external_id).
 *
 * @param {object} args
 * @param {object} args.admin                 Supabase service-role client
 * @param {string} args.tenantId
 * @param {object} args.visit                 Jobber visit node
 * @param {string[]|null} args.bookableUserIds
 * @param {string|null} args.clientName
 * @returns {Promise<{ action: 'upserted' | 'deleted' }>}
 */
export async function applyJobberVisit({ admin, tenantId, visit, bookableUserIds, clientName }) {
  const row = jobberVisitToCalendarEvent({ tenantId, visit, bookableUserIds, clientName });

  if (!row) {
    if (visit?.id) {
      await admin
        .from('calendar_events')
        .delete()
        .eq('tenant_id', tenantId)
        .eq('provider', 'jobber')
        .eq('external_id', visit.id);
    }
    return { action: 'deleted' };
  }

  const { error } = await admin
    .from('calendar_events')
    .upsert(row, { onConflict: 'tenant_id,provider,external_id' });
  if (error) throw error;
  return { action: 'upserted' };
}

/**
 * Nuke-and-repave the tenant's Jobber mirror (D-04).
 *
 * Called by:
 *   - Bookable-users PATCH after a set change (synchronous diff-sync)
 *   - Manual /api/integrations/jobber/resync endpoint
 *
 * Deletes ALL provider='jobber' rows for the tenant, then fetches the P90/F180 window
 * via `fetchVisitsPage` (injected so callers control pagination strategy + caller-side
 * mocking in tests) and re-applies each visit through `applyJobberVisit` with the
 * tenant's current bookable set.
 *
 * @param {object} args
 * @param {object} args.admin                                  Supabase service-role client
 * @param {object} args.cred                                   accounting_credentials row (must include tenant_id, jobber_bookable_user_ids)
 * @param {(args: { cred, windowStart, windowEnd, after }) => Promise<{ visits, pageInfo }>} args.fetchVisitsPage
 * @returns {Promise<{ inserted: number }>}
 */
export async function rebuildJobberMirror({ admin, cred, fetchVisitsPage }) {
  const { error: delErr } = await admin
    .from('calendar_events')
    .delete()
    .eq('tenant_id', cred.tenant_id)
    .eq('provider', 'jobber');
  if (delErr) throw delErr;

  const windowStart = new Date(Date.now() - 90 * 24 * 3600 * 1000).toISOString();
  const windowEnd = new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString();

  let cursor = null;
  let inserted = 0;
  do {
    const { visits, pageInfo } = await fetchVisitsPage({
      cred,
      windowStart,
      windowEnd,
      after: cursor,
    });
    for (const visit of visits ?? []) {
      const clientName = visit.job?.client?.name?.full ?? null;
      const res = await applyJobberVisit({
        admin,
        tenantId: cred.tenant_id,
        visit,
        bookableUserIds: cred.jobber_bookable_user_ids ?? null,
        clientName,
      });
      if (res.action === 'upserted') inserted += 1;
    }
    cursor = pageInfo?.hasNextPage ? pageInfo.endCursor : null;
  } while (cursor);

  return { inserted };
}
