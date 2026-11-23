---
type: system
system: Onboarding
status: legacy-app
description: "Session Management. Covers: `useWizardSession(key, defaultValue)`; `clearWizardSession()`"
source: .claude/skills/onboarding-flow/SKILL.md § 4. Session Management
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Session Management

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

**File**: `src/hooks/useWizardSession.js`

### `useWizardSession(key, defaultValue)`

```js
// Usage:
const [trade, setTrade] = useWizardSession('trade', null);
// Stores as: sessionStorage.key = 'gsd_onboarding_trade'
```

- Storage key format: `gsd_onboarding_${key}` — prefix isolates wizard state from other sessionStorage keys
- Reads on mount (`useState(() => ...)` initializer), writes via `useEffect` when value changes
- `JSON.parse`/`JSON.stringify` for non-string values
- Graceful degradation: if `window === 'undefined'` (SSR) or `sessionStorage` throws, uses `defaultValue`

### `clearWizardSession()`

```js
export function clearWizardSession() {
  // Bulk-removes all keys starting with 'gsd_onboarding_'
  const keys = [];
  for (let i = 0; i < sessionStorage.length; i++) {
    const k = sessionStorage.key(i);
    if (k && k.startsWith('gsd_onboarding_')) keys.push(k);
  }
  keys.forEach((k) => sessionStorage.removeItem(k));
}
```

Called from `checkout/page.js` after Stripe Checkout completes and webhook verification succeeds.

---
