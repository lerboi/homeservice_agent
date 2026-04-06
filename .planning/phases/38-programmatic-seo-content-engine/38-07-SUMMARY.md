---
phase: 38-programmatic-seo-content-engine
plan: "07"
subsystem: seo-content-data
tags: [seo, data, comparisons, integrations, seed-data, gap-closure]
dependency_graph:
  requires: []
  provides: [comparisons-data-3-items, integrations-data-4-items]
  affects: [compare-hub-page, integrations-hub-page, compare-detail-pages, integration-detail-pages, sitemap]
tech_stack:
  added: []
  patterns: [data-array-extension, cross-linked-relatedSlugs]
key_files:
  modified:
    - src/data/comparisons.js
    - src/data/integrations.js
decisions:
  - "relatedSlugs cross-link all items within each data array for internal linking"
  - "ICON_MAP constraint respected — all integration useCases use Calendar/Clock/Bell/RefreshCw only"
metrics:
  duration_seconds: 156
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_modified: 2
---

# Phase 38 Plan 07: Seed Data Gap Closure Summary

**One-liner:** Added 2 comparisons (vs-answering-service, vs-hire-receptionist) and 3 integrations (outlook-calendar, stripe, twilio) to close the data volume gap found by VERIFICATION.md — compare hub now renders 3 cards, integrations hub renders 4.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Add 2 seed comparisons | c3b2f64 | src/data/comparisons.js |
| 2 | Add 3 seed integrations | 879ae6d | src/data/integrations.js |

## What Was Built

### Task 1: comparisons.js

Added `vs-answering-service` and `vs-hire-receptionist` to the COMPARISONS array, bringing the total from 1 to 3. Each comparison has:
- 10 feature rows with `name`, `voco` (boolean), `competitor` (boolean)
- `verdictHeading` and `verdictBody` strings
- Cross-linked `relatedSlugs` to the other two comparisons

Also updated the existing `vs-voicemail` entry's `relatedSlugs` from `[]` to `['vs-answering-service', 'vs-hire-receptionist']`.

### Task 2: integrations.js

Added `outlook-calendar`, `stripe`, and `twilio` to the INTEGRATIONS array, bringing the total from 1 to 4. Each integration has:
- `description` string (2+ sentences)
- 4 use cases with `icon`, `title`, `body`
- All icons within ICON_MAP bounds: `Calendar`, `Clock`, `Bell`, `RefreshCw`
- Cross-linked `relatedSlugs` to the other three integrations

Also updated the existing `google-calendar` entry's `relatedSlugs` from `[]` to `['outlook-calendar', 'stripe', 'twilio']`.

## Verification Results

```
COMPARISONS.length = 3  (was 1)
INTEGRATIONS.length = 4  (was 1)

seo-data-layer tests: 23/23 pass
seo-sitemap tests:    10/10 pass
```

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all data is substantive content (no placeholders, no TODOs, no empty values).

## Self-Check: PASSED

Files verified present:
- src/data/comparisons.js — FOUND
- src/data/integrations.js — FOUND

Commits verified:
- c3b2f64 — FOUND
- 879ae6d — FOUND
