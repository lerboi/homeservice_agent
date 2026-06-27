'use client';

import { useEffect } from 'react';

/**
 * Reset a navigation "loading" flag when a page is shown again after the user
 * moved forward and then came back.
 *
 * The wizard step buttons set `loading = true` and then `router.push()` to the
 * next step WITHOUT clearing it (the component normally unmounts on success, so
 * the stale flag is harmless). But on Back the step can reappear with that stale
 * state still true — the browser restores the live JS heap from bfcache, and a
 * Back fired while the forward navigation is still pending leaves the very same
 * component instance mounted with `loading = true`. Either way the Continue
 * button is stuck: disabled and spinning, with no way to proceed.
 *
 * `pageshow` (incl. bfcache restore via `event.persisted`) and `popstate`
 * (browser/in-app Back/Forward) together cover every restore path; the on-mount
 * call covers a genuine remount. `reset` must be a stable setter (e.g. the
 * `setX` from `useState`).
 */
export function useClearLoadingOnPageRestore(reset) {
  useEffect(() => {
    reset();
    const clear = () => reset();
    window.addEventListener('pageshow', clear);
    window.addEventListener('popstate', clear);
    return () => {
      window.removeEventListener('pageshow', clear);
      window.removeEventListener('popstate', clear);
    };
  }, [reset]);
}
