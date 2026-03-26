# Phase 29: Hero Section Interactive Demo - Research

**Researched:** 2026-03-26
**Domain:** ElevenLabs TTS, Web Audio API, Next.js API routes, React client component state machines, RotatingText dynamic width, landing page hero section
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Pre-render the demo script as static audio segments using ElevenLabs at build/deploy time. Only the business name is generated dynamically via ElevenLabs TTS API at runtime.
- **D-02:** Use ElevenLabs for everything — both the pre-rendered static segments and the dynamic business name. Same voice consistency across the entire demo. ElevenLabs Starter plan ($5/mo, 30k chars) covers ~1,500 demo plays/month for the dynamic name segment.
- **D-03:** Pre-rendered audio segments stored as static files in `/public/audio/`. The dynamic name segment is generated via an API route (`/api/demo-voice`) and stitched client-side using the Web Audio API.
- **D-04:** HVAC routine maintenance scenario — caller wants AC serviced before summer. AI greets with business name, captures details, offers next available slot.
- **D-05:** Demo duration is 20-25 seconds — short and punchy.
- **D-06:** Two distinct voices — AI receptionist voice + caller voice. Both pre-rendered via ElevenLabs.
- **D-07:** Single-line text input with an inline "Listen to Your Demo" CTA button on the right side. Replaces both AuthAwareCTA and Watch Demo buttons.
- **D-08:** Placeholder text: "Enter your business name..." — dark hero styling (`bg-white/[0.06]` input background, white text, orange focus ring).
- **D-09:** Validation: must have at least 2 characters. Button disabled/dimmed until valid input.
- **D-10:** While generating audio, show a loading state (spinner + "Generating...").
- **D-11:** "Start Free Trial" text link below the input bar.
- **D-12:** After clicking "Listen to Your Demo", the input bar transitions into an audio player with a waveform visualizer (animated CSS bars), play/pause button, and progress indicator.
- **D-13:** Player replaces input bar in-place — same horizontal footprint. No modal.
- **D-14:** After audio finishes: player stays visible with replay option. "Start Free Trial" CTA button appears below.
- **D-15:** Shorten the main hero title (Claude's discretion). Keep RotatingText component.
- **D-16:** Replace subtitle to direct user to the input.
- **D-17:** Remove the eyebrow pill ("AI-Powered Answering for Trades") and the social proof micro-line.
- **D-18:** Change RotatingText to dynamically adjust its width to match the currently displayed word.
- **D-19:** Replace invisible sizer span with `useRef` + `getBoundingClientRect()` measured-width approach.

### Claude's Discretion
- Exact hero title wording (shorter, punchier, keeping rotating text pattern)
- Demo script dialogue (specific lines, tone — HVAC routine maintenance scenario)
- ElevenLabs voice selection for both AI receptionist and caller voices
- Waveform visualizer implementation (canvas-based, SVG, or CSS bars)
- Web Audio API stitching approach for combining pre-rendered + dynamic segments
- Exact transition animations between input state and player state
- Mobile layout adjustments (input may need to stack vertically on small screens)
- Post-play CTA button styling and placement

### Deferred Ideas (OUT OF SCOPE)
- ElevenLabs conversational API for fully dynamic two-voice demos
- Allowing users to customize the demo scenario (e.g., emergency vs routine call)
- Saving/sharing demo audio via unique URL
- A/B testing different demo scripts for conversion optimization
</user_constraints>

---

## Summary

Phase 29 replaces the hero section's two CTA buttons with an interactive voice demo: a business-name input that generates a personalized AI receptionist call using ElevenLabs TTS, played back through a waveform player. The architecture is intentionally lean — three pre-rendered static MP3 segments stitched with one dynamic segment via Web Audio API client-side. No streaming, no WebSocket, no live audio processing.

The technical work splits into five areas: (1) ElevenLabs TTS API route (`/api/demo-voice`) that accepts a business name and returns an MP3 buffer; (2) pre-rendering four audio segments as static files in `/public/audio/`; (3) `HeroDemoInput.jsx` — the input + loading state machine; (4) `HeroDemoPlayer.jsx` — the waveform player using static CSS bars + Web Audio API playback + progress tracking; (5) `RotatingText.jsx` width behavior change from fixed invisible-sizer to `useRef`-measured dynamic width. HeroSection.jsx itself is modified to swap the CTA block and update title/subtitle copy.

The ElevenLabs `elevenlabs` npm package (v1.59.0) is NOT currently in `package.json` — it must be installed. No ElevenLabs API key exists in `.env.local` — it must be added. All other dependencies (Framer Motion, shadcn Button, Sonner toast, Lucide icons, Web Audio API) are already in place.

**Primary recommendation:** Install `elevenlabs` npm package, add `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID_AI` + `ELEVENLABS_VOICE_ID_CALLER` env vars, build the API route using direct fetch or SDK (direct fetch is simpler and avoids SDK overhead for a single endpoint), and use Web Audio API `AudioContext.decodeAudioData()` for client-side buffer stitching.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| elevenlabs | 1.59.0 | ElevenLabs TTS Node.js SDK | Official SDK, TypeScript, handles auth, rate limiting, correct request format |
| Web Audio API | Native browser | Client-side AudioBuffer stitching and playback | Native browser API — no package, zero bundle impact, full AudioBuffer control |
| framer-motion | 12.38.0 (installed) | Input-to-player crossfade transitions | Already in project, handles `useReducedMotion` correctly |
| shadcn Button | (installed) | Inline CTA, play/pause controls | Already installed in project, matches design system |
| sonner | 2.0.7 (installed) | Error toast feedback | Already in public layout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| lucide-react | 0.577.0 (installed) | Play, Pause, Loader2 icons | Icon set already in project |
| next/dynamic | Next.js built-in | Lazy-load HeroDemoPlayer | Client component with Web Audio — should not SSR |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| elevenlabs npm SDK | Direct `fetch()` to ElevenLabs REST API | SDK is cleaner TS types; direct fetch works equally well for a single endpoint. Either is valid — SDK preferred for maintainability. |
| Web Audio API (manual) | `crunker` npm library | Crunker wraps AudioBuffer concat but adds a dependency for ~10 lines of code. Manual is preferred given zero-dependency policy. |
| CSS bars (static envelope) | Canvas-based FFT waveform | Canvas FFT requires `AnalyserNode` and requestAnimationFrame loop — adds complexity with no UX gain for a static demo. CSS bars with pre-computed amplitude array are correct. |

**Installation:**
```bash
npm install elevenlabs
```

**Version verification:**
```bash
npm view elevenlabs version
# → 1.59.0 (verified 2026-03-26)
```

---

## Architecture Patterns

### Recommended File Structure

```
src/app/
├── api/demo-voice/
│   └── route.js                    # NEW: POST — accepts businessName, returns MP3 buffer
├── components/landing/
│   ├── HeroSection.jsx             # MODIFY: swap CTA block, update title/subtitle
│   ├── RotatingText.jsx            # MODIFY: dynamic width via useRef + getBoundingClientRect
│   ├── HeroDemoInput.jsx           # NEW: client component, input + loading state
│   └── HeroDemoPlayer.jsx          # NEW: client component, waveform + playback
public/audio/
├── demo-intro.mp3                  # NEW: pre-rendered caller opening line
├── demo-mid.mp3                    # NEW: pre-rendered mid-conversation
└── demo-outro.mp3                  # NEW: pre-rendered booking confirmation
.env.local                          # ADD: ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID_AI, ELEVENLABS_VOICE_ID_CALLER
```

### Pattern 1: ElevenLabs TTS API Route

**What:** POST `/api/demo-voice` — accepts `{ businessName }`, calls ElevenLabs TTS with the greeting segment text, returns MP3 audio buffer as `audio/mpeg` response.

**When to use:** Called once per demo play, after user enters a business name and clicks "Listen to Your Demo".

```javascript
// Source: ElevenLabs REST API — https://elevenlabs.io/docs/api-reference/text-to-speech/convert
// Pattern mirrors: src/app/api/contact/route.js

export async function POST(request) {
  try {
    const { businessName } = await request.json();

    if (!businessName?.trim() || businessName.trim().length < 2) {
      return Response.json({ error: 'Business name required' }, { status: 400 });
    }

    const text = `Thanks for calling ${businessName.trim()}! This is your AI receptionist — I can get that scheduled for you right away.`;
    const voiceId = process.env.ELEVENLABS_VOICE_ID_AI;
    const apiKey = process.env.ELEVENLABS_API_KEY;

    const response = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
        },
        body: JSON.stringify({
          text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: { stability: 0.5, similarity_boost: 0.75 },
        }),
      }
    );

    if (!response.ok) {
      const err = await response.text();
      console.error('[demo-voice] ElevenLabs error:', err);
      return Response.json({ error: 'Voice generation failed' }, { status: 502 });
    }

    const audioBuffer = await response.arrayBuffer();
    return new Response(audioBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[demo-voice] Unexpected error:', error);
    return Response.json({ error: 'Failed to generate demo audio' }, { status: 500 });
  }
}
```

**Key points:**
- Direct `fetch()` to ElevenLabs REST API (simpler than SDK for a single route)
- Returns raw `audio/mpeg` binary — not JSON wrapping a URL
- `Cache-Control: no-store` — each business name generates a unique segment
- Error returns 502 (upstream API failure) vs 500 (our code failure) — allows client to distinguish
- Never expose `ELEVENLABS_API_KEY` to the client — server-only route

### Pattern 2: Web Audio API Buffer Stitching

**What:** Client-side audio stitching of four ArrayBuffers (3 static + 1 dynamic) into a single continuous AudioBuffer for gapless playback.

**When to use:** Inside `HeroDemoPlayer.jsx` after all segments are fetched.

```javascript
// Source: Web Audio API spec — https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
// Manual concatenation — no library required.

async function stitchAudioBuffers(audioContext, arrayBuffers) {
  // Decode all ArrayBuffers in parallel
  const decoded = await Promise.all(
    arrayBuffers.map((ab) => audioContext.decodeAudioData(ab.slice()))
  );

  const totalLength = decoded.reduce((sum, buf) => sum + buf.length, 0);
  const numberOfChannels = decoded[0].numberOfChannels;
  const sampleRate = decoded[0].sampleRate;

  const output = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

  let offset = 0;
  for (const buf of decoded) {
    for (let ch = 0; ch < numberOfChannels; ch++) {
      output.getChannelData(ch).set(buf.getChannelData(ch), offset);
    }
    offset += buf.length;
  }

  return output;
}
```

**Key points:**
- `decodeAudioData()` consumes (detaches) the ArrayBuffer — use `.slice()` to copy if needed elsewhere
- All buffers must be decoded before stitching — `Promise.all()` for parallel decode
- Assumes all segments are same sample rate (ElevenLabs `mp3_44100_128` guarantees 44100 Hz)
- `numberOfChannels` taken from first decoded buffer — all ElevenLabs outputs are stereo (2 channels)

### Pattern 3: HeroDemoInput State Machine

**What:** Client component managing `state: 'idle' | 'loading' | 'ready'`. On submit, fetches `/api/demo-voice` and parallel-fetches the three static MP3 segments from `/public/audio/`. Passes all four ArrayBuffers to `HeroDemoPlayer` on success.

```javascript
// Simplified state flow
const [state, setState] = useState('idle'); // 'idle' | 'loading' | 'ready'
const [audioBuffers, setAudioBuffers] = useState(null);
const [businessName, setBusinessName] = useState('');

async function handleSubmit() {
  if (businessName.trim().length < 2) return;
  setState('loading');

  try {
    const [nameRes, introRes, midRes, outroRes] = await Promise.all([
      fetch('/api/demo-voice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName: businessName.trim() }),
      }),
      fetch('/audio/demo-intro.mp3'),
      fetch('/audio/demo-mid.mp3'),
      fetch('/audio/demo-outro.mp3'),
    ]);

    if (!nameRes.ok) throw new Error('Demo voice generation failed');

    const [nameBuf, introBuf, midBuf, outroBuf] = await Promise.all([
      nameRes.arrayBuffer(),
      introRes.arrayBuffer(),
      midRes.arrayBuffer(),
      outroRes.arrayBuffer(),
    ]);

    // Order: intro -> dynamic name -> mid -> outro
    setAudioBuffers([introBuf, nameBuf, midBuf, outroBuf]);
    setState('ready');
  } catch (err) {
    toast.error("Couldn't generate your demo. Check your connection and try again.");
    setState('idle');
  }
}
```

### Pattern 4: Dynamic RotatingText Width

**What:** Replace the invisible-sizer span with a `useRef`-measured approach. After each `currentIndex` change, measure the rendered width of the new word and animate the container's `width` to it.

```javascript
// Source: D-19 in CONTEXT.md — replace lines 61-63 in RotatingText.jsx

const containerRef = useRef(null);
const measureRef = useRef(null); // hidden span, not aria-hidden — purely for measurement

useEffect(() => {
  if (!measureRef.current || !containerRef.current) return;
  const newWidth = measureRef.current.getBoundingClientRect().width;
  containerRef.current.style.width = `${newWidth}px`;
}, [currentIndex]);

// In JSX — replace the invisible sizer with:
// 1. A hidden measurement span (renders current word, positioned off-screen)
// 2. A transition on the container's width property

return (
  <span
    ref={containerRef}
    className={`relative inline-flex overflow-hidden whitespace-nowrap align-baseline transition-[width] duration-200 ease-in-out ${className}`}
    style={{ width: 'auto' }} // set initially; overridden by useEffect
    {...rest}
  >
    {/* Hidden measurement span — renders current word to measure its width */}
    <span
      ref={measureRef}
      className="invisible absolute pointer-events-none whitespace-nowrap"
      aria-hidden="true"
    >
      {texts[currentIndex]}
    </span>
    {/* AnimatePresence with absolute-positioned characters — same as current */}
    ...
  </span>
);
```

**Key nuance:** The `transition-[width]` class requires Tailwind v4 — supported in this project (`tailwindcss: ^4.2.2`). The `useReducedMotion` guard should skip the CSS transition by using `transition-none` when reduced motion is preferred. The existing RotatingText already checks `prefersReducedMotion` and returns a static span — the width transition must also respect this.

### Pattern 5: HeroDemoPlayer Waveform (CSS Bars)

**What:** Static amplitude envelope (pre-computed array of 40 values between 0.2 and 1.0) rendered as CSS bars. No live FFT. Bars before the playhead position are orange (`bg-[#F97316]`), bars after are dim (`bg-white/[0.15]`).

```javascript
// Static amplitude envelope — pre-computed to look like a real phone call
const WAVEFORM_BARS = 40;
const AMPLITUDE_ENVELOPE = Array.from({ length: WAVEFORM_BARS }, (_, i) => {
  // Simulate call pattern: quiet intro, louder conversation, quiet outro
  const normalized = i / WAVEFORM_BARS;
  return 0.2 + 0.6 * Math.sin(normalized * Math.PI) + 0.1 * Math.random();
});

// Progress tracking via AudioContext.currentTime
// Calculate playhead position as bar index:
const currentBarIndex = Math.floor((currentTime / totalDuration) * WAVEFORM_BARS);
```

**Why CSS bars over canvas FFT:**
- No `AnalyserNode` — no requestAnimationFrame loop — no GC pressure
- Static visual is sufficient for a pre-recorded demo (not live input)
- Simpler reduced-motion handling (hide bars, show plain text progress)
- AMPLITUDE_ENVELOPE can be seeded with deterministic noise for visual realism

### Anti-Patterns to Avoid

- **Streaming audio from the API route:** The API route returns the full MP3 buffer, not a stream. Streaming is unnecessary for a 2-5 second name segment and complicates Web Audio API integration.
- **Using `<audio>` HTML element for playback:** `<audio>` does not support seamless buffer stitching. Web Audio API's `AudioBufferSourceNode` is required for gapless playback.
- **Module-level AudioContext:** `AudioContext` must be created after user gesture (browser autoplay policy). Create `new AudioContext()` inside the click handler or on first play, not at module level.
- **SSR of HeroDemoPlayer:** Web Audio API is browser-only. `HeroDemoPlayer` must be loaded via `next/dynamic` with `ssr: false`, or rendered only after `state === 'ready'` inside a client component.
- **Exposing ELEVENLABS_API_KEY client-side:** The API key must only be used in the `/api/demo-voice` server-side route. Never pass it to the client.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| TTS API auth and request signing | Custom ElevenLabs fetch wrapper | `elevenlabs` npm SDK or direct fetch with `xi-api-key` header | Auth is trivial here — single header. Either approach is valid. |
| AudioBuffer gapless stitching | Custom ring buffer / streaming player | Web Audio API `createBuffer()` + channel data copy | Browser-native, zero-dependency, proven pattern for pre-loaded segments |
| Waveform amplitude visualization | Canvas FFT / `AnalyserNode` loop | Static pre-computed amplitude array + CSS bars | Demo is scripted/static — no live audio analysis needed |
| Loading spinner | Custom CSS spinner | `lucide-react` `Loader2` with `animate-spin` | Already in project, matches design system |
| Toast error feedback | Custom error UI | `sonner` `toast.error()` | Already wired in public layout, matches project pattern |

**Key insight:** The biggest temptation is to over-engineer the audio stack. This is a scripted 20-second demo — the entire audio pipeline fits in ~50 lines of Web Audio API code without any library.

---

## Common Pitfalls

### Pitfall 1: AudioContext Autoplay Block

**What goes wrong:** `new AudioContext()` created at module load or component mount is immediately suspended by the browser. `audioContext.state === 'suspended'` on all Chromium browsers when the context is not created during a user gesture.

**Why it happens:** Browser autoplay policy (since Chrome 66) blocks audio output until a user interaction occurs in the same call stack.

**How to avoid:** Create `new AudioContext()` inside the click handler for "Listen to Your Demo". Pass the context (or its reference) to the player. Alternatively, call `audioContext.resume()` inside the click handler before playback.

**Warning signs:** `audioContext.state === 'suspended'` after creation; `AudioBufferSourceNode.start()` silently does nothing.

### Pitfall 2: decodeAudioData Detaches the ArrayBuffer

**What goes wrong:** Calling `audioContext.decodeAudioData(arrayBuffer)` transfers ownership of the underlying ArrayBuffer. After the call, `arrayBuffer.byteLength === 0`. If you need the raw bytes again (e.g., for a second decode pass or caching), the buffer is gone.

**Why it happens:** Web Audio API spec — `decodeAudioData` uses "neutered" (detached) ArrayBuffer semantics.

**How to avoid:** Call `arrayBuffer.slice()` before passing to `decodeAudioData()` if you need to retain the original. For this use case (decode-once-and-stitch), pass the original directly — no copy needed.

**Warning signs:** `TypeError: Cannot perform %TypedArray%.prototype.set on a detached ArrayBuffer`.

### Pitfall 3: RotatingText Width Measurement Before Paint

**What goes wrong:** Calling `getBoundingClientRect()` inside a `useEffect` immediately after `currentIndex` changes may measure zero width if the hidden measurement span hasn't been laid out yet, or may measure the previous word's width.

**Why it happens:** React state updates and DOM layout are not synchronously coupled. `useLayoutEffect` is guaranteed to fire after DOM mutations but before paint.

**How to avoid:** Use `useLayoutEffect` instead of `useEffect` for the width measurement. This guarantees the DOM has been updated to the new word before measuring.

**Warning signs:** Width transitions to `0px` briefly; container collapses and then jumps; SSR warning about `useLayoutEffect` (suppress with `typeof window !== 'undefined'` guard or `dynamic` import of RotatingText).

### Pitfall 4: Static Files Not Accessible at /audio/ Path

**What goes wrong:** Files placed in `public/audio/` are served at `/audio/filename.mp3`. A `fetch('/audio/demo-intro.mp3')` returns 404 in production if the files were not committed or are only local.

**Why it happens:** Pre-rendered ElevenLabs audio segments need to be generated and committed to `public/audio/` as part of the build process, not generated at runtime.

**How to avoid:** Document the pre-render step clearly in the plan. The audio files must be generated once (via a one-time ElevenLabs TTS call), saved to `public/audio/`, and committed to the repository. These are build artifacts, not gitignored files.

**Warning signs:** 404 errors in browser network tab for `/audio/demo-*.mp3`.

### Pitfall 5: HeroSection is a Server Component

**What goes wrong:** `HeroDemoInput` and `HeroDemoPlayer` are client components with hooks and event handlers. Placing them directly as JSX inside `HeroSection` (a Server Component) causes a build error if they are not correctly declared `'use client'`.

**Why it happens:** Next.js App Router — Server Components cannot directly render Client Components that use hooks unless the client component declares `'use client'` at the top of its file.

**How to avoid:** Both `HeroDemoInput.jsx` and `HeroDemoPlayer.jsx` must have `'use client'` as their first line. `HeroDemoInput` is lazy-loaded in `HeroSection` via `next/dynamic` (consistent with how `RotatingText` and `SplineScene` are already handled). This also prevents SSR of Web Audio API code.

**Warning signs:** Build error: `You're importing a component that needs useState... but that import only works in a Client Component`.

### Pitfall 6: ElevenLabs Rate Limits on the Starter Plan

**What goes wrong:** The `/api/demo-voice` route can be called repeatedly by automated crawlers or bad actors. ElevenLabs Starter plan has rate limits that could be exhausted, blocking legitimate demo plays.

**Why it happens:** Public API route with no authentication or rate-limit gate.

**How to avoid:** Add basic server-side rate limiting. The simplest approach is an in-memory Map per IP (`request.headers.get('x-forwarded-for')`) with a cooldown of 10 seconds between demo requests per IP. This is sufficient for a landing page demo. For production hardening, add a `Math.min(businessName.length, 40)` character limit to cap TTS cost per request.

**Warning signs:** ElevenLabs 429 responses; unexpected quota consumption in ElevenLabs dashboard.

---

## Code Examples

### ElevenLabs TTS Route — Full Pattern

```javascript
// Source: ElevenLabs REST API documentation — https://elevenlabs.io/docs/api-reference/text-to-speech/convert
// File: src/app/api/demo-voice/route.js

export async function POST(request) {
  const { businessName } = await request.json();
  const clean = businessName?.trim();

  if (!clean || clean.length < 2 || clean.length > 100) {
    return Response.json({ error: 'Invalid business name' }, { status: 400 });
  }

  const text = `Thanks for calling ${clean}! This is your AI receptionist — I can get that scheduled for you right away.`;

  const ttsResponse = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVENLABS_VOICE_ID_AI}?output_format=mp3_44100_128`,
    {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY,
        'Content-Type': 'application/json',
        Accept: 'audio/mpeg',
      },
      body: JSON.stringify({
        text,
        model_id: 'eleven_multilingual_v2',
        voice_settings: { stability: 0.5, similarity_boost: 0.75 },
      }),
    }
  );

  if (!ttsResponse.ok) {
    return Response.json({ error: 'Voice generation failed' }, { status: 502 });
  }

  const buffer = await ttsResponse.arrayBuffer();
  return new Response(buffer, {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store' },
  });
}
```

### AudioContext Playback — Complete Implementation

```javascript
// Source: MDN Web Audio API — https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer
// Usage inside HeroDemoPlayer.jsx

async function loadAndPlayDemo(audioBuffers) {
  // Must be created inside user gesture handler (autoplay policy)
  const audioCtx = new AudioContext();

  // Decode all segments in parallel
  const decoded = await Promise.all(
    audioBuffers.map((ab) => audioCtx.decodeAudioData(ab.slice()))
  );

  // Concatenate decoded buffers
  const totalLength = decoded.reduce((sum, b) => sum + b.length, 0);
  const sampleRate = decoded[0].sampleRate;
  const channels = decoded[0].numberOfChannels;
  const combined = audioCtx.createBuffer(channels, totalLength, sampleRate);

  let offset = 0;
  for (const buf of decoded) {
    for (let ch = 0; ch < channels; ch++) {
      combined.getChannelData(ch).set(buf.getChannelData(ch), offset);
    }
    offset += buf.length;
  }

  // Create source node and play
  const source = audioCtx.createBufferSource();
  source.buffer = combined;
  source.connect(audioCtx.destination);

  const startTime = audioCtx.currentTime;
  source.start(0);

  source.onended = () => {
    // Notify player that audio has finished
    onAudioEnded();
  };

  // Track current time for progress bar
  // audioCtx.currentTime - startTime = elapsed seconds
  return { audioCtx, source, startTime, duration: combined.duration };
}
```

### RotatingText Width Fix — useLayoutEffect Pattern

```javascript
// Source: D-19 in CONTEXT.md — replaces lines 61-63 in RotatingText.jsx
// Uses useLayoutEffect (not useEffect) to measure before paint

import { useState, useEffect, useCallback, useMemo, useRef, useLayoutEffect } from 'react';

// Inside RotatingText component — after currentIndex state declaration:
const containerRef = useRef(null);
const measureRef = useRef(null);

useLayoutEffect(() => {
  if (!measureRef.current || !containerRef.current || prefersReducedMotion) return;
  const width = measureRef.current.getBoundingClientRect().width;
  if (width > 0) {
    containerRef.current.style.width = `${width}px`;
  }
}, [currentIndex, prefersReducedMotion]);

// In JSX:
return (
  <span
    ref={containerRef}
    className={`relative inline-flex overflow-hidden whitespace-nowrap align-baseline transition-[width] duration-200 ease-in-out ${className}`}
    {...rest}
  >
    {/* Measurement span — renders current word invisibly for width sampling */}
    <span
      ref={measureRef}
      className="invisible absolute pointer-events-none whitespace-nowrap"
      aria-hidden="true"
    >
      {texts[currentIndex]}
    </span>
    {/* AnimatePresence block — unchanged from current */}
    <AnimatePresence mode={animatePresenceMode} initial={animatePresenceInitial}>
      ...
    </AnimatePresence>
  </span>
);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| ElevenLabs monolingual v1 model | `eleven_multilingual_v2` | 2023 | Better naturalness, same latency |
| `AudioContext.decodeAudioData()` callback API | Promise-based `decodeAudioData()` | Chrome 36+ / all modern browsers | Use Promise form — cleaner async/await |
| `new webkitAudioContext()` | `new AudioContext()` | All modern browsers | No webkit prefix needed |

**Deprecated/outdated:**
- `eleven_monolingual_v1`: Still available but superseded by multilingual v2 for English use — v2 has better naturalness at same cost.
- `optimize_streaming_latency` query param: Still accepted by ElevenLabs API but deprecated in favor of `output_format` tuning.

---

## Open Questions

1. **ElevenLabs voice selection**
   - What we know: Phase 29 needs two voices — AI receptionist (female professional) + caller (male casual). Voice IDs are placeholders in UI-SPEC.
   - What's unclear: Specific voice IDs need to be selected from ElevenLabs voice library. The free-tier voice list and paid-tier list differ.
   - Recommendation: During implementation, use ElevenLabs Voices page to audition voices. Free Starter voices include "Rachel" (female, calm) and "Adam" (male, neutral). Store selected IDs as `ELEVENLABS_VOICE_ID_AI` and `ELEVENLABS_VOICE_ID_CALLER` in `.env.local`.

2. **Pre-render script execution**
   - What we know: Three static MP3 segments (`demo-intro.mp3`, `demo-mid.mp3`, `demo-outro.mp3`) must be generated once via ElevenLabs and committed to `public/audio/`.
   - What's unclear: Whether this happens via a one-time CLI script, a build-time script, or manually via the ElevenLabs UI.
   - Recommendation: Write a one-time Node.js script (`scripts/generate-demo-audio.js`) that calls ElevenLabs TTS for each segment and writes to `public/audio/`. Run once, commit the output. Document in plan.

3. **Rate limiting for /api/demo-voice**
   - What we know: Route is unauthenticated and publicly accessible.
   - What's unclear: Whether to implement IP-based rate limiting now or defer.
   - Recommendation: Implement simple in-memory IP rate limiting (one request per 10 seconds per IP) using a module-level Map. This is a landing page — not worth adding Redis for this.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API route, pre-render script | Yes | (project already runs) | — |
| `elevenlabs` npm package | `/api/demo-voice` route | No — not in package.json | 1.59.0 (latest) | Direct `fetch()` to ElevenLabs REST API (no package needed) |
| `ELEVENLABS_API_KEY` env var | `/api/demo-voice` route | No — not in .env.local | — | None — required for demo to work |
| `ELEVENLABS_VOICE_ID_AI` env var | `/api/demo-voice` and pre-render | No — not in .env.local | — | Use hardcoded placeholder during dev |
| `ELEVENLABS_VOICE_ID_CALLER` env var | Pre-render script only | No — not in .env.local | — | Use hardcoded placeholder during dev |
| Web Audio API | HeroDemoPlayer | Yes — native browser | All modern browsers | — |
| `public/audio/` directory | HeroDemoPlayer | No — directory doesn't exist | — | Must create + populate via pre-render script |
| framer-motion | Transitions | Yes — ^12.38.0 | 12.38.0 | — |
| sonner | Error toasts | Yes — ^2.0.7 | 2.0.7 | — |

**Missing dependencies with no fallback:**
- `ELEVENLABS_API_KEY` — must be obtained from ElevenLabs dashboard and added to `.env.local` before `/api/demo-voice` can function
- `public/audio/` MP3 files — must be pre-rendered and committed before the player can work end-to-end

**Missing dependencies with fallback:**
- `elevenlabs` npm package — plan uses direct `fetch()` to ElevenLabs REST API instead, which works identically for this use case and requires no additional install

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `package.json` scripts → `jest` |
| Quick run command | `npm test` |
| Full suite command | `npm run test:all` |

### Phase Requirements — Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| DEMO-01 | `/api/demo-voice` returns `audio/mpeg` for valid business name | unit | `npm test -- --testPathPattern=demo-voice` | No — Wave 0 |
| DEMO-02 | `/api/demo-voice` returns 400 for name < 2 chars | unit | `npm test -- --testPathPattern=demo-voice` | No — Wave 0 |
| DEMO-03 | `/api/demo-voice` returns 400 for missing body | unit | `npm test -- --testPathPattern=demo-voice` | No — Wave 0 |
| DEMO-04 | RotatingText width transitions on currentIndex change | manual-only | n/a | n/a — visual |
| DEMO-05 | HeroDemoInput button disabled until 2+ chars | manual-only | n/a | n/a — DOM interaction |
| DEMO-06 | Audio stitching produces correct total duration | manual-only | n/a | n/a — browser-only API |
| DEMO-07 | Error toast shown when API route returns error | manual-only | n/a | n/a — UI interaction |

**Note:** Most Phase 29 behaviors are UI/audio interactions that cannot be meaningfully Jest-tested in jsdom (Web Audio API is not available). API route tests are the only automatable unit tests.

### Sampling Rate
- **Per task commit:** `npm test` (passes with no tests — non-blocking)
- **Per wave merge:** `npm run test:all`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/api/demo-voice.test.js` — covers DEMO-01, DEMO-02, DEMO-03 (mock ElevenLabs fetch response)

---

## Project Constraints (from CLAUDE.md)

The following CLAUDE.md directives apply to this phase:

1. **Skill sync required:** After changes to `HeroSection.jsx`, `RotatingText.jsx`, `HeroDemoInput.jsx`, `HeroDemoPlayer.jsx`, or `/api/demo-voice/route.js`, update the `public-site-i18n` skill file to reflect the new hero architecture.
2. **The public-site-i18n skill** is the relevant architecture skill file for this phase. It must be kept in sync with the new component structure.
3. **Named exports:** All new components should use named exports (`export function HeroDemoInput`) — consistent with project pattern.
4. **API route pattern:** `export async function POST(request)` with `Response.json()` returns — consistent with `src/app/api/contact/route.js`.
5. **`'use client'` placement:** Must be the first line of `HeroDemoInput.jsx` and `HeroDemoPlayer.jsx`.
6. **Sonner for errors:** Use `toast.error()` from sonner (already in public layout's Toaster) — no custom error UI.

---

## Sources

### Primary (HIGH confidence)
- ElevenLabs REST API docs — `https://elevenlabs.io/docs/api-reference/text-to-speech/convert` — endpoint parameters, request format, output formats
- MDN Web Audio API — `https://developer.mozilla.org/en-US/docs/Web/API/AudioBuffer` — AudioBuffer concatenation pattern
- `src/app/api/contact/route.js` — API route pattern to mirror
- `src/app/components/landing/RotatingText.jsx` — current implementation, lines 61-63 (invisible sizer)
- `src/app/components/landing/HeroSection.jsx` — current hero structure, all elements to be replaced
- `package.json` — confirmed dependency inventory (elevenlabs absent, all others present)
- `.env.local` — confirmed env var inventory (ELEVENLABS_API_KEY absent)
- `.planning/phases/29-hero-section-interactive-demo/29-UI-SPEC.md` — complete visual/interaction contract

### Secondary (MEDIUM confidence)
- `npm view elevenlabs version` → 1.59.0 (confirmed via npm registry, 2026-03-26)
- ElevenLabs GitHub README (`github.com/elevenlabs/elevenlabs-js`) — SDK usage pattern, `textToSpeech.convert()` method signature
- tekos.net article on Next.js + ElevenLabs — direct `fetch()` pattern for API route, verified against official API docs

### Tertiary (LOW confidence)
- WebSearch: "Web Audio API concatenate buffers" — pattern for AudioBuffer stitching (manually verified against MDN spec)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages verified against npm registry and existing package.json
- Architecture: HIGH — built from direct inspection of existing codebase files and official API docs
- Pitfalls: HIGH — autoplay policy and decodeAudioData detachment are well-documented MDN caveats; RotatingText layout effect is derived from direct code inspection

**Research date:** 2026-03-26
**Valid until:** 2026-06-26 (ElevenLabs API is stable; Web Audio API spec is stable)
