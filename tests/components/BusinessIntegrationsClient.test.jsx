/**
 * @jest-environment jsdom
 *
 * Phase 58 Plan 01 Wave 0 scaffold — CHECKLIST-02 Jobber card + Last synced +
 * reconnect banner render.
 *
 * These tests WILL FAIL until Plan 58-02 / 58-05:
 *   - Extend `BusinessIntegrationsClient` to render `last_context_fetch_at` as a
 *     relative timestamp ("Last synced 2 minutes ago") when the row has no error.
 *   - Render a reconnect banner with a Reconnect button when
 *     `jobber.error === 'token_refresh_failed'`.
 * Infra prerequisites (downstream):
 *   - install @testing-library/react + jest-environment-jsdom
 *   - extend jest.config.js `testMatch` to include `.test.jsx`
 *
 * Note: `BusinessIntegrationsClient` is a default export (verified against
 * src/components/dashboard/BusinessIntegrationsClient.jsx line 110).
 */

import { describe, it, expect } from '@jest/globals';
import { render, screen } from '@testing-library/react';
import BusinessIntegrationsClient from '@/components/dashboard/BusinessIntegrationsClient';

const base = {
  xero: { connected: false, error: null, last_context_fetch_at: null },
  jobber: {
    connected: true,
    error: null,
    last_context_fetch_at: '2026-04-20T10:00:00Z',
  },
};

describe('BusinessIntegrationsClient — Jobber (Phase 58 CHECKLIST-02)', () => {
  it('renders "Last synced" line when last_context_fetch_at present and no error', () => {
    render(<BusinessIntegrationsClient initialStatus={base} />);
    expect(screen.getByText(/last synced/i)).toBeInTheDocument();
  });

  it('renders reconnect banner when jobber.error === "token_refresh_failed"', () => {
    const broken = {
      ...base,
      jobber: { ...base.jobber, error: 'token_refresh_failed' },
    };
    render(<BusinessIntegrationsClient initialStatus={broken} />);
    expect(
      screen.getByRole('button', { name: /reconnect/i }),
    ).toBeInTheDocument();
  });

  it('does not render "Last synced" when last_context_fetch_at is null', () => {
    const unsynced = {
      ...base,
      jobber: { ...base.jobber, last_context_fetch_at: null },
    };
    render(<BusinessIntegrationsClient initialStatus={unsynced} />);
    expect(screen.queryByText(/last synced/i)).toBeNull();
  });
});
