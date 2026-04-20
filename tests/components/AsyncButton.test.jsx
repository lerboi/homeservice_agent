/**
 * @jest-environment jsdom
 *
 * Phase 58 Plan 01 Wave 0 scaffold — POLISH-05 primitive contract tests.
 *
 * These tests WILL FAIL until Plan 58-04 creates `src/components/ui/async-button.jsx`
 * and Jest config + RTL / jsdom are wired. See EmptyState.test.jsx for the same
 * infra prerequisites.
 *
 * Locked prop contract (58-UI-SPEC §4.3):
 *   <AsyncButton pending={isSaving} pendingLabel="Saving…">Save changes</AsyncButton>
 *   - pending: boolean — disables button + shows Loader2 (animate-spin)
 *   - pendingLabel: string — replaces children while pending; falls back to children
 *   - All other props (variant, size, onClick, type, className, disabled) pass through
 *   - parent disabled ORs with pending
 */

import { describe, it, expect, jest } from '@jest/globals';
import { render, screen, fireEvent } from '@testing-library/react';
import { AsyncButton } from '@/components/ui/async-button';

describe('AsyncButton primitive (POLISH-05)', () => {
  it('idle state: renders children, not disabled', () => {
    render(<AsyncButton pending={false}>Save changes</AsyncButton>);
    const btn = screen.getByRole('button', { name: /save changes/i });
    expect(btn).not.toBeDisabled();
  });

  it('pending state: disabled + spinner + pendingLabel', () => {
    render(
      <AsyncButton pending={true} pendingLabel="Saving…">
        Save changes
      </AsyncButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.querySelector('.animate-spin')).not.toBeNull();
    expect(screen.getByText(/saving…/i)).toBeInTheDocument();
  });

  it('pending without pendingLabel falls back to children', () => {
    render(<AsyncButton pending={true}>Save changes</AsyncButton>);
    expect(screen.getByText(/save changes/i)).toBeInTheDocument();
  });

  it('parent disabled prop ORs with pending', () => {
    render(
      <AsyncButton pending={false} disabled={true}>
        X
      </AsyncButton>,
    );
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('passes through onClick when not pending', () => {
    const onClick = jest.fn();
    render(
      <AsyncButton pending={false} onClick={onClick}>
        Go
      </AsyncButton>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when pending (button disabled)', () => {
    const onClick = jest.fn();
    render(
      <AsyncButton pending={true} onClick={onClick}>
        Go
      </AsyncButton>,
    );
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});
