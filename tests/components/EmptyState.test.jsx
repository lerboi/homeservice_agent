/**
 * @jest-environment jsdom
 *
 * Phase 58 Plan 01 Wave 0 scaffold — POLISH-01 primitive contract tests.
 *
 * These tests WILL FAIL until Plan 58-04 creates `src/components/ui/empty-state.jsx`
 * and Jest config + RTL / jsdom are wired. Downstream plan is responsible for:
 *   - installing @testing-library/react + jest-environment-jsdom
 *   - extending jest.config.js `testMatch` to include `.test.jsx`
 *   - creating the `EmptyState` component matching the locked prop contract in
 *     58-UI-SPEC §4.1.
 *
 * Locked prop contract (58-UI-SPEC §4.1):
 *   <EmptyState icon={Users} headline="No jobs yet" description="..."
 *               ctaLabel="..." ctaHref="..." ctaOnClick={...} />
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

describe('EmptyState primitive (POLISH-01)', () => {
  it('renders icon (aria-hidden) + headline + description', () => {
    render(<EmptyState icon={Users} headline="No jobs yet" description="Test desc" />);
    expect(screen.getByRole('heading', { name: /no jobs yet/i })).toBeInTheDocument();
    expect(screen.getByText(/test desc/i)).toBeInTheDocument();
    const icon = document.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders CTA link when ctaLabel + ctaHref provided', () => {
    render(
      <EmptyState
        icon={Users}
        headline="h"
        ctaLabel="Make a test call"
        ctaHref="/dashboard/more/ai-voice-settings"
      />,
    );
    const link = screen.getByRole('link', { name: /make a test call/i });
    expect(link).toHaveAttribute('href', '/dashboard/more/ai-voice-settings');
  });

  it('renders CTA button when ctaLabel + ctaOnClick provided', () => {
    const fn = jest.fn();
    render(<EmptyState icon={Users} headline="h" ctaLabel="Add" ctaOnClick={fn} />);
    fireEvent.click(screen.getByRole('button', { name: /add/i }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not render CTA when ctaLabel omitted', () => {
    render(<EmptyState icon={Users} headline="h" description="d" />);
    expect(screen.queryByRole('link')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
