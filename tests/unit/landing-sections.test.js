/**
 * Phase 47 — Landing sections smoke tests.
 * Populated progressively by plans 02, 03, 04 as component files are created.
 * Wave 0 provides the scaffold so `npm test` does not fail on missing file.
 */

describe('Phase 47 — AfterTheCallStrip (REPOS-03)', () => {
  it('renders at least 4 after-the-call workflow items', () => {
    const src = require('fs').readFileSync('src/app/components/landing/AfterTheCallStrip.jsx', 'utf8');
    const matches = src.match(/label:\s*'[^']+'/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(4);
  });
  it('does not use id="features" or id="testimonials" on its section element', () => {
    const src = require('fs').readFileSync('src/app/components/landing/AfterTheCallStrip.jsx', 'utf8');
    expect(src).not.toMatch(/id=["']features["']/);
    expect(src).not.toMatch(/id=["']testimonials["']/);
  });
});

describe('Phase 47 — IdentitySection (OBJ-06)', () => {
  it('renders complement-framing copy (no replacement language)', () => {
    const src = require('fs').readFileSync('src/app/components/landing/IdentitySection.jsx', 'utf8');
    // Anti-patterns (defensive / replacement language)
    expect(src).not.toMatch(/worried/i);
    expect(src).not.toMatch(/don'?t worry/i);
    expect(src).not.toMatch(/replace(s|d|r|ment)?\s+you/i);
    expect(src).not.toMatch(/replacing you/i);
    // Positive framing required
    expect(src).toMatch(/your|you'?re|still/i);
  });
});

describe('Phase 47 — PracticalObjectionsGrid (OBJ-02/03/04/05/08/09)', () => {
  const src = () => require('fs').readFileSync('src/app/components/landing/PracticalObjectionsGrid.jsx', 'utf8');

  it('renders the $260,400 cost-of-inaction stat (OBJ-03)', () => {
    expect(src()).toMatch(/\$260,400/);
  });
  it('renders the 85% blind-test stat chip (OBJ-02)', () => {
    expect(src()).toMatch(/85%/);
    expect(src()).toMatch(/blind/i);
  });
  it('renders the 3-step setup strip with "forward", "hours", "live" (OBJ-04)', () => {
    expect(src()).toMatch(/forward/i);
    expect(src()).toMatch(/hours/i);
    expect(src()).toMatch(/live/i);
    expect(src()).toMatch(/4m 12s/);
  });
  it('renders trust/escalation badge row (OBJ-05)', () => {
    expect(src()).toMatch(/escalat/i);
    expect(src()).toMatch(/record/i);
    expect(src()).toMatch(/rules|control/i);
  });
  it('renders before-vs-after workflow comparison (OBJ-08)', () => {
    expect(src()).toMatch(/before/i);
    expect(src()).toMatch(/after/i);
  });
  it('renders 5 trade icons: plumbing, HVAC, electrical, handyman, roofing (OBJ-09)', () => {
    const s = src();
    expect(s).toMatch(/Plumbing/);
    expect(s).toMatch(/HVAC/);
    expect(s).toMatch(/Electrical/);
    expect(s).toMatch(/Handyman/);
    expect(s).toMatch(/Roofing/);
    // Confirm 5 Lucide icon imports
    expect(s).toMatch(/Wrench/);
    expect(s).toMatch(/Thermometer/);
    expect(s).toMatch(/Zap/);
    expect(s).toMatch(/Hammer/);
    expect(s).toMatch(/HardHat/);
  });
  it('imports AudioPlayerCard sub-component', () => {
    expect(src()).toMatch(/AudioPlayerCard/);
  });
});

describe('Phase 47 — OwnerControlPullQuote (REPOS-04)', () => {
  it('renders on dark #1C1412 background', () => {
    const src = require('fs').readFileSync('src/app/components/landing/OwnerControlPullQuote.jsx', 'utf8');
    expect(src).toMatch(/bg-\[#1C1412\]/);
  });
  it('contains an owner-control pull-quote', () => {
    const src = require('fs').readFileSync('src/app/components/landing/OwnerControlPullQuote.jsx', 'utf8');
    // Must mention both "rules" and "follows" per the UI-SPEC locked copy,
    // OR an equivalent owner-control/rules framing.
    expect(src).toMatch(/rules/i);
    expect(src).toMatch(/follows|follow/i);
  });
});

describe('Phase 47 — FAQSection (OBJ-01 + D-10)', () => {
  it.todo('renders exactly 7 FAQ questions from the locked D-06 list');
  it.todo('uses shadcn Accordion with type="single" collapsible');
  it.todo('renders chat widget with "Still wondering?" header');
  it.todo('chat widget posts to /api/public-chat');
});

describe('Phase 47 — Hero copy (REPOS-01)', () => {
  it.todo('HeroSection H1 does not contain replacement framing "Let Voco Handle Your"');
  it.todo('HeroSection retains RotatingText element');
});

describe('Phase 47 — FinalCTA copy (REPOS-02)', () => {
  it.todo('FinalCTA subtitle contains owner-control language ("your rules" or "your schedule")');
});

describe('Phase 47 — AudioPlayerCard (OBJ-02 island)', () => {
  it('declares use client and uses /audio/demo-intro.mp3', () => {
    const src = require('fs').readFileSync('src/app/components/landing/AudioPlayerCard.jsx', 'utf8');
    expect(src).toMatch(/^['"]use client['"]/m);
    expect(src).toMatch(/\/audio\/demo-intro\.mp3/);
  });
  it('implements pause coordination via __vocoPlayingAudio singleton', () => {
    const src = require('fs').readFileSync('src/app/components/landing/AudioPlayerCard.jsx', 'utf8');
    expect(src).toMatch(/__vocoPlayingAudio/);
  });
  it('exposes aria-labels for both play and pause states', () => {
    const src = require('fs').readFileSync('src/app/components/landing/AudioPlayerCard.jsx', 'utf8');
    expect(src).toMatch(/Play audio sample/);
    expect(src).toMatch(/Pause audio sample/);
  });
});

describe('Phase 47 — FAQChatWidget (OBJ-01 + D-10 chat)', () => {
  const src = () => require('fs').readFileSync('src/app/components/landing/FAQChatWidget.jsx', 'utf8');

  it("declares 'use client'", () => {
    expect(src()).toMatch(/^['"]use client['"]/m);
  });
  it('posts to /api/public-chat', () => {
    expect(src()).toMatch(/\/api\/public-chat/);
  });
  it('slices history to last 10 before POST (Pitfall 3)', () => {
    expect(src()).toMatch(/slice\(-10\)/);
  });
  it('has friendly error copy when the API fails', () => {
    expect(src()).toMatch(/Couldn't connect right now/);
  });
  it('renders 3 locked suggestion chips', () => {
    const s = src();
    expect(s).toMatch(/Does it really sound natural\?/);
    expect(s).toMatch(/How long does setup take\?/);
    expect(s).toMatch(/What does it cost\?/);
  });
  it('send button has aria-label "Send message"', () => {
    expect(src()).toMatch(/aria-label="Send message"/);
  });
});
