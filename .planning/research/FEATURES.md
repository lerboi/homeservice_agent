# Feature Research

**Domain:** SaaS site completeness & launch readiness — pricing page, unified onboarding wizard, contact page, about page, hardening
**Researched:** 2026-03-22
**Confidence:** HIGH (pricing, onboarding wizard patterns — verified via live web sources) / MEDIUM (contact/about, hardening specifics)

---

## Scope

This file covers ONLY the new features for milestone v1.1. The existing platform (voice receptionist, triage, scheduling, CRM, dashboard, landing page) is treated as a stable dependency. References to "existing" mean already built in v1.0.

---

## Feature Landscape

### Table Stakes (Users Expect These)

Features that visitors and prospects assume exist. Missing them signals "not a real product."

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| Pricing page with 4 tiers | Every SaaS product shows pricing; absence creates suspicion and pushes prospects away | LOW | Starter $99 / Growth $249 / Scale $599 / Enterprise custom; display-only at v1.1 |
| Tier feature comparison table | Buyers need to diff tiers without guessing; absence forces them to contact sales for basic questions | LOW | 8-10 features max per tier; more creates noise not clarity |
| "Most popular" badge on mid-tier | Standard UX signal; pages without a highlighted recommended tier convert 22% worse (per 2025 UX study) | LOW | Growth tier ($249) is the intended anchor/recommended tier |
| Annual/monthly billing toggle | Expected on any subscription product; signals pricing maturity even when display-only | LOW | Default to monthly; add "Save 20%" callout on annual; no Stripe needed for display |
| Enterprise "Contact Sales" CTA | High-ACV tiers that hide pricing destroy trust; Enterprise custom pricing is the one exception buyers accept | LOW | Links to contact page, not a modal form |
| Self-serve tier "Get Started" CTA | Primary conversion action per tier; must be unambiguous | LOW | Routes to unified onboarding wizard |
| Pricing FAQ section | Addresses objections inline; reduces support emails; buyers need answers before committing | LOW | 5-7 questions minimum: cancellation, seat limits, call volume overages, trial availability, refunds |
| Unified signup + onboarding wizard | Separate auth page → separate onboarding page is the old pattern; single cohesive flow is the 2026 expectation | MEDIUM | Replace existing `/auth/signin` → `/onboarding` two-stop flow with one wizard |
| Progress indicator in wizard | Users need to know how many steps remain; abandonment spikes without it | LOW | "Step 2 of 4" label or dot indicators |
| Email verification handled gracefully inside wizard | Supabase auth requires email verification; surfacing this as a redirect dead end destroys wizard completion rates | LOW | Inline "Check your inbox" step with auto-polling or manual continue |
| Test call as wizard finale | The activation moment belongs inside onboarding, not as a post-signup afterthought; this is the "aha moment" | MEDIUM | Depends on Retell number provisioning already built (VOICE-01); ONBOARD-06 gate |
| Contact page with segmented inquiry routes | Visitors need distinct paths for sales, support, and partnerships; a single form for all three feels amateurish | LOW | Three sections or tabs with separate form targets or email addresses |
| Visible response time SLA on contact page | Sets expectations; "reply within 1 business day" reduces anxiety for a business owner making a trust decision | LOW | Static copy only |
| About page with mission statement | Builds trust for a product asking access to a business owner's phone line and Google Calendar | LOW | Mission + founding problem + story; team headshots optional at launch |
| Social proof signals | For SME buyers making a trust-sensitive purchase, even a count ("trusted by 40+ home service businesses") reduces anxiety | LOW | Use real beta count; do not fabricate; placeholder acceptable |
| Error monitoring in production | Non-negotiable for any launch; silent failures in a telephony product are invisible and destructive | MEDIUM | Sentry or Axiom; catch unhandled exceptions and API failures |
| Environment variable audit before launch | Secrets must not be in source; production env vars must match expected values | LOW | Pre-launch checklist item; not a build task |

### Differentiators (Competitive Advantage)

Features that create competitive lift. Aligned to the core value: 5-minute activation, zero voicemail.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| 5-minute onboarding gate | The wizard delivers a working AI receptionist before the session ends; no competitor offers this as a self-serve flow | HIGH | Sequence: account creation → routing question → business config → Retell provisioning → live test call; all inside one wizard |
| Routing question at wizard start | Single "What trade are you in?" question pre-populates the service list and triage rules; setup feels instant, not manual | LOW | 8-10 trade categories (plumber, HVAC, electrician, etc.); seeds ONBOARD-02 config from existing API |
| Live test call inside the wizard | Prospect hears their own AI receptionist answer their actual phone number before closing the tab; this is the activation event that correlates with retention | HIGH | Existing Retell integration handles this; wizard UI surfaces it as the final step |
| ROI framing on pricing page hero | SME owners think in job values ($1,000+ per booking), not SaaS metrics; "pays for itself on day 1" framing outperforms feature lists | LOW | Copy-level differentiator; no build cost |
| Inline social proof near pricing CTAs | "Used by 120+ home service businesses" adjacent to CTA buttons; reduces "am I the first?" anxiety in risk-averse SME buyers | LOW | Use real beta pilot count; update as it grows |
| Calendly/Cal.com embed on contact page | Sales-qualified leads self-book a live demo; no email back-and-forth; reduces sales cycle friction | LOW | Cal.com is open-source and self-hostable; no third-party dependency required |
| Founding story targeting trade owners | "We built this because our plumber friend lost a $2,000 job to voicemail" resonates more than generic SaaS copy | LOW | About page copy; no build cost |
| Outlook Calendar sync | Expands TAM to Windows-centric trade businesses; Google-only is a market filter that competitors have not closed | MEDIUM | SCHED-03; deferred from v1.0; Microsoft OAuth + Graph API |
| Multi-language E2E validation | Proves the multi-language claim with evidence from the full pipeline (voice → triage → booking → notifications); competitors claim it but rarely validate E2E | MEDIUM | Spanish + one Asian language minimum; formal test script through entire pipeline |

### Anti-Features (Commonly Requested, Often Problematic)

| Feature | Why Requested | Why Problematic | Alternative |
|---------|---------------|-----------------|-------------|
| Free trial tier on pricing page | "Let users try before they buy" sounds growth-oriented | Requires metered infrastructure, abuse prevention, credit card-or-not decision, support load from unqualified free users; payment processing is explicitly out of scope for v1.1 | "Book a live demo" CTA with Calendly embed; sales-assisted trial shows the product without self-serve billing complexity |
| Per-seat pricing toggle | Enterprise buyers want to model cost by headcount | Adds pricing page complexity; current model is per-business not per-seat; forces premature pricing architecture changes | Keep per-business pricing; add "custom pricing for larger teams" in Enterprise tier copy |
| Payment processing on pricing page | "Convert in place" is a good instinct | PCI compliance, Stripe integration, chargeback handling — large scope; explicitly deferred; display-only pricing is the correct v1.1 approach | Display-only pricing + "Get Started" CTA routing to wizard; sales handles billing offline at launch |
| Email verification redirect outside wizard | Default Supabase auth pattern sends user to inbox, breaking wizard context | Users who leave the wizard to check email rarely return; the 5-minute promise collapses | Surface email verification inline as a wizard step with auto-polling + resend link |
| Full team page with headshots | "Legitimacy building" | At pre-scale launch with no professional photos, stock or absent headshots destroy trust faster than a clean text-only story | Mission + founding story paragraph is sufficient; "Meet the team" can be deferred to when the team is real |
| Live chat widget on contact page | "Reduce friction for inbound inquiries" | Requires staffing or an AI chatbot; unmanned chat is worse than no chat; adds third-party script weight and privacy surface | Clear contact form with explicit response time SLA; Calendly for demo self-booking |
| A/B testing pricing page at launch | "Optimize conversion rate from day one" | Requires meaningful traffic volume to reach statistical significance; at launch there is no such traffic | Ship one well-reasoned pricing page with analytics events attached; add A/B testing when monthly traffic exceeds ~5,000 unique visitors |
| Cookie consent / GDPR banner | Compliance concern | Adds implementation complexity, degrades UX, and is premature if no EU traffic is being targeted at launch | Note in launch checklist; implement when EU market is targeted |

---

## Feature Dependencies

```
Pricing Page
    └──CTA routes to──> Unified Signup+Onboarding Wizard
    └──Enterprise CTA routes to──> Contact Page
    └──display only; no Stripe dependency

Unified Signup+Onboarding Wizard
    └──replaces──> /auth/signin + /onboarding (existing 2-stop flow)
    └──requires──> Supabase Auth (ALREADY BUILT)
    └──requires──> Business Onboarding API ONBOARD-01..06 (ALREADY BUILT)
    └──requires──> Retell number provisioning VOICE-01 (ALREADY BUILT)
    └──finale step──> Live Test Call (ONBOARD-06 gate; ALREADY BUILT)
    └──routing question──> seeds ONBOARD-02 service list config

Contact Page
    └──receives traffic from──> Pricing Page (Enterprise CTA)
    └──receives traffic from──> Landing Page nav (ALREADY BUILT)
    └──optional embed──> Calendly / Cal.com (external, zero build cost)

About Page
    └──standalone; no technical dependencies
    └──linked from──> Landing Page nav (ALREADY BUILT)

Hardening
    └──gates on──> all v1.1 pages complete
    └──gates on──> Unified Wizard functional end-to-end
    └──includes──> Outlook Calendar sync (SCHED-03; independent)
    └──includes──> Multi-language E2E validation
    └──gate──> 5-minute onboarding test with non-technical user
    └──includes──> Error monitoring (Sentry)
    └──includes──> Concurrency / load testing
```

### Dependency Notes

- **Wizard requires existing APIs, not rebuilds:** ONBOARD-01..06 and the Retell provisioning flow are already built; the wizard is a new multi-step UI shell around existing logic plus auth, not a rewrite.
- **Pricing page CTAs require wizard:** If the wizard ships late, pricing page CTAs are dead links. Wizard must ship before or simultaneously with pricing page.
- **Hardening gates on wizard completion:** The 5-minute onboarding validation cannot pass until the wizard is functional end-to-end including the test call step.
- **Outlook sync is independent:** Does not block pricing, wizard, contact, or about pages. Can ship in parallel or after.
- **Multi-language validation is a QA task, not a build task:** The multi-language infrastructure is already built (v1.0); this is formal test script execution across the full pipeline.

---

## MVP Definition

### Launch With (v1.1)

- [ ] **Pricing page (display-only, 4 tiers)** — Converts marketing traffic; required for any sales conversation; no Stripe needed
- [ ] **Unified signup+onboarding wizard** — Core activation funnel; replaces existing two-stop flow
- [ ] **Live test call finale in wizard** — The activation "aha moment"; without it the wizard is a form, not a product demo
- [ ] **Contact page with segmented inquiry routes** — Sales, support, and partnership inquiries need distinct destinations
- [ ] **About page with mission + founding story** — Trust signal for audience being asked to route their business phone through an unfamiliar product
- [ ] **Error monitoring (Sentry or equivalent)** — Non-negotiable for production; silent telephony failures are invisible without it
- [ ] **Environment variable audit** — Secrets hygiene; must verify before demo-ready claim
- [ ] **Outlook Calendar sync (SCHED-03)** — Deferred from v1.0; included in v1.1 hardening

### Add After Validation (v1.x)

- [ ] **Annual billing toggle (functional with Stripe)** — Add when Stripe integration lands; display toggle is fine at v1.1
- [ ] **Multi-language E2E test automation** — Formal regression suite; run manually at v1.1, automate when CI/CD is stable
- [ ] **Pricing page A/B testing** — Add when monthly traffic exceeds ~5,000 unique visitors

### Future Consideration (v2+)

- [ ] **Free trial tier** — Requires metered infra, abuse prevention, and billing integration
- [ ] **Per-seat pricing model** — Requires pricing architecture restructure
- [ ] **Cookie consent / GDPR compliance** — When EU market is targeted
- [ ] **Full team page with headshots** — When team exists and photos are professional

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Unified signup+onboarding wizard | HIGH | MEDIUM | P1 |
| Live test call finale in wizard | HIGH | MEDIUM | P1 |
| Pricing page (display-only, 4 tiers) | HIGH | LOW | P1 |
| Pricing FAQ + tier comparison table | HIGH | LOW | P1 |
| "Most popular" badge + ROI hero copy | HIGH | LOW | P1 |
| Contact page (segmented routes) | MEDIUM | LOW | P1 |
| About page (mission + story) | MEDIUM | LOW | P1 |
| Error monitoring (Sentry) | HIGH | LOW | P1 |
| Routing question at wizard start | HIGH | LOW | P1 |
| Outlook Calendar sync (SCHED-03) | MEDIUM | MEDIUM | P1 |
| Multi-language E2E validation (manual) | MEDIUM | LOW | P1 (QA, not build) |
| 5-minute onboarding gate QA | HIGH | LOW | P1 (QA gate) |
| Calendly embed on contact page | MEDIUM | LOW | P2 |
| Annual billing toggle (display) | LOW | LOW | P2 |
| Concurrency / load testing | MEDIUM | MEDIUM | P2 |
| Inline social proof on pricing page | MEDIUM | LOW | P2 |

**Priority key:**
- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

---

## Competitor Feature Analysis

Relevant competitors for the pricing/onboarding/public-site surface: Goodcall, Smith.ai, Ruby Receptionists, Synthflow.

| Feature | Goodcall / Smith.ai | Ruby Receptionists | Our Approach |
|---------|---------------------|--------------------|--------------|
| Pricing transparency | Goodcall shows tiers; Smith.ai hides pricing behind "contact sales" | Shows pricing | Full display-only tiers with ROI framing; no hiding |
| Self-serve signup | Goodcall yes; Smith.ai is sales-assisted | Sales-assisted only | Self-serve wizard with live test call finale |
| Time to activation | 1-7 days (Goodcall); days to weeks (Smith.ai) | Days to weeks | 5 minutes — wizard-to-live-AI-receptionist |
| Multi-language | Limited / English-primary | English only | Validated E2E from day one |
| Calendar sync | Google only (Goodcall) | None | Google (done) + Outlook (v1.1) |
| About / trust page | Generic corporate | Generic | Trade-specific founding story; problem-first framing |
| Contact page | Generic form | Phone + form | Segmented by intent: sales / support / partnerships |

---

## Sources

- [SaaS Pricing Page Best Practices 2026 — InfluenceFlow](https://influenceflow.io/resources/saas-pricing-page-best-practices-complete-guide-for-2026/)
- [SaaS Pricing Page Best Practices: What Actually Converts in 2026 — PipelineRoad](https://pipelineroad.com/agency/blog/saas-pricing-page-best-practices)
- [13 Pricing Page Best Practices to Boost Conversion Rates — Userpilot](https://userpilot.com/blog/pricing-page-best-practices/)
- [9 Best Practices for a High-Converting SaaS Pricing Page — The Spot On Agency](https://www.thespotonagency.com/blog/the-architects-guide-9-best-practices-for-a-high-converting-saas-pricing-page)
- [SaaS Onboarding Flow: 10 Best Practices That Reduce Churn — DesignRevision](https://designrevision.com/blog/saas-onboarding-best-practices)
- [What is an Onboarding Wizard (with Examples) — UserGuiding](https://userguiding.com/blog/what-is-an-onboarding-wizard-with-examples)
- [SaaS Onboarding Flows That Actually Convert in 2026 — SaaSUI](https://www.saasui.design/blog/saas-onboarding-flows-that-actually-convert-2026)
- [The Old vs. The New: Why the Onboarding Wizard Falls Short — Userpilot](https://userpilot.com/blog/onboarding-wizard/)
- [A Guide to SaaS Signup Flows — UserGuiding](https://userguiding.com/blog/signup-flows-saas)
- [Best Practices for Designing B2B SaaS Product Pages 2026 — GenesysGrowth](https://genesysgrowth.com/blog/designing-b2b-saas-product-pages)
- [SaaS Security Checklist Before Launch 2026 — Peiko](https://peiko.space/blog/article/saas-security-checklist-before-launch)
- [Advanced SaaS Pricing Psychology 2026 — Ghost.io](https://ghl-services-playbooks-automation-crm-marketing.ghost.io/advanced-saas-pricing-psychology-beyond-basic-tiered-models/)

---

*Feature research for: HomeService AI Agent — v1.1 Site Completeness & Launch Readiness*
*Researched: 2026-03-22*
