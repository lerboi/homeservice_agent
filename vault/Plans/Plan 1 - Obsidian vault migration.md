---
type: plan
date: 2026-11-23
status: done
description: "Plan and decisions for moving project context and memory into this vault."
source: "My Prompts/Rebrand-2026-11/01-obsidian-vault-plan.md"
migrated: 2026-11-23
tags: [voco/plan]
---

# Plan 1 — Move project context and memory into an Obsidian vault

Status: DECISIONS RECORDED 2026-11-23. Awaiting green light to implement.

## 1. Where the context lives today

| Source | Size | What it is | Problem |
|---|---|---|---|
| `CLAUDE.md` | 80 lines | Project instructions + skill table | Stale: still says Gemini 3.1 Flash Live; the agent has been Deepgram + gpt-4.1-mini + ElevenLabs since Phase 66. Positioning is about to change too. |
| `.claude/skills/<9 architecture skills>/SKILL.md` | ~10,000 lines | The real architecture docs (voice 3,081 lines, dashboard 1,845, auth/DB 1,700, …) | Monoliths. Loading one costs thousands of lines even for a small question. Not browsable, no links between systems. |
| Claude memory dir (`~/.claude/projects/…/memory/`) | 37 files | 6 feedback rules, 5 references, 26 `project_*` notes | Lives outside the repo, invisible to you. Most `project_*` files are dated work logs (audits, fix waves), not durable memory, and several are superseded. |
| `My Prompts/` | 288 KB | Audits, research reports, fix plans, architecture notes | Unindexed; only findable through memory pointers. |
| `.planning/` | 984 files, 17 MB | GSD history (71 phases, roadmap, requirements) | Historical. Describes the home-service product through Phase 64. |
| `docs/`, `livekit-agent/docs/` | small | Guides, plan/handoff docs | Split across two repos; the agent repo has no CLAUDE.md at all. |

## 2. Design

One vault, in this repo, at `vault/`, tracked in git, covering both repos (Next app and `livekit-agent`). Opening `vault/` in Obsidian gives the whole project as a linked graph; Claude reads the same files.

```
vault/
├─ Home.md               Map of content. Start here (humans and Claude).
├─ Product/              Positioning (new), site flow, pricing, glossary, idea backlog
├─ Systems/              One folder per system; an index note + atomic notes
│  ├─ Voice Agent/         (livekit-agent repo: entrypoint, prompt, tools, post-call, webhook, sandbox)
│  ├─ Demo Studio/
│  ├─ Public Site/
│  ├─ Auth & Tenancy/
│  ├─ Database/            (table-group notes + migrations ledger)
│  ├─ Onboarding/
│  ├─ Dashboard & CRM/
│  ├─ Scheduling & Calendar/
│  ├─ Billing/
│  └─ Integrations/
├─ Runbooks/             Deploy both repos, run a test call, record a demo, reconnect Google, env vars, MCP servers
├─ Decisions/            One decision per note (cascade pipeline, no Cerebras/Groq, proxy.js not middleware, …)
├─ Log/                  Dated work log: audits, fix waves, investigations (from project_* memories + My Prompts)
├─ Plans/                Active plans (these three). Finished plans move to Log/.
├─ Reference/            SDK gotchas, external pointers, research reports
├─ Archive/              Index notes that LINK to .planning/ and superseded docs (no copies)
└─ _meta/                Conventions note, note templates
```

### Note conventions
- Frontmatter on every note: `type` (system | runbook | decision | log | plan | reference), `system`, `status` (current | stale | archived), `verified` (date last checked against code, or `unverified`), `code` (key file paths).
- `[[wikilinks]]` between notes; code references as `path:line`.
- Target under ~300 lines per note. A system's index note is a table of its notes with one-line "read this when…" hooks, so Claude loads only what the task needs.
- `.obsidian/` committed with minimal settings; `workspace*.json` gitignored.

### How Claude keeps using it
- `CLAUDE.md` shrinks to about 40 lines: what Voco is, the rules, and "context lives in `vault/`; start at `vault/Home.md`; read the system's index note before changing it; update the note after". The "keep skills in sync" rule becomes "keep the vault in sync".
- The 9 architecture skills become thin stubs (name + description kept so they still trigger, body = "read `vault/Systems/<X>/_index.md`"). Third-party skills (docx, pdf, frontend-design, ui-ux-pro-max, …) are untouched.
- `livekit-agent/` gets a short `CLAUDE.md` pointing at `../homeservice_agent/vault/Systems/Voice Agent/`.
- Claude memory is pruned to what memory is for: the 6 feedback rules, a pointer to the vault, and any genuinely live items. Everything project-historical moves to `vault/Log/`, `Decisions/` or `Reference/`. `MEMORY.md` drops from 37 entries to roughly 10.

## 3. Migration steps

1. Scaffold `vault/`, `_meta/Conventions.md`, templates, `.obsidian/` settings, `.gitignore` entries.
2. Split each of the 9 architecture skills by H2 section into atomic notes under `Systems/`, text preserved verbatim. Add frontmatter and an index note per system. Parity check: every source line lands in exactly one note.
3. Freshness pass, honest about its limits:
   - Verified against code now: Public Site, Demo Studio, Voice Agent sandbox + booking + calendar push (the areas Plans 2 and 3 touch).
   - Everything else is marked `verified: unverified` with any known-stale sections flagged `status: stale` (for example Gemini-era material) rather than silently rewritten.
4. Convert the 26 `project_*` memories: each becomes a dated `Log/` note, a `Decisions/` note, or is dropped as superseded (the 06-10, 06-12 and 06-26 trackers are superseded by the 07-04 audit). `reference_*` memories go to `Reference/`.
5. Move `My Prompts/` audits, research reports and fix plans into `Log/`, `Reference/` and `Plans/` with `git mv`. `My Prompts/prompts` and `My Prompts/TODO` stay where they are.
6. `Archive/GSD Planning History.md`: an index of `.planning/` (milestones, phase list, where to look) that links out. `.planning/` itself is not moved or deleted.
7. Write `Home.md`, `Product/` notes (old positioning recorded, new positioning filled in by Plan 2), and `Runbooks/`.
8. Rewrite `CLAUDE.md`, stub the 9 skills, add `livekit-agent/CLAUDE.md`, prune memory and `MEMORY.md`.
9. Verify (below), then one commit per repo.

## 4. Verification
- Script: every `[[wikilink]]` resolves; every note has valid frontmatter; no note over the size target without a reason.
- Parity: line counts of the split notes equal the source skills.
- Cold-start test: a fresh Claude session asked "how does booking push to Google Calendar?" must reach the right note via `CLAUDE.md` → `Home.md` → system index, without loading a monolith.
- You open `vault/` in Obsidian and confirm the graph and navigation feel right.

## 5. Not in scope
- Rewriting stale architecture docs for systems this rebrand does not touch.
- Migrating the 984 `.planning/` files.
- Any Obsidian plugins beyond core (Dataview and others can be added later; nothing depends on them).

## 6. Decisions (2026-11-23)
1. Vault lives in this repo at `vault/`.
2. The nine architecture skills, after the rebrand:
   - **Deleted** (content superseded by the rebuild): `public-site-i18n`, `scroll-line-path`. Fresh `Systems/Public Site/` notes are written from the new code in Plan 2.
   - **Kept as stubs pointing at the vault, content current and needed**: `voice-call-architecture`, `scheduling-calendar-system`, `auth-database-multitenancy`. These describe the product core that the new positioning sells and that the Demo Studio runs on.
   - **Kept as stubs, marked "legacy app" in the vault**: `dashboard-crm-system`, `onboarding-flow`, `payment-architecture`, `integrations-jobber-xero`. The code they describe is untouched and still deployed, so they are needed the day anyone works on the dashboard, onboarding, billing or Jobber/Xero again. They are not needed for the rebrand or the demo.
3. Still open: confirm the GitHub repo is private before the vault is committed (it will contain audit findings and infrastructure notes).

## 7. Outcome (2026-11-23)

Built as planned; committed and pushed on the owner's instruction the same day. Result: 251 notes; link check passes; line parity between the nine source skills and the split notes verified by script.

Differences from the plan above:
- **Memory is a junction.** The Claude memory directory now points at `vault/Memory/`, so memory is in the vault itself: [[Claude memory and skills wiring]]. It holds the six feedback rules and one pointer; the 31 project and reference notes became [[Log]], [[Reference]] and [[Product]] notes.
- **All of `My Prompts/` and `docs/` moved**, including `TODO` ([[Backlog]]), `prompts` ([[Prompt Library]]) and the binary documents ([[Documents]]). Both folders are gone. Old-to-new paths: [[Moved files]].
- **`public-site-i18n` and `scroll-line-path` are stubbed, not deleted yet.** The code they describe still exists until Plan 2 rebuilds the site; they are deleted then.
- **Code comments updated.** 24 files across both repos cited moved documents; the paths were updated (comment-only changes).
- **Added:** [[Now]] (current state), [[Moved files]], hub notes generated by `_meta/tools/build_hubs.py`, and `_meta/tools/check_vault.py`.
- **Found during the work:** both GitHub repos are public. One personal phone number in the migrated notes was redacted before pushing.

- **Cold-start test run.** A fresh agent answered three architecture questions from `CLAUDE.md` alone without keyword search. Its findings were applied: index notes slimmed (the Voice Agent index went from about 61,000 to 8,400 characters), multi-part notes renamed after their contents, historical notes listed separately, and two verified bridge notes added ([[Scheduling - Booking to calendar on agent calls (verified path)]], [[Billing - Plans and limits at a glance (verified)]]) where migrated notes described an outdated flow.

When the owner has reviewed the vault, this plan moves to `Log/`.
