---
type: runbook
status: current
description: "How each repo gets to production: Next app on Vercel, voice agent on Railway. Includes the order to follow when a change spans both."
verified: 2026-11-23
tags: [voco/runbook]
---

# Deploy

## Voice agent (`livekit-agent`)
- Railway project `miraculous-love`, service `livekit_agent`, environment `production`, region asia-southeast1 (Singapore) since 2026-11-25; it was europe-west4 before.
- Pushing to `main` on GitHub (`lerboi/livekit_agent`) triggers a build from the `Dockerfile` and a deploy. Verified: the running deployment is commit `1dbee5a` from 2026-09-08.
- The worker registers with LiveKit Cloud as `voco-voice-agent`. A healthy deploy logs `registered worker`.
- Tests before pushing: `pytest` in the agent repo (663 passing with one known pre-existing failure, per [[2026-09-09 Call-experience items 1, 2, 3, 5 shipped]]).
- Environment variables are set in Railway, not in the repo.

## Next app (`homeservice_agent`)
- Hosted on Vercel (`.vercel/` project link, `vercel.json` defines ten cron routes). Pushes to `main` deploy to production. The push-to-deploy link was not re-verified on 2026-11-23.
- Checks before pushing: `npm run lint`, `npm test`, `npm run build`.
- Database migrations in `supabase/migrations/` are applied separately (Supabase MCP `apply_migration` or the Supabase dashboard). Apply a migration before deploying code that depends on it.

## When a change spans both repos
1. Apply any migration.
2. Deploy the side that tolerates the old version of the other. For new room-metadata fields read by the agent, deploy the agent first: it ignores metadata it does not know.
3. Deploy the other side, then run a browser test call: [[Run a browser test call]].

Never push to either `main` without the owner's go-ahead.
