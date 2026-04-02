'use client';

import useSWR from 'swr';

const fetcher = (url) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  });

/**
 * Thin SWR wrapper with standard config for dashboard pages.
 *
 * @param {string|null} url — fetch URL, or null to skip fetching
 * @param {object} options — SWR options override
 * @returns {{ data, error, isLoading, mutate }}
 */
export function useSWRFetch(url, options = {}) {
  return useSWR(url, fetcher, {
    revalidateOnFocus: true,
    revalidateOnReconnect: true,
    dedupingInterval: 5000,
    ...options,
  });
}
