/**
 * @jest-environment jsdom
 *
 * Phase 58 Plan 01 Wave 0 scaffold — POLISH-04 primitive contract tests.
 *
 * These tests WILL FAIL until Plan 58-04 creates `src/components/ui/error-state.jsx`
 * and Jest config + RTL / jsdom are wired. See EmptyState.test.jsx for the same
 * infra prerequisites.
 *
 * Locked prop contract (58-UI-SPEC §4.2):
 *   <ErrorState message="..." onRetry={() => void} retryLabel="Try again" />
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { ErrorState } from '@/components/ui/error-state';

describe('ErrorState primitive (POLISH-04)', () => {
  it('renders role="alert" + fixed headline', () => {
    render(<ErrorState />);
    const region = screen.getByRole('alert');
    expect(region).toBeInTheDocument();
    expect(screen.getByText(/something went wrong/i)).toBeInTheDocument();
  });

  it('renders default message when prop omitted', () => {
    render(<ErrorState />);
    expect(
      screen.getByText(/we couldn't load this\. please try again\./i),
    ).toBeInTheDocument();
  });

  it('renders custom message when provided', () => {
    render(<ErrorState message="Network down" />);
    expect(screen.getByText(/network down/i)).toBeInTheDocument();
  });

  it('renders retry button only when onRetry provided', () => {
    const { rerender } = render(<ErrorState />);
    expect(screen.queryByRole('button', { name: /try again/i })).toBeNull();

    const onRetry = jest.fn();
    rerender(<ErrorState onRetry={onRetry} />);
    fireEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('uses custom retryLabel', () => {
    render(<ErrorState onRetry={() => {}} retryLabel="Retry now" />);
    expect(screen.getByRole('button', { name: /retry now/i })).toBeInTheDocument();
  });
});
