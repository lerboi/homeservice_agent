'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const OnboardingContext = createContext(null);

export function OnboardingProvider({ children }) {
  const [completed, setCompleted] = useState(false);

  const markComplete = useCallback(() => setCompleted(true), []);

  return (
    <OnboardingContext.Provider value={{ completed, markComplete }}>
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding() {
  return useContext(OnboardingContext) || { completed: false, markComplete: () => {} };
}
