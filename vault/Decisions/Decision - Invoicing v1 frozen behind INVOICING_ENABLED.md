---
type: decision
date: 2026-08-20
status: current
description: "Invoicing and estimates are frozen behind a master flag with their crons unscheduled, as part of cutting v1 scope."
tags: [voco/decision]
---

# Decision - Invoicing v1 frozen behind INVOICING_ENABLED

## Decision
Invoicing is disabled by a master flag (`src/lib/invoicing-enabled.js`) and its cron jobs are not scheduled in `vercel.json`. The code stays in the repo.

## Sources
[[2026-08-20 Simplification pass - invoicing v1 freeze]]. Same approach as [[Decision - Jobber and Xero integrations frozen behind a flag for v1]].
