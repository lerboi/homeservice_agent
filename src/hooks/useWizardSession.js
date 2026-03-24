'use client';
import { useEffect, useState } from 'react';

export function useWizardSession(key, defaultValue) {
  const storageKey = `gsd_onboarding_${key}`;

  const [value, setValue] = useState(() => {
    if (typeof window === 'undefined') return defaultValue;
    try {
      const stored = sessionStorage.getItem(storageKey);
      return stored ? JSON.parse(stored) : defaultValue;
    } catch {
      return defaultValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, JSON.stringify(value));
    } catch {
      // sessionStorage unavailable — degrade gracefully
    }
  }, [value, storageKey]);

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
