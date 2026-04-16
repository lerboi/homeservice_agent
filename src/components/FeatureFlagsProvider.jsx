'use client';

import { createContext, useContext } from 'react';

/**
 * Default flags — used when no Provider is mounted (e.g., during initial mount,
 * or in routes outside the dashboard tree). Fail-closed: invoicing OFF.
 */
const DEFAULT_FLAGS = { invoicing: false };

const FeatureFlagsContext = createContext(DEFAULT_FLAGS);

/**
 * Wraps the dashboard subtree and distributes per-tenant feature flags.
 *
 * Mounted by `src/app/dashboard/DashboardLayoutClient.jsx` (Plan 03) and given
 * the flags object that the Server layout wrapper resolved via getTenantFeatures().
 *
 * @param {{ value: { invoicing: boolean }, children: React.ReactNode }} props
 */
export function FeatureFlagsProvider({ value, children }) {
  return (
    <FeatureFlagsContext.Provider value={value || DEFAULT_FLAGS}>
      {children}
    </FeatureFlagsContext.Provider>
  );
}

/**
 * Reads the current feature flags from Context.
 *
 * Returns DEFAULT_FLAGS when called outside a <FeatureFlagsProvider> — this is
 * intentional fail-closed behaviour: components rendered outside the dashboard
 * tree (e.g., login page) see invoicing OFF and hide invoicing UI by default.
 *
 * @returns {{ invoicing: boolean }}
 */
export function useFeatureFlags() {
  return useContext(FeatureFlagsContext);
}
