# Phase 28: Admin Dashboard - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 28-admin-dashboard
**Areas discussed:** Admin authentication, Phone inventory mgmt, Tenant overview, Visual design

---

## Admin Authentication

| Option | Description | Selected |
|--------|-------------|----------|
| Env-var password | Simple shared password in ADMIN_PASSWORD env var, session cookie, no DB changes | |
| Supabase Auth + role column | Existing Supabase Auth with admin role in DB, middleware checks role | ✓ |
| Supabase Auth allow-list | Email allow-list in env var, middleware checks email membership | |

**User's choice:** Supabase Auth + role column
**Notes:** User prefers a scalable approach with explicit DB-backed role storage.

### Follow-up: Role Storage

| Option | Description | Selected |
|--------|-------------|----------|
| user_metadata flag | Set is_admin in auth.users.raw_user_meta_data, no migration needed | |
| Separate admin_users table | New table with user_id FK, role column, queryable and explicit | ✓ |

**User's choice:** Separate admin_users table
**Notes:** Prefers explicit, queryable table over metadata flags.

---

## Phone Inventory Management

### Adding Numbers

| Option | Description | Selected |
|--------|-------------|----------|
| Single add form | One number at a time, simple text input | |
| Bulk CSV import | Upload CSV with multiple numbers | |
| Both single + bulk | Single for day-to-day, bulk for initial seeding | ✓ |

**User's choice:** Both single + bulk
**Notes:** Wants flexibility for both daily operations and initial seeding.

### Reassignment

| Option | Description | Selected |
|--------|-------------|----------|
| Retire only | Admin retires numbers, no direct tenant-to-tenant swap | ✓ |
| Retire + reassign | Direct reassignment between tenants possible | |

**User's choice:** Retire only
**Notes:** Safer approach — prevents accidental number theft from active tenants.

---

## Tenant Overview

### Management Level

| Option | Description | Selected |
|--------|-------------|----------|
| Read-only overview | View-only table, no admin actions | |
| Read + flag management | View plus provisioning_failed flag toggle | |
| Full management | View, suspend, impersonate, manage provisioning | ✓ |

**User's choice:** Full management
**Notes:** User wants comprehensive admin capabilities.

### Impersonation

| Option | Description | Selected |
|--------|-------------|----------|
| View-only impersonation | Read-only view of tenant dashboard with admin banner | ✓ |
| Full impersonation | Full read/write access as tenant | |
| Skip impersonation | No impersonation in Phase 28 | |

**User's choice:** View-only impersonation
**Notes:** Safe "peek" into tenant's dashboard without ability to modify data.

### Suspend

| Option | Description | Selected |
|--------|-------------|----------|
| Soft suspend | Flag only, no call blocking | |
| Hard suspend | Flag + call blocking kill switch | |
| No suspend | Skip suspend functionality | ✓ |

**User's choice:** No suspend
**Notes:** Call blocking handled by billing enforcement (Phase 25), not admin actions.

---

## Visual Design

| Option | Description | Selected |
|--------|-------------|----------|
| Reuse tenant design | Same Heritage Copper tokens, same components | |
| Distinct admin theme | Different color scheme (blue/gray) for visual differentiation | ✓ |
| Minimal/utilitarian | Basic HTML, minimal styling | |

**User's choice:** Distinct admin theme
**Notes:** Admin interface should be visually obvious — can't be mistaken for tenant dashboard.

---

## Claude's Discretion

- Admin theme specific color palette
- CSV parsing library
- Impersonation session mechanism
- Admin layout structure
- Pagination approach
- Search/filter capabilities

## Deferred Ideas

None — discussion stayed within phase scope
