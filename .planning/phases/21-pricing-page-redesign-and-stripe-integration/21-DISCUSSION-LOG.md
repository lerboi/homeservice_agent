# Phase 21: Pricing Page Redesign and Stripe Integration - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 21-pricing-page-redesign-and-stripe-integration
**Areas discussed:** Stripe checkout flow, Visual design upgrade, Tier accuracy & features, FAQ & objection handling

---

## Stripe Checkout Flow

### Payment flow

| Option | Description | Selected |
|--------|-------------|----------|
| Stripe Checkout (hosted page) | Redirect to Stripe's hosted payment page. Fastest to build, PCI-compliant, supports trials natively. | ✓ |
| Stripe Elements (embedded) | Embed card input in your page. More control but more work. | |
| Trial first, pay later | Skip payment at signup, collect card before trial expires. | |

**User's choice:** Stripe Checkout (hosted page)
**Notes:** None

### 14-day trial credit card requirement

| Option | Description | Selected |
|--------|-------------|----------|
| No card required | Lower friction, higher signups, some never convert. | |
| Card required upfront | Collect card at signup, auto-charge after 14 days. Higher intent. | ✓ |

**User's choice:** Card required upfront
**Notes:** None

### CTA button copy

| Option | Description | Selected |
|--------|-------------|----------|
| "Start Free Trial" | All paid tiers say this. Enterprise stays "Contact Us". | ✓ |
| "Try Free for 14 Days" | More explicit about trial duration. | |
| Keep "Get Started" | Current CTA unchanged. | |

**User's choice:** "Start Free Trial"
**Notes:** None

### Plan management

| Option | Description | Selected |
|--------|-------------|----------|
| Stripe Customer Portal | Link to Stripe's hosted portal from dashboard settings. Zero custom billing UI. | ✓ |
| Custom billing page | Build billing management page in dashboard. More control, more work. | |

**User's choice:** Stripe Customer Portal
**Notes:** None

---

## Visual Design Upgrade

### Tier card styling

| Option | Description | Selected |
|--------|-------------|----------|
| Dark cards with copper glow | Dark background, copper glow hover, consistent with Phase 13 decisions. | ✓ |
| Keep current white cards | White cards on dark background as-is. | |
| Glass/frosted cards | Semi-transparent with backdrop-blur. Performance constraint. | |

**User's choice:** Dark cards with copper glow
**Notes:** None

### Social proof / trust elements

| Option | Description | Selected |
|--------|-------------|----------|
| 14-day free trial banner | Prominent callout near top. | ✓ |
| Money-back guarantee badge | Visual badge near tier cards. | |
| Social proof micro-line | "Trusted by 500+ trades businesses" with avatars. | |
| Testimonial quote | 1-2 short quotes from trades owners. | ✓ |

**User's choice:** 14-day free trial banner + testimonial quote
**Notes:** "Remove the money back guarantee everywhere. Also remove anything that says no credit card required."

### Hero section styling

| Option | Description | Selected |
|--------|-------------|----------|
| Rich dark hero | Match landing page: #050505, radial gradient, dot-grid, blur orb. | ✓ |
| Simple dark hero | Keep current minimal dark hero. | |
| Gradient hero | Dark-to-transparent gradient. | |

**User's choice:** Rich dark hero
**Notes:** None

---

## Tier Accuracy & Features

### Feature accuracy

| Option | Description | Selected |
|--------|-------------|----------|
| Accurate to built features | Only list what actually exists. Builds trust. | ✓ |
| Keep aspirational features | Show product vision. | |
| Mix — built + coming soon | Built features normal, upcoming with "Coming Soon" badge. | |

**User's choice:** Accurate to built features
**Notes:** None

### Tier differentiation

| Option | Description | Selected |
|--------|-------------|----------|
| Volume-based tiers | All features on all tiers. Differ by call volume and support. | ✓ |
| Feature-gated tiers | Different tiers unlock different features. Requires backend enforcement. | |

**User's choice:** Volume-based tiers
**Notes:** None

### Pricing / call limits

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current prices | Starter $99/40, Growth $249/120, Scale $599/400, 20% annual. | ✓ |
| Adjust prices/limits | Change numbers. | |

**User's choice:** Keep current prices
**Notes:** None

---

## FAQ & Objection Handling

### FAQ topics

| Option | Description | Selected |
|--------|-------------|----------|
| Setup & onboarding | How long, technical skills, test call. | ✓ |
| AI call quality | Complex calls, confusion, accents, AI detection. | ✓ |
| Trial & billing | 14-day trial, charging, cancellation, overages. | ✓ |
| Data & security | Recordings, access, compliance. | ✓ |

**User's choice:** All 4 topics
**Notes:** None

### FAQ size

| Option | Description | Selected |
|--------|-------------|----------|
| 6-8 questions | Covers key objections without overwhelming. | ✓ |
| 10-12 questions | Comprehensive but longer. | |
| 4-5 questions | Tight, critical objections only. | |

**User's choice:** 6-8 questions
**Notes:** None

---

## Claude's Discretion

- Final copy for all headlines, sublines, FAQ answers, testimonial quotes
- Exact Stripe Price ID mapping and webhook handling details
- Animation timing and scroll triggers
- Comparison table structure for volume-based tiers
- Mobile responsive adaptations
- Trial banner styling and placement
- Testimonial section layout

## Deferred Ideas

- Trial expiry email sequence — notifications/lifecycle phase
- Call limit enforcement and overage billing — backend enforcement phase
- Plan proration tracking in-app — separate work
- Stripe tax configuration — depends on business entity
- Coupon/promo code system — admin UI needed
