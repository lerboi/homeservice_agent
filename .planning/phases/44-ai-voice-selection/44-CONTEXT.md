# Phase 44: AI Voice Selection - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Let business owners choose their AI receptionist's voice from a curated set of 6 Gemini voices in the AI & Voice Settings dashboard page. Voice picker UI with pre-recorded audio preview clips, grouped by gender. Selection persists to tenants table and the LiveKit agent reads it at call time. Backward-compatible — NULL defaults to existing tone-based voice mapping.

</domain>

<decisions>
## Implementation Decisions

### Voice picker layout
- **D-01:** 2x3 grid layout — two columns, three rows
- **D-02:** Gender-grouped: female voices top row (Aoede, Erinome, Sulafat), male voices bottom row (Zephyr, Achird, Charon)
- **D-03:** Subtle "Female" / "Male" labels above each gender group
- **D-04:** Each card shows voice name, brief character description
- **D-05:** Responsive collapse — 2 columns on mobile, or single column if needed for breathing room
- **D-06:** Uses existing `selected.card` (copper border + light tint) and `selected.cardIdle` design tokens for selection state

### Audio preview interaction
- **D-07:** Small play/pause icon button in the corner of each voice card
- **D-08:** Tapping play on one card auto-stops any other card that's currently playing
- **D-09:** Audio files are static, stored in `/public/audio/voices/` — one file per voice (e.g., `aoede.mp3`, `zephyr.mp3`)
- **D-10:** Owner will provide the pre-recorded audio sample files

### Selection persistence
- **D-11:** Explicit Save button — owner selects a voice card, then clicks "Save" to persist
- **D-12:** Toast confirmation on save ("Voice updated")
- **D-13:** Voice change takes effect on the next inbound call (no mid-session impact)

### Voice-to-tone relationship
- **D-14:** `ai_voice` column on tenants overrides `VOICE_MAP[tone_preset]` when set
- **D-15:** NULL `ai_voice` = backward-compatible fallback to tone-based voice mapping (Zephyr for professional, Aoede for friendly, Achird for local_expert)
- **D-16:** `tone_preset` continues to control prompt personality (measured/warm/relaxed) independently of voice selection
- **D-17:** No migration backfill — existing tenants keep NULL (tone-based mapping) until they actively choose

### Voice catalog
- **D-18:** 6 voices total:
  - Female: Aoede (warm, upbeat), Erinome (bright, expressive), Sulafat (warm, gentle)
  - Male: Zephyr (bright, clear), Achird (relaxed, neighborly), Charon (deep, authoritative)

### Claude's Discretion
- Exact card dimensions and spacing
- Play button icon style and positioning within the card
- Toast duration and styling
- Save button placement (bottom of section vs inline)
- Loading/disabled states during save

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Voice call architecture
- `.claude/skills/voice-call-architecture/SKILL.md` — Full agent architecture, VOICE_MAP, tone_preset mapping, Gemini RealtimeModel configuration
- `src/agent.py` in `livekit-agent` repo (`C:/Users/leheh/.Projects/livekit-agent/src/agent.py`) — Lines 44-49 for VOICE_MAP, line 182 for voice_name resolution

### Dashboard patterns
- `src/lib/design-tokens.js` — `selected.card` and `selected.cardIdle` tokens for selection state styling
- `src/components/dashboard/SettingsAISection.jsx` — Current AI settings section (voice picker will be added here)
- `src/app/dashboard/more/ai-voice-settings/page.js` — Parent page that renders SettingsAISection

### Database
- `.claude/skills/auth-database-multitenancy/SKILL.md` — Tenants table schema, migration patterns, RLS policies
- `supabase/migrations/` — Migration numbering (latest is 043)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `selected.card` / `selected.cardIdle` design tokens: Copper border highlight + subtle tint for active selection, stone border for idle — directly usable for voice card states
- `card.base` design token: White rounded card with subtle shadow — base style for voice cards
- `btn.primary` design token: Copper orange button style — for the Save button
- `toast` from `sonner`: Already used across dashboard for notifications

### Established Patterns
- Settings sections are standalone components in `src/components/dashboard/Settings*.jsx`
- API routes use `getTenantId()` for tenant scoping
- Supabase browser client for reads, API routes for writes
- `supabase-browser.js` for client-side queries

### Integration Points
- `SettingsAISection.jsx` — Voice picker section added here, above or below the existing phone number + test call panel
- `ai-voice-settings/page.js` — May need to fetch `ai_voice` and `tone_preset` in addition to `phone_number`
- New API route: `PATCH /api/ai-voice-settings` — persists `ai_voice` to tenants table
- Agent `src/agent.py` — Read `tenant.ai_voice`, use if set, else fall back to `VOICE_MAP[tone_preset]`
- New migration (044): Add `ai_voice TEXT` column to tenants

</code_context>

<specifics>
## Specific Ideas

No specific requirements — open to standard approaches

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope

</deferred>

---

*Phase: 44-ai-voice-selection*
*Context gathered: 2026-04-11*
