---
type: log
date: 2026-06-12
status: record
description: "Voice-agent naturalness pass P1-P8 COMMITTED+PUSHED to livekit-agent main (8fbe053, 2026-06-13, Railway auto-deploying); pending — text2 SQL, live UAT, optional VOCO_STT_KEYTERMS trial"
source: "Claude memory note project_voice_naturalness_findings.md"
migrated: 2026-11-23
tags: [voco/log]
---

# 2026-06-12 Voice naturalness P1-P8 shipped
The voice-agent naturalness pass ([[2026-06-11 Voice agent naturalness and information-collection findings (full report)]], main repo — proposal + production-call evidence + implementation status header) was IMPLEMENTED 2026-06-12 and COMMITTED+PUSHED to livekit-agent `main` as `8fbe053` on 2026-06-13 (one commit, 23 files — also carried the 2026-06-12 audit hardening that shared agent.py: subscription_gate.py module, webhook security, Xero/Jobber/triage/post_call fixes). Railway auto-deploys from main. Suite at push: 443 passed / 1 pre-existing VIP failure.

**Key shapes:** P1 — check_day returns OPTIONS (3 spread windows + tokens), check_slot too_soon/day_empty pair rejections with alternatives, next_available_days returns day labels; prompt licenses offering 2–3 TOOL-RETURNED times only. P2 — CALLER AUTHORITY prompt block; `STATE:address_ok_confirm_postal` (lookup postal asked as question); `_apply_country_guard` in the region-fallback orchestrator downgrades wrong-country confirmed* to `unconfirmed` (no DB change; fires before retry → self-heals). P3 — intake questions after booking. P4/P5 — register contract + spoken-numbers rules + STT-noise handling. P8 — `VOCO_PREEMPTIVE_GENERATION` (default ON), `VOCO_STT_KEYTERMS` (default OFF — keyterm+language="multi" unverified vs Deepgram API; UAT before enabling).

**Why:** real transcripts showed an agent arguing for Google's wrong postal, a Singapore job booked to Utah, 5× address repetition, a guess-reject scheduling loop that lost a caller, and a blocking intake interview.

**What's still pending:** (1) user manually runs `My Prompts/text2` SQL in Supabase (tenants.country US→SG for Make It AI 24141cd0 + optional voco tenant + audit query) — NOT yet run as of 2026-06-13 (note: another session has since used [[2026-06-13 Onboarding journey audit - findings and change plan (full report)]] for an onboarding brief — the SQL file is `text2` with no extension; verify which file holds the SQL before running); (2) live UAT per findings.md §9 script (postal-correction, too-soon, intake-dedupe, garbled-street, Spanish call); (3) optionally flip VOCO_STT_KEYTERMS=true on a UAT deploy. The voice-call-architecture skill is synced. Related: [[feedback_livekit_prompt_philosophy]], [[feedback_directive_prompt_silence_deadlock]], [[2026-06-09 Cascade pipeline migration (Deepgram + gpt-4.1-mini + ElevenLabs)]].
