# Phase 11: Landing Page UI/UX Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 11-landing-page-ui-ux-redesign
**Areas discussed:** Hero section redesign, How It Works visual treatment, Features section overhaul, Overall design system & polish

---

## Hero Section Redesign

### Hero Layout
| Option | Description | Selected |
|--------|-------------|----------|
| Keep split layout, upgrade visuals | 2-column (copy left, visual right) with upgraded Spline 3D and polish | |
| Full-width centered hero | Centered column with visual below (Linear/Vercel style) | |
| Immersive/ambient hero | Background-driven with particles/effects behind centered text | |

**User's choice:** Custom — Full-width split layout with text on left, 3D interactive Spline element on right using 21st.dev `serafim/splite` component and specific Spline community model (https://app.spline.design/community/file/2ce6351a-d7a5-4c4e-bf13-75bc9f841891). Cursor-reactive. Mobile gets static fallback. Performance-first with dynamic imports and CWV priority.

### Headline Approach
| Option | Description | Selected |
|--------|-------------|----------|
| Keep RotatingText headline | Current headline with rotating Competitor/Revenue/Customer | ✓ |
| New headline, keep RotatingText | Fresh copy with rotation animation | |
| Static headline, no rotation | Let 3D scene be the attention-grabber | |

**User's choice:** Keep RotatingText headline

### Hero Social Proof
| Option | Description | Selected |
|--------|-------------|----------|
| Keep avatar stack + text | 3 colored avatar circles + "Trusted by 500+" | ✓ |
| Logo bar of client brands | Row of trade business logos | |
| Live counter animation | Animated counters for calls/revenue | |

**User's choice:** Keep avatar stack + text (Recommended)

---

## How It Works Visual Treatment

### Step Presentation Style
| Option | Description | Selected |
|--------|-------------|----------|
| Vertical timeline with connector | Steps connected by animated line on scroll | |
| Interactive cards with hover states | Upgraded current cards with richer interactions | |
| Animated scenario walkthrough | Single panel with tabs transitioning between steps | ✓ |
| You decide | Claude picks best approach | |

**User's choice:** Animated scenario walkthrough with tabs

### Visual Elements
| Option | Description | Selected |
|--------|-------------|----------|
| Icons only (current approach) | Lucide icons in gradient containers | ✓ |
| Mini illustrations per step | Custom illustrations per step | |
| Animated micro-interactions | Icons animate on scroll/hover | |
| You decide | Claude picks | |

**User's choice:** Icons only (current approach)

---

## Features Section Overhaul

### Grid Layout
User provided specific direction before options were presented:
- Use Aceternity bento grid from 21st.dev (https://21st.dev/community/components/aceternity/bento-grid/default)
- Add 5th feature card

**User's choice:** Aceternity bento grid layout with 5 features

### 5th Feature Card
| Option | Description | Selected |
|--------|-------------|----------|
| Multi-Language Support | "Speaks Their Language" — AI answers in caller's language | ✓ |
| Smart Scheduling / Calendar Sync | "Your Calendar, Always Updated" — auto sync | |
| Dashboard & Lead Tracking | "Every Lead, One Dashboard" — unified view | |
| You decide | Claude picks most compelling | |

**User's choice:** Multi-Language Support — "Speaks Their Language"

---

## Overall Design System & Polish

### Section Transitions
| Option | Description | Selected |
|--------|-------------|----------|
| Smooth scroll reveals (current) | AnimatedSection fade/slide-in on scroll | ✓ |
| Parallax depth layers | Background elements move slower than foreground | |
| Seamless gradient flows | Sections blend with gradient transitions | |
| You decide | Claude picks | |

**User's choice:** Smooth scroll reveals (current)

### Social Proof Improvement
| Option | Description | Selected |
|--------|-------------|----------|
| Polish existing cards | Upgraded hover effects, refined badges, subtle animations | ✓ |
| Marquee/carousel testimonials | Infinite scrolling marquee (21st.dev style) | |
| Featured testimonial + stats bar | One large quote + stats bar | |
| You decide | Claude picks | |

**User's choice:** Polish existing cards

### Final CTA
| Option | Description | Selected |
|--------|-------------|----------|
| Polish existing (Recommended) | Upgrade Heritage Copper CTA with better gradient/animation | ✓ |
| Dark CTA with accent glow | Midnight Slate background with copper glow | |
| You decide | Claude picks | |

**User's choice:** Polish existing (Recommended)

---

## Claude's Discretion

- Aceternity bento grid column/row spans for 5-card layout
- Card hover micro-interactions and animation timing
- How It Works tab transition animation style
- Typography refinements
- Social Proof hover effect details
- Final CTA gradient/animation specifics
- Responsive breakpoints and mobile adaptations
- 5th feature card visual treatment and copy

## Deferred Ideas

None — discussion stayed within phase scope
