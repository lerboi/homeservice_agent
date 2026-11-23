---
type: system
system: Onboarding
status: legacy-app
description: "File: src/lib/trade-templates.js"
source: .claude/skills/onboarding-flow/SKILL.md § 8. Trade Templates
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Trade Templates

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

**File**: `src/lib/trade-templates.js`

```js
export const TRADE_TEMPLATES = {
  plumber: {
    label: 'Plumber',
    services: [
      { name: 'Gas Leak', urgency_tag: 'emergency' },
      { name: 'Burst Pipe', urgency_tag: 'emergency' },
      { name: 'Water Heater Replacement', urgency_tag: 'urgent' },
      { name: 'Drain Cleaning', urgency_tag: 'routine' },
      // ... (10 services total)
    ],
  },
  hvac: { ... },          // 10 services: 3 emergency, 2 urgent, 5 routine
  electrician: { ... },   // 10 services: 3 emergency, 3 urgent, 4 routine
  general_handyman: { ... } // 10 services: 1 emergency, 2 urgent, 7 routine
};
```

Used in: profile page (pre-populates services on trade select), services page (initial state from sessionStorage or TRADE_TEMPLATES), TradeSelector (iterates keys for the picker grid).

Services list is editable in Step 3 — user can add/remove before saving.

---
