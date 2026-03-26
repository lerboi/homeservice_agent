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
- **D-01:** Pre-render the demo script as static audio segments using ElevenLabs at build/deploy time. Only the business name is generated dynamically via ElevenLabs TTS API at runtime.
- **D-02:** Use ElevenLabs for everything — both the pre-rendered static segments and the dynamic business name. Same voice consistency across the entire demo. ElevenLabs Starter plan ($5/mo, 30k chars) covers ~1,500 demo plays/month for the dynamic name segment.
- **D-03:** Pre-rendered audio segments stored as static files in `/public/audio/`. The dynamic name segment is generated via an API route (`/api/demo-voice`) and stitched client-side using the Web Audio API.

### Demo Script & Scenario
- **D-04:** HVAC routine maintenance scenario — caller wants AC serviced before summer. AI greets with business name, captures details, offers next available slot. Shows the everyday booking value (not emergency drama).
- **D-05:** Demo duration is 20-25 seconds — short and punchy. Greeting, quick request, slot offered, confirmed. Keeps visitor attention on a landing page.
- **D-06:** Two distinct voices — AI receptionist voice + caller voice. Both pre-rendered via ElevenLabs with different voice IDs. Feels like a real phone call.

### Input Bar Design
- **D-07:** Single-line text input with an inline "Listen to Your Demo" CTA button on the right side. Replaces both the AuthAwareCTA and Watch Demo buttons.
- **D-08:** Placeholder text: "Enter your business name..." — dark hero styling (`bg-white/[0.06]` input background, white text, orange focus ring).
- **D-09:** Validation: must have at least 2 characters. Button disabled/dimmed until valid input.
- **D-10:** While generating the audio, show a loading state on the button (spinner + "Generating...").
- **D-11:** Add a "Start Free Trial" text link below the input bar for users who want to skip the demo.

### Audio Player UI
- **D-12:** After clicking "Listen to Your Demo", the input bar transitions into an audio player with a waveform visualizer (animated CSS bars), play/pause button, and progress indicator. Dark styling matching the `#050505` hero background.
- **D-13:** The player replaces the input bar in-place — same horizontal footprint. No modal, no separate section.
- **D-14:** After audio finishes: player stays visible with replay option. A "Start Free Trial" CTA button appears below the player to convert. No "Try another name" link — once they've heard the demo, keep them moving toward signup.

### Hero Title and Copy
- **D-15:** Shorten the main hero title (Claude's discretion). Keep the RotatingText component with cycling words pattern. Make it punchier than current.
- **D-16:** Replace the subtitle to direct the user to the input — something like "Enter your business name and hear your AI receptionist in action."
- **D-17:** Remove the eyebrow pill ("AI-Powered Answering for Trades") and the social proof micro-line ("Trusted by 500+ trades businesses"). Let the demo input be the sole focus.

### Responsive Rotating Text
- **D-18:** Change the RotatingText component to dynamically adjust its width to match the currently displayed word, using a CSS transition instead of the current invisible sizer that reserves the longest word's width.
- **D-19:** The invisible sizer span (line 61-63 of RotatingText.jsx) should be replaced with a measured-width approach — `useRef` + `getBoundingClientRect()` or similar.

### Claude's Discretion
- Exact hero title wording (shorter, punchier, keeping rotating text pattern)
- Demo script dialogue (specific lines, tone — HVAC routine maintenance scenario)
- ElevenLabs voice selection for both AI receptionist and caller voices
- Waveform visualizer implementation (canvas-based, SVG, or CSS bars)
- Web Audio API stitching approach for combining pre-rendered + dynamic segments
- Exact transition animations between input state and player state
- Mobile layout adjustments (input may need to stack vertically on small screens)
- Post-play CTA button styling and placement

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Hero section (current implementation to modify)
- `src/app/components/landing/HeroSection.jsx` — Current hero: Spline 3D, RotatingText, AuthAwareCTA + Watch Demo button
- `src/app/components/landing/RotatingText.jsx` — Per-character animated text rotation with invisible sizer (lines 61-63 are the width reservation to change)
- `src/components/landing/AuthAwareCTA.js` — Auth-aware CTA button (being replaced by input bar, but auth routing pattern reused for "Start Free Trial" link)

### Landing page structure
- `src/app/(public)/page.js` — HeroSection is statically imported (above fold)
- `src/app/(public)/layout.js` — Public layout with LandingNav + LandingFooter
- `src/app/components/landing/AnimatedSection.jsx` — Animation system used in hero

### Design reference
- `src/app/components/landing/LandingNav.jsx` — Dark nav styling reference for input/player dark theme consistency
- `src/app/(public)/pricing/page.js` — Dark section styling patterns (`bg-[#050505]`, `text-white/50`, `border-white/[0.06]`)

### API patterns
- `src/app/api/contact/route.js` — POST API route pattern to mirror for `/api/demo-voice`

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
- New API route: `src/app/api/demo-voice/route.js` — accepts business name, calls ElevenLabs TTS, returns audio buffer
- New components: `HeroDemoInput.jsx` (client), `HeroDemoPlayer.jsx` (client)
- Static audio files: `public/audio/` — pre-rendered ElevenLabs segments

</code_context>

<specifics>
## Specific Ideas

- ElevenLabs for both static and dynamic segments ensures consistent voice quality across the entire demo
- $5/mo ElevenLabs Starter plan covers ~1,500 dynamic name generations/month (20 chars per name)
- Web Audio API stitches AudioBuffers seamlessly — load pre-rendered segments as ArrayBuffers, generate name segment via API, concatenate and play
- The input-to-player transition should feel like the input "transforms" into the player (same position, same width)
- HVAC routine maintenance scenario is relatable to broad trade audience without being overdramatic
- 20-25 seconds keeps attention while showing the full value prop: greeting → request → booking
- Post-play CTA appears to capitalize on the "wow" moment right after hearing the demo

</specifics>

<deferred>
## Deferred Ideas

- ElevenLabs conversational API for fully dynamic two-voice demos
- Allowing users to customize the demo scenario (e.g., emergency vs routine call)
- Saving/sharing demo audio via unique URL
- A/B testing different demo scripts for conversion optimization

</deferred>

---

*Phase: 29-hero-section-interactive-demo*
*Context gathered: 2026-03-26*
