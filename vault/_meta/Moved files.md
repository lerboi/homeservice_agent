---
type: meta
status: current
description: "Lookup table from pre-vault file paths (My Prompts/, docs/, skills, Claude memory) to the vault notes that replaced them. Use it when a code comment, commit message or old note cites a path that no longer exists."
verified: 2026-11-23
tags: [voco/meta]
---

# Moved files (2026-11-23 migration)

Code comments that cited `My Prompts/Jobber-Xero-Disable.md` and `My Prompts/Voice-Pipeline-Gap-Analysis-2026-09.md` were updated to the new paths in both repos. Other citations (commit messages, bare `findings.md` in agent comments) still use the old names; resolve them here.

## Repo files

| Old path | Now |
|---|---|
| `My Prompts/text1.md` | [[2026-06-10 Deep system audit and UX report (full report)]] |
| `My Prompts/text2.md` | [[2026-06-13 Onboarding journey audit - findings and change plan (full report)]] |
| `My Prompts/Audit.md` | [[2026-07-04 Full system audit (full report)]] |
| `My Prompts/P0-fix-plan.md` | [[2026-07-09 P0-2 to P0-5 verification and fix plan]] |
| `My Prompts/Jobber-Xero-Disable.md` | [[Decision - Jobber and Xero integrations frozen behind a flag for v1]] |
| `My Prompts/Voice-Naturalness-Research-2026-09.md` | [[Research - Natural-sounding cascaded voice agents (2026-09)]] |
| `My Prompts/Voice-Pipeline-Gap-Analysis-2026-09.md` | [[Research - Voice pipeline gap analysis (2026-09)]] |
| `My Prompts/Architecture/Call Routing System.md` | [[Voice Agent - Call Routing System (owner-first routing, Phase 39-40)]] |
| `My Prompts/Architecture/Voco_Private_Limited_System_Network_Configuration_Diagram.pdf` | `_attachments/`, listed in [[Documents]] |
| `My Prompts/TODO` | [[Backlog]] |
| `My Prompts/prompts` | [[Prompt Library]] |
| `My Prompts/Rebrand-2026-11/0*.md` | [[Plans]] |
| `docs/findings.md` (cited as `findings.md` in agent code comments) | [[2026-06-11 Voice agent naturalness and information-collection findings (full report)]] |
| `docs/Economics.docx`, `docs/Voco_Marketing_Overview.pdf`, `docs/Voice-Call-System-Guide.docx` | `_attachments/`, listed in [[Documents]] |
| `My Prompts/audit-2026-06-12.md`, `My Prompts/Migration.md` | Did not exist at migration time. The 06-12 audit survives only as its summary: [[2026-06-12 Eight-pass full audit]] |

## Skills

| Old file | Now |
|---|---|
| `.claude/skills/voice-call-architecture/SKILL.md` and `references/phase-history.md` | [[Voice Agent]] |
| `.claude/skills/scheduling-calendar-system/SKILL.md` | [[Scheduling and Calendar]] |
| `.claude/skills/auth-database-multitenancy/SKILL.md` | [[Auth and Database]] |
| `.claude/skills/onboarding-flow/SKILL.md` | [[Onboarding]] |
| `.claude/skills/dashboard-crm-system/SKILL.md` | [[Dashboard and CRM]] |
| `.claude/skills/payment-architecture/SKILL.md` | [[Billing]] |
| `.claude/skills/integrations-jobber-xero/SKILL.md` and `references/*.md` | [[Integrations Jobber Xero]] |
| `.claude/skills/public-site-i18n/SKILL.md`, `.claude/skills/scroll-line-path/SKILL.md` | [[Public Site]] |

The skill files still exist as short stubs: [[Claude memory and skills wiring]].

## Claude memory

`project_*` memory notes became dated entries in [[Log]] (one idea went to [[Idea - VIP caller direct routing]]). `reference_*` notes went to [[Reference]]. `feedback_*` notes stayed memory and are in `Memory/`. Each migrated note records its original file name in its `source:` field.

## Not moved

`.planning/` ([[GSD Planning History]]) and `livekit-agent/docs/` stay where they are.
