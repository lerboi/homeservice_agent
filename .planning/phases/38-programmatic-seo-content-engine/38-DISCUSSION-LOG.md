# Phase 38: Programmatic SEO and Content Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-06
**Phase:** 38-programmatic-seo-content-engine
**Areas discussed:** Page visual design, Content strategy, OG image design, Metadata & title pattern

---

## Page Visual Design

### Blog Listing Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Card grid | 2-3 column card grid with featured image, title, excerpt, date. Reuses Card component. | ✓ |
| Simple list | Vertical list, no images. Clean and fast. | |
| Featured + grid | Hero featured post at top, then card grid below. | |

**User's choice:** Card grid
**Notes:** None

### Persona Page Style

| Option | Description | Selected |
|--------|-------------|----------|
| Long-form landing page | Hero, pain points, features grid, testimonial, CTA. Mini landing page per trade. | ✓ |
| Compact info page | Shorter — headline, brief pain points, 2-3 features, single CTA. | |
| You decide | Claude picks. | |

**User's choice:** Long-form landing page
**Notes:** None

### Comparison Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Side-by-side table | Feature comparison table, verdict section, CTA. | ✓ |
| Prose-based | Narrative format with pros/cons sections. | |
| You decide | Claude picks. | |

**User's choice:** Side-by-side table
**Notes:** None

### Glossary Page Layout

| Option | Description | Selected |
|--------|-------------|----------|
| Definition + FAQ | Definition at top, FAQ accordion, related term links. | ✓ |
| Simple definition | Definition and related links only. No FAQ. | |
| You decide | Claude picks. | |

**User's choice:** Definition + FAQ
**Notes:** None

### Visual Tone

| Option | Description | Selected |
|--------|-------------|----------|
| Light content pages | White/off-white background, dark text, copper accents. Matches About/Pricing/Terms. | ✓ |
| Match landing page style | Dark backgrounds, gradients, animation-heavy. | |
| You decide | Claude picks per page type. | |

**User's choice:** Light content pages
**Notes:** None

### Integration Page Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Marketing-focused | Tool description, integration overview, use cases, CTA. SEO/marketing content. | ✓ |
| Technical docs | Actual setup guides with configuration steps. | |
| You decide | Claude picks. | |

**User's choice:** Marketing-focused
**Notes:** None

---

## Content Strategy

### Seed Content Quality

| Option | Description | Selected |
|--------|-------------|----------|
| Real draft copy | Claude writes actual Voco-specific, publishable content. | ✓ |
| Placeholder/lorem | Structure and templates only. TODO markers. | |

**User's choice:** Real draft copy
**Notes:** User specifically requested high-quality SEO blogs. Use abm-programmatic-seo and abm-seo-audit skills for best practices.

### Seed Content Volume

**User's choice:** 1 seed item per page type
**Notes:** User explicitly requested 1 per section to validate templates. Scale content later.

---

## OG Image Design

### OG Image Style

| Option | Description | Selected |
|--------|-------------|----------|
| Branded template | Voco logo, dark-to-copper gradient, title text, page type badge. 1200x630px. | ✓ |
| Minimal text-only | Plain dark background, title text only, small wordmark. | |
| Per-type variants | Different layouts for each page type. | |

**User's choice:** Branded template
**Notes:** None

---

## Metadata & Title Pattern

### Title Template

| Option | Description | Selected |
|--------|-------------|----------|
| {Page} \| Voco | Short brand suffix with pipe separator. Most common SaaS convention. | ✓ |
| {Page} — Voco | Em dash separator. Matches existing About page. | |
| {Page} \| Voco AI Receptionist | Longer brand suffix with descriptor. | |

**User's choice:** {Page} | Voco
**Notes:** Existing pages inconsistent — this becomes the standard going forward.

### Canonical URL Base Domain

| Option | Description | Selected |
|--------|-------------|----------|
| https://voco.live | Matches brand domain in CLAUDE.md. | ✓ |
| https://www.voco.live | With www prefix. | |
| You decide | Claude picks. | |

**User's choice:** https://voco.live
**Notes:** None

---

## Claude's Discretion

- Blog detail page layout and typography
- Animation/transition choices on page templates
- FAQ accordion implementation approach
- OG image exact gradient colors and badge styling
- Which hub pages go in nav vs footer

## Deferred Ideas

None — discussion stayed within phase scope.
