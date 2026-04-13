# Phase 47: Landing — Objection-Busting, Repositioning, and Landing Polish — Research

**Researched:** 2026-04-13
**Domain:** Next.js landing page — new sections, copy edits, shadcn Accordion, framer-motion, `/api/public-chat` reuse, ScrollLinePath constraints
**Confidence:** HIGH (all findings from direct codebase inspection + prior v5.0 research artifacts)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Split emotional vs practical objections into two surfaces. OBJ-06 (identity/change-aversion) gets its own dedicated emotional section. OBJ-02, OBJ-03, OBJ-04, OBJ-05, OBJ-08, OBJ-09 consolidate into one "practical objections" grid section with multiple counter cards inside.
- **D-02:** Insertion point for all new sections is **after `</ScrollLinePath>` closing tag** (between ScrollLinePath and FinalCTASection) to preserve the copper SVG sine wave geometry. Never insert new children inside ScrollLinePath — EXCEPT for AfterTheCallStrip (D-05 / REPOS-03) which is the 3rd ScrollLinePath child.
- **D-03:** FAQ section (OBJ-01) sits **just above FinalCTASection** as the final doubt-catcher before the CTA.
- **D-04:** REPOS-04 (owner-control pull-quote) is a **standalone section between SocialProof and FAQ** — breathing-room placement creates a pause-moment before the final commitment ask.
- **D-05:** REPOS-03 pivots to a **"what happens after the call" extension strip** inserted as 3rd ScrollLinePath child (after FeaturesCarousel, before SocialProofSection). Shows: CRM lead created, SMS/email sent, calendar synced, recurring slot reserved, analytics updated.
- **D-06:** FAQ includes exactly 7 questions (locked): (1) "Does Voco sound robotic?" (2) "What happens if Voco gets a job detail wrong?" (3) "How much does Voco cost?" (4) "Does Voco actually understand my trade?" (5) "How long does setup really take?" (6) "What happens if Voco doesn't know an answer?" (7) "Can I listen to what Voco says on my calls?"
- **D-07:** FAQ tone: confident + specific, never defensive. State what Voco does directly. Use specific numbers (85% blind-test stat, escalation chain, 4-minute setup). Avoid defensive openers.
- **D-08:** Answer length: 2-3 sentences each. Links/CTAs inside answers allowed (max 2 across all 7 questions).
- **D-09:** Uses the existing Radix Accordion from shadcn/ui — already installed per CONTEXT.md. (Note: not yet installed — see Critical Finding below.)
- **D-10:** FAQ section includes a **right-side AI chat panel** beside the accordion (stacks below on mobile). Copy: "Still wondering? Ask Voco directly."
- **D-11:** Chat widget reuses the existing `/api/public-chat` route (already unauthenticated, no tenant required). No new backend needed.
- **D-12:** Chat widget feels integrated with FAQ, not a floating/popup chatbot.
- **D-13:** OBJ-02, OBJ-03, OBJ-04, OBJ-05, OBJ-08, OBJ-09 rendered as a consolidated "practical objections" grid section.
- **D-14:** Card visual treatment: illustration fallback to decorated Lucide icons if illustration production is not feasible (planner's judgment).
- **D-15:** OBJ-09 (trade specificity) uses a **trade icon grid + brief capability list** (plumbing/HVAC/electrical/handyman/roofing, icons + one-liner per trade).
- **D-16:** OBJ-02 card includes an **inline mini-audio player** with pre-recorded sample. CTA links back to hero voice demo.
- **D-17:** OBJ-04 (5-minute setup strip) is a **static 3-step visual** — forward number → set hours → live. AnimatedSection fade-up only.
- **D-18:** OBJ-03 (cost of inaction) renders as a stat block with $260,400/year figure vs Voco's starting price.
- **D-19:** REPOS-01 (hero H1 + subtitle): reframe to complement-not-replacement language. RotatingText element stays. Tone guardrails: "answers when you can't", "you stay in charge".
- **D-20:** REPOS-02 (FinalCTA subtitle): reinforce owner-control framing. Tone guardrail: "your rules, your schedule". Structure unchanged.
- **D-21:** REPOS-04 pull-quote text: planner drafts 2-3 candidates. Direction: "You set the rules. Voco follows them." or similar.
- **D-22:** Every new section wraps in existing `AnimatedSection` — no new animation library.
- **D-23:** Every new section matches warm-neutral background rhythm (alternates bg-white / bg-[#FAFAF9] / bg-[#F5F5F4] / bg-[#1C1412]).
- **D-24:** Every new section stacks to single column at 375px, md+ breakpoint introduces grid.

### Claude's Discretion

- Exact copy for OBJ cards (headline + counter + stat chip) — planner drafts, based on PROBLEMS.md counter text
- Exact FAQ answer copy for all 7 questions — planner drafts under D-07 + D-08 tone guardrails
- "What happens after the call" strip content — planner chooses 4-5 items from: CRM lead creation, SMS/email notification, Google/Outlook sync, recurring appointment spawning, analytics dashboard
- Chat widget visual polish (input styling, message bubble design) — planner chooses consistent with existing landing aesthetic
- Pull-quote text (REPOS-04) — planner drafts 2-3 candidates

### Deferred Ideas (OUT OF SCOPE)

- Revenue calculator on landing (OBJ-07) — already exists on `/pricing`. Not rebuilt.
- Illustration production pipeline — planner decides per-plan; full illustration system is out of scope for Phase 47.
- Real trade-specific call transcript/audio on OBJ-09 — deferred due to legal/privacy clearance.
- Mobile-specific section variant — Phase 47 enforces responsive reflow only; dedicated mobile-only sections are out of scope.
- Pop-up / floating chatbot on landing — rejected; chat lives inside FAQ section only.
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| OBJ-01 | FAQ accordion (≥7 questions) covering all PROBLEMS.md objections + identity/change-aversion, placed just above FinalCTASection | shadcn Accordion (needs install); 7 questions locked in D-06; API reuse confirmed |
| OBJ-02 | "Sounds robotic" counter section linking back to hero demo, including 85% blind-test stat | Inline audio player pattern; HeroDemoBlock anchor link established |
| OBJ-03 | "Cost of inaction" stat block with $260,400/year figure vs Voco starting price | PROBLEMS.md stat confirmed; no calculator needed |
| OBJ-04 | "5-minute setup" 3-step visual strip (forward number → set hours → live) | Static AnimatedSection pattern; no new deps |
| OBJ-05 | Trust/hybrid-backup badge row (human escalation, recorded calls, owner-controlled escalation) | Static badge pattern; consolidated into practical objections grid |
| OBJ-06 | Identity/change-aversion block with emotional copy framing Voco as complement | Dedicated emotional section, centered single-column layout |
| OBJ-08 | Before-vs-After workflow comparison strip | Consolidated into practical objections grid |
| OBJ-09 | Trade-specificity proof block (plumbing/HVAC/electrical terminology) | Trade icon grid + capability list (D-15); 5 Lucide icons |
| REPOS-01 | Hero H1 + subtitle copy reframe to complement-not-replacement language | HeroSection.jsx copy-only edit; RotatingText stays |
| REPOS-02 | FinalCTASection subtitle reinforces owner-control framing | FinalCTASection.jsx copy-only edit |
| REPOS-03 | 5-icon full-stack workflow positioning strip (after-the-call) | New component inserted as 3rd ScrollLinePath child |
| REPOS-04 | Owner-control emphasis pull-quote ("You set the rules. Voco follows them.") | Standalone dark section between SocialProof and FAQ |
| POLISH-11 | All new sections use AnimatedSection wrapper with useReducedMotion compliance + background rhythm | AnimatedSection.jsx confirmed; pattern verified |
| POLISH-12 | All new landing sections render single-column at 375px and grid/multi-column at md+ | Standard Tailwind responsive pattern; UI-SPEC contracts define exact breakpoints |
</phase_requirements>

---

## Summary

Phase 47 adds six new components to the landing page and modifies two existing ones (HeroSection + FinalCTASection copy). All new sections insert after the `</ScrollLinePath>` closing tag except AfterTheCallStrip (REPOS-03), which inserts as the 3rd ScrollLinePath child. The routing sequence after this phase is: Hero → ScrollLinePath{HowItWorks, FeaturesCarousel, AfterTheCallStrip, SocialProof} → IdentitySection → PracticalObjectionsGrid → OwnerControlPullQuote → FAQSection → FinalCTA.

The entire phase is frontend-only. The backend is already built: `/api/public-chat` already exists, is unauthenticated, already uses Groq Llama 4 Scout, and has IP rate limiting. The only non-trivial dependency issue is that the shadcn Accordion component is NOT installed despite CONTEXT.md stating it is — Wave 0 must run `npx shadcn add accordion` before the FAQ plan executes.

The critical ScrollLinePath constraint: AfterTheCallStrip goes INSIDE ScrollLinePath as its 3rd child. The SVG path geometry currently anchors on `#features` and `#testimonials` element IDs. Adding a section between FeaturesCarousel and SocialProofSection will increase the container height, pushing `#testimonials` further down. The ScrollLinePath re-measures on mount + 100ms + 1000ms delays, so the wave will self-correct geometrically — but the path's `testimonialsY` crossing point will be recalculated based on the actual DOM positions after render. No manual crossings array edit is needed as long as AfterTheCallStrip does NOT have `id="features"` or `id="testimonials"` on its section element.

**Primary recommendation:** Use dynamic imports with loading skeletons for all five new major sections. Copy all AnimatedSection/AnimatedStagger/AnimatedItem patterns verbatim from SocialProofSection. Install accordion before writing FAQSection.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| framer-motion | ^11 (already installed) | AnimatedSection fade-up, AnimatedStagger, AnimatedItem | All landing sections use this; `AnimatedSection.jsx` wraps it |
| shadcn/ui Accordion | (Radix) | FAQ collapsible UI | Decision D-09; all other shadcn components already used on landing |
| lucide-react | (already installed) | Icons for trade grid, step numbers, send button | Established icon library for entire landing page |
| Groq via OpenAI SDK | (already installed) | Chat widget backend | `/api/public-chat` already calls Groq Llama 4 Scout |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Next.js `dynamic()` | (already installed) | Lazy-load new sections with loading skeletons | Every new below-fold section |
| HTML `<audio>` | native | OBJ-02 inline mini audio player | No library needed; single play/pause toggle |
| React `useState` / `useRef` | native | Chat widget message state, audio player state | Client components only |

### Not Needed

| Problem | Don't Use | Use Instead |
|---------|-----------|-------------|
| FAQ accordion | Custom disclosure component | shadcn Accordion (Radix) |
| Chat widget API | New API route | Existing `/api/public-chat` (already anonymous, no changes) |
| Scroll animations | Raw `motion.div` | `AnimatedSection`, `AnimatedStagger`, `AnimatedItem` from `AnimatedSection.jsx` |
| Audio visualization | Web Audio API waveform | Static decorative CSS bars (D-16); only play/pause needed |

**Installation — the one missing piece:**

```bash
npx shadcn add accordion
```

Version verification — confirmed already installed packages via codebase inspection. The accordion is the only missing shadcn component for this phase.

---

## Architecture Patterns

### Route Order in `src/app/(public)/page.js` (post-phase)

```
<ScrollProgress />
<HeroSection />                     ← MODIFY: copy-only (REPOS-01)
<ScrollLinePath>
  <HowItWorksSection />             ← unchanged
  <FeaturesCarousel />              ← unchanged
  <AfterTheCallStrip />             ← NEW (REPOS-03) — 3rd ScrollLinePath child
  <SocialProofSection />            ← unchanged
</ScrollLinePath>
<IdentitySection />                 ← NEW (OBJ-06)
<PracticalObjectionsGrid />         ← NEW (OBJ-02/03/04/05/08/09)
<OwnerControlPullQuote />           ← NEW (REPOS-04)
<FAQSection />                      ← NEW (OBJ-01 + D-10 chat widget)
<FinalCTASection />                 ← MODIFY: copy-only (REPOS-02)
```

### Recommended Component File Structure

```
src/app/components/landing/
├── AfterTheCallStrip.jsx      ← NEW (REPOS-03) — Server Component, AnimatedSection
├── IdentitySection.jsx        ← NEW (OBJ-06) — Server Component, AnimatedSection
├── PracticalObjectionsGrid.jsx ← NEW (OBJ-02/03/04/05/08/09) — Server Component outer, 'use client' for audio player card
├── AudioPlayerCard.jsx        ← NEW (OBJ-02 inline audio) — 'use client' sub-component
├── OwnerControlPullQuote.jsx  ← NEW (REPOS-04) — Server Component, AnimatedSection
└── FAQSection.jsx             ← NEW (OBJ-01 + chat) — outer Server Component, 'use client' for chat widget
```

All new section files live in `src/app/components/landing/` (not `src/components/landing/` — two different directories exist; the former is the primary landing section location).

### Pattern 1: Dynamic Import with Loading Skeleton

**What:** All new below-fold sections use `dynamic()` with a loading skeleton matching the section's background and approximate height to prevent CLS.

**When to use:** Every new section added to `page.js`.

**Example:**

```jsx
// In src/app/(public)/page.js
const FAQSection = dynamic(
  () => import('@/app/components/landing/FAQSection').then((m) => m.FAQSection),
  {
    loading: () => (
      <section className="bg-white py-20 md:py-28 px-6" aria-hidden="true">
        <div className="max-w-5xl mx-auto">
          <div className="h-4 w-24 bg-black/10 rounded mx-auto mb-3" />
          <div className="h-8 w-72 bg-black/10 rounded mx-auto mb-12" />
          <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12">
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7].map((i) => (
                <div key={i} className="h-14 bg-black/5 rounded-lg" />
              ))}
            </div>
            <div className="h-[400px] rounded-2xl bg-black/5" />
          </div>
        </div>
      </section>
    ),
  }
);
```

### Pattern 2: AnimatedSection / AnimatedStagger / AnimatedItem

**What:** All new section content wraps in these components from `AnimatedSection.jsx`. Never use raw `motion.div` — it bypasses `useReducedMotion`.

**Example for a grid section:**

```jsx
// Source: src/app/components/landing/SocialProofSection.jsx (existing pattern)
import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';

export function PracticalObjectionsGrid() {
  return (
    <section className="bg-[#FAFAF9] py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          {/* eyebrow + H2 */}
        </AnimatedSection>
        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
          {cards.map((card) => (
            <AnimatedItem key={card.id}>
              {/* card content */}
            </AnimatedItem>
          ))}
        </AnimatedStagger>
      </div>
    </section>
  );
}
```

### Pattern 3: Server Component with 'use client' Sub-Component

**What:** New section files are Server Components (no `'use client'` directive) for static marketing content. Only interactive sub-components (audio player, chat widget) are client components.

**When to use:** FAQSection outer shell and PracticalObjectionsGrid outer shell are Server Components. AudioPlayerCard.jsx and the chat panel inside FAQSection are `'use client'`.

**Why:** Keeps bundle size smaller; static content renders at the server and only interactive islands hydrate on client.

### Pattern 4: Chat Widget Uses `/api/public-chat` As-Is

**What:** The existing `/api/public-chat` route is already anonymous, rate-limited, and powered by Groq Llama 4 Scout. The FAQ chat widget POSTs to this same endpoint. No backend changes needed.

**Exact endpoint contract:**
- POST `/api/public-chat`
- Body: `{ message: string, currentRoute?: string, history?: Array }`
- Response: `{ reply: string }` or `{ error: string }` with 429/400/503
- Rate limit: 5s per IP, 1000/day global cap

**Chat widget state machine:**
1. Empty state: show 3 suggestion chips
2. User sends: chips disappear, append user bubble, disable input, show loading bot bubble
3. Response arrives: replace loading with bot bubble, re-enable input, auto-scroll to bottom
4. Error (429 / 503 / network fail): show error bot bubble "Couldn't connect right now — try refreshing the page."

### Pattern 5: Eyebrow Pill + Section H2 (Existing Pattern)

**What:** All landing sections open with an eyebrow pill (orange uppercase label) + an H2. This pattern is in SocialProofSection and FeaturesCarousel.

```jsx
// Source: existing SocialProofSection.jsx pattern
<p className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">
  Eyebrow Label
</p>
<h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] leading-tight tracking-tight">
  Section Heading
</h2>
```

### Pattern 6: Stat Chip (Existing Pattern — Testimonials)

**What:** Small rounded pill with green background for metric badges. Used in SocialProofSection testimonials.

```jsx
// Source: src/app/components/landing/SocialProofSection.jsx (metric badge)
<span className="inline-flex items-center gap-1 px-3 py-2 rounded-full bg-[#166534]/10 border border-[#166534]/20 text-[14px] font-semibold text-[#166534]">
  {metric}
</span>
```

### Pattern 7: AfterTheCallStrip Inside ScrollLinePath

**What:** REPOS-03 inserts as the 3rd child of ScrollLinePath between FeaturesCarousel and SocialProofSection. The SVG wave will still work because ScrollLinePath measures the container on mount + re-measures after 100ms and 1000ms. AfterTheCallStrip must NOT have `id="features"` or `id="testimonials"` on its section element — those IDs are measurement anchors for the SVG path.

**AfterTheCallStrip section element:**
```jsx
// NO id attribute here — let ScrollLinePath's existing IDs remain on features and testimonials
<section className="bg-white py-12 md:py-16 px-6">
```

### Anti-Patterns to Avoid

- **Raw `motion.div` in new sections:** Bypasses `useReducedMotion`. Only use `AnimatedSection`, `AnimatedStagger`, `AnimatedItem`.
- **`relative` on the `<section>` element inside ScrollLinePath:** CSS stacking requires sections be non-positioned. Only the inner content `<div>` gets `relative z-[1]`. Violating this breaks the SVG line.
- **Inserting sections inside ScrollLinePath except AfterTheCallStrip:** The sine wave anchors on `#features` and `#testimonials`. New sections after FeaturesCarousel would push `#testimonials` and misalign the wave unless they are correctly between those two.
- **Importing more than 5 distinct section components in `page.js`:** A count warning from PITFALLS.md. After this phase, the page will have: HeroSection (static), plus 6 new dynamic sections + 3 existing ScrollLinePath children + FinalCTA = acceptable since 5 were already there; the real concern is FinalCTA must remain last.
- **Hardcoded semantic tokens in new landing sections:** New sections must use hardcoded hex (e.g., `bg-[#FAFAF9]`), not `bg-background` or `bg-card`. Dark mode scopes to dashboard only.
- **Defensive objection headings:** No heading that mirrors the fear back. "Worried Voco sounds robotic?" → wrong. Lead with the positive assertion and then the proof.
- **Semantic `font-medium` (weight 500):** UI-SPEC bans this in Phase 47. Use only weight 400 (regular) or weight 600 (semibold).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| FAQ accordion expand/collapse | Custom disclosure state + animation | shadcn Accordion (Radix) | Keyboard nav, aria-expanded, animation, focus management all built in |
| Chat API (anonymous visitors) | New Express route / new Next.js API | `/api/public-chat` as-is | Already anonymous, already rate-limited, already integrated |
| Scroll-triggered section animations | Raw `motion.div whileInView` | `AnimatedSection` / `AnimatedStagger` | `useReducedMotion` guard is built in; raw motion.div skips it |
| Audio waveform visualization | Web Audio API FFT waveform | Static CSS bars (decorative, `@keyframes` pulse) | D-16 explicitly says "static decorative bars"; Web Audio is heavy and unnecessary |
| Section entrance animations | New framer-motion config | Existing `AnimatedSection` props (direction, delay) | Re-invention costs time and risks missing reduced-motion guard |

**Key insight:** This phase is almost entirely composition + content. Every animation, API, and UI primitive already exists in the codebase. The risk is not missing a library — it is accidentally rewriting something that already works.

---

## Common Pitfalls

### Pitfall 1: Accordion Not Installed

**What goes wrong:** Plan tasks try to use shadcn `Accordion` in FAQSection but the component file doesn't exist. The module import fails and the build breaks.

**Why it happens:** CONTEXT.md D-09 says "already installed" but direct inspection of `src/components/ui/` confirms accordion is NOT in the directory. The other components listed in UI-SPEC (badge, button, card, input, separator, sheet, skeleton, sonner, tooltip) are all present. Accordion is missing.

**How to avoid:** Wave 0 must run `npx shadcn add accordion` before any plan that touches FAQSection.

**Warning signs:** `src/components/ui/accordion.jsx` does not exist before Wave 0 runs.

---

### Pitfall 2: AfterTheCallStrip Breaks ScrollLinePath If Given Section ID `features` or `testimonials`

**What goes wrong:** AfterTheCallStrip gets an `id="after-call"` and the section renders between FeaturesCarousel and SocialProofSection. Fine. But if a developer accidentally uses `id="features"` or `id="testimonials"` on it (copying from another section), ScrollLinePath's `document.getElementById` calls in `measure()` return the wrong element, and the wave anchor points misalign.

**Why it happens:** ScrollLinePath anchors on two specific IDs: `#features` and `#testimonials`. FeaturesCarousel has `id="features"` and SocialProofSection has `id="testimonials"`. AfterTheCallStrip must use a neutral ID or no ID.

**How to avoid:** AfterTheCallStrip uses `id="after-call"` or no ID. Never `id="features"` or `id="testimonials"`.

**Warning signs:** The copper sine wave ends abruptly or the Features dot appears in the wrong vertical position after AfterTheCallStrip is added.

---

### Pitfall 3: Chat Widget History Accumulates In-Memory

**What goes wrong:** The chat widget passes `history` (previous messages) to `/api/public-chat` to maintain conversation context. If the visitor sends many messages, the history array grows unbounded. The API already trims to last 10 messages server-side (`history.slice(-10)`), but the client must also manage state to avoid sending a 200-message history array in each POST body.

**Why it happens:** Simple `useState` array appending without a client-side cap.

**How to avoid:** Client `history` state cap at 20 entries. Slice before each POST: `history.slice(-10)`. The API already does this server-side, but a client-side cap prevents oversized request payloads.

---

### Pitfall 4: Defensive Copy in Headings Signals Guilt

**What goes wrong:** OBJ card headings and identity section copy mirrors the fear back. "Worried Voco sounds robotic?" triggers skepticism more than silence would.

**Why it happens:** Drafters write directly to the Reddit quote from PROBLEMS.md. The framing becomes reactive.

**How to avoid:** Lead with the positive assertion. "85% of callers can't tell it's AI" beats "Worried it sounds robotic? It doesn't." No heading should mention the fear it's countering.

**Warning signs:** Any heading containing: "worry", "concern", "robotic" (in a heading context), "might be wondering", "but what", "afraid", "don't think".

---

### Pitfall 5: `relative` on `<section>` Inside ScrollLinePath Hides the SVG Line

**What goes wrong:** AfterTheCallStrip.jsx uses `<section className="relative ...">` — adding `relative` to the section element places it in a stacking context above z-index 0 (the SVG), which means the SVG line draws but is hidden behind the section background.

**Why it happens:** Developers reflexively add `relative` to sections that need positioned children.

**How to avoid:** The section element must be non-positioned. Only the inner content `<div>` gets `relative z-[1]`. This is the CSS stacking contract documented in scroll-line-path skill: section bg (non-positioned) → SVG (absolute z-0) → content (relative z-1+).

```jsx
// CORRECT pattern for sections inside ScrollLinePath
<section className="bg-white py-12 md:py-16 px-6">
  {/* no relative on section */}
  <div className="relative z-[1] max-w-5xl mx-auto">
    {/* content */}
  </div>
</section>
```

---

### Pitfall 6: OBJ-02 Audio Player Competing with HeroDemoBlock

**What goes wrong:** Visitor has HeroDemoBlock playing in the hero and scrolls down to the OBJ-02 inline audio player. Both play simultaneously, causing audio overlap.

**Why it happens:** Two independent `<audio>` elements on the page with no coordination.

**How to avoid:** UI-SPEC specifies: "Only one audio source per page plays at a time — pause hero demo if this plays, and vice versa." Check if `HeroDemoBlock` / `HeroDemoPlayer` exposes a pause ref or event. If not, use a simple `window.vocoAudioRef` pattern or a module-level singleton that both components can call. AudioPlayerCard.jsx must call pause on any other playing audio before starting its own.

---

### Pitfall 7: Chat Widget Input Not Disabled During Loading

**What goes wrong:** User sends a message, bot is responding, user sends another message immediately. The API call overlap produces out-of-order responses.

**Why it happens:** Chat widget input is not disabled while `isLoading === true`.

**How to avoid:** `isLoading` state: disable input, disable send button, show Loader2 spinner on send button, show "..." loading bot bubble. Re-enable only when response arrives.

---

### Pitfall 8: Section Background Adjacency Violations

**What goes wrong:** Two same-color sections appear adjacent (e.g., OBJ-06 and SocialProofSection both `bg-white`).

**Why it happens:** Developer chooses a background color without checking the section above.

**How to avoid:** The UI-SPEC background rhythm table is the canonical reference. Check it before setting any new section's background. Two dark sections adjacent (REPOS-04 `bg-[#1C1412]` + FinalCTA `bg-[#1C1412]`) is intentional — this is the only planned exception.

**Background rhythm (post-phase):**

| Section | Background |
|---------|-----------|
| Hero | `#050505` dark |
| HowItWorks (ScrollLinePath) | bg-white / bg-[#FAFAF9] alternating |
| FeaturesCarousel (ScrollLinePath) | bg-[#FAFAF9] |
| AfterTheCallStrip (ScrollLinePath NEW) | bg-white |
| SocialProof (ScrollLinePath) | bg-[#F5F5F4] |
| IdentitySection (NEW) | bg-white |
| PracticalObjectionsGrid (NEW) | bg-[#FAFAF9] |
| REPOS-04 PullQuote (NEW) | bg-[#1C1412] dark |
| FAQSection (NEW) | bg-white |
| FinalCTA | bg-[#1C1412] dark |

---

## Code Examples

### Eyebrow + H2 Pattern (existing)

```jsx
// Source: existing SocialProofSection.jsx
<p className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">
  What Our Customers Say
</p>
<h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] leading-tight tracking-tight">
  Real results from real trades
</h2>
```

### Card with Hover Effect (UI-SPEC)

```jsx
<div className="rounded-2xl bg-white border border-stone-200/60 shadow-sm p-6 flex flex-col gap-4 hover:border-[#F97316]/30 hover:shadow-[0_4px_20px_rgba(249,115,22,0.1)] hover:-translate-y-1 transition-all duration-200">
  {/* icon + headline + body + optional stat chip */}
</div>
```

### Stat Chip (UI-SPEC, from existing testimonials)

```jsx
<span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-[#166534]/10 border border-[#166534]/20 text-[14px] font-semibold text-[#166534]">
  85% can't tell it's AI — 2025 blind test
</span>
```

### FAQ Accordion Section Skeleton

```jsx
// 'use client' needed for accordion interactions via Radix
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';

// type="single" collapsible — only one item open at a time
<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="q1" className="border-b border-stone-200/60">
    <AccordionTrigger className="text-[15px] font-semibold text-[#0F172A] py-4 text-left min-h-[44px] hover:no-underline">
      Does Voco sound robotic?
    </AccordionTrigger>
    <AccordionContent className="text-[15px] text-[#475569] leading-relaxed pb-4">
      {/* 2-3 sentence answer */}
    </AccordionContent>
  </AccordionItem>
  {/* 6 more items */}
</Accordion>
```

### Chat Widget POST Pattern

```jsx
// 'use client' component
const sendMessage = async (text) => {
  setIsLoading(true);
  setMessages(prev => [...prev, { role: 'user', content: text }]);
  try {
    const res = await fetch('/api/public-chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: text,
        currentRoute: '/',
        history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    setMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
  } catch {
    setMessages(prev => [...prev, {
      role: 'assistant',
      content: "Couldn't connect right now — try refreshing the page."
    }]);
  } finally {
    setIsLoading(false);
  }
};
```

### Hero H1 Copy Update (REPOS-01)

Current copy:
```jsx
// HeroSection.jsx lines 53-66
<h1>Let Voco Handle Your <RotatingText texts={['Phone Calls', 'Bookings', 'Invoices', 'Paperwork']} /></h1>
<p>Your AI receptionist answers every call, books jobs, and captures leads — 24/7, in 70+ languages.</p>
```

Required direction (planner drafts final copy):
- H1 must retain RotatingText element
- Tone: "answers when you can't" / "you stay in charge"
- Sample: "Voco Handles Your [RotatingText] — So You Can Focus on the Job"
- Subtitle must reinforce complement framing: something like "Voco answers when you're on the roof, in a crawlspace, or running on 4 hours sleep. You stay in control of every job."

### FinalCTA Copy Update (REPOS-02)

Current subtitle:
```jsx
<p className="text-lg text-[#A1A1AA] mb-10 max-w-md mx-auto leading-relaxed">
  Set up your AI receptionist in 5 minutes. No tech skills needed. No credit card required.
</p>
```

Required update (planner drafts final copy):
- Reinforce owner-control: "your rules, your schedule" tone guardrail
- H2 "Your next emergency call is tonight." stays
- Subtitle update only

### REPOS-04 Pull-Quote Section

```jsx
<section className="relative overflow-hidden py-20 md:py-24 px-6">
  <div className="absolute inset-0 bg-[#1C1412]" />
  <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.10),transparent_60%)]" />
  <div className="relative max-w-2xl mx-auto text-center">
    <AnimatedSection>
      <p className="text-[24px] md:text-[30px] font-semibold text-white leading-tight">
        "You set the rules. Voco follows them."
      </p>
      <p className="text-[14px] text-white/50 italic mt-4">
        — [attribution line, planner drafts]
      </p>
    </AnimatedSection>
  </div>
</section>
```

---

## ScrollLinePath Technical Detail

The SVG measures two anchor points:
1. `#features` element → `featuresY` → dot position at `featuresY + 60`
2. `#testimonials` element → `testimonialsY` → wave crossing point

Adding AfterTheCallStrip between FeaturesCarousel and SocialProofSection increases `testimonialsY` (because SocialProofSection is pushed down). The wave self-corrects because ScrollLinePath re-measures on mount + 100ms + 1000ms delays. The path is built dynamically from actual pixel coordinates, not hardcoded values.

**Risk:** If AfterTheCallStrip uses heavy dynamic imports that load after the 1000ms re-measure delay, `testimonialsY` may be wrong. Mitigate by triggering an additional `measure()` after AfterTheCallStrip is fully loaded, or by making AfterTheCallStrip a Server Component (renders synchronously).

**Safe approach:** Make AfterTheCallStrip a Server Component (no `'use client'`) — it is purely static content (5 icons + labels), so it needs no client state. Server-rendered content is in the DOM before the 100ms measure delay fires.

---

## Environment Availability

Step 2.6: Inspected dependencies via codebase. Phase 47 has no new external runtime dependencies.

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Next.js dynamic() | All new sections | ✓ | Already installed | — |
| framer-motion | AnimatedSection | ✓ | Already installed | — |
| lucide-react | Trade icons, step badges, send icon | ✓ | Already installed | — |
| shadcn Accordion | FAQSection | ✗ | NOT installed | Run `npx shadcn add accordion` in Wave 0 |
| /api/public-chat | Chat widget | ✓ | Already deployed | — |
| GROQ_API_KEY env var | Chat widget (via public-chat) | ✓ | Already set (route confirmed active) | — |
| HTML `<audio>` | OBJ-02 mini player | ✓ | Native browser API | — |
| Pre-recorded audio sample | OBJ-02 inline player | ✗ | Needs to be created/placed | Static .mp3 file in `public/audio/` |

**Missing dependencies with no fallback:**
- `src/components/ui/accordion.jsx` — must be installed via `npx shadcn add accordion` before FAQSection plan executes

**Missing with known solution:**
- Pre-recorded audio sample for OBJ-02 inline player — planner specifies source/path; can use an excerpt from existing `demo-intro.mp3` / `demo-mid.mp3` / `demo-outro.mp3` in `public/audio/` as a fallback if no dedicated sample is available

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `package.json` (test script: `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`) |
| Quick run command | `npm test -- tests/unit/` |
| Full suite command | `npm test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| OBJ-01 | FAQ renders 7 questions; accordion is accessible (type single, collapsible) | visual/manual | Manual browser inspection | ❌ Wave 0 |
| OBJ-02 | Audio player plays/pauses; stops other audio | manual | Manual browser | ❌ Wave 0 |
| OBJ-03 | $260,400 stat visible on page | smoke | `npm test -- tests/unit/landing-sections.test.js` | ❌ Wave 0 |
| OBJ-04 | 3-step setup strip renders 3 steps in correct order | smoke | Same file | ❌ Wave 0 |
| OBJ-05 | Trust badge row renders escalation chain + recordings + owner control | smoke | Same file | ❌ Wave 0 |
| OBJ-06 | Identity section renders complement framing copy | smoke | Same file | ❌ Wave 0 |
| OBJ-08 | Before/after workflow comparison visible | smoke | Same file | ❌ Wave 0 |
| OBJ-09 | Trade icon grid shows 5 trades | smoke | Same file | ❌ Wave 0 |
| REPOS-01 | H1 no longer says "Let Voco Handle" (old replacement framing) | smoke | `npm test -- tests/unit/landing-sections.test.js` | ❌ Wave 0 |
| REPOS-02 | FinalCTA subtitle contains owner-control language | smoke | Same file | ❌ Wave 0 |
| REPOS-03 | After-the-call strip shows ≥4 workflow items | smoke | Same file | ❌ Wave 0 |
| REPOS-04 | Pull-quote section renders on dark background | smoke | Same file | ❌ Wave 0 |
| POLISH-11 | No raw `motion.div` in new landing files | unit | `grep -r "motion\.div" src/app/components/landing/` excludes known files | Manual grep |
| POLISH-12 | All new sections have `flex flex-col` + `md:grid` (or equivalent) pattern | manual | Manual 375px viewport test | Manual |
| D-11 (chat) | `/api/public-chat` returns `{ reply }` for anonymous POST | unit | `npm test -- tests/unit/public-chat-api.test.js` | ❌ Wave 0 |

**Note on testing strategy:** This phase is predominantly UI/static content. Most requirements are verifiable by visual inspection in the browser. The smoke tests above validate content presence (e.g., $260,400 appears in rendered HTML), not interactive behavior. The most testable thing is the `/api/public-chat` route — and it already exists and works.

### Sampling Rate

- **Per task commit:** `npm test -- tests/unit/ --passWithNoTests`
- **Per wave merge:** `npm test`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps

- [ ] `npx shadcn add accordion` — installs `src/components/ui/accordion.jsx`
- [ ] `tests/unit/landing-sections.test.js` — smoke tests for content presence in new section exports
- [ ] `tests/unit/public-chat-api.test.js` — unit test confirming `/api/public-chat` accepts anonymous POST and returns `{ reply }` (may already be covered by existing integration tests — verify before creating)

---

## Project Constraints (from CLAUDE.md)

| Directive | Impact on Phase 47 |
|-----------|---------------------|
| Brand name is Voco — not HomeService AI | All new copy in FAQ answers, section headings, and pull-quote must say "Voco" not "HomeService AI" |
| Keep skills in sync after changes | After Phase 47, update `public-site-i18n` SKILL.md to reflect new sections + file map additions |
| Landing page uses hardcoded hex colors (intentional — immune to dark mode) | All new section backgrounds must use hardcoded hex values, not semantic tokens like `bg-background` |
| `src/app/components/landing/` is primary landing component location | All new component files go in this directory, not `src/components/landing/` |
| shadcn/ui (new-york preset, neutral, radix primitives) | Accordion must be installed via `npx shadcn add accordion` to match existing preset |
| framer-motion already installed; no new animation libs | AnimatedSection/AnimatedStagger/AnimatedItem are the only animation wrappers to use |

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Objection-busting as wall-of-text paragraphs | Proof-first: number/stat as primary visual, copy as caption | 2024-2025 SaaS conversion best practice | Higher scan-readability for contractor demographic |
| Floating chatbot widget over landing | Embedded chat panel inside FAQ section | Decision D-12 (Phase 47) | Avoids mode confusion with HeroDemoBlock audio demo |
| Full pricing table on landing | Stat block with link to pricing page | Decision OBJ-07 out of scope | Defers price anchoring until trust is built; /pricing page already has ROICalculator |

---

## Open Questions

1. **Pre-recorded audio sample for OBJ-02**
   - What we know: HeroDemoBlock uses `public/audio/demo-intro.mp3`, `demo-mid.mp3`, `demo-outro.mp3`
   - What's unclear: Whether a dedicated short AI voice sample exists or needs to be produced for the inline mini-player
   - Recommendation: Planner specifies audio path; if no dedicated file exists, use `demo-intro.mp3` as the sample (it is a pre-rendered caller opening line that demonstrates the AI voice clearly)

2. **AfterTheCallStrip audio file path for OBJ-02 alternative: none needed**
   - What we know: OBJ-02 is in PracticalObjectionsGrid, not AfterTheCallStrip. These are separate sections.
   - This question is resolved: AfterTheCallStrip has no audio.

3. **`npx shadcn add accordion` execution timing**
   - What we know: Accordion is missing from `src/components/ui/`
   - Recommendation: Wave 0, first task, before any component file that imports accordion is written

---

## Sources

### Primary (HIGH confidence)

- Direct codebase inspection of `src/app/(public)/page.js` — confirmed current ScrollLinePath children (3: HowItWorks, FeaturesCarousel, SocialProof)
- Direct codebase inspection of `src/components/ui/` — confirmed accordion NOT installed; all other Phase 47 shadcn deps present
- Direct codebase inspection of `src/app/api/public-chat/route.js` — confirmed anonymous endpoint, Groq Llama 4 Scout, rate limiting, response shape
- Direct codebase inspection of `src/app/components/landing/AnimatedSection.jsx` — confirmed AnimatedSection/AnimatedStagger/AnimatedItem exports and useReducedMotion pattern
- Direct codebase inspection of `src/app/components/landing/ScrollLinePath.jsx` — confirmed ID anchor points (#features, #testimonials), re-measure timing (100ms + 1000ms), AfterTheCallStrip insertion safety
- Direct codebase inspection of `src/app/components/landing/HeroSection.jsx` — confirmed current H1 "Let Voco Handle Your", subtitle, RotatingText structure
- Direct codebase inspection of `src/app/components/landing/FinalCTASection.jsx` — confirmed current subtitle copy and structure
- `.planning/phases/47-landing-objection-busting-repositioning-and-landing-polish/47-CONTEXT.md` — locked decisions
- `.planning/phases/47-landing-objection-busting-repositioning-and-landing-polish/47-UI-SPEC.md` — visual/interaction contract
- `My Prompts/PROBLEMS.md` — 5 objections + counters + identity bonus objection (PRIMARY SOURCE for copy)
- `.planning/research/PITFALLS.md` — tone pitfalls, ScrollLinePath breakage risk, AnimatedSection usage requirement (all HIGH confidence, code-verified)
- `.claude/skills/scroll-line-path/SKILL.md` — ScrollLinePath architecture, CSS stacking contract
- `.claude/skills/public-site-i18n/SKILL.md` — file map, component locations, public chat architecture

### Secondary (MEDIUM confidence)

- `.planning/research/FEATURES.md` — feature landscape; section order recommendations; anti-features
- `.planning/research/ARCHITECTURE.md` — insertion points; dynamic import pattern; component inventory

### Tertiary (LOW confidence)

- PROBLEMS.md "85–95% blind test" stat — cited from 2025 research but exact study not linked; the UI-SPEC locks the copy as "85%" so use that number regardless of exact source
- "$260,400/year" figure from PROBLEMS.md — mathematical derivation (42 calls/mo × 74% miss rate × $1,000 avg job × 12 months); treat as marketing claim, not audited statistic

---

## Metadata

**Confidence breakdown:**

- Standard stack: HIGH — all verified by direct file inspection
- Architecture: HIGH — page.js, ScrollLinePath, AnimatedSection all directly inspected
- Pitfalls: HIGH — code-verified from PITFALLS.md + direct code reads
- Accordion missing: HIGH — `src/components/ui/` directory listed, accordion absent
- Chat widget reuse: HIGH — `/api/public-chat` directly read and confirmed anonymous

**Research date:** 2026-04-13
**Valid until:** 2026-05-13 (30-day stability; all dependencies are project-internal or long-stable)
