'use client';

import { useEffect, useMemo, useState } from 'react';
import { Joyride, STATUS } from 'react-joyride';

// Tour flow: a centered welcome modal → spotlighted, auto-scrolling steps on
// real dashboard elements → a centered "you're all set" modal.
//
// `placement: 'center'` renders a modal (no spotlight, no scroll) — perfect for
// the intro/outro. The middle steps anchor to compact, always-present elements
// (status block, readiness card, daily-ops bento, the nav) so react-joyride can
// smooth-scroll each into view. The nav lives in two places — the desktop
// sidebar (`hidden lg:flex`) and the mobile bottom bar (`lg:hidden`) — so we
// point at whichever is rendered for the current breakpoint.
//
// `hasReadiness` gates the call-readiness step: that card hides itself once the
// owner is fully set up, so we only include the step when the element is
// actually in the DOM (computed when the tour starts — see the effect below).
function buildSteps(desktop, hasReadiness) {
  const steps = [
    {
      target: 'body',
      placement: 'center',
      title: 'Welcome to Voco 👋',
      content: "Your AI receptionist is already answering calls 24/7. Here's a quick 30-second tour to get you fully set up.",
    },
    {
      target: '[data-tour="ai-status"]',
      placement: desktop ? 'right' : 'bottom',
      title: 'Your AI, live 24/7',
      content: "This is your receptionist's status. A green dot means it's picking up every call — day, night, and weekends.",
    },
  ];

  if (hasReadiness) {
    steps.push({
      target: '[data-tour="call-readiness"]',
      placement: 'bottom',
      title: 'Get call-ready',
      content: 'This shows how close your AI is to fully handling calls. Work through each essential — it always points you to the single next step.',
    });
  }

  steps.push(
    {
      target: '[data-tour="todays-appointments"]',
      placement: 'bottom',
      title: 'Your day at a glance',
      content: 'Every appointment your AI books lands right here — plus calls handled, hot jobs, and usage just below.',
    },
    {
      target: desktop ? '[data-tour="sidebar-nav"]' : '[data-tour="bottom-nav"]',
      placement: desktop ? 'right' : 'top',
      title: 'Find everything here',
      content: 'Jump to your jobs, calls, calendar, customers, and settings anytime from the menu.',
    },
    {
      target: 'body',
      placement: 'center',
      title: 'You’re all set 🎉',
      content: 'That’s the tour! Your AI is already working in the background. You can replay this anytime from “Take the tour”.',
    }
  );

  return steps;
}

export default function DashboardTour({ run, onFinish }) {
  // Track the lg breakpoint so nav targeting + placement match the visible nav.
  // Memoized so the steps array stays stable until the breakpoint crosses.
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(min-width: 1024px)');
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  // Build steps from the current breakpoint, including the call-readiness step
  // only while that card is mounted (it hides once the owner is fully set up).
  // Computed during render (not via setState-in-effect, which the project bans);
  // by the time `run` flips true the DOM already reflects the mounted card.
  const steps = useMemo(() => {
    const hasReadiness =
      run &&
      typeof document !== 'undefined' &&
      !!document.querySelector('[data-tour="call-readiness"]');
    return buildSteps(desktop, hasReadiness);
  }, [run, desktop]);

  // onEvent fires for every tour event; persist + close on the terminal ones.
  function handleEvent({ status }) {
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      localStorage.setItem('gsd_has_seen_tour', '1');
      // Let the home page's "Take the tour" button update its label live
      // (the native `storage` event doesn't fire in the same tab).
      window.dispatchEvent(new Event('voco-tour-seen-change'));
      onFinish();
    }
  }

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      scrollToFirstStep
      // Behavior + theme. v3 keeps these on the `options` prop (not styles.options).
      // Design tokens are OKLCH, so reference the vars directly (no hsl() wrapper).
      options={{
        primaryColor: 'var(--brand-accent)',
        backgroundColor: 'var(--popover)',
        textColor: 'var(--popover-foreground)',
        arrowColor: 'var(--popover)',
        overlayColor: 'rgba(0, 0, 0, 0.55)',
        zIndex: 10000,
        width: 360,
        spotlightPadding: 8,
        spotlightRadius: 12,
        scrollOffset: 96,
        scrollDuration: 350,
        skipBeacon: true,
        // Guided experience: the page is non-interactive during the tour, so a
        // stray click on a highlighted link or the backdrop can't derail it.
        blockTargetInteraction: true,
        overlayClickAction: false,
        buttons: ['skip', 'back', 'primary'],
      }}
      locale={{
        back: 'Back',
        last: 'Got it',
        next: 'Next',
        skip: 'Skip',
      }}
      styles={{
        tooltip: {
          borderRadius: 14,
          padding: 22,
          boxShadow: '0 16px 48px rgba(0, 0, 0, 0.4)',
          border: '1px solid var(--border)',
        },
        tooltipContainer: {
          textAlign: 'left',
        },
        tooltipTitle: {
          fontSize: 16,
          fontWeight: 600,
          margin: '0 0 6px',
          color: 'var(--popover-foreground)',
        },
        tooltipContent: {
          padding: 0,
          fontSize: 14,
          lineHeight: 1.55,
          color: 'var(--muted-foreground)',
        },
        tooltipFooter: {
          marginTop: 18,
        },
        buttonPrimary: {
          backgroundColor: 'var(--brand-accent)',
          color: 'var(--brand-accent-fg)',
          borderRadius: 8,
          padding: '9px 16px',
          fontSize: 14,
          fontWeight: 500,
        },
        buttonBack: {
          color: 'var(--muted-foreground)',
          fontSize: 13,
          marginRight: 8,
        },
        buttonSkip: {
          color: 'var(--muted-foreground)',
          fontSize: 13,
        },
      }}
      onEvent={handleEvent}
    />
  );
}
