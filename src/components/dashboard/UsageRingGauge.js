'use client';

import { useState, useEffect } from 'react';

/**
 * UsageRingGauge — SVG donut ring gauge for call usage visualization.
 *
 * Shows calls_used / calls_limit with overage overflow visualization.
 * Normal usage: brand orange arc up to 100%.
 * Overage: base arc at 100% + amber overage arc (capped at 50% additional visual arc).
 *
 * Props:
 * - callsUsed: number of calls used this billing period
 * - callsLimit: plan call limit for this billing period
 * - overageRate: per-call overage rate in dollars (e.g. 2.48)
 */
export default function UsageRingGauge({ callsUsed = 0, callsLimit = 0, overageRate = 0 }) {
  const [animated, setAnimated] = useState(false);

  const radius = 50;
  const circumference = 2 * Math.PI * radius; // ~314.16

  // Determine fill percentage for main arc (clamped to 1 at max)
  const fillPercentage = callsLimit > 0 ? Math.min(callsUsed / callsLimit, 1) : 0;

  // Calculate overage
  const isOverage = callsUsed > callsLimit;
  const overageCount = isOverage ? callsUsed - callsLimit : 0;

  // Overage arc percentage: capped at 50% additional visual arc
  const overagePercentage =
    isOverage && callsLimit > 0 ? Math.min((callsUsed - callsLimit) / callsLimit, 0.5) : 0;

  const overageArcLength = overagePercentage * circumference;

  // Animated stroke-dashoffset: starts at circumference (no arc), animates to target
  const targetMainOffset = circumference * (1 - fillPercentage);
  const mainOffset = animated ? targetMainOffset : circumference;
  const overageOffset = animated ? circumference - overageArcLength : circumference;

  const ariaLabel = isOverage
    ? `Usage: ${callsUsed} of ${callsLimit} calls used this billing period, plus ${overageCount} overage calls`
    : `Usage: ${callsUsed} of ${callsLimit} calls used this billing period`;

  useEffect(() => {
    // Respect prefers-reduced-motion: show final state immediately, skip animation
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) {
      setAnimated(true);
      return;
    }

    // Trigger animation on mount via requestAnimationFrame to ensure transition fires
    const raf = requestAnimationFrame(() => {
      setAnimated(true);
    });
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      <svg
        role="img"
        aria-label={ariaLabel}
        viewBox="0 0 120 120"
        width="120"
        height="120"
        className="overflow-visible"
      >
        {/* Background track — full circle in stone-200 */}
        <circle
          cx="60"
          cy="60"
          r={radius}
          fill="none"
          stroke="#E7E5E4"
          strokeWidth="10"
        />

        {/* Main fill arc — brand orange, clockwise from 12 o'clock */}
        {(callsUsed > 0 || fillPercentage > 0) && (
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#C2410C"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={mainOffset}
            transform="rotate(-90 60 60)"
            style={{ transition: animated ? 'stroke-dashoffset 600ms ease-out' : 'none' }}
          />
        )}

        {/* Overage arc — amber-500, starts where base fill ends */}
        {isOverage && overageArcLength > 0 && (
          <circle
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke="#F59E0B"
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${overageArcLength} ${circumference - overageArcLength}`}
            strokeDashoffset={overageOffset}
            transform="rotate(-90 60 60)"
            style={{
              transition: animated ? 'stroke-dashoffset 600ms ease-out 300ms' : 'none',
            }}
          />
        )}

        {/* Center text: calls used count */}
        <text
          x="60"
          y="56"
          textAnchor="middle"
          fontSize="28"
          fontWeight="600"
          fill="#0F172A"
          dominantBaseline="middle"
        >
          {callsUsed}
        </text>

        {/* Center text: "of {limit}" label */}
        <text
          x="60"
          y="72"
          textAnchor="middle"
          fontSize="12"
          fill="#475569"
        >
          of {callsLimit}
        </text>
      </svg>

      {/* Below ring text */}
      <div className="text-center space-y-1">
        <p className="text-sm text-[#475569]">
          {callsUsed} of {callsLimit} included calls used
        </p>
        {isOverage && (
          <p className="text-xs text-[#F59E0B]">
            {overageCount} overage {overageCount === 1 ? 'call' : 'calls'} at ${overageRate}/call
          </p>
        )}
      </div>
    </div>
  );
}
