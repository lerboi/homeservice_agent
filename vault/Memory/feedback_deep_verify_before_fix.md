---
name: Deep-verify before proposing fixes
description: For bug fixes and code changes, trace every write path, reader, and adjacent system before proposing; confirm no side-effects before writing code
type: feedback
originSessionId: 3111c424-ec77-4e54-99cb-696156a4ea1c
---
For any non-trivial bug fix or code change, do exhaustive verification BEFORE writing code or calling ExitPlanMode:

- Grep for every writer of the field/function in question (both repos if multi-repo).
- Trace every reader/consumer to confirm the proposed change improves (never regresses) them.
- Read the actual files in question end-to-end — don't rely solely on subagent reports.
- Produce a root-cause analysis with file:line evidence showing the exact failure chain.
- Build an impact matrix listing every adjacent system (webhooks, crons, RPCs, dashboard readers, Realtime subscribers, test-call handling, etc.) and why each is safe or improved.
- Call out files explicitly NOT touched and why.
- Only after that: propose the change and ask for approval.

**Why:** The user was burned twice in a session by me proposing fixes without full verification — they explicitly rejected my plan twice to force deeper investigation. The pattern "confirm first that all changes made will not cause any issues" is a durable preference, not a one-off.

**How to apply:** Before writing any code for a reported bug, produce:
(a) the failure chain traced through the code with line numbers,
(b) an enumeration of all writers/readers of the affected state,
(c) an impact matrix for every adjacent system,
(d) explicit list of files NOT touched.
Then pause for approval. "Do not write any code yet, just let me know" is a phrase that signals they want this verification depth.
