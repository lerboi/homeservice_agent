'use client';

import { Joyride, STATUS } from 'react-joyride';
import { useReducedMotion } from 'framer-motion';

const STEPS = [
  {
    target: '[data-tour="home-page"]',
    content: "This is your command center. Check today's stats, upcoming appointments, and leads that need your attention.",
    disableBeacon: true,
    placement: 'bottom',
  },
  {
    target: '[href="/dashboard/leads"]',
    content: 'Your leads live here. Every call AI answers creates a lead you can track from new to paid.',
    placement: 'bottom',
  },
  {
    target: '[href="/dashboard/calendar"]',
    content: 'See your booked appointments and availability. Syncs with Google or Outlook calendar.',
    placement: 'bottom',
  },
  {
    target: '[href="/dashboard/calls"]',
    content: 'View every call your AI handled — duration, urgency, booking outcome, and more.',
    placement: 'bottom',
  },
  {
    target: '[href="/dashboard/analytics"]',
    content: 'Track your conversion rates, revenue, and call volume over time.',
    placement: 'bottom',
  },
  {
    target: '[href="/dashboard/more"]',
    content: 'Configure your services, working hours, calendar connections, and AI settings here.',
    placement: 'top',
  },
];

export default function DashboardTour({ run, onFinish }) {
  const prefersReduced = useReducedMotion();

  function handleCallback({ status }) {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem('gsd_has_seen_tour', '1');
      onFinish();
    }
  }

  return (
    <Joyride
      steps={STEPS}
      run={run}
      continuous
      showSkipButton
      showProgress
      disableScrolling={false}
      disableAnimation={!!prefersReduced}
      locale={{
        last: 'Got it',
        skip: 'Skip tour',
      }}
      styles={{
        options: {
          primaryColor: '#C2410C',
          backgroundColor: '#FFFFFF',
          textColor: '#0F172A',
          zIndex: 9999,
        },
        buttonNext: {
          backgroundColor: '#C2410C',
        },
        buttonBack: {
          color: '#475569',
        },
      }}
      callback={handleCallback}
    />
  );
}
