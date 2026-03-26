'use client';
import { useEffect, useState } from 'react';

export function useWizardSession(key, defaultValue) {
  const storageKey = `gsd_onboarding_${key}`;

  const [value, setValue] = useState(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  // Sync from sessionStorage after mount (avoids SSR mismatch)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem(storageKey);
      if (stored !== null) {
        setValue(JSON.parse(stored));
      }
    } catch {
      // sessionStorage unavailable
    }
    setHydrated(true);
  }, [storageKey]);

  // Persist to sessionStorage on change (only after initial hydration)
  useEffect(() => {
    if (!hydrated) return;
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // sessionStorage unavailable
    }
  }, [value, storageKey, hydrated]);

  return [value, setValue];
}

export function clearWizardSession() {
  if (typeof window === 'undefined') return;
  try {
    const keys = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k && k.startsWith('gsd_onboarding_')) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    // silent
  }
}
