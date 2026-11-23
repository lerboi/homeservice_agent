---
type: system
system: Public Site
status: pending-rebuild
description: "Animation System. Covers: `AnimatedSection({ children, className, delay, direction })`; `AnimatedStagger({ children, className })`; `AnimatedItem({ children, className })`"
source: .claude/skills/public-site-i18n/SKILL.md § 4. Animation System
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Animation System

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

**File**: `src/app/components/landing/AnimatedSection.jsx`

Three exported components, all `'use client'` (Framer Motion):

### `AnimatedSection({ children, className, delay, direction })`

Direction prop maps to offset:
```js
const directions = {
  up: { y: 32 },
  down: { y: -32 },
  left: { x: 32 },
  right: { x: -32 },
};
```

**Prefers-reduced-motion** (Framer Motion v12 pattern):
```js
const prefersReducedMotion = useReducedMotion();
// ...
initial={prefersReducedMotion ? false : { opacity: 0, ...offset }}
whileInView={prefersReducedMotion ? {} : { opacity: 1, x: 0, y: 0 }}
```

`initial={false}` skips the animation entirely when reduced motion is active — Framer Motion v12 pattern. Does NOT just remove animation class (which would leave invisible elements).

`viewport={{ once: true, margin: '-80px' }}` — animates only once, triggers 80px before viewport edge.

Transition: `duration: 0.6, ease: [0.22, 1, 0.36, 1]` (2026-08-14: was 0.2s/32px — retimed to a smoother glide; offsets now 24px, AnimatedItem 0.55s/20px, stagger 0.08).

### `AnimatedStagger({ children, className })`

Container for stagger sequences. Uses `staggerChildren: prefersReducedMotion ? 0 : 0.05` — zero stagger when reduced motion is active (all items appear at once).

### `AnimatedItem({ children, className })`

Used inside `AnimatedStagger`. Each item: `{ opacity: 0, y: 24 }` → `{ opacity: 1, y: 0 }`. When reduced motion: `hidden: {}` (no transform applied).

---
