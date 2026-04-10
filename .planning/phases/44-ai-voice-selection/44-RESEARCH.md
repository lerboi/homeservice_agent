# Phase 44: AI Voice Selection - Research

**Researched:** 2026-04-11
**Domain:** Dashboard UI settings, Supabase schema migration, Python agent voice configuration
**Confidence:** HIGH

## Summary

Phase 44 adds a voice picker to the AI & Voice Settings dashboard page. Owners choose from 6 curated Gemini voices via a 2x3 card grid with audio preview; their selection persists to the `tenants` table and the LiveKit Python agent reads it at call time. The feature is fully backward-compatible: a `NULL` `ai_voice` column value falls back to the existing `VOICE_MAP[tone_preset]` logic already in `agent.py`.

All implementation domains are well-understood. The codebase has direct precedents for every required piece: settings PATCH API routes (`/api/notification-settings/route.js`), design token–based card selection (`selected.card` / `selected.cardIdle`), sonner toast confirmations, and service-role Supabase updates guarded by `getTenantId()`. The Python agent change is a one-liner override inserted above the existing `VOICE_MAP.get(tone_preset, "Kore")` call at line 182 of `src/agent.py`.

The UI-SPEC (44-UI-SPEC.md) is fully approved and prescribes exact component names, grid layout, copy, and accessibility contract. The planner should treat the UI-SPEC as the implementation blueprint — this research focuses on the integration seams that the UI-SPEC does not address.

**Primary recommendation:** Implement in 4 tasks — (1) DB migration, (2) API route, (3) VoicePickerSection + VoiceCard UI components integrated into SettingsAISection, (4) Python agent override in livekit-agent repo. Audio files are owner-supplied and require a placeholder step in Wave 0.

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Voice picker layout**
- D-01: 2x3 grid layout — two columns, three rows
- D-02: Gender-grouped: female voices top row (Aoede, Erinome, Sulafat), male voices bottom row (Zephyr, Achird, Charon)
- D-03: Subtle "Female" / "Male" labels above each gender group
- D-04: Each card shows voice name, brief character description
- D-05: Responsive collapse — 2 columns on mobile, or single column if needed for breathing room
- D-06: Uses existing `selected.card` (copper border + light tint) and `selected.cardIdle` design tokens for selection state

**Audio preview interaction**
- D-07: Small play/pause icon button in the corner of each voice card
- D-08: Tapping play on one card auto-stops any other card that's currently playing
- D-09: Audio files are static, stored in `/public/audio/voices/` — one file per voice (e.g., `aoede.mp3`, `zephyr.mp3`)
- D-10: Owner will provide the pre-recorded audio sample files

**Selection persistence**
- D-11: Explicit Save button — owner selects a voice card, then clicks "Save" to persist
- D-12: Toast confirmation on save ("Voice updated")
- D-13: Voice change takes effect on the next inbound call (no mid-session impact)

**Voice-to-tone relationship**
- D-14: `ai_voice` column on tenants overrides `VOICE_MAP[tone_preset]` when set
- D-15: NULL `ai_voice` = backward-compatible fallback to tone-based voice mapping (Zephyr for professional, Aoede for friendly, Achird for local_expert)
- D-16: `tone_preset` continues to control prompt personality (measured/warm/relaxed) independently of voice selection
- D-17: No migration backfill — existing tenants keep NULL (tone-based mapping) until they actively choose

**Voice catalog**
- D-18: 6 voices total:
  - Female: Aoede (warm, upbeat), Erinome (bright, expressive), Sulafat (warm, gentle)
  - Male: Zephyr (bright, clear), Achird (relaxed, neighborly), Charon (deep, authoritative)

### Claude's Discretion
- Exact card dimensions and spacing
- Play button icon style and positioning within the card
- Toast duration and styling
- Save button placement (bottom of section vs inline)
- Loading/disabled states during save

### Deferred Ideas (OUT OF SCOPE)
None — discussion stayed within phase scope
</user_constraints>

---

## Project Constraints (from CLAUDE.md)

- **Brand name is Voco** — not HomeService AI
- **Read relevant skill before changes, update skill after** — changes to voice agent touch `voice-call-architecture` skill; changes to tenants table touch `auth-database-multitenancy` skill
- **Keep skills in sync** — both skills must be updated after implementation
- **Stack**: Next.js App Router, Supabase (service role for writes, browser client for reads), Tailwind CSS, shadcn/ui, design-tokens.js for styling
- **API route writes**: Always use `getTenantId()` + service-role Supabase client (`src/lib/supabase.js`), not the browser client
- **Test framework**: Jest, `tests/**/*.test.js` pattern, `node` environment, `@/` alias maps to `src/`

---

## Standard Stack

### Core (verified from codebase)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React (Next.js App Router) | 15.x (project baseline) | Client component for voice picker state | Codebase baseline |
| Tailwind CSS | 3.x | Grid layout, spacing, responsive breakpoints | Codebase baseline |
| `src/lib/design-tokens.js` | project file | `selected.card`, `selected.cardIdle`, `card.base`, `btn.primary` | Established pattern — every settings component uses these |
| `sonner` | installed | Toast notifications | Already used across dashboard |
| `lucide-react` | installed | Play/Pause/Loader2 icons | Already used; UI-SPEC specifies these icons |
| `src/lib/supabase-browser.js` | project file | Client-side tenant read (fetch `ai_voice` on mount) | Established pattern in `ai-voice-settings/page.js` |
| `src/lib/supabase.js` | project file | Service-role write in API route | Established pattern in all settings routes |
| `src/lib/get-tenant-id.js` | project file | Tenant scoping in API route | Mandatory for all dashboard API routes |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@/components/ui/skeleton` | shadcn installed | Loading skeleton for voice cards | While `ai_voice` is being fetched on mount |
| `HTMLAudioElement` (browser native) | Web API | Audio preview playback | D-09 specifies static MP3 files; no audio library needed |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native `<audio>` / `HTMLAudioElement` | Howler.js, Tone.js | Libraries are overkill for 6 static clip previews with simple play/pause; native Audio() is zero-dependency |
| Design tokens (`selected.card`) | Custom CSS classes | Design tokens are the established project pattern — do not diverge |

**Installation:** No new packages needed. Everything is already installed.

---

## Architecture Patterns

### Recommended Project Structure

New files to create:
```
src/
├── components/dashboard/
│   └── VoicePickerSection.jsx    # New — self-contained voice picker component
├── app/api/
│   └── ai-voice-settings/
│       └── route.js              # New — PATCH endpoint
supabase/migrations/
└── 044_ai_voice_column.sql       # New — adds ai_voice TEXT to tenants
livekit-agent/src/
└── agent.py                      # Edit — 3-line override (ai_voice || tone fallback)
public/audio/voices/
└── *.mp3                         # Owner-supplied; 6 placeholder files needed
```

Existing files to modify:
```
src/
├── app/dashboard/more/ai-voice-settings/page.js   # Extend: fetch ai_voice, pass to SettingsAISection
└── components/dashboard/SettingsAISection.jsx      # Extend: render VoicePickerSection above phone block
.claude/skills/
├── voice-call-architecture/SKILL.md               # Update after agent.py change
└── auth-database-multitenancy/SKILL.md            # Update after migration
```

### Pattern 1: Settings API Route (PATCH)

Established pattern from `/api/notification-settings/route.js`:

```javascript
// src/app/api/ai-voice-settings/route.js
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';  // service-role client

const VALID_VOICES = ['Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon'];

export async function PATCH(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { ai_voice } = await request.json();

    // Allowlist validation — critical: only accept known Gemini voice names
    if (!VALID_VOICES.includes(ai_voice)) {
      return Response.json({ error: 'Invalid voice selection' }, { status: 400 });
    }

    const { error } = await supabase
      .from('tenants')
      .update({ ai_voice })
      .eq('id', tenantId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }

    return Response.json({ ai_voice });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
```

### Pattern 2: Database Migration

Migration numbering: latest is `043_appointments_realtime.sql`. New migration is `044_ai_voice_column.sql`.

```sql
-- Migration 044: Add ai_voice column to tenants
-- Phase 44: AI Voice Selection
--
-- Additive-only. ai_voice TEXT nullable — NULL means use VOICE_MAP[tone_preset] fallback.
-- No backfill. Existing tenants keep NULL until they actively choose via voice picker.
-- Constraint: only accept the 6 curated Gemini voice names.

ALTER TABLE tenants
  ADD COLUMN ai_voice TEXT CHECK (
    ai_voice IS NULL OR ai_voice IN ('Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon')
  );
```

Note: The CHECK constraint enforces the allowlist at DB level. The API route also validates — defense in depth.

### Pattern 3: Python Agent Voice Override

Current code in `src/agent.py` at line 182:
```python
voice_name = VOICE_MAP.get(tone_preset, "Kore")
```

Modified code (D-14, D-15):
```python
# Use explicitly selected voice if set, else fall back to tone-based mapping
ai_voice = tenant.get("ai_voice") if tenant else None
voice_name = ai_voice if ai_voice else VOICE_MAP.get(tone_preset, "Kore")
```

This is the complete change to `agent.py`. Two lines replace one.

### Pattern 4: Page-Level Data Fetch Extension

`ai-voice-settings/page.js` currently fetches only `phone_number`. It must also fetch `ai_voice`:

```javascript
const { data, error } = await supabase
  .from('tenants')
  .select('phone_number, ai_voice')  // Add ai_voice
  .single();
```

Pass `ai_voice` down to `SettingsAISection` as a prop; `SettingsAISection` passes it to `VoicePickerSection` as `initialVoice`.

### Pattern 5: VoicePickerSection Audio Management

```javascript
// Audio mutual exclusion — only one card playing at a time
const [playingVoice, setPlayingVoice] = useState(null);
const audioRef = useRef(null);

function handlePlay(voiceName) {
  if (audioRef.current) {
    audioRef.current.pause();
    audioRef.current = null;
  }
  if (playingVoice === voiceName) {
    // Toggle off — already playing this one
    setPlayingVoice(null);
    return;
  }
  const audio = new Audio(`/audio/voices/${voiceName.toLowerCase()}.mp3`);
  audio.addEventListener('ended', () => setPlayingVoice(null));
  audio.play();
  audioRef.current = audio;
  setPlayingVoice(voiceName);
}
```

### Anti-Patterns to Avoid

- **Writing with browser client**: All writes (PATCH) must go through an API route using the service-role client, never `supabase-browser` directly for writes. Established constraint across all settings.
- **Fetching ai_voice inside VoicePickerSection**: The page-level component owns data fetching, component receives `initialVoice` as a prop. Mirrors existing `phoneNumber` prop pattern in `SettingsAISection`.
- **Sending voice name to agent mid-call**: Voice is resolved once at call start from tenant record. No mechanism to change voice mid-session — D-13 documents this explicitly.
- **Trusting the voice name without validation**: The API must allowlist against the 6 known names. Arbitrary strings passed to `google.realtime.RealtimeModel(voice=...)` would cause a Gemini API error at call time.
- **Skipping the audio cleanup on unmount**: If the component unmounts while audio is playing (e.g., navigation), `audioRef.current.pause()` must be called in a `useEffect` cleanup to prevent memory leaks.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast component | `sonner` (already imported) | Already used across all dashboard settings |
| Loading skeleton | Animated div | `@/components/ui/skeleton` | Consistent with existing skeleton usage in `SettingsAISection` |
| Allowlist validation | Regex or fuzzy matching | Simple `Array.includes()` + DB CHECK constraint | Exact match against 6 known strings — no complexity needed |
| Audio playback | Custom audio engine | Native `HTMLAudioElement` / `new Audio()` | Static clips, single play/pause per card — browser native is sufficient |

**Key insight:** This phase is deliberately simple. The "custom" work is the UI layout and wiring. All supporting infrastructure (toast, skeleton, design tokens, API pattern) already exists.

---

## Common Pitfalls

### Pitfall 1: Migration Number Conflict
**What goes wrong:** Migration 044 conflicts with Phase 42's planned migration `044_calendar_blocks_and_completed_at.sql`.
**Why it happens:** Phase 42 (CAL-01) also uses number 044 (seen in REQUIREMENTS.md). Phase 44 (this phase) runs independently of Phase 42.
**How to avoid:** Check if `supabase/migrations/044_*.sql` already exists before writing. If Phase 42 has run first, this migration must be numbered 045. Coordinate migration numbering at planning time — the planner should assign the next available number after checking the actual migration directory at implementation time.
**Warning signs:** `supabase db push` fails with "migration already applied" or "duplicate filename."

### Pitfall 2: Audio Files Not Present at Deploy Time
**What goes wrong:** Voice cards render but clicking play gives a network 404. Audio file paths are `/public/audio/voices/aoede.mp3` etc.
**Why it happens:** D-10 states the owner will provide the audio files — they are not in the repo yet. Next.js serves `/public` as static assets, but files must physically exist.
**How to avoid:** Wave 0 must create placeholder audio files (silent or very short MP3) at the correct paths so the UI is functional during development. The real files replace the placeholders before launch. Document this clearly.
**Warning signs:** Browser DevTools Network tab shows 404 for `/audio/voices/*.mp3`.

### Pitfall 3: Gemini Voice Name Case Sensitivity
**What goes wrong:** `google.realtime.RealtimeModel(voice="aoede")` fails or uses wrong voice.
**Why it happens:** Gemini voice names are capitalized (Aoede, Zephyr etc.). The DB stores them as entered; if stored lowercase, the agent receives lowercase.
**How to avoid:** Store voice names with exact capitalization matching Gemini's API (`Aoede`, not `aoede`). The allowlist in the API route uses these exact strings. The DB CHECK constraint enforces the same list.
**Warning signs:** Gemini API error at call time, or voice doesn't change despite successful save.

### Pitfall 4: Audio Playing Across Page Navigation
**What goes wrong:** Owner clicks play, then navigates away — audio keeps playing because the component unmounted without cleanup.
**Why it happens:** `new Audio()` is not tied to React's lifecycle by default.
**How to avoid:** `useEffect` cleanup in `VoicePickerSection` that calls `audioRef.current?.pause()` on unmount.
**Warning signs:** Audio continues after navigating to a different dashboard page.

### Pitfall 5: RLS on Tenants Table Allows Read-Write via Browser Client
**What goes wrong:** Developer writes voice selection directly from the browser client instead of through the API route.
**Why it happens:** The tenants table RLS allows authenticated users to SELECT and UPDATE their own row. This means browser-direct writes would technically work — but bypass the allowlist validation in the API route.
**How to avoid:** All writes must go through `PATCH /api/ai-voice-settings` which validates the voice name. Never write to `tenants` from the browser client in settings flows.

---

## Code Examples

### Migration (verified pattern from migrations/042_call_routing_schema.sql)
```sql
-- 044_ai_voice_column.sql
ALTER TABLE tenants
  ADD COLUMN ai_voice TEXT CHECK (
    ai_voice IS NULL OR ai_voice IN ('Aoede', 'Erinome', 'Sulafat', 'Zephyr', 'Achird', 'Charon')
  );
```

### Agent voice override (verified from agent.py lines 182-192)
```python
# Two-line change in src/agent.py, replacing the single VOICE_MAP.get line
ai_voice = tenant.get("ai_voice") if tenant else None
voice_name = ai_voice if ai_voice else VOICE_MAP.get(tone_preset, "Kore")

model = google.realtime.RealtimeModel(
    model="gemini-3.1-flash-live-preview",
    voice=voice_name,
    # ... rest unchanged
)
```

### VoiceCard structure (from UI-SPEC)
```jsx
// VoiceCard: entire card surface selects; play button click is isolated
<div
  role="radio"
  aria-checked={isSelected}
  onClick={() => onSelect(voice.name)}
  className={`${card.base} ${isSelected ? selected.card : selected.cardIdle} ${!isSelected ? card.hover : ''} relative p-4 cursor-pointer`}
>
  <button
    onClick={(e) => { e.stopPropagation(); onPlay(voice.name); }}
    aria-label={isPlaying ? `Pause ${voice.name} preview` : `Play ${voice.name} preview`}
    className="absolute top-2 right-2 w-11 h-11 flex items-center justify-center rounded-full hover:bg-stone-100"
  >
    {isPlaying
      ? <Pause size={16} className="text-[#C2410C]" />
      : <Play size={16} className="text-stone-500" />}
  </button>
  <p className="text-sm font-semibold text-[#0F172A]">{voice.name}</p>
  <p className="text-xs text-[#475569] mt-1">{voice.description}</p>
</div>
```

### Page-level data fetch (extending existing ai-voice-settings/page.js pattern)
```javascript
const { data, error } = await supabase
  .from('tenants')
  .select('phone_number, ai_voice')
  .single();
setPhoneNumber(data?.phone_number ?? null);
setCurrentVoice(data?.ai_voice ?? null);
```

---

## Environment Availability

Step 2.6: SKIPPED — phase is purely code/UI/config changes within the existing Next.js and Python agent environments. No new external services or CLI tools required. Gemini voice names are configuration values, not a new API endpoint.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest |
| Config file | `jest.config.js` (root) |
| Quick run command | `npx jest tests/unit/ --no-coverage` |
| Full suite command | `npx jest --no-coverage` |

### Phase Requirements → Test Map

Phase 44 has no formal requirement IDs (TBD in REQUIREMENTS.md). Mapping to behaviors:

| Behavior | Test Type | Automated Command | File Exists? |
|----------|-----------|-------------------|-------------|
| API route rejects invalid voice name | unit | `npx jest tests/unit/ai-voice-settings.test.js -x` | No — Wave 0 gap |
| API route rejects unauthenticated request | unit | `npx jest tests/unit/ai-voice-settings.test.js -x` | No — Wave 0 gap |
| API route saves valid voice name | unit | `npx jest tests/unit/ai-voice-settings.test.js -x` | No — Wave 0 gap |
| Agent voice override: ai_voice set | manual smoke | call the test call endpoint | N/A — cross-repo Python |
| Agent voice override: ai_voice NULL falls back | manual smoke | call the test call endpoint | N/A — cross-repo Python |
| Audio mutual exclusion (one card plays at a time) | manual | visual verification in browser | N/A — UI interaction |

### Sampling Rate
- **Per task commit:** `npx jest tests/unit/ai-voice-settings.test.js -x`
- **Per wave merge:** `npx jest --no-coverage`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/unit/ai-voice-settings.test.js` — unit tests for PATCH route validation logic
- [ ] `public/audio/voices/aoede.mp3` (and 5 others) — placeholder silent audio files so the UI loads without 404s during development

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Retell voice config | Gemini `RealtimeModel(voice=...)` | Phase 23 LiveKit migration | Voice name must match Gemini's naming, not Retell's |
| `VOICE_MAP` always used | `ai_voice` column overrides `VOICE_MAP` | Phase 44 (this phase) | Explicit owner selection bypasses tone-based default |

**Deprecated/outdated:**
- Phase 44 does not deprecate anything. `VOICE_MAP` and `tone_preset` remain fully active for tenants who have not chosen a voice.

---

## Open Questions

1. **Migration number conflict with Phase 42**
   - What we know: Phase 42 (CAL-01) plans to create `044_calendar_blocks_and_completed_at.sql`. Phase 44 (this phase) also needs `044_ai_voice_column.sql`.
   - What's unclear: Which phase runs first in the codebase. As of research date, no `044_*.sql` exists in `supabase/migrations/`.
   - Recommendation: The planner should assign a migration number by checking the actual migration directory at implementation time. If Phase 42 runs first, this migration becomes 045. If Phase 44 runs first, this migration is 044. Do not hardcode 044 in plans — use "next available number."

2. **Audio placeholder file format**
   - What we know: D-09 specifies static MP3 files in `/public/audio/voices/`. D-10 says the owner provides them.
   - What's unclear: Whether placeholder files (silent MP3) should be committed to the repo during development.
   - Recommendation: Create a 1-second silent MP3 for each voice during Wave 0 so developers can iterate on the UI without waiting for owner-supplied clips. Add a `# TODO: Replace with real audio clips` comment in a README or code comment near the audio path constants.

---

## Sources

### Primary (HIGH confidence)
- `livekit-agent/src/agent.py` lines 44-49, 182 — VOICE_MAP definition and voice_name assignment (verified by direct read)
- `src/lib/design-tokens.js` — `selected.card`, `selected.cardIdle`, `card.base`, `btn.primary` exact class strings (verified by direct read)
- `src/components/dashboard/SettingsAISection.jsx` — current component structure and props (verified by direct read)
- `src/app/dashboard/more/ai-voice-settings/page.js` — current page data-fetch pattern (verified by direct read)
- `src/app/api/notification-settings/route.js` — canonical PATCH settings route pattern (verified by direct read)
- `supabase/migrations/042_call_routing_schema.sql` — migration style/pattern (verified by direct read)
- `.planning/phases/44-ai-voice-selection/44-UI-SPEC.md` — full UI component contract (verified by direct read)
- `jest.config.js` — test framework configuration (verified by direct read)

### Secondary (MEDIUM confidence)
- `supabase/migrations/` directory listing — confirmed latest migration is 043, no 044 exists yet (verified by Bash ls)
- `.planning/REQUIREMENTS.md` CAL-01 — confirms Phase 42 also plans to use migration 044 (potential number conflict)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries already installed and in use; no new dependencies
- Architecture: HIGH — all patterns are direct copies/extensions of existing codebase patterns
- Pitfalls: HIGH — migration numbering conflict is concrete and verified; audio 404 and voice name case are direct API concerns

**Research date:** 2026-04-11
**Valid until:** 2026-05-11 (stable stack; Gemini voice API names are stable configuration values)
