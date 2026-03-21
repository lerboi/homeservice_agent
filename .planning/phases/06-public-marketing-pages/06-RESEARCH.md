# Phase 6: Public Marketing Pages - Research

**Researched:** 2026-03-22
**Domain:** Next.js App Router public marketing pages — pricing UI, contact form, multi-page navigation, Resend email
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Pricing page layout**
- Horizontal card row: 4 cards side by side on desktop, stacking vertically on mobile
- Growth tier visually elevated with "Most Popular" badge
- On mobile, Growth card appears first (reordered from desktop layout)
- Each tier card shows: tier name, price, call volume, feature highlights, CTA button
- Enterprise tier has "Contact Us" CTA instead of "Get Started"

**Monthly/annual toggle**
- Centered pill toggle above the tier cards (Monthly | Annual)
- Annual pricing shows "Save 20%" badge on the toggle
- Prices update in-place without page reload (client-side state)
- Display-only — no Stripe, no checkout

**Feature comparison table**
- Full grid table below the tier cards: features as rows, tiers as columns
- Checkmarks and values in cells (not just checkmarks — show call counts, specific limits)
- Sticky tier header row on scroll for long tables
- Responsive: horizontal scroll or card-per-tier on mobile

**FAQ section**
- Core 4 questions only: cancellation, overages, trial availability, refunds
- Accordion-style expand/collapse
- Placed below the comparison table

**Pricing hero**
- ROI-framed copy: lead with job revenue lost to voicemail, not SaaS metrics
- "Stop Losing $1,000 Jobs to Voicemail" direction for headline (Claude writes final copy)
- Subline frames tiers by value: "Every tier pays for itself after one booked job"

**About page**
- Minimal — mission statement and core values only
- No team section, no photos (early stage)
- Short and focused: why this exists, who it's for, what we believe

**Contact page**
- Single form with fields: name, email, inquiry type dropdown (Sales / Support / Partnerships), message
- Inquiry type routes Resend email to the correct internal address
- Honeypot field for spam protection (hidden field, no CAPTCHA)
- Explicit response time SLA displayed: "We respond within 24 hours"
- Success toast/confirmation after submission

**Navigation**
- Extend existing LandingNav with page links: Pricing, About, Contact alongside existing anchor links
- On landing page: anchor links scroll to sections; page links navigate to new pages
- On sub-pages: all links are page navigation
- Hamburger with slide-out drawer on mobile: full-height drawer with all nav links + CTA button at bottom
- One nav component shared across all public pages

**Page structure & routing**
- Shared `(public)` route group with its own `layout.js` containing LandingNav + LandingFooter
- Landing page moved into `(public)/page.js`
- New pages: `(public)/pricing/page.js`, `(public)/about/page.js`, `(public)/contact/page.js`
- Dashboard keeps its own layout with sidebar (unchanged)

**Visual continuity**
- All public pages use consistent dark hero pattern: Midnight Slate (#0F172A) hero section at top, content sections on Soft Stone (#F5F5F4) below
- Same design language as Phase 2.1 landing page: Heritage Copper CTAs, AnimatedSection scroll animations, Server Components with client animation delegation
- Trade-inspired color palette carried through all pages

**Footer**
- Expand from simple footer to multi-column layout
- Three columns: Product (Features, Pricing, How it works), Company (About, Contact), Legal (Terms, Privacy)
- Same dark (#0F172A) background as current footer
- Logo and copyright retained

### Claude's Discretion
- Final copy for all headlines and body text (guided by ROI framing and Foreman voice)
- Exact animation timing and scroll triggers
- Comparison table feature list (what features to compare across tiers)
- Mobile responsive breakpoints and table adaptation
- Icon choices for feature grid and FAQ
- Typography sizing and spacing within established palette
- Contact form validation UX details
- About page values/principles content

### Deferred Ideas (OUT OF SCOPE)
- Stripe integration / actual payment processing — out of scope, display-only pricing
- Blog / content marketing section — separate initiative
- Live demo phone number on pricing page — needs Retell demo account
- Team photos / bios on About page — add when team grows
- SEO optimization and meta tags — can be enhanced later
- Analytics / conversion tracking — separate concern

</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| PRICE-01 | User sees 4 pricing tiers (Starter $99/40 calls, Growth $249/120 calls, Scale $599/400 calls, Enterprise custom) with clear feature breakdown | Tier data constants in a shared config; shadcn Card components for tier cards |
| PRICE-02 | Growth tier is visually highlighted with "Most Popular" badge as the recommended option | shadcn Badge component already in project; CSS `order-first` on mobile, visual ring/elevation on desktop |
| PRICE-03 | User can toggle between monthly and annual pricing display (display-only, no Stripe) | Client component with `useState`; prices derived from constants via 0.8 multiplier |
| PRICE-04 | User sees a feature comparison table below the fold showing what each tier includes | HTML `<table>` with `position: sticky` thead; horizontal scroll container on mobile |
| PRICE-05 | User sees an FAQ section addressing cancellation, overages, trial availability, and refunds | shadcn Accordion (Radix-based, already in radix-ui dep) or custom details/summary |
| PRICE-06 | User sees ROI-framed hero copy that speaks in job revenue, not SaaS metrics | Server Component hero section, copy authored by Claude during implementation |
| PRICE-07 | Each tier has a "Get Started" CTA that routes to the unified onboarding wizard | `<Link href="/onboarding">` — Enterprise tier gets `<Link href="/contact">` |
| PAGE-01 | User can navigate to Pricing, About, and Contact pages from any public page via updated nav | LandingNav extended with page links; mobile drawer via `useState` + Framer Motion slide |
| PAGE-02 | User sees an About page with mission statement and founding story targeting trade owners | Static Server Component page, no data fetching required |
| PAGE-03 | User can submit a contact inquiry with segmented routes for sales, support, or partnerships | Client-side form with `fetch` to new API route `/api/contact`; inquiry type drives `to` address |
| PAGE-04 | Contact form submissions are delivered to ops inbox via Resend with spam protection | `/api/contact` POST route; Resend `emails.send()`; honeypot field checked server-side |
| PAGE-05 | Contact page displays explicit response time SLA | Static text in contact page UI: "We respond within 24 hours" |

</phase_requirements>

---

## Summary

Phase 6 is a pure frontend + one API route phase. No new database tables are required. All routing is handled by Next.js App Router. The `(public)` route group pattern is a direct parallel of the existing `dashboard` layout pattern already in the codebase. The most technically complex work is the pricing page (monthly/annual toggle, sticky comparison table, mobile card reorder) and the contact API route (Resend routing by inquiry type, honeypot spam protection).

The existing codebase provides everything needed: shadcn Card, Badge, Button; Framer Motion AnimatedSection/AnimatedStagger/AnimatedItem with direction and stagger support; Resend client already configured and tested; the color tokens (Heritage Copper `#C2410C`, Midnight Slate `#0F172A`, Soft Stone `#F5F5F4`) already defined in globals.css. No new npm dependencies are required.

The landing page (`src/app/page.js`) must be moved into the new `(public)` route group. This is a file-system operation that requires care to avoid breaking the existing root layout — the `(public)` group adds its own nested layout (LandingNav + LandingFooter) while the root `layout.js` retains only providers and global styles.

**Primary recommendation:** Build from existing assets. No new libraries. One `(public)` route group layout wraps all four public pages. Pricing toggle is `useState`. Contact form submits to a new `POST /api/contact` route using the already-instantiated Resend pattern from `src/lib/notifications.js`.

---

## Standard Stack

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Next.js App Router | 16.1.7 (in project) | Route groups, Server Components, nested layouts | Already in use; `(public)` group follows `dashboard` layout pattern |
| Tailwind CSS v4 | 4.2.2 (in project) | Styling with `@import 'tailwindcss'` + CSS custom props | Already configured; no tailwind.config.js |
| Framer Motion | 12.38.0 (in project) | AnimatedSection, AnimatedStagger, AnimatedItem | Already implemented; direction + stagger support ready |
| shadcn/ui (new-york) | Manual components.json | Card, Badge, Button, Accordion | Already in project; Radix-based for accessibility |
| Resend | 6.9.4 (in project) | Contact form email delivery | Already configured with lazy-instantiated client pattern |
| Lucide React | 0.577.0 (in project) | Icons for FAQ, feature table | Already imported across codebase |
| Sonner | 2.0.7 (in project) | Toast notifications for form success/error | Already in dependencies |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| Radix UI | 1.4.3 (in project) | Accordion primitives for FAQ | Use for FAQ expand/collapse — already a dependency via radix-ui package |

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Radix Accordion for FAQ | `<details>/<summary>` | Native HTML is simpler but animation control is limited; Radix already available |
| `useState` for toggle | URL search params | URL params would allow shareable "annual" links but adds complexity; display-only, so state is sufficient |
| Horizontal scroll on mobile table | Card-per-tier view | Horizontal scroll is simpler; card-per-tier requires duplicating data structure |

**Installation:** No new packages required. All dependencies exist in the project.

**Version verification:** All versions confirmed from `package.json` directly — no npm lookup needed.

---

## Architecture Patterns

### Route Group Structure
```
src/app/
├── (public)/
│   ├── layout.js          # LandingNav + LandingFooter wrapper (Server Component)
│   ├── page.js            # Landing page (moved from src/app/page.js)
│   ├── pricing/
│   │   └── page.js        # Pricing page
│   ├── about/
│   │   └── page.js        # About page
│   └── contact/
│       └── page.js        # Contact page
├── api/
│   └── contact/
│       └── route.js       # POST handler — Resend dispatch by inquiry type
├── dashboard/             # Unchanged — keeps its own layout
├── layout.js              # Root layout — providers only, no nav/footer
└── globals.css            # Color tokens already defined
```

### Pattern 1: `(public)` Route Group Layout

Next.js route groups (parenthesized directories) do not affect URL paths. They create isolated layout trees. The `(public)` layout wraps all marketing pages with LandingNav + LandingFooter without touching the root layout or dashboard.

```jsx
// src/app/(public)/layout.js — Server Component
import { LandingNav } from '@/app/components/landing/LandingNav';
import { LandingFooter } from '@/app/components/landing/LandingFooter';

export default function PublicLayout({ children }) {
  return (
    <>
      <LandingNav />
      <main>{children}</main>
      <LandingFooter />
    </>
  );
}
```

**Migration note:** When `src/app/page.js` moves to `src/app/(public)/page.js`, the root layout no longer renders LandingNav + LandingFooter directly. The current `page.js` renders them inline — that must be removed as the layout takes over.

### Pattern 2: Server Component Pages with Client Islands

All public pages are Server Components by default. Client interactivity (pricing toggle, mobile nav drawer, FAQ accordion, contact form) is isolated to `'use client'` island components. This matches the established Phase 2.1 pattern.

```
PricingPage (Server) → PricingHero (Server) → PricingTiers (Client: toggle + card state)
                      → ComparisonTable (Server: sticky thead via CSS)
                      → FAQSection (Client: accordion open/close)
ContactPage (Server) → ContactHero (Server) → ContactForm (Client: form + submit)
AboutPage (Server) → all Server Components, no client needed
```

### Pattern 3: Pricing Toggle State Pattern

```jsx
// 'use client'
// Source: established project pattern (Phase 02.1, Phase 04-06 counter animation)
const [billing, setBilling] = useState('monthly');

const price = billing === 'annual'
  ? Math.round(tier.monthlyPrice * 0.8)
  : tier.monthlyPrice;
```

Annual = monthly * 0.8 (20% off). Prices defined as constants, not fetched from API.

### Pattern 4: Pricing Data Constants (Single Source of Truth)

```js
// src/app/(public)/pricing/pricingData.js  (not a component — plain JS)
export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    callLimit: 40,
    cta: 'Get Started',
    ctaHref: '/onboarding',
    highlighted: false,
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 249,
    callLimit: 120,
    cta: 'Get Started',
    ctaHref: '/onboarding',
    highlighted: true,   // "Most Popular"
    badge: 'Most Popular',
  },
  {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: 599,
    callLimit: 400,
    cta: 'Get Started',
    ctaHref: '/onboarding',
    highlighted: false,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,   // Custom
    callLimit: null,
    cta: 'Contact Us',
    ctaHref: '/contact',
    highlighted: false,
  },
];
```

### Pattern 5: Contact API Route — Resend Dispatch by Inquiry Type

```js
// src/app/api/contact/route.js
// Source: mirrors existing lazy-instantiated Resend pattern in src/lib/notifications.js
import { Resend } from 'resend';

const INQUIRY_ADDRESSES = {
  sales: process.env.CONTACT_EMAIL_SALES,
  support: process.env.CONTACT_EMAIL_SUPPORT,
  partnerships: process.env.CONTACT_EMAIL_PARTNERSHIPS,
};

export async function POST(request) {
  const body = await request.json();
  const { name, email, inquiryType, message, _honeypot } = body;

  // Spam gate
  if (_honeypot) {
    return Response.json({ ok: true }); // Silent success
  }

  // Validation
  if (!name || !email || !inquiryType || !message) {
    return Response.json({ error: 'Missing fields' }, { status: 400 });
  }

  const to = INQUIRY_ADDRESSES[inquiryType] || process.env.CONTACT_EMAIL_FALLBACK;

  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL,
    to,
    replyTo: email,
    subject: `[${inquiryType}] Contact form: ${name}`,
    text: `Name: ${name}\nEmail: ${email}\nType: ${inquiryType}\n\n${message}`,
  });

  return Response.json({ ok: true });
}
```

### Pattern 6: Honeypot Spam Protection

A hidden input rendered in JSX but invisible to users via CSS. Bots fill it; humans do not. Server-side check returns silent 200 to avoid fingerprinting the protection.

```jsx
{/* Hidden honeypot — do NOT use display:none, use opacity/position */}
<input
  type="text"
  name="_honeypot"
  aria-hidden="true"
  tabIndex={-1}
  autoComplete="off"
  className="absolute opacity-0 top-0 left-0 h-0 w-0 overflow-hidden"
/>
```

### Pattern 7: Mobile Nav Drawer

The existing LandingNav is a `'use client'` component with scroll state. Add drawer state alongside:

```jsx
const [drawerOpen, setDrawerOpen] = useState(false);

// Hamburger button (mobile only) → toggles drawer
// Drawer: fixed overlay, full-height slide-in from right
// Framer Motion AnimatePresence + motion.div for slide animation
// All nav links + CTA at bottom of drawer
```

Use `AnimatePresence` from Framer Motion (already imported) for enter/exit animation.

### Pattern 8: Sticky Comparison Table Header

Pure CSS — no JS scroll listeners needed:

```jsx
<div className="overflow-x-auto">
  <table className="w-full">
    <thead className="sticky top-16 z-10 bg-[#F5F5F4]">
      {/* top-16 = height of fixed nav (64px) */}
      <tr>
        <th>Feature</th>
        {/* One column per tier */}
      </tr>
    </thead>
    <tbody>...</tbody>
  </table>
</div>
```

### Anti-Patterns to Avoid

- **Nesting LandingNav + LandingFooter in each page component:** The `(public)` layout handles this once. Pages should only export their page content.
- **Fetching pricing data from API/database:** Prices are static constants. No server round-trip needed.
- **Using `display:none` on honeypot field:** Bots skip `display:none`; use `opacity:0` with positional hiding.
- **Animating `height` in the FAQ accordion:** Animate `max-height` or use Radix Accordion's built-in animation to avoid layout thrashing (flagged in ui-ux-pro-max skill, Animation category).
- **Putting `'use client'` on the page component:** Keep pages as Server Components; push client interactivity down to the smallest island.
- **Re-instantiating Resend per request vs lazy client:** The existing pattern uses a module-level lazy client. For API routes (stateless serverless), instantiate inside the handler — this is correct behavior for Next.js route handlers (each invocation is isolated).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Accessible accordion for FAQ | Custom show/hide with `useState` | Radix UI Accordion (via `radix-ui` dep already installed) | Keyboard navigation, ARIA `aria-expanded`, focus management handled |
| Toast notifications for contact form | Custom toast | Sonner (already in project: `import { toast } from 'sonner'`) | Already configured, accessible, positioned correctly |
| Email delivery | Nodemailer / fetch to SMTP | Resend (already in project) | Already configured, has React Email template support |
| Mobile drawer animation | CSS transition | Framer Motion AnimatePresence (already in project) | `exit` animation is impossible with pure CSS state toggle |
| Accessible toggle (billing) | `<div>` with click handler | `<button>` elements with proper ARIA roles | Screen reader reads toggle state |

**Key insight:** Every "custom build" in this phase already has a project-installed equivalent. The risk is reinventing something worse.

---

## Common Pitfalls

### Pitfall 1: Route Group Migration Breaks Root Layout
**What goes wrong:** Moving `page.js` into `(public)/` while the root `layout.js` still wraps everything correctly — but if LandingNav/LandingFooter were ever rendered at root layout level, they'd appear on dashboard pages too.
**Why it happens:** The current `page.js` renders LandingNav inline. After moving to `(public)/layout.js`, the page component must NOT also render them.
**How to avoid:** After moving `page.js` to `(public)/page.js`, strip LandingNav and LandingFooter from the page component. The layout handles them.
**Warning signs:** Nav appears on `/dashboard` routes.

### Pitfall 2: LandingNav Anchor Links Break on Sub-pages
**What goes wrong:** `<a href="#how-it-works">` works on the landing page but navigates to `/#how-it-works` incorrectly when clicked from `/pricing`.
**Why it happens:** Relative hash links anchor to the current page's DOM, not the landing page.
**How to avoid:** In the updated LandingNav, detect current route with `usePathname()`. On non-root pages, render anchor links as `<Link href="/#how-it-works">`. On root page, render as `<a href="#how-it-works">`.
**Warning signs:** Clicking "How it works" from `/pricing` does not scroll to landing page section.

### Pitfall 3: Comparison Table Sticky Header Obscured by Fixed Nav
**What goes wrong:** The sticky thead gets hidden under the fixed LandingNav (64px / top-0) when user scrolls.
**Why it happens:** `sticky top-0` sticks below the viewport top, not below the fixed nav.
**How to avoid:** Use `sticky top-16` (64px = 4rem = h-16) on `<thead>` to account for the fixed nav height.
**Warning signs:** Sticky header disappears under nav when scrolling.

### Pitfall 4: Mobile Card Reorder (Growth First) with CSS Only
**What goes wrong:** On desktop, card order is Starter → Growth → Scale → Enterprise. On mobile, Growth must appear first.
**Why it happens:** DOM order drives screen readers and tab order. Reordering visually with CSS `order` is fine, but the DOM order should match the mobile-first priority for accessibility.
**How to avoid:** Render tiers in mobile-priority order (Growth, Starter, Scale, Enterprise) in the DOM. On desktop, use `md:order-*` classes to restore visual order (Growth becomes `md:order-2`, Starter `md:order-1`, etc.). Alternatively, keep DOM order as mobile priority and rely on `order` utilities.
**Warning signs:** Screen reader reads cards in wrong order; desktop visual order is wrong.

### Pitfall 5: Contact Form Submit without Loading State
**What goes wrong:** User clicks Submit, nothing visible happens for 1-2 seconds, user clicks again, duplicate email sent.
**Why it happens:** Async Resend call has latency; no pending state shown.
**How to avoid:** Disable submit button during submission with `isPending` state. Show loading indicator. This is a requirement of the ui-ux-pro-max skill (Touch & Interaction: "Loading feedback" is CRITICAL).
**Warning signs:** Double submissions in ops inbox.

### Pitfall 6: Honeypot Field Skipped by Accessibility Tools
**What goes wrong:** Screen readers read the hidden honeypot field aloud as a form field, confusing users.
**Why it happens:** `opacity-0` + positional hiding does not hide from screen readers.
**How to avoid:** Add `aria-hidden="true"` and `tabIndex={-1}` on the honeypot input, plus `autoComplete="off"`.
**Warning signs:** Screen reader announces an extra unnamed text field in the contact form.

---

## Code Examples

### Pricing Toggle Client Component
```jsx
'use client';
// Source: established project useState pattern (see Phase 04-06 counter animation)
import { useState } from 'react';
import { PRICING_TIERS } from './pricingData';

export function PricingTiers() {
  const [billing, setBilling] = useState('monthly');

  return (
    <div>
      {/* Pill toggle */}
      <div className="flex items-center justify-center gap-0 mb-10 rounded-full border border-white/[0.12] bg-white/[0.04] w-fit mx-auto p-1">
        {['monthly', 'annual'].map((plan) => (
          <button
            key={plan}
            onClick={() => setBilling(plan)}
            className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
              billing === plan
                ? 'bg-[#C2410C] text-white shadow-sm'
                : 'text-white/50 hover:text-white'
            }`}
          >
            {plan === 'monthly' ? 'Monthly' : (
              <span className="flex items-center gap-2">
                Annual
                <span className="text-xs bg-[#166534] text-white px-2 py-0.5 rounded-full">
                  Save 20%
                </span>
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tier cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {PRICING_TIERS.map((tier) => {
          const price = tier.monthlyPrice === null
            ? null
            : billing === 'annual'
              ? Math.round(tier.monthlyPrice * 0.8)
              : tier.monthlyPrice;

          return (
            <TierCard key={tier.id} tier={tier} price={price} billing={billing} />
          );
        })}
      </div>
    </div>
  );
}
```

### Mobile Nav Drawer with Framer Motion
```jsx
'use client';
// Source: Framer Motion AnimatePresence pattern; project uses framer-motion v12
import { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import Link from 'next/link';

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const pathname = usePathname();
  const isRoot = pathname === '/';

  // Close drawer on route change
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <nav className={`fixed top-0 left-0 right-0 z-50 ...`}>
        {/* ... existing nav content ... */}
        {/* Hamburger — mobile only */}
        <button
          className="md:hidden ..."
          onClick={() => setDrawerOpen((v) => !v)}
          aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={drawerOpen}
        >
          {/* hamburger icon */}
        </button>
      </nav>

      {/* Mobile drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setDrawerOpen(false)}
            />
            {/* Drawer */}
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'tween', duration: 0.25 }}
              className="fixed top-0 right-0 bottom-0 z-50 w-[280px] bg-[#0F172A] md:hidden flex flex-col"
            >
              {/* Nav links + CTA button */}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
```

### Contact Form with Honeypot
```jsx
'use client';
import { useState } from 'react';
import { toast } from 'sonner';

export function ContactForm() {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsPending(true);
    const formData = new FormData(e.target);
    const body = {
      name: formData.get('name'),
      email: formData.get('email'),
      inquiryType: formData.get('inquiryType'),
      message: formData.get('message'),
      _honeypot: formData.get('_honeypot'),
    };

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Submission failed');
      toast.success('Message sent! We\'ll respond within 24 hours.');
      e.target.reset();
    } catch {
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="relative">
      {/* Honeypot */}
      <input
        type="text"
        name="_honeypot"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        className="absolute opacity-0 top-0 left-0 h-0 w-0 overflow-hidden"
      />
      {/* Visible fields */}
      {/* ... name, email, inquiryType select, message textarea ... */}
      <button type="submit" disabled={isPending}>
        {isPending ? 'Sending...' : 'Send Message'}
      </button>
    </form>
  );
}
```

### Sticky Comparison Table Header
```jsx
// Server Component — no 'use client' needed
export function ComparisonTable({ tiers }) {
  return (
    <div className="overflow-x-auto -mx-6 px-6">
      <table className="w-full min-w-[640px]">
        <thead className="sticky top-16 z-10 bg-[#F5F5F4]">
          <tr>
            <th className="py-4 text-left text-sm font-medium text-[#475569] w-1/3">
              Feature
            </th>
            {tiers.map((tier) => (
              <th key={tier.id} className="py-4 text-center text-sm font-semibold text-[#0F172A]">
                {tier.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Feature rows */}
        </tbody>
      </table>
    </div>
  );
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `pages/` directory routing | App Router with route groups `(public)` | Next.js 13+ | Route groups allow isolated layout trees without URL impact |
| `tailwind.config.js` | `@import 'tailwindcss'` + CSS `@theme` block | Tailwind v4 (in project since Phase 02.1) | No config file — tokens defined in globals.css |
| `framer-motion` v10 `AnimatePresence` | Same API in v12 | Framer Motion v12 | API stable; `useReducedMotion` hook pattern already established |
| `shadcn` CLI with `--style` flag | Manual `components.json` (new-york) | shadcn v4 removed `--style` flag | Components.json already created manually in project |

**Deprecated/outdated:**
- `pages/_app.js` layout pattern: Not used in this project — App Router only.
- `next/head` for meta tags: Replaced by `export const metadata` in App Router — relevant if SEO is added later (currently deferred).

---

## Open Questions

1. **Accordion implementation: Radix or `<details>`**
   - What we know: `radix-ui` v1.4.3 is installed (provides Accordion primitives). `<details>/<summary>` is zero-dependency but animation is limited.
   - What's unclear: Whether the project has `@radix-ui/react-accordion` specifically or just the monorepo `radix-ui` package.
   - Recommendation: Check if `import * from 'radix-ui'` includes Accordion. If yes, use it. If the Accordion subpackage needs to be added separately, use `<details>/<summary>` with a CSS `max-height` transition — simpler than adding a new dep.

2. **Internal ops email addresses for contact routing**
   - What we know: Inquiry type (sales/support/partnerships) should route to different addresses via Resend.
   - What's unclear: Whether the project owner has defined these addresses yet.
   - Recommendation: Use env vars `CONTACT_EMAIL_SALES`, `CONTACT_EMAIL_SUPPORT`, `CONTACT_EMAIL_PARTNERSHIPS` with a single `CONTACT_EMAIL_FALLBACK`. The API route reads from env; addresses are set at deploy time.

3. **`sonner` Toaster provider placement**
   - What we know: `sonner` is in dependencies (v2.0.7). `toast()` calls work globally when `<Toaster>` is rendered in a parent layout.
   - What's unclear: Whether `<Toaster>` is already mounted in `src/app/layout.js`.
   - Recommendation: Check root layout. If `<Toaster>` is not present, add it to the `(public)/layout.js` so it covers all marketing pages without affecting dashboard.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | Jest 29.7.0 |
| Config file | `jest.config.js` (root) — `testMatch: ['**/tests/**/*.test.js']` |
| Quick run command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/contact/ --passWithNoTests` |
| Full suite command | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests` |

### Phase Requirements → Test Map
| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PAGE-04 | Contact API route: honeypot blocks spam, valid form sends email via Resend, inquiry type routes to correct address | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/contact/contact-api.test.js -x` | ❌ Wave 0 |
| PAGE-04 | Contact API route: missing required fields returns 400 | unit | Same file | ❌ Wave 0 |
| PRICE-03 | Pricing toggle logic: annual price = monthly * 0.8, rounded | unit | `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/pricing/pricing-calc.test.js -x` | ❌ Wave 0 |
| PAGE-01/02/03 | Nav, About, Contact pages render correctly | manual-only | Visual review in browser | N/A — UI, not unit-testable |
| PRICE-01/02/04/05/06/07 | Pricing page UI — cards, badge, table, FAQ | manual-only | Visual review in browser | N/A — UI, not unit-testable |
| PAGE-05 | SLA text visible on contact page | manual-only | Visual review in browser | N/A — static text |

**Manual-only justification:** React component rendering tests (JSDOM + React Testing Library) are not part of the established project test pattern. The project uses `testEnvironment: 'node'` and tests only pure logic (API routes, utility functions). UI behavior is validated manually.

### Sampling Rate
- **Per task commit:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js tests/contact/ --passWithNoTests`
- **Per wave merge:** `node --experimental-vm-modules node_modules/jest-cli/bin/jest.js --passWithNoTests`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `tests/contact/contact-api.test.js` — covers PAGE-04 (honeypot, field validation, Resend dispatch by inquiry type)
- [ ] `tests/pricing/pricing-calc.test.js` — covers PRICE-03 (annual price calculation: monthlyPrice * 0.8 rounded)
- [ ] `tests/__mocks__/resend.js` — already exists at `tests/__mocks__/resend.js` — reuse for contact tests

---

## Sources

### Primary (HIGH confidence)
- `src/app/components/landing/LandingNav.jsx` — existing nav structure, scroll state pattern, Heritage Copper CTA
- `src/app/components/landing/AnimatedSection.jsx` — AnimatedSection, AnimatedStagger, AnimatedItem — direction prop, stagger variants
- `src/app/components/landing/LandingFooter.jsx` — current footer structure to expand
- `src/app/dashboard/layout.js` — route group layout pattern (reference for `(public)/layout.js`)
- `src/app/globals.css` — all landing color tokens confirmed: `--color-landing-surface`, `--color-landing-dark`, `--color-landing-accent`, `--color-landing-muted`, `--color-landing-success`
- `src/lib/notifications.js` — Resend lazy-instantiated client pattern; `emails.send()` API shape
- `package.json` — all dependency versions confirmed
- `jest.config.js` — test runner configuration confirmed
- `.planning/phases/06-public-marketing-pages/06-CONTEXT.md` — all locked decisions

### Secondary (MEDIUM confidence)
- Next.js App Router route groups documentation — `(group)` directories create isolated layout trees without affecting URL paths; confirmed by dashboard layout pattern already in codebase
- Framer Motion v12 `AnimatePresence` — stable API across v11/v12; `exit` prop on `motion.div` confirmed by existing project usage

### Tertiary (LOW confidence)
- Radix UI Accordion availability via `radix-ui` v1.4.3 monorepo package — needs verification at implementation time (see Open Questions #1)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries verified from `package.json`, no assumptions
- Architecture: HIGH — route group pattern verified from existing `dashboard/layout.js`; Server/Client split is established project pattern
- Contact API: HIGH — Resend pattern verified from `src/lib/notifications.js`; honeypot pattern is well-documented
- Pitfalls: HIGH — all identified from direct code inspection (LandingNav anchor link issue, sticky header offset, mobile card order)
- Validation architecture: HIGH — jest config verified, existing mock structure confirmed

**Research date:** 2026-03-22
**Valid until:** 2026-06-22 (stable stack — Next.js, Tailwind v4, Framer Motion are all stable)
