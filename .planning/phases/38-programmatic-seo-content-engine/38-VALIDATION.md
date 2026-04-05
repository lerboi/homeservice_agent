---
phase: 38
slug: programmatic-seo-content-engine
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-06
---

# Phase 38 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Jest 29.7.0 |
| **Config file** | `jest.config.js` |
| **Quick run command** | `npm test -- --testPathPattern=tests/unit/seo` |
| **Full suite command** | `npm test` |
| **Estimated runtime** | ~5 seconds |

---

## Sampling Rate

- **After every task commit:** Run `npm test -- --testPathPattern=tests/unit/seo`
- **After every plan wave:** Run `npm test`
- **Before `/gsd:verify-work`:** Full suite must be green
- **Max feedback latency:** 10 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|-----------|-------------------|-------------|--------|
| 38-01-01 | 01 | 1 | SEO-01 | unit | `npm test -- --testPathPattern=tests/unit/seo-sitemap` | ❌ W0 | ⬜ pending |
| 38-01-02 | 01 | 1 | SEO-01 | unit | `npm test -- --testPathPattern=tests/unit/seo-robots` | ❌ W0 | ⬜ pending |
| 38-01-03 | 01 | 1 | SEO-03 | unit | `npm test -- --testPathPattern=tests/unit/seo-data-layer` | ❌ W0 | ⬜ pending |
| 38-01-04 | 01 | 1 | SEO-09 | unit | `npm test -- --testPathPattern=tests/unit/seo-schema-markup` | ❌ W0 | ⬜ pending |
| 38-01-05 | 01 | 1 | SEO-10 | unit | `npm test -- --testPathPattern=tests/unit/seo-metadata` | ❌ W0 | ⬜ pending |
| 38-02-xx | 02 | 2 | SEO-02 | manual | — (curl/browser) | n/a | ⬜ pending |
| 38-02-xx | 02 | 2 | SEO-04–08 | manual | — (visual verification) | n/a | ⬜ pending |
| 38-03-xx | 03 | 3 | SEO-11 | manual | — (link audit) | n/a | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `tests/unit/seo-sitemap.test.js` — verifies sitemap.js returns array of objects with `url`, `lastModified`, `changeFrequency`, `priority` for each expected route
- [ ] `tests/unit/seo-robots.test.js` — verifies robots.js returns `{ rules: [{userAgent: '*', allow: '/'}], sitemap: 'https://voco.live/sitemap.xml' }`
- [ ] `tests/unit/seo-data-layer.test.js` — verifies each data array has at least 1 item and each item has required slug + title fields
- [ ] `tests/unit/seo-schema-markup.test.js` — verifies SchemaMarkup renders a `<script>` tag with valid JSON string and correct `@type`
- [ ] `tests/unit/seo-metadata.test.js` — verifies `generateMetadata` returns correct title format `{title} | Voco`, canonical URL, and OG image URL shape

*Existing infrastructure covers framework — only new test files needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| OG image renders correctly | SEO-02 | ImageResponse requires browser/curl to verify visual output | `curl -I localhost:3000/og?title=Test&type=blog` returns 200 + Content-Type image/png |
| Page templates render with seed data | SEO-04–08 | Visual layout verification | Visit each page type in browser, confirm layout matches UI-SPEC |
| Internal links present on all pages | SEO-11 | Link audit requires page navigation | Browse each hub and child page, verify links to hub, siblings, and CTA |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 10s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
