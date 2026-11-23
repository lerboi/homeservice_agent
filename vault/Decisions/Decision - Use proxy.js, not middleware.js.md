---
type: decision
status: current
description: "Request routing and auth gating live in src/proxy.js (the Next.js 16 convention). There is no middleware.js."
verified: 2026-11-23
tags: [voco/decision]
---

# Decision - Use proxy.js, not middleware.js

`src/proxy.js` exists and `src/middleware.js` does not (checked 2026-11-23). Add request gating to `proxy.js`.

The owner's instruction is recorded as a memory rule: [[feedback_proxy_not_middleware]]. Details of what the proxy guards: [[Auth and Database]].
