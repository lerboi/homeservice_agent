---
phase: 28
slug: admin-dashboard
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-26
---

# Phase 28 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Manual verification + API route testing via curl/fetch |
| **Config file** | none — admin phase is primarily UI + API routes |
| **Quick run command** | `curl -s http://localhost:3000/api/admin/phone-inventory \| jq .` |
| **Full suite command** | Manual walkthrough of admin auth, inventory CRUD, tenant overview, impersonation |
| **Estimated runtime** | ~120 seconds (manual) |

---

## Sampling Rate

- **After every task commit:** Verify API route responds correctly
- **After every plan wave:** Full manual walkthrough of completed features
- **Before `/gsd:verify-work`:** Full suite must pass
- **Max feedback latency:** 10 seconds (API response time)

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| TBD | TBD | TBD | Admin auth | manual | middleware check | TBD | ⬜ pending |
| TBD | TBD | TBD | Inventory CRUD | API | curl /api/admin/phone-inventory | TBD | ⬜ pending |
| TBD | TBD | TBD | Tenant overview | API | curl /api/admin/tenants | TBD | ⬜ pending |
| TBD | TBD | TBD | Impersonation | manual | visual verification | TBD | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `npx shadcn@latest add table` — Table component for inventory and tenant views
- [ ] `npm install papaparse` — CSV parsing for bulk import
- [ ] `supabase/migrations/012_admin_users.sql` — admin_users table

*Research identified these as missing dependencies.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Admin login flow | SC-1 | Requires browser + Supabase Auth session | Log in as admin user, verify /admin loads |
| Non-admin redirect | SC-5 | Requires browser session as non-admin | Log in as tenant user, navigate to /admin, verify 403 |
| Impersonation banner | SC-4 | Visual verification | Click "View as" on tenant, verify read-only banner appears |
| CSV bulk import | SC-2 | File upload interaction | Upload CSV with valid + invalid rows, verify results |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
