---
phase: 38-programmatic-seo-content-engine
plan: 06
subsystem: seo-data-layer
tags: [seo, content, blog, personas, seed-data, gap-closure]
dependency_graph:
  requires: []
  provides: [blog-seed-data, persona-seed-data]
  affects: [blog-hub-page, persona-hub-page, sitemap]
tech_stack:
  added: []
  patterns: [static-data-array-export, cross-linked-relatedSlugs]
key_files:
  modified:
    - src/data/blog.js
    - src/data/personas.js
decisions:
  - "Blog posts use inline markdown headings (## split pattern) consistent with Phase 38 decision — no markdown library added"
  - "Persona relatedSlugs use slug values (not trade names) matching the router pattern in for/[persona]/page.js"
metrics:
  duration: "304 seconds (~5 minutes)"
  completed_date: "2026-04-06"
  tasks_completed: 2
  files_modified: 2
---

# Phase 38 Plan 06: Seed Data Gap Closure Summary

**One-liner:** Added 2 HVAC/electrician blog posts (1183-1230 words each) and 3 HVAC/electrician/handyman personas to close SC-7 and SC-8 gaps, bringing blog to 3 posts and personas to 4 trades with full cross-linking.

## What Was Built

This plan closed the content volume gap identified in 38-VERIFICATION.md. All templates and routes were already built; only seed data was missing.

### Task 1: Blog Posts (src/data/blog.js)

Added two new blog post objects to BLOG_POSTS array:

- `ai-receptionist-for-hvac` — "How HVAC Companies Are Booking 30% More Jobs With AI Receptionists" (1230 words, published 2025-11-15)
- `ai-receptionist-for-electricians` — "Why Electricians Lose 40% of Inbound Calls (And How To Fix It)" (1183 words, published 2025-12-01)

Updated the existing plumber post's `relatedSlugs` from `[]` to `['ai-receptionist-for-hvac', 'ai-receptionist-for-electricians']`.

All three posts have complete cross-linking via relatedSlugs forming a full triangle of internal links.

### Task 2: Personas (src/data/personas.js)

Added three new persona objects to PERSONAS array:

- `hvac-technician` — HVAC Technician persona with weather-based pain points and seasonal triage features
- `electrician` — Electrician persona with safety/panel/EV-charger pain points and emergency detection features
- `handyman` — Handyman persona with solo-operator pain points and multi-trade scheduling features

Updated the existing plumber persona's `relatedSlugs` from `[]` to `['hvac-technician', 'electrician', 'handyman']`.

All icons use valid ICON_MAP values: `Phone`, `Clock`, `DollarSign`.

## Verification Results

```
BLOG_POSTS count: 3
  ai-receptionist-for-plumbers: 1267 words, 2 related
  ai-receptionist-for-hvac: 1230 words, 2 related
  ai-receptionist-for-electricians: 1183 words, 2 related

PERSONAS count: 4
  plumber: 3 painPoints, 3 features, 3 related
  hvac-technician: 3 painPoints, 3 features, 3 related
  electrician: 3 painPoints, 3 features, 3 related
  handyman: 3 painPoints, 3 features, 3 related

seo-data-layer test suite: 23/23 passed
seo-sitemap test suite: 10/10 passed
```

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1 | 4c24fcf | feat(38-06): add HVAC and electrician seed blog posts |
| Task 2 | fe61324 | feat(38-06): add HVAC, electrician, and handyman seed personas |

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — all blog and persona content is fully wired. The data arrays are imported directly by the hub pages (`/blog/page.js` and `/for/page.js`) and detail pages (`/blog/[slug]/page.js` and `/for/[persona]/page.js`). All fields render live content.

## Self-Check

Files exist:
- src/data/blog.js: FOUND
- src/data/personas.js: FOUND

Commits exist:
- 4c24fcf: FOUND
- fe61324: FOUND

## Self-Check: PASSED
