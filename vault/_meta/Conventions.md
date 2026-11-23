---
type: meta
status: current
description: "How this vault is organised, where each kind of note goes, the frontmatter schema, and the rules that keep it trustworthy for AI and human readers."
verified: 2026-11-23
tags: [voco/meta]
---

# Conventions

## Design principles

1. **Progressive disclosure.** `CLAUDE.md` → [[Home]] → a hub or system index → one atomic note. Nobody should need to load a 3,000-line file to answer a small question. Index tables carry a one-line description per note so the right note can be chosen without opening the others.
2. **One fact, one place.** Link instead of copying. If two notes disagree, the one with the newer `verified:` date wins and the other is fixed.
3. **Honest freshness.** Every note says how far it can be trusted (`status`, `verified`). A note that has not been checked against code says so.
4. **Folders by purpose, not by topic.** If you hesitate about where a note goes, use the table below; if it still does not fit, the structure is wrong and this note should change.

## Where things go

| Folder | Holds | Lifetime |
|---|---|---|
| `Home.md`, `Now.md` | Entry point; current state | `Now` is overwritten as things change |
| `Systems/<System>/` | How the code works today. One index note named after the system, plus atomic notes | Updated with the code |
| `Runbooks/` | Step-by-step operational procedures | Updated when the procedure changes |
| `Decisions/` | One decision per note: context, decision, consequences | Permanent; superseded, never edited away |
| `Log/` | Dated record of work: audits, fix waves, investigations. Filename starts `YYYY-MM-DD` | Append-only |
| `Plans/` | Plans not yet finished. When done, the plan moves to `Log/` | Temporary |
| `Reference/` | Research, SDK gotchas, pointers to external resources, documents | Long-lived |
| `Product/` | Positioning, site flow, backlog, ideas | Updated |
| `Memory/` | Claude's auto-memory: how the owner wants work done. Claude Code reads and writes this folder through a directory junction (see [[Claude memory and skills wiring]]) | Managed by Claude |
| `Archive/` | Index notes that point at history kept elsewhere (`.planning/`) | Rarely changes |
| `_attachments/` | Binary files (PDF, DOCX) | |
| `_meta/` | This note, templates, tools | |

## Frontmatter

```yaml
---
type: system | system-index | runbook | decision | log | plan | reference | idea | hub | meta | status
system: Voice Agent            # system notes only
status: current | legacy-app | pending-rebuild | historical | superseded | record | in-progress | approved | idea
description: "One sentence. Shown in index tables; write it so a reader can decide whether to open the note."
verified: 2026-11-23           # last date the note was checked against code or live systems; empty = never
date: 2026-09-05               # log, decision and reference notes: when it happened
source: "where the text came from, if migrated"
migrated: 2026-11-23           # only on migrated notes
tags: [voco/system/voice-agent]
---
```

Status meanings:

| Status | Meaning |
|---|---|
| `current` | Describes the system as it is believed to be now |
| `legacy-app` | Describes the home-service dashboard app (dashboard, onboarding, billing, Jobber/Xero). The code is deployed and unchanged, but it is not the focus after the 2026-11 rebrand |
| `pending-rebuild` | Describes code that an approved plan is about to replace |
| `historical` | Describes something no longer in the code (for example the Gemini-era pipeline). Kept for the reasoning |
| `superseded` | A log or decision replaced by a later one |
| `record` | A log entry: true when written, not maintained |

## Writing rules

- Filenames are unique across the vault and readable: `Voice Agent - Post-Call Pipeline.md`, `2026-09-05 Voice-agent prompt refactor.md`, `Decision - …`.
- Link with `[[Note name]]`. Reference code as `path:line`, with the repo named when it is the agent repo (`livekit-agent/src/agent.py:717`).
- Aim for under 300 lines per note. Split by subject when a note grows past that.
- Start every note with what it is for. Put the conclusion before the detail.
- No secrets, tokens, customer data or personal data. Both repos are public.
- When code changes: update the system note, set `verified:`, and if the change was a decision or a notable piece of work, add a `Decisions/` or `Log/` note and update [[Now]].

## Tools

- `python vault/_meta/tools/check_vault.py`: verifies every wikilink resolves and every note has frontmatter. Run before committing vault changes.
- `python vault/_meta/tools/build_hubs.py`: regenerates the hub tables in `Log`, `Decisions`, `Plans`, `Reference`, `Product`, `Runbooks` from each note's frontmatter. Run after adding a note to one of those folders.

- `python vault/_meta/tools/baseline_call.py <tenant_id> <tenant_phone>`: places a scripted, sandboxed test call against the deployed agent and prints the gap between the end of each caller utterance and the agent's first audio. Reads keys from both repos' env files; prints no secrets.
- `vault/_meta/tools/dev_worker_env.py` and `llm_ttft_bench.py`: see [[Run a local dev worker and measure]].
- `vault/_meta/tools/verify_google_calendar.mjs` and `demo_event_check.mjs`: check a tenant's Google Calendar connection, and read back or remove the event a demo call created. See [[Record a demo]].

Templates are in `_meta/templates/`.
