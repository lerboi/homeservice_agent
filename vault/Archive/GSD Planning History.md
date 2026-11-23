---
type: reference
status: historical
description: "Index of the .planning/ directory: the GSD (get-shit-done) planning history through Phase 64 of the home-service product. Explains what is there and why it was not moved into the vault."
verified: 2026-11-23
tags: [voco/archive]
---

# GSD Planning History (`.planning/`)

Up: [[Home]]

`.planning/` at the repo root holds 984 files (17 MB) produced by the GSD workflow between March and June 2026. It is history: it describes how the home-service product was built phase by phase. It was left in place because the GSD commands and agents under `.claude/` read and write that exact path, and because nothing in it describes the system more accurately than the notes under [[Systems]].

## What is in it
| Path | Content |
|---|---|
| `.planning/PROJECT.md` (146 lines) | Original project definition |
| `.planning/ROADMAP.md` (1,569 lines) | Every phase with goals and status |
| `.planning/REQUIREMENTS.md` (676 lines) | Requirement IDs referenced by phase documents |
| `.planning/STATE.md`, `HANDOFF.json`, `HANDOFF-2026-05-07.md` | State when GSD work last stopped (May 2026) |
| `.planning/MILESTONES.md`, `milestones/v5.0-*` | Milestone summaries |
| `.planning/phases/` (71 phase folders) | Per-phase CONTEXT, RESEARCH, PLAN, SUMMARY, VERIFICATION documents. Last folders: 61 (address validation), 62 (Jobber write-side), 63 (LiveKit SDK upgrades), 64 (pipeline agent migration), 999.x (backlog bugs) |
| `.planning/research/` | Early stack and architecture research, the Gemini 3.1 audit, the check-availability split plan |
| `.planning/queries/` | A call-analysis SQL query and fetch script |

## How to use it
- Code comments and older notes cite phases ("Phase 61 D-B2", "Plan 39-04"). Look the phase up in `ROADMAP.md`, then open its folder under `phases/`.
- Do not treat it as current. Work after June 2026 is recorded in [[Log]].

## Agent repo documents (not moved)
These stay in `livekit-agent/docs/` because they are versioned with that code and cited by its commit messages:
- `PLAN-2026-09-02-phase0-phase1.md`: [[Call-experience four-phase plan (2026-09-02)]]
- `PLAN-2026-09-09-items-1-2-3-5.md`: [[2026-09-09 Call-experience items 1, 2, 3, 5 shipped]]
- `INFRA-REGIONS.md`, `uat/phase-60-personas.md`, `uat/phase-60-sentry-playbook.md`
