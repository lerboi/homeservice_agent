# HomeService AI Agent

## What This Is

An all-in-one AI platform for home service SMEs (plumbers, HVAC, electricians, etc.) that answers every inbound call instantly via a low-latency voice AI receptionist, triages emergencies from routine inquiries, and books jobs directly into the owner's real-time calendar — turning missed $50 ad-spend leads into confirmed $1,000+ jobs in under 2 minutes, 24/7, without the owner touching their phone.

## Core Value

Every inbound call is answered instantly and converted into a confirmed booking or qualified lead — no call goes to voicemail, no lead is lost to a competitor.

## Current Milestone: v6.0 Integrations & Focus (planning)

**Goal:** Refocus Voco on the Call System by extracting the internal invoicing system into an optional toggleable feature, and add native Jobber (GraphQL) and Xero (REST) integrations that provide the AI with real-time customer context — outstanding balances, job history, past visits — to make collections and booking conversations materially smarter without Voco acting as the primary accounting engine.

**Target features:**
- Tenant-level `features_enabled` flag with invoicing default OFF for all tenants (still in dev — no breakage risk)
- Native Jobber GraphQL OAuth + customer-by-phone lookup for caller context (jobs, invoices, balance)
- Native Xero REST OAuth + customer-by-phone lookup for outstanding balance and recent invoices
- Jobber schedule mirror into local `calendar_events` (treating Jobber as a third calendar provider alongside Google + Outlook)
- LiveKit agent customer context injection: pre-call system prompt section + on-demand `check_customer_account` tool
- Setup checklist items `connect_jobber` and `connect_xero` in the post-onboarding flow
- Next.js 16 caching uplift: `cacheComponents: true`, "use cache" + revalidateTag for dashboard integrations status
- ✓ Phase 52 (Leads → Jobs rename) shipped 2026-04-17 — dashboard nav + URL `/dashboard/jobs` (308 redirect), status pills relabeled to home-service vernacular (`New · Scheduled · Completed · Paid · Lost` with `ml-2` Lost gap), copy reframed across 16 surfaces, chatbot knowledge corpus reframed, dashboard-crm-system skill synced; DB enum + API routes + component file names preserved
- Phase 51 polish budget (empty states, skeletons, focus rings) absorbed at the tail of v6.0

## Previous Milestone: v5.0 Trust & Polish (Shipped 2026-04-16)

**Shipped:** Phases 47, 48, 48.1, 49 (4 phases, 19 plans). Phase 50 absorbed into Phase 49 Plan 05; Phase 51 (polish pass) and Phase 52 (Leads → Jobs rename) deferred to v6.0. See `MILESTONES.md` for accomplishments and `milestones/v5.0-ROADMAP.md` for the full archive.

**Original v5.0 goal:** Harden Voco's visual and conversion surface and elevate day-to-day usefulness — address the 5 most common home-service-owner objections to AI receptionists, reposition Voco as a complementary full-stack AI workflow, redesign the dashboard home page into a daily-use hub for owners, extend full dark mode coverage across the dashboard, and apply overall UI/UX polish across both the public site and dashboard to lift the product's perceived quality end-to-end.

## Requirements

### Validated

- ✓ Landing page objection-busting + revenue-recovery repositioning ("Stop losing $1,000+" hero, AudioDemoSection, Cost-of-Silence stat, IntegrationsStrip, YouStayInControlSection consolidation, Voco AI rebrand) — v5.0 Phases 47 + 48.1
- ✓ Dashboard home redesigned as daily-ops command center (DailyOpsHub bento grid, auto-detecting themed setup checklist, persistent AI chat via ChatProvider Context, 375px responsive) — v5.0 Phase 48
- ✓ Full dark mode coverage across all dashboard pages, flyouts, modals, badges, charts, and calendar via ThemeProvider + semantic token migration — v5.0 Phase 49 (Phase 50 work absorbed)
- ✓ AI voice receptionist answers inbound calls with sub-second pickup via Retell — v1.0 Phase 1
- ✓ Multi-language voice support from day one — v1.0 Phase 1
- ✓ Layered triage system: keywords + caller urgency + owner-configured rules — v1.0 Phase 2
- ✓ Owner-defined service tiers to mark high-ticket job types — v1.0 Phase 2
- ✓ Emergency calls get instant booking into next available slot — v1.0 Phase 3
- ✓ Routine calls captured as qualified leads for owner confirmation — v1.0 Phase 3
- ✓ Built-in availability scheduler with time slot management — v1.0 Phase 3
- ✓ Google Calendar sync for real-time availability — v1.0 Phase 3
- ✓ Anti-double-booking with slot locking at moment of booking — v1.0 Phase 3
- ✓ Lead tracker CRM: new → booked → completed → paid pipeline — v1.0 Phase 4
- ✓ Lead capture with caller details, job type, urgency, address, notes — v1.0 Phase 4
- ✓ Owner notifications via SMS, email, and push when leads come in — v1.0 Phase 4
- ✓ Web-based dashboard (mobile-responsive) for managing leads, calendar, and settings — v1.0 Phase 4
- ✓ Business onboarding: configure services, tiers, availability, and greeting scripts — v1.0 Phase 2
- ✓ Call recordings and transcripts stored per lead — v1.0 Phase 1
- ✓ Public marketing landing page — v1.0 Phase 2.1

### Active

- [x] Agent prompt rewrite: booking-first dispatcher behavior for all call types — v2.0 Phase 14
- [ ] Triage reclassification: urgency tags as notification priority only
- [ ] Booking flow universalization: all calls get booked autonomously
- [x] Exception state handling: escalation only when AI can't understand or caller requests human — v2.0 Phase 14
- [ ] Notification priority system: urgency-driven SMS/email formatting and delivery priority
- [x] Recovery SMS universal fallback: failed bookings trigger recovery SMS — v2.0 Phase 17
- [x] Multi-language end-to-end validation (voice → booking → notifications) — v2.0 Phase 18 (human UAT pending)
- [x] Concurrency QA and load testing — v2.0 Phase 18 (integration test, human UAT pending)
- [x] 5-minute onboarding gate validation with non-technical user — v2.0 Phase 18 (human UAT pending)
- [ ] Invoicing as optional toggleable feature (default off for new tenants) — v6.0
- [ ] Native Jobber GraphQL integration for real-time customer context during calls — v6.0
- [ ] Native Xero REST integration for outstanding balance / invoice history during calls — v6.0
- [ ] Jobber schedule mirror into local calendar_events for zero-latency slot availability — v6.0
- [ ] Setup checklist items for connect_jobber + connect_xero in onboarding flow — v6.0
- [ ] LiveKit agent customer context injection (system prompt + on-demand tool) — v6.0

### Out of Scope

- Native mobile app — web-first, mobile-responsive (defer to v2)
- Omnichannel chat (SMS, web widget, WhatsApp, Messenger) — voice-first, chat is a later add-on
- Full CRM (invoicing, job costing, crew dispatch) — lead tracker only, not replacing ServiceTitan
- Payment processing / Stripe integration — moved to v3.0 milestone (active)
- Outbound calling / follow-up automation — inbound only for v1

## Context

**The Problem:** Home service businesses pay $20-$50 per Google Ads lead. When that lead calls and gets voicemail, they hang up within 6 seconds and call the next competitor. The business loses a $1,000+ job because nobody picked up. Human answering services can't verify addresses, sync calendars, or book — they're expensive and leaky.

**The Market:** Home services is a fragmented market of millions of SMEs globally. Most run on phone calls. The owner is often on a job site and can't answer. There's no affordable "instant response" solution that actually books.

**Voice AI Approach:** Use Retell as the telephony + speech layer for low-latency, natural-sounding voice interactions. Retell handles STT/TTS and telephony infrastructure, letting us focus on the intelligence layer (triage, scheduling, CRM).

**Triage Intelligence (v2.0 — Booking-First):** Three-layer system retained but repurposed:
1. **Keyword detection:** "flooding," "gas smell," "no heat" → emergency tag. "Quote," "next week," "remodel" → routine tag.
2. **Caller urgency signals:** Temporal cues ("happening right now" vs "sometime next month"), stress indicators.
3. **Owner-configured rules:** Business defines which service types are emergency, which are high-ticket.
**Key change in v2.0:** Urgency tags no longer route calls (all calls get booked). Tags drive notification priority — emergency bookings trigger immediate high-priority SMS/email; routine bookings use standard notification flow.

**Scheduling Logic:** Calendar must be the single source of truth. Slot locking must be atomic — if two calls come in simultaneously, one gets the slot and the other gets the next available. Travel time buffers and geographic zone grouping to be designed during phase planning.

**Monetization:** Monthly SaaS subscription per business.

**Target:** Demo-ready product that can be shown to potential home service customers.

## Constraints

- **Voice Latency:** Must feel like talking to a real person — sub-second response times are critical for caller trust
- **Telephony Platform:** Retell for voice infrastructure (not building from scratch)
- **Calendar Integrity:** Zero tolerance for double-bookings — atomic slot locking is non-negotiable
- **Multi-language:** Voice AI must handle multiple languages from v1, not a later addition
- **Web-first:** Browser-based dashboard, no native mobile app in v1

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Retell over Vapi and raw Twilio+STT | Faster to market, proven low-latency voice, focus on intelligence not infra | — Pending |
| Lead tracker over full CRM | Avoid competing with ServiceTitan/Housecall Pro; integrate don't replace | — Pending |
| Voice-first, defer chat channels | Calls are where the money is lost; chat can layer on later | — Pending |
| Multi-language from day one | Global market = global languages; retrofitting is harder than building in | — Pending |
| Monthly SaaS pricing | Predictable revenue, simple for SME owners to understand | — Pending |
| Booking-first over escalation-first | AI books all calls autonomously; urgency used for notification priority not routing; reduces missed bookings, simplifies call flow | v2.0 |
| Escalation as exception only | Transfer only on AI confusion or explicit caller request; reduces owner interruptions while ensuring no dead ends | v2.0 |
| Universal recovery SMS fallback | Every failed booking triggers recovery SMS; no call path ends without a next step for the caller | v2.0 |
| Revenue-recovery framing over feature-platform framing | Hero, Cost-of-Silence stat, AudioDemoSection, and IntegrationsStrip lead with dollar-pain instead of feature lists; lifts conversion intent on first scroll | v5.0 (48.1) |
| Dark mode via semantic CSS variables (not class toggles or inline styles) | One token migration per component, no useTheme() hook except for SVG inline styles; enables future palette tweaks without code changes | v5.0 (49) |
| Invoicing as optional toggleable feature, not core | Voco's core value is the Call System; invoicing competes with ServiceTitan/Jobber and dilutes focus; default off for new tenants, reachable behind a settings toggle | v6.0 |
| Native Jobber + Xero read-side integrations (no writes) | AI fetches customer context (balance, jobs, history) at call-time; Voco does not act as accounting engine — leaves writes to the connected system | v6.0 |
| Jobber schedule mirrored into local calendar_events table | Zero-latency availability checks during calls (single Supabase query covers Google + Outlook + Jobber); webhook-driven freshness | v6.0 |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd:transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd:complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-04-17 — v5.0 (Trust & Polish) shipped; v6.0 (Integrations & Focus) Phase 52 shipped, remaining phases in planning*
