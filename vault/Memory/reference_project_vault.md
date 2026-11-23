---
name: reference-project-vault
description: All Voco project knowledge (systems, runbooks, decisions, logs, plans, research) lives in the Obsidian vault at vault/ in the homeservice_agent repo; start at vault/Home.md and vault/Now.md
metadata:
  type: reference
---

Project knowledge is not kept in memory. It lives in the Obsidian vault at `C:\Users\leheh\.Projects\homeservice_agent\vault\` (migrated 2026-11-23).

- Entry point: `vault/Home.md`. Current state and open items: `vault/Now.md`.
- Architecture: `vault/Systems/<System>/<System>.md` index notes.
- Work history that used to be `project_*` memories: `vault/Log/`. Decisions: `vault/Decisions/`. SDK gotchas and research: `vault/Reference/`.
- Conventions and tools: `vault/_meta/Conventions.md`.

**How to apply:** when work produces something worth keeping about the project, write it to the vault (a Log, Decision or system note, and update `Now.md`), not to memory. Memory is only for how the owner wants work done. This memory directory is itself a junction to `vault/Memory/`.
