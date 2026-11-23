---
type: system
system: Onboarding
status: legacy-app
description: "Onboarding Components. Covers: `TestCallPanel({ phoneNumber, onComplete, onGoToDashboard, context })`; `CelebrationOverlay()`; `TradeSelector({ selected, onSelect })`; `OtpInput({ onComplete, disabled })`"
source: .claude/skills/onboarding-flow/SKILL.md § 3. Onboarding Components
migrated: 2026-11-23
verified:
tags: [voco/system/onboarding]
---

# Onboarding Components

Part of [[Onboarding]]. Migrated verbatim from the `onboarding-flow` skill; check `verified` before trusting details.

### `TestCallPanel({ phoneNumber, onComplete, onGoToDashboard, context })`

**File**: `src/components/onboarding/TestCallPanel.js`

State machine via `callState`:
- `'ready'` → button to trigger call
- `'calling'` → spinner (Loader2), then transitions to `in_progress` on API success
- `'in_progress'` → pulsing green phone icon + elapsed timer. **Polls from both 'calling' and 'in_progress' states** — catches fast-completing calls that skip the in_progress transition
- `'complete'` → renders `CelebrationOverlay` + "Go to Dashboard"
- `'timeout'` → alert + retry button (after 3 minutes)

**Polling**: `setInterval` at 4000ms. On `data.complete === true` → `clearInterval` + `setCallState('complete')` + `onComplete()`.

**Dual context**: `context` prop (`'onboarding'` or `'settings'`) renders different UI styles — compact inline for settings panel, full-page styling retained for legacy/post-payment surfaces. Component is no longer mounted by the onboarding wizard, but the `'onboarding'` style branch is kept in case the panel is reused elsewhere.

### `CelebrationOverlay()`

**File**: `src/components/onboarding/CelebrationOverlay.js`

Animated SVG checkmark + orange radial pulse rings.

```js
const prefersReducedMotion = useReducedMotion();
// ...
{!prefersReducedMotion && (
  <>
    <div className="animate-radial-pulse-1" ... />
    <div className="animate-radial-pulse-2" ... />
    <div className="animate-radial-pulse-3" ... />
  </>
)}
```

**Critical**: When `prefersReducedMotion` is true, the radial pulse `<div>` elements are **not rendered at all** (not just missing animation class). Avoids layout artifacts from invisible absolutely-positioned elements.

The checkmark SVG (`animate-draw-circle`, `animate-draw-check`) has `opacity-100` static class when reduced motion is active.

### `TradeSelector({ selected, onSelect })`

**File**: `src/components/onboarding/TradeSelector.js`

Grid of trade picker cards. Iterates `TRADE_TEMPLATES` entries, renders with icons:
```js
const TRADE_ICONS = { plumber: Wrench, hvac: Thermometer, electrician: Zap, general_handyman: Hammer };
```

`role="radiogroup"` + `role="radio"` + `aria-checked` for accessibility. Keyboard: Enter/Space to select. Selected state: `border-[#C2410C] bg-[#C2410C]/[0.04]` (from design-tokens `selected.card`).

### `OtpInput({ onComplete, disabled })`

**File**: `src/components/onboarding/OtpInput.js`

6 digit box inputs using `useRef` array. Auto-advances focus on digit entry. Backspace moves backward. Paste handler strips non-digits, fills all boxes.

Focus ring: `focus:border-[#C2410C] focus:ring-2 focus:ring-[#C2410C]/20` (no `ring-offset`) — eliminates white gap on dark card backgrounds (avoidance of Pitfall 7). Box styling: `bg-stone-50 border border-stone-300`.

Calls `onComplete(code)` when all 6 digits are filled.

---
