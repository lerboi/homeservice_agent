---
type: system
system: Public Site
status: pending-rebuild
description: "File: src/emails/NewLeadEmail.jsx"
source: .claude/skills/public-site-i18n/SKILL.md § 11. Email Templates
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Email Templates

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

**File**: `src/emails/NewLeadEmail.jsx`

React Email template for owner lead notifications. Exported as named function:
```js
export function NewLeadEmail({ lead, businessName, dashboardUrl })
```

**Design tokens used** (inline styles, not Tailwind — React Email renders as HTML email):
- `warmSurface (#F5F5F4)` — email body background
- `navy (#0F172A)` — header background (normal calls)
- `#DC2626` (red) — header background for emergency calls
- `brandOrange (#C2410C)` — CTA button background
- `bodyText (#475569)` — label text

**Emergency variant**: `isEmergency = urgency === 'emergency'` → red header + "EMERGENCY BOOKING" badge.

Called from `src/lib/notifications.js` `sendOwnerEmail()`. Rendered to HTML via `@react-email/components`.

---
