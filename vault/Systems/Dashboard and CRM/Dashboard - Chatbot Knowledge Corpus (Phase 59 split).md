---
type: system
system: Dashboard and CRM
status: legacy-app
description: "File: src/lib/chatbot-knowledge/index.js"
source: .claude/skills/dashboard-crm-system/SKILL.md § 20. Chatbot Knowledge Corpus (Phase 59 split)
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Chatbot Knowledge Corpus (Phase 59 split)

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/lib/chatbot-knowledge/index.js`

Phase 59 replaced `leads.md` with three separate files:

| File | Covers |
|------|--------|
| `customers.md` | Customer dedup, merge/unmerge, customer detail page, phone immutability |
| `jobs.md` | Job lifecycle (scheduled→completed→paid), job cards, invoice link |
| `inquiries.md` | Callbacks (internally inquiries): lifecycle (open→Booked/Lost), D-07a stale-inquiry owner-responsibility policy, conversion flow |

**2026-06-10 (Inquiries → Calls merge + same-day Callbacks rename)** —
`calls.md`, `inquiries.md`, and `jobs.md` rewritten for the new IA:
`calls.md` describes the classic call log as the landing view, the
callbacks banner ("N callers waiting for a callback" → View), the
Callbacks view with its "← All calls" control, and keeps the "Where did
the Inquiries tab go?" answer; `inquiries.md` retitled "Callbacks", points
all links at `/dashboard/calls?view=callbacks`, uses "Booked" display
language; `jobs.md` repointed its cross-link to
`[Callbacks](/dashboard/calls?view=callbacks)`.

`ROUTE_DOC_MAP`: `/dashboard/jobs` → `jobs.md` (**fixed 2026-06-10 — it
had pointed at the deleted `leads.md` since Phase 59**),
`/dashboard/inquiries` → `inquiries.md` (kept for the redirect route),
`/dashboard/customers/*` → `customers.md`. `KEYWORD_DOC_MAP`: the
job/lead/crm group now maps to `jobs.md` (same stale-`leads.md` fix), and
a NEW keyword group `['inquiry', 'inquiries', 'needs reply', 'callback',
'call back']` → `inquiries.md` is ordered BEFORE the calls group so
"callback" matches inquiries, not the `call` keyword.

---
