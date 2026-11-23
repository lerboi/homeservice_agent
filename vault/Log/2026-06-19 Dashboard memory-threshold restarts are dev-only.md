---
type: log
date: 2026-06-19
status: record
description: "Dashboard \\\"Server approaching memory threshold, restarting\\\" is local next-dev-only; app code has no leak; trigger is SWR revalidateOnFocus burst on browser-tab refocus"
source: "Claude memory note project_dashboard_memory_dev_only.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-06-19 Dashboard memory-threshold restarts are dev-only
2026-06-18/19: User reported "⚠ Server is approaching the used memory threshold, restarting..." when sitting idle on /dashboard then switching browser tabs. 20-agent adversarial audit (workflow dashboard-memory-leak-audit) found **0 unbounded leaks in app code** — every timer/listener/Supabase channel/SWR poll traced writer→cleanup and came back bounded. The /dashboard home page opens no realtime channel, no setInterval, no per-page poll; only continuous idle work is the 60s `/api/dashboard/stats` poll (useAttentionCounts, mounted in DashboardSidebar + BottomTabBar — SWR dedupes the fetch, two timers).

**Confirmed environment: local `npm run dev` (`next dev`), Next 16.1.7.** NOT a production issue — the web app is on Vercel (serverless/stateless), which cannot grow heap across an idle session or print this banner. The string exists nowhere in the repo → emitted by the dev runtime/watchdog.

**Root cause = long-lived `next dev` Node process heap growth, amplified by `next.config.js:44` `cacheComponents: true` (Next 16 experimental 'use cache', Phase 54 INTFOUND-03) + `withSentryConfig` (next.config.js:96). Scripts are vanilla `next dev`/`start` with no `--max-old-space-size`.**

**Trigger that converts slow idle growth into a crash on browser-tab refocus:** every dashboard fetch uses `revalidateOnFocus: true` (useSWRFetch default) and there is NO global SWRConfig, so returning to the tab fires ~7 concurrent requests (stats, appointments, calls, usage, account, billing/data, setup-checklist) → dev recompile + allocation spike on an already-bloated process → watchdog restart.

Minor (not leaks): /api/account fetched twice on home (page.js SWR + AiNumberBanner raw fetch); AnimatePresence key={pathname} default 'sync' double-mounts page subtree ~200ms per nav (DashboardLayoutClient.jsx:69-81).

Recommended fix (dev-only): raise dev heap headroom (NODE_OPTIONS=--max-old-space-size=4096) + optionally disable/throttle revalidateOnFocus via a global SWRConfig; toggle cacheComponents off as the isolation test. See [[feedback_deep_verify_before_fix]].
