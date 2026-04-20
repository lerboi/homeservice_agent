---
status: deferred
phase: 58-setup-checklist-final-wiring-skills-telemetry-uat-phase-51-polish-absorption
source: [58-CONTEXT.md, 58-RESEARCH.md, 58-VALIDATION.md, 58-UI-SPEC.md]
started: 2026-04-20
updated: 2026-04-20
deferred_to: Phase 999.6 (backlog)
---

## Current Test
[deferred to Phase 999.6 — see ROADMAP.md backlog]

## Tests

### 1. Xero connect flow — happy path
expected: Visiting /dashboard/more/integrations → Connect Xero → OAuth → callback → card shows Connected + Last synced just-now. Setup checklist connect_xero flips to complete.
result: pending
notes: |

### 2. Xero disconnect flow
expected: Disconnect button removes accounting_credentials row; card shows "Connect Xero"; setup checklist connect_xero flips back to incomplete (no red dot, just plain incomplete).
result: pending
notes: |

### 3. Xero token-refresh failure → red dot
expected: Force refresh_token invalidation in sandbox (revoke in Xero dashboard or corrupt stored refresh_token). Next agent fetch fails; `error_state='token_refresh_failed'` set on row. Setup checklist connect_xero flips to incomplete with RED DOT + "Reconnect needed" subtitle + CTA label "Reconnect". Integrations card shows reconnect banner.
result: pending
notes: |

### 4. Xero reconnect clears error
expected: From red-dot state (Test 3), click Reconnect → OAuth → callback nulls error_state. Red dot disappears; checklist returns to complete; Last synced timestamp present.
result: pending
notes: |

### 5. Jobber connect flow — happy path
expected: Same as Test 1, jobber side. Card shows Connected + Last synced. Checklist connect_jobber complete.
result: pending
notes: |

### 6. Jobber disconnect flow
expected: Same as Test 2, jobber side.
result: pending
notes: |

### 7. Jobber token-refresh failure → red dot
expected: Same as Test 3, jobber side.
result: pending
notes: |

### 8. Jobber reconnect clears error
expected: Same as Test 4, jobber side.
result: pending
notes: |

### 9. Real test call — customer context injection (Xero)
expected: Dial the tenant's Twilio number from a phone whose E.164 matches a known Xero customer. Verify post-call: activity_log has integration_fetch rows with provider='xero' and reasonable duration_ms. accounting_credentials.last_context_fetch_at updated. Agent referred to customer context during call (check transcript).
result: pending
notes: |

### 10. Real test call — Jobber customer context
expected: Same as Test 9, Jobber side; activity_log provider='jobber'. Run only if Jobber connected.
result: pending
notes: |

### 11. Pre-call fanout latency p95 ≤ 2.5s
expected: Run 20 staged test calls over 48h. Query activity_log for event_type='integration_fetch_fanout'. p95 duration_ms ≤ 2500. Record p50/p95/p99 numbers in 58-TELEMETRY-REPORT.md. (If fewer calls available, note sample size.)
result: pending
notes: |

### 12. Webhook miss → Phase 57 poll fallback (Jobber schedule)
expected: Disable Jobber webhook endpoint in sandbox (or simulate signature failure). Trigger a visit change in Jobber. Confirm the every-15-min /api/cron/poll-jobber-visits backfills the calendar_events row within one poll window.
result: pending
notes: |

### 13. POLISH-03 keyboard focus walk — all 7 pages
expected: Tab through every interactive element on jobs, calls, calendar, more/integrations, services, settings, more/billing. Each focused element shows copper (--brand-accent) ring with 1px offset. Mouse-clicking the same elements does NOT show the ring (focus-visible semantic). Both light and dark modes checked.
result: pending
notes: |

### 14. POLISH-01 empty states — spot-check 4 populated pages
expected: In a fresh tenant with no data: /dashboard/jobs, /dashboard/calls, /dashboard/calendar, /dashboard/services each render an EmptyState with icon + headline + description + CTA. CTA navigates correctly.
result: pending
notes: |

### 15. POLISH-02 loading skeletons — no CLS
expected: Throttle network to Slow 3G in DevTools. Visit each of 7 pages. No blank flashes; layout-matching skeletons render during fetch; measured CLS ≤ 0.1 per page (Chrome DevTools Performance panel).
result: pending
notes: |

### 16. POLISH-04 error + retry — mock fetch failure
expected: Block the primary fetch endpoint for each of 7 pages (DevTools Network request-block). Each page renders ErrorState with Retry button. Clicking Retry re-triggers the fetch (unblock simultaneously to verify recovery).
result: pending
notes: |

### 17. POLISH-05 async button — save settings flow
expected: In /dashboard/settings (or any settings panel), click Save. Button shows spinner + "Saving…" label + disabled state until server responds. Repeat for Connect/Disconnect Jobber, Add service.
result: pending
notes: |

### 18. Skill documentation sanity
expected: Spot-check .claude/skills/integrations-jobber-xero/SKILL.md exists with valid frontmatter. voice-call-architecture and dashboard-crm-system SKILL.md headers show "Last updated: 2026-04-20 — Phase 58". CLAUDE.md Core Application Skills table has integrations-jobber-xero row.
result: pending
notes: |

## Summary
total: 18
passed: 0
issues: 0
pending: 18
skipped: 0
