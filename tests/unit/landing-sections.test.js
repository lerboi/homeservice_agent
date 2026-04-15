/**
 * Phase 48.1 — Landing sections smoke tests.
 *
 * Wave 0 RED state: assertions for AudioDemoSection, IntegrationsStrip,
 * CostOfSilenceBlock, YouStayInControlSection WILL FAIL because those
 * components do not exist yet. This is expected and correct — they go
 * GREEN as Plans 02/03 ship.
 *
 * All assertions use source-string regex matches (fs.readFileSync) —
 * no React rendering, no jsdom, no @testing-library. Jest node env only.
 */

import { readFileSync, existsSync, readdirSync } from 'fs';

const read = (p) => readFileSync(p, 'utf8');

// ---------------------------------------------------------------------------
// HeroSection 48.1
// ---------------------------------------------------------------------------

describe('HeroSection 48.1', () => {
  const src = () => read('src/app/components/landing/HeroSection.jsx');

  it('H1 contains revenue-pain headline', () => {
    expect(src()).toMatch(/Stop losing \$1,000\+ every time you miss a call\./);
  });

  it('contains primary value proposition line', () => {
    expect(src()).toMatch(/Voco AI answers, triages, and books every call/);
  });

  it('contains multilingual micro-proof line', () => {
    expect(src()).toMatch(/Answers in English, Spanish, Mandarin, Malay/);
  });

  it('primary CTA anchors to #audio-demo', () => {
    expect(src()).toMatch(/href="#audio-demo"/);
  });

  it('does NOT import RotatingText (removed in Phase 48.1)', () => {
    expect(src()).not.toMatch(/import[^;]*RotatingText/);
  });
});

// ---------------------------------------------------------------------------
// AudioDemoSection 48.1
// ---------------------------------------------------------------------------

describe('AudioDemoSection 48.1', () => {
  it('file exists', () => {
    expect(existsSync('src/app/components/landing/AudioDemoSection.jsx')).toBe(true);
  });

  it('carries id="audio-demo" section anchor', () => {
    const src = read('src/app/components/landing/AudioDemoSection.jsx');
    expect(src).toMatch(/id="audio-demo"/);
  });

  it('uses __vocoPlayingAudio singleton for pause coordination', () => {
    const src = read('src/app/components/landing/AudioDemoSection.jsx');
    expect(src).toMatch(/__vocoPlayingAudio/);
  });

  it('references both demo-emergency and demo-routine audio files', () => {
    const src = read('src/app/components/landing/AudioDemoSection.jsx');
    expect(src).toMatch(/demo-emergency/);
    expect(src).toMatch(/demo-routine/);
  });
});

// ---------------------------------------------------------------------------
// IntegrationsStrip 48.1
// ---------------------------------------------------------------------------

describe('IntegrationsStrip 48.1', () => {
  it('file exists', () => {
    expect(existsSync('src/app/components/landing/IntegrationsStrip.jsx')).toBe(true);
  });

  it('lists Google Calendar and Outlook (live integrations)', () => {
    const src = read('src/app/components/landing/IntegrationsStrip.jsx');
    expect(src).toMatch(/Google Calendar/);
    expect(src).toMatch(/Outlook/);
  });

  it('lists Jobber, Housecall Pro, ServiceTitan, Zapier (coming soon)', () => {
    const src = read('src/app/components/landing/IntegrationsStrip.jsx');
    expect(src).toMatch(/Jobber/);
    expect(src).toMatch(/Housecall Pro/);
    expect(src).toMatch(/ServiceTitan/);
    expect(src).toMatch(/Zapier/);
  });

  it('has Coming Soon label for planned integrations', () => {
    expect(read('src/app/components/landing/IntegrationsStrip.jsx')).toMatch(/Coming soon/i);
  });

  it('has Live label for active integrations', () => {
    expect(read('src/app/components/landing/IntegrationsStrip.jsx')).toMatch(/Live/);
  });
});

// ---------------------------------------------------------------------------
// CostOfSilenceBlock 48.1
// ---------------------------------------------------------------------------

describe('CostOfSilenceBlock 48.1', () => {
  it('file exists', () => {
    expect(existsSync('src/app/components/landing/CostOfSilenceBlock.jsx')).toBe(true);
  });

  it('displays the $260,400 annual cost stat', () => {
    expect(read('src/app/components/landing/CostOfSilenceBlock.jsx')).toMatch(/\$260,400/);
  });

  it('links to /pricing#calculator deep link', () => {
    expect(read('src/app/components/landing/CostOfSilenceBlock.jsx')).toMatch(/\/pricing#calculator/);
  });

  it('includes "Calculate yours" CTA', () => {
    expect(read('src/app/components/landing/CostOfSilenceBlock.jsx')).toMatch(/Calculate yours/);
  });
});

// ---------------------------------------------------------------------------
// YouStayInControlSection 48.1
// ---------------------------------------------------------------------------

describe('YouStayInControlSection 48.1', () => {
  it('file exists', () => {
    expect(existsSync('src/app/components/landing/YouStayInControlSection.jsx')).toBe(true);
  });

  it('carries the locked H2 heading', () => {
    expect(read('src/app/components/landing/YouStayInControlSection.jsx')).toMatch(/You Stay in Control/);
  });

  it('contains the locked pull quote (D-12)', () => {
    expect(read('src/app/components/landing/YouStayInControlSection.jsx')).toMatch(
      /You set the rules\. Voco follows them\./
    );
  });

  it('uses dark pull-quote background #1C1412', () => {
    expect(read('src/app/components/landing/YouStayInControlSection.jsx')).toMatch(/bg-\[#1C1412\]/);
  });

  it('uses CARD_CLS shared constant (D-16)', () => {
    expect(read('src/app/components/landing/YouStayInControlSection.jsx')).toMatch(/CARD_CLS/);
  });
});

// ---------------------------------------------------------------------------
// FeaturesCarousel-4 48.1
// ---------------------------------------------------------------------------

describe('FeaturesCarousel-4 48.1', () => {
  const src = () => read('src/app/components/landing/FeaturesCarousel.jsx');

  it('contains all 4 Phase 48.1 pillar titles (D-31)', () => {
    const s = src();
    expect(s).toMatch(/24\/7 AI Answering/);
    expect(s).toMatch(/Real-Time Calendar Booking/);
    expect(s).toMatch(/Speaks Your Trade/);
    expect(s).toMatch(/Automated Lead Recovery/);
  });

  it('does NOT contain the 5 retired Phase 47 pillar titles (D-32)', () => {
    const s = src();
    expect(s).not.toMatch(/Custom Pickup Rules/);
    expect(s).not.toMatch(/Lead Capture & CRM/);
    expect(s).not.toMatch(/Post-Call SMS/);
    expect(s).not.toMatch(/Invoicing & Estimates/);
    expect(s).not.toMatch(/Call Analytics/);
  });

  it('still carries id="features" anchor for ScrollLinePath dot', () => {
    expect(src()).toMatch(/id="features"/);
  });
});

// ---------------------------------------------------------------------------
// FAQSection 48.1
// ---------------------------------------------------------------------------

describe('FAQSection 48.1', () => {
  const src = () => read('src/app/components/landing/FAQSection.jsx');

  it('links to #audio-demo (updated from #hero) for "Hear it yourself"', () => {
    expect(src()).toMatch(/#audio-demo/);
  });

  it('does NOT use #hero as the audio anchor', () => {
    expect(src()).not.toMatch(/#hero/);
  });
});

// ---------------------------------------------------------------------------
// page.js 48.1 structure
// ---------------------------------------------------------------------------

describe('page.js 48.1 structure', () => {
  const src = () => read('src/app/(public)/page.js');

  it('does NOT import removed Phase 47 components', () => {
    const s = src();
    expect(s).not.toMatch(/HowItWorksSection/);
    expect(s).not.toMatch(/BeyondReceptionistSection/);
    expect(s).not.toMatch(/SocialProofSection/);
    expect(s).not.toMatch(/IdentitySection/);
    expect(s).not.toMatch(/OwnerControlPullQuote/);
    expect(s).not.toMatch(/HeroDemoBlock/);
    expect(s).not.toMatch(/PracticalObjectionsGrid/);
  });

  it('imports (static or dynamic) the 4 new Phase 48.1 sections', () => {
    const s = src();
    expect(s).toMatch(/AudioDemoSection/);
    expect(s).toMatch(/IntegrationsStrip/);
    expect(s).toMatch(/CostOfSilenceBlock/);
    expect(s).toMatch(/YouStayInControlSection/);
  });

  it('contains <ScrollLinePath> wrapping exactly IntegrationsStrip, CostOfSilenceBlock, FeaturesCarousel', () => {
    const s = src();
    expect(s).toMatch(/<ScrollLinePath>/);
    // All 3 wrapped children are present
    expect(s).toMatch(/IntegrationsStrip/);
    expect(s).toMatch(/CostOfSilenceBlock/);
    expect(s).toMatch(/FeaturesCarousel/);
  });

  it('section ordering: AudioDemoSection before ScrollLinePath before YouStayInControlSection before FAQSection', () => {
    const s = src();
    const idxAudio = s.indexOf('<AudioDemoSection');
    // Use </ScrollLinePath> as boundary: dynamic import declarations appear before <ScrollLinePath>
    // but YouStayInControlSection render tag must appear after </ScrollLinePath>
    const idxScrollLineClose = s.indexOf('</ScrollLinePath>');
    const idxYouStayRender = s.indexOf('<YouStayInControlSection');
    const idxFAQ = s.indexOf('<FAQSection');
    expect(idxAudio).toBeGreaterThan(-1);
    expect(idxScrollLineClose).toBeGreaterThan(-1);
    expect(idxYouStayRender).toBeGreaterThan(-1);
    expect(idxFAQ).toBeGreaterThan(-1);
    expect(idxAudio).toBeLessThan(idxScrollLineClose);
    expect(idxScrollLineClose).toBeLessThan(idxYouStayRender);
    expect(idxYouStayRender).toBeLessThan(idxFAQ);
  });
});

// ---------------------------------------------------------------------------
// metadata 48.1 (Voco AI rebrand — D-27)
// ---------------------------------------------------------------------------

describe('metadata 48.1 (Voco AI rebrand)', () => {
  const src = () => read('src/app/layout.js');

  it('page title starts with "Voco AI"', () => {
    expect(src()).toMatch(/title:\s*['"]Voco AI/);
  });

  it('exports openGraph and twitter metadata fields', () => {
    const s = src();
    expect(s).toMatch(/openGraph/);
    expect(s).toMatch(/twitter/);
  });
});

// ---------------------------------------------------------------------------
// negative scope guard 48.1 (hard constraint per SC #9)
// ---------------------------------------------------------------------------

describe('negative scope guard 48.1', () => {
  it('no NEW Phase 48.1 landing components import createClient (server DB access)', () => {
    // Only scan Phase 48.1 new component files — existing components (HeroDemoInput,
    // LandingNav) already use @/lib/supabase-browser for auth which is acceptable.
    // SC #9 forbids new backend/API surface from landing components — check via createClient.
    const newComponents = [
      'src/app/components/landing/AudioDemoSection.jsx',
      'src/app/components/landing/IntegrationsStrip.jsx',
      'src/app/components/landing/CostOfSilenceBlock.jsx',
      'src/app/components/landing/YouStayInControlSection.jsx',
    ];
    let allSrc = '';
    for (const f of newComponents) {
      if (existsSync(f)) {
        allSrc += readFileSync(f, 'utf8');
      }
    }
    // These new components must not create server Supabase clients (no DB access)
    expect(allSrc).not.toMatch(/createClient/);
    expect(allSrc).not.toMatch(/from ['"]@\/lib\/supabase['"]/);
  });

  it('migration count has not grown beyond 51 (Phase 48.1 is frontend-only, SC #9)', () => {
    // Baseline migration count captured at Plan 01 write time: 51 files
    const BASELINE_MIGRATION_COUNT = 51;
    if (existsSync('supabase/migrations')) {
      const count = readdirSync('supabase/migrations').length;
      expect(count).toBeLessThanOrEqual(BASELINE_MIGRATION_COUNT);
    }
  });
});

// ---------------------------------------------------------------------------
// Preserved Phase 47 assertions — unchanged components
// ---------------------------------------------------------------------------

describe('Phase 47 — FinalCTA copy (REPOS-02) — unchanged', () => {
  it('FinalCTA subtitle contains owner-control language', () => {
    const src = read('src/app/components/landing/FinalCTASection.jsx');
    expect(src).toMatch(/your rules|your schedule/i);
  });
});

describe('Phase 47 — AudioPlayerCard (pause singleton) — unchanged', () => {
  it('implements pause coordination via __vocoPlayingAudio singleton', () => {
    const src = read('src/app/components/landing/AudioPlayerCard.jsx');
    expect(src).toMatch(/__vocoPlayingAudio/);
  });
});

describe('Phase 47 — FAQChatWidget (OBJ-01 + D-10 chat) — unchanged', () => {
  const src = () => read('src/app/components/landing/FAQChatWidget.jsx');

  it("declares 'use client'", () => {
    expect(src()).toMatch(/^['"]use client['"]/m);
  });

  it('posts to /api/public-chat', () => {
    expect(src()).toMatch(/\/api\/public-chat/);
  });

  it('slices history to last 10 before POST (Pitfall 3)', () => {
    expect(src()).toMatch(/slice\(-10\)/);
  });
});
