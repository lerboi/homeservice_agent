# Milestones

## v5.0 Trust & Polish (Shipped: 2026-04-16)

**Phases shipped:** 47, 48, 48.1, 49 (4 phases, 19 plans)
**Phases absorbed:** 50 (charts/calendar dark mode → executed inside Phase 49 Plan 05)
**Phases deferred to v6.0:** 51 (UI/UX polish pass), 52 (Leads → Jobs rename)

### Key accomplishments

- **Landing objection-busting + revenue-recovery rewrite** (Phases 47 + 48.1): replaced feature-platform framing with revenue-recovery narrative — "Stop losing $1,000+ every time you miss a call" hero, AudioDemoSection real-call player, Cost-of-Silence stat block, IntegrationsStrip with live (Google/Outlook) and coming-soon (Jobber/Xero/Housecall Pro/ServiceTitan/WhatsApp) badges, YouStayInControlSection consolidating identity/owner-control sections into 3 visual mocks, Voco AI rebrand for SEO disambiguation
- **Dashboard home redesigned as daily-ops command center** (Phase 48): DailyOpsHub bento grid (TodayAppointmentsTile, CallsTile, HotLeadsTile, UsageTile with threshold colors), auto-detecting setup checklist refactored into 4 themed accordions with per-item dismiss/mark-done overrides (migration 050), ChatProvider React Context lifting chat state across home panel ↔ ChatbotSheet, Help & Discoverability card, 375px responsive single-column stacking
- **Full dark mode parity across the dashboard** (Phase 49): ThemeProvider wired with no hydration flash, sidebar theme toggle with localStorage persistence, semantic CSS-var token migration across ~50 components and ~28 pages, all flyouts/modals/badges/banners/sidebar/bottom-tab dark-aware, AnalyticsCharts (Recharts SVG) and CalendarView migrated via useTheme() hook (Phase 50 work absorbed into Plan 49-05's hex-audit gate sweep)
- **FAQ + AI chat surfaces unified** (Phases 47 + 48): public landing FAQSection + FAQChatWidget powered by /api/public-chat (Groq); dashboard ChatProvider + ChatbotSheet sharing message history with home ChatPanel via React Context

### Known gaps / deferred

- Phase 51 (UI/UX polish pass — empty states, skeletons, focus rings, error retry, async button states) — deferred to v6.0 polish budget
- Phase 52 (Leads → Jobs rename + status pill restructure) — deferred to v6.0 as first phase
- Phase 47-05 plan formally superseded in part by Phase 48.1 rewrite (47-05 commits a1bc795/31ebd95/9fedaa6/5fa612d shipped on 2026-04-14; some components and copy later replaced by 48.1)

**Archives:**
- [v5.0 Roadmap](milestones/v5.0-ROADMAP.md)
- [v5.0 Requirements](milestones/v5.0-REQUIREMENTS.md)

---
