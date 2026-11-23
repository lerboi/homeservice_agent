---
type: system
system: Dashboard and CRM
status: legacy-app
description: "Command Palette + Global Search. Covers: Radix Dialog wrapping (prod-readiness 2026-06); Search groups (`/api/search`)"
source: .claude/skills/dashboard-crm-system/SKILL.md § 21. Command Palette + Global Search
migrated: 2026-11-23
verified:
tags: [voco/system/dashboard-and-crm]
---

# Command Palette + Global Search

Part of [[Dashboard and CRM]]. Migrated verbatim from the `dashboard-crm-system` skill; check `verified` before trusting details.

**File**: `src/components/dashboard/CommandPalette.jsx`

⌘K / Ctrl+K spotlight search. Debounced 250ms → `GET /api/search?q=`
(`src/app/api/search/route.js`). Results are grouped by `type` and rendered
with `TYPE_ICONS` keyed on the group type.

### Radix Dialog wrapping (prod-readiness 2026-06)

The palette now renders inside the shared Radix `Dialog`
(`src/components/ui/dialog.jsx`) instead of a hand-rolled fixed overlay. The
Dialog provides **focus trap, focus restore on close, Escape-to-close
(`onOpenChange`), and `role=dialog` / `aria-modal`** for free. Implementation
notes:

- `<DialogContent showCloseButton={false}>` anchored near the top
  (`top-[15vh] translate-y-0`) to keep command-palette convention.
- `onOpenAutoFocus` is `preventDefault()`-ed so focus lands on the search
  `<input>` (via `inputRef`), not the first result.
- A visually-hidden `<DialogTitle className="sr-only">Search</DialogTitle>`
  supplies the accessible name.
- ⌘K toggle is still a global `keydown` listener; Escape is handled by the
  Dialog (so it is intentionally NOT in the local `handleKeyDown`).
- ArrowUp/Down + Enter still drive the `selectedIndex` keyboard nav over the
  flattened result list.

### Search groups (`/api/search`)

Returns up to 5 rows per group; `type` values match `CommandPalette`'s
`TYPE_ICONS`:

| Group `type` | Source table | Item href |
|--------------|--------------|-----------|
| `customers` | `customers` (name/phone ILIKE) | `/dashboard/customers/${id}` |
| `calls` | `calls` (from_number ILIKE) | `/dashboard/calls` |
| `invoices` | `invoices` | `/dashboard/invoices/${id}` |
| `appointments` | `appointments` | `/dashboard/calendar` |
| `estimates` | `estimates` | `/dashboard/estimates/${id}` |

**Prod-readiness 2026-06**: the customers group replaced the prior stale
`leads` group/copy — the route already queried the `customers` table (it
still uses an internal `leadsRes` variable name), and `CommandPalette`'s
icon/placeholder/empty copy were updated from "leads" → "customers" to match
the `type:'customers'` payload.

---
