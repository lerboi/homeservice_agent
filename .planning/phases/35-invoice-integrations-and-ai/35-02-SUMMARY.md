---
phase: 35-invoice-integrations-and-ai
plan: 02
subsystem: ai, api, ui
tags: [gemini-flash, google-genai, invoice, ai-descriptions, transcript]

# Dependency graph
requires:
  - phase: 33-invoice-core
    provides: "Invoice schema, InvoiceEditor component, invoice API routes"
provides:
  - "AI description generation library (Gemini 2.0 Flash)"
  - "POST /api/invoices/[id]/ai-describe endpoint"
  - "AI Describe button with accept/discard preview in InvoiceEditor"
affects: [35-invoice-integrations-and-ai, dashboard-crm-system]

# Tech tracking
tech-stack:
  added: ["@google/genai"]
  patterns: ["Gemini Flash text generation via @google/genai SDK", "AI preview with per-item accept/discard UI pattern"]

key-files:
  created:
    - "src/lib/ai/invoice-describe.js"
    - "src/app/api/invoices/[id]/ai-describe/route.js"
  modified:
    - "src/components/dashboard/InvoiceEditor.jsx"

key-decisions:
  - "Used @google/genai SDK (not older @google/generative-ai) for Gemini 2.0 Flash access"
  - "Markdown code fence stripping before JSON.parse for robust response parsing"
  - "AI Describe button only renders when invoiceId prop exists (saved invoices, not create-new mode)"

patterns-established:
  - "AI generation preview pattern: generate, preview below each item, accept/discard individually or bulk"
  - "Gemini Flash integration via @google/genai with GEMINI_API_KEY env var"

requirements-completed: [D-06, D-07, D-08, D-09]

# Metrics
duration: 6min
completed: 2026-04-01
---

# Phase 35 Plan 02: AI Describe Summary

**Gemini 2.0 Flash AI descriptions from call transcripts with per-line-item accept/discard preview in InvoiceEditor**

## Performance

- **Duration:** 6 min
- **Started:** 2026-04-01T11:11:31Z
- **Completed:** 2026-04-01T11:17:12Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- AI description library fetches transcripts via lead_calls junction table and generates trade-specific descriptions via Gemini Flash
- API endpoint validates invoice has linked lead with transcripts before generating (400 errors for missing lead, missing transcript, missing line items)
- InvoiceEditor shows AI Describe button with Sparkles icon, disabled tooltip when no transcript linked, and loading state with spinner
- Accept/discard preview cards below each line item with individual and bulk (Accept All/Discard All) actions

## Task Commits

Each task was committed atomically:

1. **Task 1: AI description library and API endpoint** - `f607bf4` (feat)
2. **Task 2: AI Describe button and preview UI in InvoiceEditor** - `6fc33a4` (feat)
3. **Dependency: @google/genai** - `40df8cb` (chore)

## Files Created/Modified
- `src/lib/ai/invoice-describe.js` - Transcript fetch (lead_calls junction) and Gemini Flash description generation
- `src/app/api/invoices/[id]/ai-describe/route.js` - POST endpoint with auth, validation, and error handling
- `src/components/dashboard/InvoiceEditor.jsx` - AI Describe button, preview cards, accept/discard handlers
- `package.json` - Added @google/genai dependency

## Decisions Made
- Used @google/genai SDK (latest, replaces deprecated @google/generative-ai) for Gemini 2.0 Flash
- Strip markdown code fences before JSON.parse to handle model response variations
- AI Describe button only renders when invoiceId prop exists (saved invoices only, not create-new mode)
- Tooltip on disabled button explains "No call transcript linked to this invoice"

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
- GEMINI_API_KEY environment variable must be set for AI description generation to work

## Next Phase Readiness
- AI description system complete and ready for use
- InvoiceEditor accepts new props (invoiceId, leadId, hasTranscript) that parent pages need to pass through

## Self-Check: PASSED

All files and commits verified.

---
*Phase: 35-invoice-integrations-and-ai*
*Completed: 2026-04-01*
