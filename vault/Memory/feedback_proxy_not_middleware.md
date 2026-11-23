---
name: Middleware routing via proxy.js
description: Next.js 16 natively uses proxy.js (not middleware.js) — all routing/gating logic lives in src/proxy.js
type: feedback
---

Next.js 16 natively recognizes `proxy.js` as the middleware entry point. The function must be exported as `proxy` (not `middleware`). Having both `proxy.js` and `middleware.js` causes a build error.

**Why:** Next.js 16 changed the convention from middleware.js to proxy.js. The project correctly uses proxy.js.

**How to apply:** When modifying middleware behavior, edit `src/proxy.js`. NEVER create a `src/middleware.js` file — it conflicts with proxy.js in Next.js 16.
