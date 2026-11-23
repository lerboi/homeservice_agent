---
type: system
system: Public Site
status: pending-rebuild
description: "File: src/app/(public)/page.js"
source: .claude/skills/public-site-i18n/SKILL.md § 2. Landing Page Structure
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Landing Page Structure

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

**File**: `src/app/(public)/page.js`

**Static imports (2026-08-14)**: `HeroSection` (best LCP) plus all Server Component sections — `IntegrationsStrip`, `CostOfSilenceBlock`, `YouStayInControlSection`, `FinalCTASection`. These render in the initial HTML with no loading state.

**Dynamic imports (client sections only)**: `AudioDemoSection`, `FeaturesCarousel`, `FAQSection` — code-split via `next/dynamic`. Loading fallbacks reserve height (AudioDemo h-[420px], FeaturesCarousel h-[560px], FAQ h-[400px]) but are visually quiet: plain blocks on the section's real background color, no gray pulsing card. `PreloadSections` (client, renders null, mounted first inside `<main>`) warms these 3 chunks on `requestIdleCallback` (setTimeout 300ms fallback) so the fallbacks almost never paint.

**Page structure (2026-08-14):**
```
<main>
  <ScrollProgress />
  <PreloadSections />                ← client, renders null — idle-preloads the 3 dynamic chunks
  <HeroSection />                    ← static import
  <AudioDemoSection />               ← dynamic ('use client'), id="audio-demo"
  <ScrollLinePath>
    <IntegrationsStrip />            ← static (Server Component)
    <CostOfSilenceBlock />           ← static (Server Component)
    <FeaturesCarousel />             ← dynamic ('use client'), id="features" (ScrollLinePath anchor)
  </ScrollLinePath>
  <YouStayInControlSection />        ← static (Server Component), OUTSIDE ScrollLinePath
  <FAQSection />                     ← dynamic ('use client')
  <FinalCTASection />                ← static (Server Component)
</main>
```

**`ScrollProgress`**: Milestone dot nav (desktop left sidebar + mobile bottom dots). Hidden while hero section is visible — only appears after hero's bottom edge scrolls past 50% viewport. Hides again at CTA section.

---
