/**
 * @jest-environment jsdom
 *
 * CalendarConnectionsCard — the calendar page's unified Connections card.
 * Replaces the old page-top IntegrationReconnectBanner + JobberCopyBanner:
 * Google/Outlook calendar rows (via CalendarSyncCard, stubbed here) plus
 * Jobber/Xero business-app rows with inline reconnect state.
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen } from '@testing-library/react';

// ESM mocks must be registered before the dynamic import below.
// CalendarSyncCard fetches /api/calendar-sync/status on mount — stub it out;
// its own behavior is covered elsewhere. (It's also a .js-with-JSX file that
// the jest transform doesn't process.)
jest.unstable_mockModule('@/components/dashboard/CalendarSyncCard', () => ({
  __esModule: true,
  default: () => <div data-testid="calendar-sync-card" />,
}));

const mockUseSWRFetch = jest.fn();
jest.unstable_mockModule('@/hooks/useSWRFetch', () => ({
  __esModule: true,
  useSWRFetch: (...args) => mockUseSWRFetch(...args),
}));

const { default: CalendarConnectionsCard } = await import(
  '@/components/dashboard/CalendarConnectionsCard'
);

describe('CalendarConnectionsCard', () => {
  it('renders skeleton rows while integration status loads', () => {
    mockUseSWRFetch.mockReturnValue({ data: undefined, isLoading: true });
    const { container } = render(<CalendarConnectionsCard />);
    expect(screen.getByText('Connections')).toBeInTheDocument();
    expect(screen.getByTestId('calendar-sync-card')).toBeInTheDocument();
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0);
  });

  it('renders Connect links when neither business app is connected', () => {
    mockUseSWRFetch.mockReturnValue({ data: { jobber: null, xero: null }, isLoading: false });
    render(<CalendarConnectionsCard />);
    expect(screen.getAllByText('Not connected')).toHaveLength(2);
    expect(screen.getAllByRole('link', { name: 'Connect' })).toHaveLength(2);
    expect(screen.queryByText('Action needed')).not.toBeInTheDocument();
  });

  it('renders healthy state with Jobber copy hint when connected', () => {
    mockUseSWRFetch.mockReturnValue({
      data: {
        jobber: { provider: 'jobber', error_state: null, display_name: 'Acme Plumbing' },
        xero: null,
      },
      isLoading: false,
    });
    render(<CalendarConnectionsCard />);
    expect(screen.getByText('Acme Plumbing')).toBeInTheDocument();
    expect(screen.getByText(/push to jobber is coming soon/i)).toBeInTheDocument();
    expect(screen.queryByText('Action needed')).not.toBeInTheDocument();
  });

  it('surfaces reconnect state inline when a token refresh failed', () => {
    mockUseSWRFetch.mockReturnValue({
      data: {
        jobber: { provider: 'jobber', error_state: 'token_refresh_failed', display_name: null },
        xero: { provider: 'xero', error_state: null, display_name: 'Acme Books' },
      },
      isLoading: false,
    });
    render(<CalendarConnectionsCard />);
    expect(screen.getByText('Action needed')).toBeInTheDocument();
    expect(screen.getByText(/connection expired/i)).toBeInTheDocument();
    const reconnect = screen.getByRole('link', { name: 'Reconnect' });
    expect(reconnect).toHaveAttribute('href', '/dashboard/more/integrations');
    // Healthy Xero row must NOT show a reconnect affordance
    expect(screen.getAllByRole('link', { name: 'Reconnect' })).toHaveLength(1);
    // The "coming soon" hint is suppressed while Jobber needs a reconnect
    expect(screen.queryByText(/push to jobber is coming soon/i)).not.toBeInTheDocument();
  });
});
