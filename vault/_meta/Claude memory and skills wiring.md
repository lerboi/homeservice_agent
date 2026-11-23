---
type: meta
status: current
description: "How Claude Code is wired to this vault: CLAUDE.md, the skill stubs, and the memory directory junction. Read before changing any of the three."
verified: 2026-11-23
tags: [voco/meta]
---

# Claude memory and skills wiring

## CLAUDE.md
`CLAUDE.md` at the repo root is loaded into every Claude Code session. It is deliberately short: what Voco is, the rules, and a pointer to [[Home]]. Project knowledge does not go in `CLAUDE.md`; it goes in this vault.

`livekit-agent/CLAUDE.md` does the same for sessions started in the agent repo and points at `../homeservice_agent/vault/`.

## Skill stubs
The nine architecture skills in `.claude/skills/` used to contain the architecture documentation (about 10,000 lines). Their content now lives in `Systems/`. Each `SKILL.md` is a stub that keeps the skill's `name` and `description` (so it still triggers on relevant tasks) and tells the reader which index note to open.

| Skill stub | Vault index |
|---|---|
| `voice-call-architecture` | [[Voice Agent]] |
| `scheduling-calendar-system` | [[Scheduling and Calendar]] |
| `auth-database-multitenancy` | [[Auth and Database]] |
| `onboarding-flow` | [[Onboarding]] |
| `dashboard-crm-system` | [[Dashboard and CRM]] |
| `payment-architecture` | [[Billing]] |
| `integrations-jobber-xero` | [[Integrations Jobber Xero]] |
| `public-site-i18n`, `scroll-line-path` | [[Public Site]] (both stubs are deleted when Plan 2 rebuilds the public site) |

Third-party skills (docx, pdf, frontend-design, ui-ux-pro-max and others) are untouched.

## Memory
Claude Code's auto-memory directory for this project is
`C:\Users\leheh\.claude\projects\C--Users-leheh--Projects-homeservice-agent\memory`.
It is a Windows directory junction pointing at `vault/Memory/`, so the files Claude reads and writes as memory are the files visible here.

- `Memory/MEMORY.md` is the index Claude loads each session. One line per memory.
- Memory holds only how the owner wants work done (feedback rules) and a pointer to this vault. Project knowledge, work history and references live in the other folders.
- The pre-migration memory directory is backed up at `…\memory.bak-2026-11-23` (outside the repo). It can be deleted once the vault has been reviewed.
- To undo the junction: remove the junction (`rmdir` on the junction path, which does not delete the target) and copy `vault/Memory/` back to that path.
