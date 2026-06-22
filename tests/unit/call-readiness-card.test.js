/**
 * CallReadinessCard — home-page onboarding indicator tests.
 *
 * Target: `src/components/dashboard/CallReadinessCard.jsx`. Matches project test
 * convention (static source-text inspection, no @testing-library).
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/CallReadinessCard.jsx';
const read = () => readFileSync(SRC, 'utf8');

describe('CallReadinessCard', () => {
  it('component file exists', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('fetches the setup-checklist endpoint (shared SWR key)', () => {
    expect(read()).toMatch(/useSWRFetch\s*\(\s*['"]\/api\/setup-checklist['"]/);
  });

  it('tracks essentials + the call-ready milestone', () => {
    const src = read();
    expect(src).toMatch(/essential/);
    expect(src).toMatch(/callReady/);
  });

  it('renders a segmented progress bar', () => {
    expect(read()).toMatch(/SegmentBar/);
  });

  it('deep-links the single next essential step', () => {
    const src = read();
    expect(src).toMatch(/nextStep/);
    expect(src).toMatch(/href=\{nextStep\.href/);
  });

  it('opens the full checklist via the open-setup-checklist event', () => {
    expect(read()).toMatch(
      /dispatchEvent\(\s*new Event\(\s*['"]open-setup-checklist['"]/
    );
  });

  it('carries the call-readiness tour hook', () => {
    expect(read()).toMatch(/data-tour=["']call-readiness["']/);
  });

  it('respects prefers-reduced-motion via framer-motion useReducedMotion', () => {
    expect(read()).toMatch(/useReducedMotion/);
  });
});
