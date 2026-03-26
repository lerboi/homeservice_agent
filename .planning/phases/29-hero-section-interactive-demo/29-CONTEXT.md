# Phase 29: Hero Section Interactive Demo - Context

**Gathered:** 2026-03-26
**Status:** Ready for planning

<domain>
## Phase Boundary

Replace the hero section's CTA buttons (AuthAwareCTA + Watch Demo) with an interactive business name input and AI voice demo player. Visitor enters their business name, clicks "Listen to Your Demo", and hears a scripted AI receptionist conversation with their name dynamically inserted. Also: shorten the main hero title and make the RotatingText component adjust its width responsively to match the currently displayed word rather than reserving the longest word's width.

</domain>

<decisions>
## Implementation Decisions

### Voice Demo Approach
- **D-01:** Pre-render the demo script as static audio segments (intro, mid-conversation, closing) using a high-quality TTS service at build/deploy time. Only the business name is generated dynamically via a lightweight TTS API call at runtime.
- **D-02:** Use OpenAI TTS (`tts-1` or `tts-1-hd`) for the dynamic business name segment — $15/1M chars, ~0.5s latency, 6 voice options. Cost is essentially zero at landing page traffic volumes.
- **D-03:** The demo script is a ~30-45 second conversation between an AI receptionist and a caller. Two distinct voices: one for the AI agent (confident, professional), one for the caller (casual homeowner). The script demonstrates: greeting with business name, understanding a service request, and booking an appointment.
- **D-04:** Pre-rendered audio segments are stored as static files in `/public/audio/` — no CDN or external hosting needed. The dynamic name segment is generated via an API route (`/api/demo-voice`) and stitched client-side using the Web Audio API.

### Audio Player UI
- **D-05:** After the user clicks "Listen to Your Demo", the input bar transitions (fade/slide) into an audio player with a waveform visualizer, play/pause button, and progress indicator. Dark styling matching the `#050505` hero background.
- **D-06:** The player replaces the input bar in-place — same horizontal footprint. No modal, no separate section. The transition should feel smooth and immediate.
- **D-07:** A "Try another name" link below the player lets the user go back to the input state.

### Hero Title and Copy
- **D-08:** Shorten the main hero title. Current: "Every Call You Miss Is a Job Your {Rotating} Just Won". Make it punchier — something like "Every Missed Call Is a {Rotating} Lost" or similar. Keep the RotatingText component with the cycling words pattern.
- **D-09:** Replace the subtitle text to direct the user to the input: something like "Enter your business name and hear your AI receptionist in action."
- **D-10:** The eyebrow pill ("AI-Powered Answering for Trades") stays as-is.

### Input Bar Design
- **D-11:** Single-line text input with an inline "Listen to Your Demo" CTA button on the right side (inside or adjacent to the input). Replaces both the AuthAwareCTA and Watch Demo buttons.
- **D-12:** Placeholder text: "Enter your business name..." — styled to match the dark hero (`bg-white/[0.06]` input background, white text, orange focus ring).
- **D-13:** Validation: must have at least 2 characters. Button disabled/dimmed until valid input.
- **D-14:** While generating the audio, show a loading state on the button (spinner + "Generating...").
- **D-15:** Keep the social proof micro-line below the input/player.
- **D-16:** Add a small "Start Free Trial" text link below the input bar for users who want to skip the demo and go straight to onboarding.

### Responsive Rotating Text
- **D-17:** Change the RotatingText component to dynamically adjust its width to match the currently displayed word, using a CSS transition (`transition: width 0.3s ease`) instead of the current invisible sizer that reserves the longest word's width. This makes the surrounding text reflow smoothly as words cycle.
- **D-18:** The invisible sizer span (line 61-63 of RotatingText.jsx) should be replaced with a measured-width approach — either `useRef` + `offsetWidth` measurement or a CSS `width` transition on the container matching the current word's natural width.

### Claude's Discretion
- Exact hero title wording (shorter, punchier, keeping rotating text pattern)
- Demo script dialogue (specific lines, tone, scenario — should feel realistic for a plumbing/HVAC/electrical business)
- Voice selection from OpenAI TTS voices (alloy, echo, fable, onyx, nova, shimmer)
- Waveform visualizer implementation (canvas-based, SVG, or CSS bars)
- Web Audio API stitching approach for combining pre-rendered + dynamic segments
- Exact transition animations between input state and player state
- Mobile layout adjustments (input may need to stack vertically on small screens)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hero section (current implementation to modify)
- `src/app/components/landing/HeroSection.jsx` — Current hero: Spline 3D, RotatingText, AuthAwareCTA + Watch Demo button
- `src/app/components/landing/RotatingText.jsx` — Per-character animated text rotation with invisible sizer (lines 61-63 are the width reservation to change)
- `src/components/landing/AuthAwareCTA.js` — Auth-aware CTA button (will be replaced by input bar, but auth routing pattern may be reused for the "Start Free Trial" link)

### Landing page structure
- `src/app/(public)/page.js` — HeroSection is statically imported (above fold)
- `src/app/(public)/layout.js` — Public layout with LandingNav + LandingFooter
- `src/app/components/landing/AnimatedSection.jsx` — Animation system used in hero

### Design reference
- `src/app/components/landing/LandingNav.jsx` — Dark nav styling reference for input/player dark theme consistency
- `src/app/(public)/pricing/page.js` — Dark section styling patterns (`bg-[#050505]`, `text-white/50`, `border-white/[0.06]`)

### API patterns
- `src/app/api/contact/route.js` — POST API route pattern to mirror for `/api/demo-voice`
- `src/lib/supabase.js` — Service-role client (if needed for any server-side operations)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `RotatingText` component — already handles per-character animation, just needs width behavior change
- `AnimatedSection` — can wrap the input/player transition
- `Button` from shadcn — for the inline CTA and play/pause controls
- Dark hero styling patterns — `bg-[#050505]`, `bg-white/[0.06]`, `border-white/[0.07]`, `text-white/50` already established
- `dynamic()` from next/dynamic — for lazy-loading the audio player/waveform component

### Established Patterns
- Server Component (HeroSection) with client sub-components (RotatingText, AuthAwareCTA) — the input bar and player will need to be client components
- `next/dynamic` for lazy loading non-critical client components
- API routes follow `export async function POST(request)` pattern with `Response.json()` returns
- Sonner `toast` for error feedback (already in public layout)

### Integration Points
- HeroSection.jsx — main file to modify (replace CTA section with input/player)
- RotatingText.jsx — width behavior change
- New API route: `src/app/api/demo-voice/route.js` — accepts business name, returns audio buffer
- New components: `HeroDemoInput.jsx` (client), `HeroDemoPlayer.jsx` (client)
- Static audio files: `public/audio/demo-intro.mp3`, `demo-mid.mp3`, `demo-outro.mp3`

</code_context>

<specifics>
## Specific Ideas

- Pre-rendered segments + dynamic name splice approach gives instant playback for 95% of the audio with minimal latency
- OpenAI TTS at $15/1M chars is essentially free for landing page volumes (a business name is ~20 chars = $0.0003 per demo play)
- Web Audio API can stitch AudioBuffers seamlessly — load pre-rendered segments as ArrayBuffers, generate name segment via API, concatenate and play
- The input-to-player transition should feel like the input "transforms" into the player (same position, same width)
- Demo script should showcase the core value prop: AI answers with business name, understands the service need, books an appointment — all in ~30-45 seconds

</specifics>

<deferred>
## Deferred Ideas

- ElevenLabs conversational API for fully dynamic two-voice demos (higher quality but $22+/mo and more latency)
- Allowing users to customize the demo scenario (e.g., emergency vs routine call)
- Saving/sharing demo audio via unique URL
- A/B testing different demo scripts for conversion optimization

</deferred>

---

*Phase: 29-hero-section-interactive-demo*
*Context gathered: 2026-03-26*
