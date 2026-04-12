# Pitfalls Research

**Domain:** SaaS landing page trust-building + dark mode retrofit + UI/UX polish (Next.js + Tailwind + shadcn + framer-motion)
**Researched:** 2026-04-13
**Confidence:** HIGH (code-verified where marked; MEDIUM for framer-motion/recharts dark mode specifics based on official docs + community patterns)

---

## Critical Pitfalls

### Pitfall 1: Defensiveness Signals Guilt

**What goes wrong:**
The objection-busting sections read like a company under attack rather than a confident market leader. Visitors who had no specific fear get one planted by the copy. "No, we're NOT robotic" triggers skepticism more than silence would.

**Why it happens:**
Founders write directly to the customer quote they found on Reddit. The framing becomes reactive ("you think X but actually...") instead of proof-first ("here's what happens when you use Voco"). The PROBLEMS.md objections are research artifacts, not headline copy.

**How to avoid:**
Never mirror the fear back at the visitor. Instead, demonstrate the counter with evidence: show a waveform, a booking confirmation, a "4-minute setup" timer. Write the section heading to the outcome, not the objection. "Voco sounds like a real person — here's proof" beats "Worried AI sounds robotic? It doesn't." Bury the objection language and lead with the positive assertion.

**Warning signs:**
Any heading that starts with "You might be wondering...", "But what about...", "Many contractors worry...", or any copy that mentions "AI" and "robotic" in the same sentence.

**Phase to address:**
Whichever phase writes the landing copy. Do a pass specifically asking: "Would this sentence exist if there were no objection?" If yes, keep it. If it only exists as a rebuttal, rewrite it as a standalone claim.

---

### Pitfall 2: Section Proliferation Buries the CTA

**What goes wrong:**
Adding six objection-busting sections between HowItWorks and FinalCTA means the conversion moment (AuthAwareCTA) appears 80%+ of the way down the page — after most visitors have already bounced or made their decision. The page now has 7 scroll regions with no momentum funnel.

**Why it happens:**
Each objection feels equally important. The natural response is to give each equal visual weight and sequence them one after another. The scroll experience becomes a list, not a story.

**How to avoid:**
The existing page structure is: Hero → HowItWorks → FeaturesCarousel → SocialProof → FinalCTA. Any new objection content must be embedded inside an existing section (e.g., a collapsible FAQ block inside SocialProof, proof stats inside FeaturesCarousel) or collapsed into a single "Why Voco" section that addresses all 5 objections in tabs or accordions. The FinalCTA must remain the last thing a visitor sees before footer. Do not insert a new top-level section after SocialProof.

**Warning signs:**
The `page.js` in `src/app/(public)/page.js` imports more than 5 distinct section components. The FinalCTASection is not the penultimate element before footer.

**Phase to address:**
Landing page architecture phase. The page composition in `page.js` is the enforcement point — treat it as the gate.

---

### Pitfall 3: Tone Mismatch Between Sections

**What goes wrong:**
The existing landing page tone is confident, sparse, and trade-owner-direct ("Your next emergency call is tonight." / "Real trades. Real results."). Objection sections written from a different author model or at a different time read corporate, anxious, or SaaS-generic and break the voice. The visitor subconsciously feels the page was stitched together.

**Why it happens:**
The trust sections get written to address stakeholder concerns ("we need to handle the hallucination objection") rather than to continue the existing narrative voice.

**How to avoid:**
Before writing any new section, read HeroSection → HowItWorksSection → SocialProofSection aloud. Note: short sentences. Orange accent labels in uppercase. Data point first, explanation second. The word "voicemail" as a villain. Any new copy must pass the same read-aloud test.

**Warning signs:**
New sections use words like "solution", "leverage", "utilize", "platform", or sentences longer than 20 words in the hero copy area. Any paragraph over 3 sentences in a hero/proof context.

**Phase to address:**
Landing copy phase. Run a find on the new section files for any of the above words before marking the phase complete.

---

### Pitfall 4: Dark Mode Hydration Flash (FOUC)

**What goes wrong:**
The `<html>` tag in `src/app/layout.js` does not have `suppressHydrationWarning`. `next-themes` is installed (confirmed: `package.json` has `next-themes: ^0.4.6`) but `ThemeProvider` is not present in `layout.js`. On first load, the browser renders the server HTML with no dark class, then the client adds `.dark` — causing a white flash on dark-preferring users.

**Why it happens:**
`next-themes` requires wrapping the app in `<ThemeProvider>` AND setting `suppressHydrationWarning` on the `<html>` tag. Without both, Next.js App Router throws a hydration mismatch warning and the flash appears. Neither is present in the current `layout.js`.

**How to avoid:**
1. Create a `ThemeProvider` client component wrapper.
2. In `layout.js`, add `suppressHydrationWarning` to the `<html>` tag.
3. Pass `attribute="class"` and `defaultTheme="system"` (or `"light"` to keep current UX for existing users) to `ThemeProvider`.
4. Store user preference in Supabase `tenants` table (or `localStorage` for anonymous public site visitors) — do not rely on cookie-based persistence without an explicit cookie strategy.

**Warning signs:**
Visible white flash on page load in dark OS mode. React console warning: "Warning: Prop `className` did not match."

**Phase to address:**
Dark mode foundation phase (must be the FIRST dark mode task before any color work).

---

### Pitfall 5: Hardcoded Color Classes Across 51 Dashboard Components

**What goes wrong:**
A grep of `src/components/dashboard` reveals 293 occurrences of hardcoded color classes (`bg-white`, `bg-gray-*`, `text-[#...]`, `border-gray-*`) across 51 files, and 454 occurrences of semantic-looking but hardcoded values (`bg-stone-*`, `text-[#0F172A]`, `text-[#475569]`). Additionally, `src/lib/design-tokens.js` hardcodes colors as JS string constants (`bg-white`, `bg-[#F5F5F4]`) that are used across onboarding and dashboard. When `.dark` is added to `<html>`, none of these classes respond to it — every component stays light.

**How to avoid:**
Before adding any dark mode CSS variables, do a systematic replacement pass:
- `bg-white` in card/surface contexts → `bg-card`
- `bg-white` in page/body contexts → `bg-background`
- `text-[#0F172A]` → `text-foreground`
- `text-[#475569]` → `text-muted-foreground`
- `bg-stone-200` / `bg-stone-100` → `bg-muted`
- `border-stone-200` → `border-border`

Run `grep -r "bg-white" src/components/dashboard` and `grep -r "bg-white" src/app/dashboard` to get the complete list (the counts above are from the component directory only; the dashboard page directory adds 41 more `bg-white` instances across 15 files). Do NOT do this as a single bulk find-replace — each instance needs context review (a white logo background should stay white; a card surface should become `bg-card`).

**Warning signs:**
Any dashboard component that still has `bg-white` or `text-[#0F172A]` as a static class after the color audit.

**Phase to address:**
Dark mode color audit phase — must complete before any dark mode toggle is user-accessible.

---

### Pitfall 6: Recharts Chart Colors Break in Dark Mode

**What goes wrong:**
`AnalyticsCharts.jsx` uses inline hex strings everywhere: `stroke="#e5e7eb"` (grid lines), `fill="#C2410C"` (bar/line fills), `tick={{ fill: '#475569' }}` (axis text), `contentStyle={{ border: '1px solid #e2e8f0', background: 'white' }}` (tooltip). Recharts renders these via SVG/inline styles, bypassing Tailwind entirely. Adding `.dark` to `<html>` does nothing for these colors — the charts will show white tooltips on dark backgrounds and light-gray grid lines that disappear.

**How to avoid:**
Use a `useTheme()` hook (from `next-themes`) inside `AnalyticsCharts.jsx` to resolve theme at render time, then pass conditional color values:
```js
const { resolvedTheme } = useTheme();
const isDark = resolvedTheme === 'dark';
const gridColor = isDark ? '#374151' : '#e5e7eb';
const tickColor = isDark ? '#9ca3af' : '#475569';
const tooltipBg = isDark ? '#1f2937' : 'white';
const tooltipBorder = isDark ? '#374151' : '#e2e8f0';
```
This is the only reliable pattern for Recharts in dark mode. CSS variables cannot be used inside SVG `stroke`/`fill` attributes rendered by Recharts.

The same issue applies to the `STATUS_COLORS` and `URGENCY_COLORS` palette objects (hardcoded hex) — these feed `<Cell fill={entry.color} />` and will not adapt. Those specific colors may be acceptable as semantic data colors (red = emergency is correct in both modes), but verify contrast ratios against dark card backgrounds.

**Warning signs:**
White tooltip box floating over dark chart background. Invisible gray grid lines (light gray on dark gray).

**Phase to address:**
Dark mode — analytics phase. Separate from the general color audit because Recharts requires a different fix pattern.

---

### Pitfall 7: Missing ThemeProvider Means No Toggle at All

**What goes wrong:**
`next-themes` is in `package.json` but `ThemeProvider` is not wired into `layout.js` (verified: no import, no usage). `useTheme()` called in any component (currently only `sonner.jsx`) will return `undefined` theme with no error in development — it silently falls back. Building a theme toggle UI before `ThemeProvider` is in the tree results in a toggle that does nothing.

**How to avoid:**
The `ThemeProvider` setup in `layout.js` is a gating prerequisite. No theme toggle work should proceed until `ThemeProvider` is wired in and `document.documentElement.classList` responds to theme changes. Verify with: open DevTools → toggle `.dark` class on `<html>` → confirm at least one known shadcn component changes appearance.

**Warning signs:**
`useTheme()` returns `{ theme: undefined, setTheme: () => {} }`. Toggling theme in UI has no visible effect.

**Phase to address:**
Dark mode foundation phase — first task, blocks all other dark mode work.

---

### Pitfall 8: CSS Variable Drift Between shadcn and Custom Dashboard Tokens

**What goes wrong:**
`globals.css` defines a complete shadcn v2 token set for both `:root` and `.dark`, but `design-tokens.js` defines parallel colors as raw hex strings (`brandOrange: '#C2410C'`, `card.base: 'bg-white rounded-2xl...'`). These tokens are imported and used in onboarding and dashboard components. When dark mode is added, the CSS variables adapt but the JS-token-derived classes do not — any component using `card.base` will have a hardcoded `bg-white` that ignores `.dark`.

**How to avoid:**
Deprecate hardcoded values in `design-tokens.js` and replace with Tailwind semantic equivalents:
- `card.base` → replace `bg-white` with `bg-card`
- `glass.topBar` → replace `bg-white/80` with `bg-card/80`
- `colors.navy` / `heading` → replace usages with `text-foreground`
- `colors.bodyText` / `body` → replace usages with `text-muted-foreground`

Then audit all import sites of `design-tokens.js` for the dashboard and onboarding components.

**Warning signs:**
`grep -r "design-tokens" src/` shows imports — check each import site for hardcoded white/dark values.

**Phase to address:**
Dark mode color audit phase. The `design-tokens.js` file is a centralization trap: it looks like tokens but they are hardcoded strings.

---

### Pitfall 9: Dashboard Sidebar Already Has Its Own Dark Background — Double-Dark Problem

**What goes wrong:**
`DashboardSidebar.jsx` uses `bg-[#0F172A]` (dark navy) as its background — this looks intentional and correct in light mode. In dark mode, if the main content area also goes dark (`bg-background` resolves to near-black), the sidebar and content area may become indistinguishable from each other. The page loses its visual hierarchy.

**How to avoid:**
The sidebar's dark navy (`#0F172A`) must remain its dark mode color too — it should not respond to the theme token. Use a raw hex class that is NOT a semantic token: `bg-[#0F172A]` is already correct for this purpose. Ensure the dark mode main content area uses a lighter dark (e.g., `oklch(0.145 0 0)` which is the current `--background`) and cards use `oklch(0.205 0 0)` (`--card`), creating visible separation. Do not make the sidebar `bg-background` — that would destroy the sidebar's identity.

**Warning signs:**
In dark mode, sidebar and content area appear as one undifferentiated dark region.

**Phase to address:**
Dark mode visual review phase (after color audit and before shipping).

---

### Pitfall 10: CalendarView Has 22+ Hardcoded Color Classes Including Urgency State Blocks

**What goes wrong:**
`CalendarView.js` defines `URGENCY_STYLES` with hardcoded Tailwind classes: `bg-red-50 border-l-[3px] border-red-400 hover:bg-red-100/70` for emergency, `bg-[#F0F4FF]` for routine. These are light-mode colors. In dark mode, `bg-red-50` is near-white — invisible or near-invisible against dark backgrounds. The calendar event blocks will be unreadable.

**How to avoid:**
Add explicit dark mode variants for each urgency state. Either use Tailwind dark variants:
```
emergency: 'bg-red-50 dark:bg-red-950/30 border-l-[3px] border-red-400 dark:border-red-500 hover:bg-red-100/70 dark:hover:bg-red-900/40'
routine: 'bg-[#F0F4FF] dark:bg-blue-950/30 border-l-[3px] border-[#4F6BED] hover:bg-[#E8EFFE] dark:hover:bg-blue-900/30'
```
Or conditionally apply classes based on `useTheme()` resolvedTheme. The routine block uses a hardcoded hex `bg-[#F0F4FF]` which has no dark variant at all.

**Warning signs:**
In dark mode, calendar events appear as near-white blocks on dark gray backgrounds (extremely low contrast). Emergency blocks in particular (red-50) will be nearly invisible.

**Phase to address:**
Dark mode — calendar-specific color pass. This is a separate task from the general color audit because `CalendarView.js` uses dynamic class-concatenation strings that cannot be found by a simple grep for `bg-white`.

---

### Pitfall 11: Framer-Motion Animations on New Landing Sections Must Use AnimatedSection, Not Raw motion.div

**What goes wrong:**
`AnimatedSection.jsx` already correctly implements `useReducedMotion()` — it skips all animations for users who have enabled "reduce motion" in their OS. If objection-busting sections are built with raw `<motion.div>` elements (copying from examples online), they bypass this accessibility guard entirely. Users who need reduced motion get animations anyway.

**Why it happens:**
The pattern `<motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }}>` works visually but skips the `useReducedMotion()` check that `AnimatedSection` applies.

**How to avoid:**
All new landing section animations must use `<AnimatedSection>`, `<AnimatedStagger>`, and `<AnimatedItem>` from `src/app/components/landing/AnimatedSection.jsx`. These are the established wrappers. If a new animation pattern is needed that doesn't fit these wrappers, extend the file — do not create new raw `motion.div` usages.

**Warning signs:**
`grep -r "motion.div" src/app/components/landing/` shows results outside of `AnimatedSection.jsx`, `ScrollProgress.jsx`, `ScrollLinePath.jsx`, and `HowItWorksMinimal.jsx` (which handle their own reduced-motion logic).

**Phase to address:**
Landing content phase. Add to the phase's "definition of done" checklist.

---

### Pitfall 12: Polish Pass Scope Creep Breaks What Works

**What goes wrong:**
"Polish pass" is undefined scope. A developer touching spacing tokens ends up refactoring the LeadFlyout, which breaks the status update flow, which requires a fix to the API route, which is now a feature change disguised as polish. The milestone ships late and introduces regressions.

**Why it happens:**
UI/UX polish touches everything visually. Every element is adjacent to logic. Without hard boundaries, the pass expands until it encompasses the entire codebase.

**How to avoid:**
Define "polish" as: typography scale, spacing, hover/focus states, empty states, loading states, and error states — with NO changes to: component API contracts, data flow, API routes, or business logic. Each polish sub-task should be completable and verifiable in isolation. The rule: if the change would require updating an API or a database query, it is NOT polish — it is a feature and belongs in a different milestone.

**Warning signs:**
A polish PR that modifies any file in `src/app/api/`, `src/lib/` (except design tokens), or `supabase/migrations/`.

**Phase to address:**
Polish planning phase. Write the scope exclusion list before any code is touched.

---

### Pitfall 13: Focus State Regressions During Color Audit

**What goes wrong:**
When replacing `bg-white` and `text-[#0F172A]` with semantic tokens, focus ring colors also get swept up. The current `design-tokens.js` focus ring is `focus:ring-[#C2410C]` (brand orange). If this gets replaced with `focus:ring-ring` (shadcn default which is currently `oklch(0.533 0.154 27.5)` — also orange-ish in light mode but potentially different in dark), focus states may become invisible or inconsistent. Keyboard navigation becomes inaccessible.

**How to avoid:**
Do not replace focus ring classes during the color sweep. Keep `focus:ring-[#C2410C]` as a hardcoded exception for interactive elements — brand-orange focus rings are a deliberate accessibility choice that should work in both modes. After dark mode is enabled, test keyboard navigation specifically: Tab through all interactive elements in dark mode and verify the ring is visible against dark backgrounds (orange on dark gray is typically fine).

**Warning signs:**
Tab-navigating the dashboard in dark mode reveals invisible or very faint focus rings.

**Phase to address:**
Dark mode visual review phase — dedicated keyboard navigation pass.

---

### Pitfall 14: Image Contrast in Dark Mode (Logos, Avatars, Social Proof Initials)

**What goes wrong:**
The brand logo used in `DashboardSidebar.jsx` is `WHITE VOCO LOGO V1 (no bg).png` — a white PNG with transparent background. It renders correctly on the dark sidebar (`bg-[#0F172A]`). But if any page section changes to a light background in dark mode, the white logo becomes invisible. The testimonial initial avatars in `SocialProofSection.jsx` use solid colors (`bg-amber-600`, `bg-sky-600`, `bg-emerald-600`) that are fine in light mode but may be too saturated on dark backgrounds.

**How to avoid:**
Audit all image usages: anything with brand imagery needs a dark-mode-safe container. The sidebar logo is safe (sidebar stays dark). Dark mode is dashboard-only per PROJECT.md — the public landing page (which includes testimonials) is NOT scoped for dark mode in v5.0. For the dashboard, verify logo appears only inside `DashboardSidebar` which keeps its dark background.

**Warning signs:**
Invisible logo (white-on-white). This would only occur if a new layout places the logo outside the dark sidebar.

**Phase to address:**
Dark mode visual review phase.

---

### Pitfall 15: The ScrollLinePath SVG Animation Will Break If Section Order Changes

**What goes wrong:**
The landing page uses a `ScrollLinePath` SVG that draws a copper sine wave through the HowItWorks → FeaturesCarousel → SocialProof section sequence (documented in the `scroll-line-path` skill). If new objection-busting sections are inserted into this sequence — inside the `<ScrollLinePath>` wrapper — the SVG path anchor points will misalign. The line will stop mid-section or skip entire areas.

**How to avoid:**
Check `src/app/(public)/page.js` — the `<ScrollLinePath>` wrapper currently contains exactly three children: `HowItWorksSection`, `FeaturesCarousel`, `SocialProofSection`. If new sections must appear in this flow, they must be added as children of `ScrollLinePath` AND the SVG path coordinates in `ScrollLinePath.jsx` must be recalculated. Alternatively, place new sections either before `<ScrollLinePath>` (after hero, before how-it-works) or after it (between `SocialProofSection` and `FinalCTASection`) where the SVG line has already ended.

**Warning signs:**
The copper sine wave SVG line ends abruptly or appears disconnected from section content after adding a new section.

**Phase to address:**
Landing page architecture phase — before placing any new section in the DOM.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcode chart colors per theme using `resolvedTheme` checks in AnalyticsCharts | Simpler than abstracting to tokens | Every Recharts component needs individual theme logic | Acceptable for v5.0 — only one chart file |
| Use `dark:` Tailwind variants inline rather than CSS variable migration | Faster, no refactor of globals.css | More classes per element, harder to maintain | Acceptable where semantic token equivalent does not exist |
| Keep `design-tokens.js` JS constants, add dark-mode exports alongside them | Minimal migration risk | Two sources of truth for colors | Never — consolidate into CSS variables |
| Add new landing sections as full top-level page sections | Simpler component structure | Breaks scroll flow, buries CTA | Never — embed into existing sections |
| Skip `ThemeProvider` and manually toggle `.dark` via JS | Avoids restructuring layout.js | No `useTheme()` hook available, no system preference support | Never — `next-themes` is already installed |

---

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Recharts + dark mode | Passing static hex to `stroke`, `fill`, `contentStyle` | Read `resolvedTheme` from `useTheme()`, derive colors conditionally at render |
| next-themes + Next.js App Router | Forgetting `suppressHydrationWarning` on `<html>` | Add `suppressHydrationWarning` to the `<html>` tag in `layout.js` before any other theme work |
| next-themes + Supabase auth | Storing theme in localStorage only — user loses preference on new devices | Persist theme preference to `tenants` table, sync on auth, fall back to localStorage |
| framer-motion + new landing sections | Using raw `motion.div` without `useReducedMotion` check | Use existing `AnimatedSection` wrapper which already handles reduced-motion |
| shadcn Sheets/Dialogs + dark mode | Sheet overlay has `bg-background` but flyout content inside has hardcoded `bg-white` | Replace `bg-white` inside SheetContent with `bg-card` or `bg-background` |
| Spline 3D scene + dark mode | Attempting to theme-adapt it | No action needed; HeroSection background is intentionally dark and is public-site-only |

---

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Embedding all 6 objection sections as separate dynamically-imported chunks | 6 extra lazy-load waterfalls, visible progressive loading | Co-locate related objection content into a single component | Immediately visible on slow connections |
| Adding `whileInView` to many elements without `viewport: { once: true }` | Animations re-trigger on scroll-up, expensive re-renders | Always pass `once: true` to viewport (AnimatedSection already does this) | Visible immediately on any scroll-heavy section |
| Calling `useTheme()` in every dashboard component | Many re-renders when theme changes | Resolve theme once at layout level, pass via context or CSS variables | Not a problem at current component count but degrades over time |
| Image-heavy "proof" sections (screenshots, phone mockups) without `next/image` | LCP regression, CLS from unsized images | Use `next/image` with explicit `width`/`height` or `fill` + `sizes` on all new images | Immediately measurable on Lighthouse |

---

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| Theme toggle in Settings page only (not in persistent header) | Mobile users never find it; dark mode feels hidden | Place toggle in accessible location: dashboard top bar or user avatar menu |
| Dark mode toggle that applies to the public landing page too | Landing page is a dark-hero + light-body composition; dark mode on it creates double-dark or broken contrast | Scope `.dark` class to dashboard layout only, not applied to public pages |
| Adding objection content as plain text paragraphs | Home-service owners skim; text-heavy sections get zero reading time | Use proof data (numbers, timers, waveforms) as the primary visual; text as caption |
| Empty states not updated for dark mode | Skeleton loaders using raw `bg-stone-200` may disappear against dark backgrounds | Verify all Skeleton components use `bg-muted` (shadcn default) which does respond to theme |
| "5-minute setup" counter or animated proof elements without reduced-motion fallback | Disorienting for motion-sensitive users | Wrap any new animated proof elements with `useReducedMotion()` gate |

---

## "Looks Done But Isn't" Checklist

- [ ] **Dark mode ThemeProvider:** `layout.js` has `<ThemeProvider>` wrapping children AND `<html suppressHydrationWarning>` — verify by checking if toggling theme class works without hydration warning in console.
- [ ] **Chart dark mode:** Open analytics page in dark mode — verify tooltip backgrounds are dark, grid lines are visible, axis text is readable.
- [ ] **Calendar dark mode:** Open calendar page in dark mode — verify urgency-colored event blocks (red-50, amber-50, #F0F4FF) are readable against dark card backgrounds.
- [ ] **Landing page CTA preserved:** Scroll the public home page from top to bottom — FinalCTASection with AuthAwareCTA must be the last content before footer. Count top-level section components in `page.js` — should be no more than 6.
- [ ] **Reduced motion on new sections:** Enable OS "reduce motion" — all new landing animations should be instant (no fade/slide). Verify by inspecting `AnimatedSection` usage in new components.
- [ ] **No objection language in headings:** Grep new landing section files for: "worry", "concern", "robotic", "might be wondering", "but what", "don't think". These should appear zero times in heading copy.
- [ ] **Design tokens updated:** `design-tokens.js` `card.base` no longer contains `bg-white` — grep confirms it.
- [ ] **Focus states visible in dark mode:** Tab through dashboard in dark mode — every interactive element shows a visible focus ring (orange ring on dark gray is fine; invisible ring is not).
- [ ] **ScrollLinePath unbroken:** View landing page — the copper sine wave connects continuously through all sections it wraps without gaps.
- [ ] **Spline scene not affected:** Dark mode toggle does not change HeroSection appearance (it is already a dark section and is public-site-only, not inside dashboard scope).

---

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Hydration flash ships to production | MEDIUM | Add `suppressHydrationWarning` to `<html>` immediately + hotfix deploy; flash disappears without other changes |
| Bulk find-replace of `bg-white` breaks logo or icon backgrounds | MEDIUM | Git diff shows all affected files; restore `bg-white` on explicit white-background contexts (logo containers, image backgrounds) |
| New landing section breaks ScrollLinePath | LOW | Move section outside `<ScrollLinePath>` children — either before or after the wrapper |
| Recharts charts invisible in dark mode | LOW | One file change (`AnalyticsCharts.jsx`) with conditional color logic resolves all charts |
| Objection copy reads defensive and tanks conversion | HIGH | Rewrite from outcome-first perspective; requires a full copy pass, not a quick edit |
| Polish pass expanded into API changes and shipped breakage | HIGH | Revert the non-UI changes; re-scope the milestone |

---

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Defensiveness signals guilt | Landing copy phase | Read-aloud test: no mirrored fear language in headings |
| Section proliferation buries CTA | Landing architecture phase | Count imports in `page.js`; FinalCTA is last |
| Tone mismatch | Landing copy phase | Glossary of forbidden words grep on new files |
| Dark mode hydration flash | Dark mode foundation (Phase 1 of dark mode) | No React hydration warnings in console |
| 51 components with hardcoded colors | Dark mode color audit | `grep -r "bg-white" src/components/dashboard` returns only intentional white contexts |
| Recharts chart colors | Dark mode analytics phase | Visual review of analytics page in dark mode |
| Missing ThemeProvider | Dark mode foundation (Phase 1, task 1) | `useTheme()` returns a non-undefined theme value |
| CSS variable drift (design-tokens.js) | Dark mode color audit | `grep "bg-white" src/lib/design-tokens.js` returns zero results |
| Sidebar double-dark | Dark mode visual review | Side-by-side screenshot: sidebar and main content are visually distinct |
| CalendarView urgency colors | Dark mode calendar phase | Visual review: all urgency event blocks readable in dark mode |
| Raw motion.div without reduced-motion | Landing content phase | `grep -r "motion\.div" src/app/components/landing/` — only inside known files |
| Polish pass scope creep | Polish planning phase | Any PR touching `src/app/api/` or `supabase/migrations/` is rejected |
| Focus state regressions | Dark mode visual review | Keyboard-only navigation test in dark mode |
| Image/logo contrast | Dark mode visual review | Visual scan of all image-containing dashboard pages in dark mode |
| ScrollLinePath breaks | Landing architecture phase | Visual inspection of sine wave path continuity |

---

## Sources

- Code audit: `src/components/dashboard/` — 293 hardcoded color occurrences across 51 files, 454 hardcoded semantic-but-hex occurrences across 53 files (grep-verified)
- Code audit: `src/app/dashboard/` — 41 `bg-white` occurrences across 15 files (grep-verified)
- Code audit: `src/lib/design-tokens.js` — hardcoded hex constants confirmed
- Code audit: `src/app/layout.js` — no ThemeProvider, no suppressHydrationWarning confirmed
- Code audit: `src/app/globals.css` — dark mode CSS variables present for shadcn tokens; `.dark` custom variant defined via `@custom-variant dark (&:is(.dark *))` confirmed
- Code audit: `package.json` — next-themes ^0.4.6 confirmed installed, ThemeProvider absent from app
- Code audit: `src/components/dashboard/AnalyticsCharts.jsx` — all Recharts color values are inline hex, confirmed
- Code audit: `src/components/dashboard/CalendarView.js` — urgency color classes hardcoded, confirmed
- Code audit: `src/app/components/landing/AnimatedSection.jsx` — useReducedMotion pattern confirmed correct, all wrappers handle it
- Code audit: `src/app/(public)/page.js` — ScrollLinePath wraps exactly 3 sections, confirmed
- PROBLEMS.md objection research — used to calibrate tone pitfall warnings
- next-themes documentation — suppressHydrationWarning requirement for App Router (MEDIUM confidence)
- Recharts rendering model — SVG stroke/fill do not respond to CSS custom properties (HIGH confidence — SVG specification limitation)

---
*Pitfalls research for: v5.0 Trust & Polish — landing objection sections, dark mode retrofit, UI/UX polish pass*
*Researched: 2026-04-13*
