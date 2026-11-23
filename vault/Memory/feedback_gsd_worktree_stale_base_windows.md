---
name: GSD parallel-executor worktree branches can have a stale base on Windows
description: When spawning gsd-executor with isolation=worktree on Windows, the worktree branch's tree may be missing recent commits even when git merge-base claims the correct expected_base; verify file presence before merging
type: feedback
originSessionId: 39940c8e-0cca-446d-aca2-fabd2b742bdc
---
When `/gsd-execute-phase` spawns a `gsd-executor` Agent with `isolation="worktree"` on Windows, the worktree's branch can be created from a stale base — its working tree (and the resulting commit's tree) is missing recent commits on `main`, even though `git merge-base HEAD <EXPECTED_BASE>` returns `<EXPECTED_BASE>` and the workflow's `<worktree_branch_check>` therefore reports OK.

**Why:** Known Windows GSD issue documented in execute-phase.md `<worktree_branch_check>` — the soft-reset workaround in the workflow patches HEAD but the worktree's index/tree predates recent commits. Merging the resulting commit back to main silently drops files (e.g., the executor's commit `8c1d77e` was missing `supabase/migrations/054_external_account_id.sql` even though main HEAD `f25bdec` contained it).

**How to apply:**

Before doing the post-wave worktree merge, run a sanity check on every executor commit:

```bash
# For each worktree commit, diff its tree against parent — anything in DELETED state
# that wasn't actually edited by the plan is a stale-base symptom.
git diff --diff-filter=D --name-only <commit>^ <commit>
```

If files unrelated to the plan appear as deleted: do NOT `git merge` the worktree branch. Recover by cherry-picking only the plan's actual added/modified files:

```bash
git checkout <worktree_commit> -- <plan_files>
git commit --no-verify -m "..."
git worktree remove <path> -f -f
git branch -D <worktree_branch>
```

Then continue the plan inline on main rather than spawning more worktree agents for that phase. For phases with many plans, consider setting `workflow.use_worktrees=false` upfront on Windows to avoid the issue entirely.
