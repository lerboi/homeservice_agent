// Phase 58 Plan 58-04: thin wrapper around <EmptyState> (POLISH-01).
// The hardcoded markup previously here is now centralised in
// src/components/ui/empty-state.jsx — preserving this file name + named export
// keeps every current caller (`/dashboard/jobs/page.js:23`) working without edit.

import { Users } from 'lucide-react';
import { EmptyState } from '@/components/ui/empty-state';

export function EmptyStateLeads() {
  return (
    <EmptyState
      icon={Users}
      headline="No jobs yet"
      description="When callers reach your AI, jobs appear here with caller details, job type, and urgency."
      ctaLabel="Make a Test Call"
      ctaHref="/dashboard/more/ai-voice-settings"
    />
  );
}
