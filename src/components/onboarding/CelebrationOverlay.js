'use client';
import { useReducedMotion } from 'framer-motion';

export function CelebrationOverlay() {
  const prefersReducedMotion = useReducedMotion();

  return (
    <div className="flex flex-col items-center">
      {/* Radial pulse rings container */}
      <div className="relative flex items-center justify-center size-32">
        {!prefersReducedMotion && (
          <>
            <div
              className="absolute inset-0 rounded-full border-2 border-[#C2410C] animate-radial-pulse-1"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 rounded-full border-2 border-[#C2410C] animate-radial-pulse-2"
              aria-hidden="true"
            />
            <div
              className="absolute inset-0 rounded-full border-2 border-[#C2410C] animate-radial-pulse-3"
              aria-hidden="true"
            />
          </>
        )}

        {/* Animated checkmark SVG */}
        <svg
          viewBox="0 0 100 100"
          className="size-20 relative z-10"
          aria-label="Success checkmark"
          role="img"
        >
          <circle
            cx="50"
            cy="50"
            r="45"
            stroke="#166534"
            strokeWidth="3"
            fill="none"
            className={prefersReducedMotion ? 'opacity-100' : 'animate-draw-circle'}
          />
          <path
            d="M30 52 L45 67 L72 37"
            stroke="#166534"
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={prefersReducedMotion ? 'opacity-100' : 'animate-draw-check'}
          />
        </svg>
      </div>
    </div>
  );
}
