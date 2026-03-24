# Pitfalls Research

**Domain:** Voice AI system pivot from escalation-first to booking-first digital dispatcher
**Researched:** 2026-03-24
**Confidence:** HIGH (derived from direct codebase analysis + domain knowledge of LLM-driven voice systems)

## Critical Pitfalls

### Pitfall 1: Prompt Regression -- AI Still Tries to Escalate Instead of Book

**What goes wrong:**
The current `agent-prompt.js` contains explicit triage-aware behavior that tells the AI to "respond with urgency" for emergencies and "take a relaxed approach" for routine calls. The booking flow section (lines 78-79) instructs: "For ROUTINE calls: Use relaxed tone. Offer booking but don't pressure -- create lead if they decline." This language teaches the AI that routine = optional booking. After the pivot, if these remnants remain, the AI will still create leads instead of booking for routine calls, and may still try to transfer emergency callers ("let me get someone to you right away" in the TRIAGE-AWARE BEHAVIOR section) instead of booking them into the nearest slot.

**Why it happens:**
The system prompt is a single monolithic function (`buildSystemPrompt`) that mixes triage behavior with booking flow. Developers update the booking flow section but forget to remove or rewrite the triage behavior section. The LLM receives contradictory instructions: "book everyone" in one section vs. "respond with urgency and escalate" in another. LLMs resolve contradictions unpredictably -- sometimes they book, sometimes they escalate, depending on the conversation context.

**How to avoid:**
1. Delete the entire `TRIAGE-AWARE BEHAVIOR` section from the prompt. Urgency detection should still happen (via `classifyCall`) but it must not appear in the voice prompt as behavioral routing.
2. Rewrite the `BOOKING FLOW` section to remove the emergency/routine fork. Replace with a single flow: "Always book. For emergencies, book the earliest available slot. For routine, book the next convenient slot."
3. Remove the "create lead if they decline" instruction for routine callers. Replace with: "If the caller declines booking, confirm you'll send a link to book online" (recovery SMS path).
4. Explicitly add a negative instruction: "Never offer to transfer the call unless the caller explicitly asks to speak with a human or you cannot understand their request."
5. Write prompt regression tests that assert the absence of escalation-routing language and the presence of booking-first language.

**Warning signs:**
- Test calls where the AI says "let me get someone to you right away" instead of offering slots
- Routine callers being told "I'll save your information" instead of being offered appointment times
- `transfer_call` function invocation rate not dropping after the prompt rewrite
- Lead creation rate staying the same (should drop as bookings increase)

**Phase to address:**
Phase 1 (Agent Prompt Rewrite) -- this is the foundation. Every other phase depends on the AI actually booking first.

---

### Pitfall 2: Triage Logic Leaking Into Booking Decisions

**What goes wrong:**
The `classifyCall` pipeline (layer1-keywords -> layer2-llm -> layer3-rules) runs in `processCallAnalyzed` (call-processor.js, line 143-150) and stores `urgency_classification` on the call record. Currently, this urgency value flows into: (a) the `atomicBookSlot` call as the `urgency` parameter, (b) the `createOrMergeLead` call via `triageResult`, and (c) notification formatting. The risk is that developers wire urgency into booking-path decisions -- e.g., "if emergency, book immediately; if routine, create lead" -- recreating the old escalation model inside the new booking flow. The current `call-processor.js` already does this: line 172 has `const isRoutineUnbooked = triageResult.urgency === 'routine' && !appointmentExists;` which triggers `suggested_slots` calculation only for routine unbooked calls. This logic assumes routine calls won't be booked, which is the old model.

**Why it happens:**
The three-layer triage system is deeply embedded. It runs post-call, stores results on call records, and feeds into lead creation. Developers naturally branch on urgency because the data is right there. The mental model "emergency = special handling" is sticky -- even when the spec says urgency is just notification priority.

**How to avoid:**
1. Create a clear architectural boundary: triage output feeds ONLY into `sendOwnerNotifications` (formatting and delivery priority). It must not affect booking path, lead status, or slot selection.
2. Remove the `isRoutineUnbooked` conditional in `call-processor.js`. After the pivot, ALL unbooked calls (regardless of urgency) should get suggested_slots and recovery SMS.
3. Keep the `urgency` field on appointments for display purposes, but add a code comment: "Urgency is informational only -- it does not affect slot selection or booking eligibility."
4. Add a lint rule or code review checklist item: "Does this code branch on urgency for anything other than notification formatting?"

**Warning signs:**
- Any `if (urgency === 'emergency')` or `if (urgency === 'routine')` in booking or lead-creation code paths
- Recovery SMS cron (`send-recovery-sms/route.js`) still skipping calls based on urgency
- Dashboard showing different statuses for emergency vs. routine calls beyond badge color
- Suggested slots only calculated for routine calls (current bug that must be fixed)

**Phase to address:**
Phase 2 (Triage Reclassification) -- must be done immediately after prompt rewrite, before booking flow universalization. Otherwise the old triage-routing logic will conflict with new booking behavior.

---

### Pitfall 3: Over-Booking -- AI Books Callers Who Don't Want a Booking

**What goes wrong:**
Booking-first means the AI defaults to booking everyone. But some callers have no intent to book: price shoppers ("How much do you charge for...?"), information seekers ("Do you service my area?"), existing customers checking on an existing appointment, salespeople, wrong numbers. If the AI aggressively pushes booking on these callers, it creates ghost appointments that waste the owner's time, damages caller experience, and fills the calendar with no-shows.

**Why it happens:**
The prompt says "book every call" and the LLM takes it literally. Without explicit carve-outs for non-booking intents, the AI will try to schedule a plumber for someone who just wants a price quote. The current prompt has no intent classification -- it jumps straight from information gathering to slot offering.

**How to avoid:**
1. Add an explicit intent-detection step in the prompt before the booking flow: "First determine if the caller needs a service appointment. If they only want information (pricing, service area, hours), answer their question and then offer: 'Would you like me to schedule a visit while we're on the line?'"
2. Define non-booking intents explicitly in the prompt: price inquiries, existing appointment inquiries, sales calls, complaints, wrong numbers. For each, define the correct handling.
3. Add a `booking_offered` boolean to the call metadata so you can track how often the AI offers booking vs. how often it books. A high offer-to-book ratio is healthy; a low one means the AI is being too aggressive.
4. Never auto-book without verbal confirmation from the caller. The current prompt already requires slot selection + address confirmation -- keep this gate.

**Warning signs:**
- High appointment cancellation or no-show rate after going live
- Caller complaints about being "forced to book"
- Calendar filling up with appointments from callers who just had questions
- Short call durations (< 2 min) resulting in bookings (suspicious -- not enough time for real booking flow)

**Phase to address:**
Phase 1 (Agent Prompt Rewrite) -- intent detection must be part of the booking-first prompt, not bolted on later.

---

### Pitfall 4: Notification Fatigue From Booking Every Call

**What goes wrong:**
Currently, `sendOwnerNotifications` fires for every lead created (call-processor.js, line 302). If every call now creates a booking instead of just emergencies, the owner gets an SMS and email for every single call -- including the routine ones that previously were quiet leads. A plumber getting 15-20 calls/day now gets 15-20 SMS alerts. They mute notifications. Then they miss the genuine emergency at 2 AM.

**Why it happens:**
The v1.0 notification system was designed for a world where notifications meant "something important happened." In the booking-first model, every call is "important" by definition. The signal-to-noise ratio collapses. The current `sendOwnerSMS` function (notifications.js, line 53) formats every notification the same way, just with a different urgency label.

**How to avoid:**
1. Implement tiered notification delivery based on urgency:
   - Emergency bookings: immediate SMS + email + push (high-priority channel)
   - High-ticket bookings: immediate email + push, SMS only during business hours
   - Routine bookings: daily digest email, no SMS unless owner opts in
2. Change the notification trigger: don't notify on every booking creation. Notify on: (a) emergency bookings always, (b) routine bookings via batched digest, (c) failed bookings always (owner needs to know).
3. Add notification preferences to the onboarding/settings flow so owners can control their threshold.
4. Use different SMS templates: emergency gets an urgent tone with action required; routine gets a calm confirmation.

**Warning signs:**
- Owners complaining about too many notifications
- Owners unsubscribing from SMS (breaking the emergency notification channel)
- Low dashboard engagement (owners stop checking because notifications are noise)
- Response time to emergency notifications increasing (lost in the flood)

**Phase to address:**
Phase 5 (Notification Priority System) -- but design the tiering in Phase 1 so the prompt rewrite knows what urgency tags are used for.

---

### Pitfall 5: Calendar Flooding -- No Guardrails on Autonomous Booking Volume

**What goes wrong:**
With the AI booking every call, a busy home service business could have 20+ appointments booked per day. Without maximum booking limits, buffer times between appointments, and geographic clustering, the owner arrives at the first job and realizes they have 6 appointments across town in the next 3 hours. The calendar becomes physically impossible to fulfill. Worse: if a competitor or spam caller repeatedly calls, the AI books fake appointments that consume real slots.

**Why it happens:**
The current `atomicBookSlot` only prevents double-booking of the same slot. It does not enforce: max bookings per day, minimum travel time between appointments (zone travel buffers exist in DB but are only used for slot calculation, not as hard constraints), or rate limiting per phone number. The system trusts every caller is legitimate.

**How to avoid:**
1. Add a max-bookings-per-day limit per tenant (configurable, default 12). Once hit, the AI says "Our schedule is full for today, the next available is [tomorrow slot]."
2. Enforce zone travel buffers as hard constraints in `atomicBookSlot`, not just soft preferences in slot calculation. If the previous appointment is in Zone A and the next request is in Zone B with a 30-min buffer, the booking should account for it.
3. Add phone number rate limiting: max 2 bookings per phone number per week. Prevents spam/abuse.
4. Add a "tentative" booking status for the first booking from a new phone number, auto-confirmed after 15 minutes (gives owner time to review if needed).
5. Expose a daily booking cap and "pause new bookings" toggle in the dashboard.

**Warning signs:**
- Owners cancelling multiple bookings per day (physically impossible schedule)
- Same phone number creating multiple bookings
- No travel buffer between back-to-back appointments in different zones
- Calendar showing 100% utilization (no room for emergencies)

**Phase to address:**
Phase 3 (Booking Flow Universalization) -- this is where the atomic booking logic needs hardening.

---

### Pitfall 6: Silent Fallback Chain Failures

**What goes wrong:**
The booking-first model creates a longer chain of fallbacks: AI tries to book -> booking fails -> AI offers alternative slot -> that fails too -> call ends -> recovery SMS fires -> SMS delivery fails -> caller is lost. Each link in this chain can fail silently. The current `sendCallerRecoverySMS` (notifications.js, line 103) catches errors and logs them but returns undefined -- the cron job (send-recovery-sms/route.js) treats this as success and marks `recovery_sms_sent_at`. The caller never gets the SMS, and the system thinks it was sent.

**Why it happens:**
The v1.0 system had fewer fallback paths. Recovery SMS was only for unbooked callers, and notification failures were acceptable because the lead was captured anyway. In the booking-first model, recovery SMS is the last safety net -- if it fails silently, the caller has no way to book and no way to reach the business.

**How to avoid:**
1. Make `sendCallerRecoverySMS` return a success/failure boolean. Only mark `recovery_sms_sent_at` if the SMS was actually delivered (check Twilio message status, not just API call success).
2. Add a retry mechanism: if recovery SMS fails, retry up to 3 times with exponential backoff before marking as permanently failed.
3. Add a `recovery_sms_status` column (pending/sent/failed/delivered) instead of just a timestamp. Query for failed SMS in the dashboard.
4. Add a dead-letter alert: if more than 5% of recovery SMS fail in a day, alert the system admin.
5. Track the full fallback chain per call: `booking_attempted` -> `booking_succeeded` -> `recovery_sms_sent` -> `recovery_sms_delivered`. Surface broken chains in the dashboard.

**Warning signs:**
- `recovery_sms_sent_at` is populated but Twilio delivery reports show failures
- Callers calling back saying they never got a link
- High `recovery_sms_sent_at` population but low click-through on booking links
- The cron job processing calls but `sent` count is always 0 (silent failures)

**Phase to address:**
Phase 6 (Recovery SMS Universal Fallback) -- but the monitoring/observability should be designed in Phase 3 (booking flow).

---

### Pitfall 7: Loss of Human Oversight for Genuine Emergencies

**What goes wrong:**
In the old model, emergencies triggered proactive transfer to the owner. The owner was in the loop for every emergency. In the booking-first model, the AI autonomously books the emergency into the nearest slot and sends a high-priority notification. If the notification is delayed (SMS queue, email spam filter, owner's phone on silent), the owner doesn't know about the gas leak until they check the dashboard. A 30-minute delay for a gas leak is unacceptable.

**Why it happens:**
The pivot spec says "escalation only on exception states" and treats emergencies the same as routine calls for booking purposes. This is correct for the booking flow, but the notification path for emergencies must be upgraded to compensate for removing the proactive transfer. The current `sendOwnerNotifications` is fire-and-forget with no delivery confirmation or escalation on failure.

**How to avoid:**
1. For emergency bookings: send notification through ALL channels simultaneously (SMS + email + push + phone call to owner if SMS unconfirmed after 2 minutes).
2. Add delivery confirmation for emergency notifications: poll Twilio message status. If not delivered within 2 minutes, escalate to the next channel.
3. Keep the `transfer_call` function available but only invoke it when: (a) the caller explicitly asks for a human, or (b) the emergency notification to the owner fails delivery within a timeout.
4. Add an emergency acknowledgment flow: owner must tap a link in the SMS to acknowledge. If not acknowledged within 5 minutes, auto-call the owner's phone.
5. Never remove emergency escalation contacts -- the `escalation_contacts` table exists for a reason. Use it as a backup chain when the primary owner doesn't acknowledge.

**Warning signs:**
- Emergency bookings with no owner acknowledgment within 5 minutes
- Owner reporting they didn't know about an emergency until hours later
- Emergency notification delivery rate below 99%
- Escalation contacts table being ignored or deprioritized

**Phase to address:**
Phase 5 (Notification Priority System) -- emergency notification hardening must be in this phase. Do not ship booking-first without it.

---

### Pitfall 8: Test Suite Regression -- Existing Tests Assert Old Behavior

**What goes wrong:**
The existing test suite (`tests/agent/prompt.test.js`) has tests that assert the presence of escalation-era behavior: line 104 asserts `TRIAGE-AWARE BEHAVIOR` exists in the prompt, line 78 asserts `transfer_call` references. The booking test (`tests/scheduling/booking.test.js`) tests the atomic booking function but not the full booking-first flow. When the prompt is rewritten, these tests break -- but instead of updating them to assert new behavior, developers disable or delete them to make CI green. The result: no tests for the new behavior, and the old behavior could silently return in future prompt edits.

**Why it happens:**
When pivoting core behavior, the test suite becomes an obstacle rather than a safety net. Tests that assert "the AI says X" break because the AI now says "Y." Under deadline pressure, teams delete failing tests instead of rewriting them to assert new invariants.

**How to avoid:**
1. Before changing any code, write the NEW test suite first (test-driven pivot):
   - Assert prompt contains "book every call" language
   - Assert prompt does NOT contain "create lead if they decline" for routine callers
   - Assert prompt does NOT contain proactive transfer instructions
   - Assert `transfer_call` tool is still available (exception path) but prompt doesn't encourage it
   - Assert booking function is called for both emergency and routine urgency values
2. Keep old tests as "regression markers" -- rename them to `test.skip` with a comment: "Old escalation behavior -- verify this no longer applies."
3. Add end-to-end tests that simulate a full call flow: inbound -> slot calculation -> booking attempt -> notification -> recovery SMS (if booking fails).
4. Add prompt snapshot tests: store the full generated prompt as a snapshot, review diffs in PRs.

**Warning signs:**
- Test suite has fewer tests after the pivot than before
- Tests that were previously passing are now skipped without replacement
- No tests for the booking-first prompt behavior
- CI passing but manual testing reveals the AI still escalates

**Phase to address:**
Phase 1 (Agent Prompt Rewrite) -- write new tests before changing the prompt. Every subsequent phase should add tests, never remove them.

---

### Pitfall 9: Dashboard Showing Stale Urgency Semantics

**What goes wrong:**
PROJECT.md says "Dashboard visual parity: keep existing urgency badges, change backend meaning only." This means the dashboard shows "EMERGENCY" and "ROUTINE" badges that used to mean "transferred to owner" and "captured as lead" but now mean "high-priority notification" and "standard notification." If the dashboard isn't updated to explain the new meaning, owners see an "EMERGENCY" badge and wonder why nobody called them. Or they see a "ROUTINE" badge and assume it's just a lead, not a confirmed booking.

**Why it happens:**
"Visual parity" is interpreted as "don't change the UI." But the meaning of the data changed. Keeping the same visual creates a semantic mismatch that confuses users.

**How to avoid:**
1. Update badge labels to reflect booking-first semantics: "EMERGENCY" -> "Urgent Booking" (red), "ROUTINE" -> "Booking" (green), "HIGH_TICKET" -> "High-Value Booking" (gold).
2. Add booking status to the dashboard view: "Booked" / "Booking Failed" / "Declined to Book" -- this is the primary status now, not urgency.
3. Move urgency from the primary badge to a secondary indicator (small icon or tooltip).
4. Add a "Needs Attention" filter that shows: failed bookings, unacknowledged emergencies, callers who declined booking.

**Warning signs:**
- Owners asking "why did nobody call me about this emergency?"
- Owners ignoring routine bookings because they look like old-style leads
- Dashboard click-through rate dropping after the pivot
- Support tickets about badge meanings

**Phase to address:**
Phase 7 (Dashboard Visual Parity) -- but the data model decisions should be made in Phase 2 (Triage Reclassification).

---

### Pitfall 10: Retell Dynamic Variables Not Updated for Booking-First

**What goes wrong:**
The inbound webhook handler (`retell/route.js`, `handleInbound`) passes `available_slots` and `booking_enabled` as dynamic variables to Retell. The current system calculates slots for 3 days and limits to 6. In a booking-first world where every call gets booked, 6 slots may not be enough if the day is busy. The AI offers 6 slots, all are taken during the call, and the AI has no way to fetch fresh slots mid-conversation. The call ends without a booking.

**Why it happens:**
Slot data is calculated once at call start and injected as static dynamic variables. During a busy day, slots can be taken between the time they're calculated and the time the AI offers them. The `atomicBookSlot` function handles the race condition (returns `slot_taken`), but the AI's recovery path ("that slot was just taken") only works if there are alternative slots to offer. If all 6 provided slots are stale, the AI loops on "slot taken" with no fresh data.

**How to avoid:**
1. Increase the slot window: calculate 10-12 slots across 5 days instead of 6 across 3. More slots = more likely at least one is still available.
2. Add a `refresh_slots` tool function that the AI can invoke mid-call if it receives multiple "slot taken" responses. This fetches fresh availability in real-time.
3. In the "slot taken" handler in `handleBookAppointment`, return not just the next single slot but the next 3 available slots, so the AI has alternatives to offer.
4. Add a "no slots available" terminal path: "I'm unable to find an available time right now. I'll send you a link to book online where you can see live availability." -> trigger recovery SMS immediately.

**Warning signs:**
- Multiple "slot taken" responses in a single call
- Calls ending without booking despite slots being available (stale data problem)
- AI looping on slot offers with no resolution
- High recovery SMS rate despite available calendar capacity

**Phase to address:**
Phase 3 (Booking Flow Universalization) -- slot data freshness is a booking infrastructure concern.

---

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Keeping triage sections in prompt but adding "ignore for routing" comments | Faster prompt rewrite, less risk of breaking things | LLM may still follow triage instructions despite comments; contradictory prompt | Never -- remove old behavior, don't comment it out |
| Hardcoding notification tiers instead of making them configurable | Ship faster | Every tenant has different preferences; forced to revisit when first customer complains | MVP only -- add settings within 2 phases |
| Using `recovery_sms_sent_at` timestamp as delivery confirmation | No Twilio status polling needed | False positives on delivery; callers fall through the cracks | Never after booking-first -- recovery SMS is critical path |
| Skipping intent detection in prompt ("just book everyone") | Simpler prompt, fewer edge cases | Ghost appointments, calendar noise, angry callers | Never -- intent detection is minimal effort, high impact |
| Running old and new tests in parallel without reconciling | CI stays green | Contradictory assertions; false confidence in test coverage | Only during the transition; reconcile within the same phase |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Retell dynamic variables | Assuming slot data is fresh for entire call duration | Pre-calculate generous slot count; add mid-call refresh tool; handle all-stale gracefully |
| Retell `transfer_call` | Removing the transfer function entirely in booking-first mode | Keep it available for exception states; change prompt to deprioritize it, don't remove the capability |
| Groq/LLM tool calls | Expecting the LLM to reliably choose `book_appointment` over `transfer_call` with contradictory prompt instructions | Resolve prompt contradictions first; LLMs follow the most recent/prominent instruction, not the "correct" one |
| Twilio SMS | Treating API success (202 Accepted) as delivery confirmation | Poll message status or use status callbacks; 202 means queued, not delivered |
| Supabase `book_appointment_atomic` | Assuming the RPC handles all booking constraints (max per day, travel buffers) | The RPC only prevents double-booking of the same slot; add application-level constraints before calling RPC |
| Google Calendar push | Blocking on calendar sync during the call (latency hit) | Current code correctly uses `after()` for async push; do not regress this when adding booking-first logic |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Slot calculation for every inbound call | Slow call pickup (> 1 second) when tenant has many appointments | Cache slot availability per tenant with 30-second TTL; invalidate on new booking | 50+ active appointments per tenant |
| Recovery SMS cron processing all unbooked calls | Cron timeout; SMS delivery delays | After booking-first, most calls will be booked -- the cron should process fewer calls, not more. If cron is still processing high volume, bookings aren't working. | 100+ unbooked calls per minute (indicates booking failure, not scale) |
| `processCallAnalyzed` doing serial DB lookups | Slow post-call processing; notification delays | Already uses Promise.all in places; ensure no new serial queries are added during the pivot | 20+ concurrent call_analyzed events |
| Single-threaded WebSocket server | Dropped calls during high concurrency | Current `retell-llm-ws.js` handles one connection per call; ensure no shared state between connections | 50+ simultaneous calls (unlikely for SME, but possible during outage recovery) |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| No rate limiting on booking endpoint | Competitor spam-books all slots, DoS via calendar flooding | Add per-phone-number booking rate limit (2/week) and per-tenant daily cap |
| Booking with unverified phone numbers | Fake bookings with spoofed numbers | The AI already collects phone from caller ID; consider SMS verification for first-time callers (adds friction, weigh carefully) |
| Recovery SMS to any number without opt-in | TCPA compliance violation; SMS sent to numbers that never consented | Add TCPA consent language to the AI's recording disclosure; log consent per call |
| Exposing booking link with tenant_id in URL | Tenant ID enumeration; unauthorized bookings via direct URL manipulation | Use opaque tokens instead of tenant UUIDs in public booking links |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| AI asks for information it already has (name from caller ID, address from previous call) | Caller frustration; longer call duration | Pre-fill known data and confirm: "I see you're calling from [number]. Is this [previous caller name]?" |
| Offering slots in UTC or wrong timezone | Caller books 10 AM thinking local time, appointment is 10 AM UTC | Current code converts to tenant timezone -- ensure this also matches caller's timezone if different |
| AI doesn't explain what booking means | Caller unsure if they're committed or just expressing interest | Add confirmation language: "This will reserve a [duration] appointment on [date]. The team will be at your address at that time. Does that work?" |
| No way to cancel or reschedule via the AI | Caller calls back to cancel, AI tries to book them again | Add cancel/reschedule intent detection: "I'd like to cancel my appointment" should not trigger booking flow |
| Recovery SMS sent to caller who already booked | Annoying; undermines trust | Current cron checks for existing appointment -- verify this check works with new booking flow (the `retell_call_id` join must match) |

## "Looks Done But Isn't" Checklist

- [ ] **Prompt rewrite:** Often missing negative instructions -- verify the prompt explicitly says "do NOT transfer unless..." not just "book everyone"
- [ ] **Triage reclassification:** Often missing the `call-processor.js` conditional that branches on urgency for `suggested_slots` -- verify `isRoutineUnbooked` logic is removed
- [ ] **Booking universalization:** Often missing max-bookings-per-day guardrail -- verify `atomicBookSlot` or caller has a daily cap
- [ ] **Recovery SMS universalization:** Often missing the delivery confirmation check -- verify `recovery_sms_sent_at` is only set after confirmed delivery, not after API call
- [ ] **Notification priority:** Often missing the emergency acknowledgment flow -- verify owner must confirm receipt of emergency notifications
- [ ] **Dashboard parity:** Often missing the semantic update -- verify badge labels reflect booking status, not just urgency
- [ ] **Test suite:** Often missing new assertions -- verify test count is higher after pivot than before, not lower
- [ ] **Exception state handling:** Often missing the "caller just wants info" path -- verify intent detection exists before booking flow
- [ ] **Retell config:** Often missing the `transfer_call` function retention -- verify it's still registered even though prompt deprioritizes it
- [ ] **End-to-end flow:** Often missing the "all slots stale" path -- verify there's a graceful terminal when no fresh slots are available

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Prompt regression (AI still escalating) | LOW | Rewrite prompt, redeploy. No data migration needed. Test with 5 live calls. |
| Triage logic in booking decisions | MEDIUM | Audit all `urgency` conditionals in codebase. Refactor to notification-only usage. Requires code changes across multiple files. |
| Over-booking / ghost appointments | HIGH | Cancel invalid appointments, notify affected callers, add intent detection, rebuild owner trust. Calendar cleanup is manual. |
| Notification fatigue | MEDIUM | Implement digest mode retroactively. Re-engage owners who muted notifications. Design notification preferences UI. |
| Calendar flooding | HIGH | Purge spam bookings, add rate limits, potentially block numbers. Calendar recovery is manual and time-consuming. |
| Silent fallback failures | HIGH | Audit all calls where recovery_sms_sent_at is set but caller never booked. Re-send SMS. Add monitoring. Retroactive fix is labor-intensive. |
| Emergency oversight loss | CRITICAL | If an emergency was missed, there is no technical recovery -- only customer service recovery. Prevention is the only strategy. |
| Test suite gaps | MEDIUM | Write missing tests retroactively. The risk is that bugs shipped during the gap period are already in production. |
| Dashboard confusion | LOW | Update labels and add tooltips. Mostly a frontend change. |
| Stale slot data | MEDIUM | Add refresh_slots tool, increase pre-calculated slot count. Requires Retell config update and webhook handler changes. |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Prompt regression | Phase 1: Agent Prompt Rewrite | Prompt snapshot test; absence of escalation language; transfer_call invocation rate < 5% of calls |
| Triage logic leaking | Phase 2: Triage Reclassification | Zero urgency-based conditionals in booking/lead code; grep audit passes |
| Over-booking | Phase 1: Agent Prompt Rewrite | Intent detection in prompt; booking-offered vs. booking-completed ratio tracked |
| Notification fatigue | Phase 5: Notification Priority System | Owner notification preferences exist; emergency vs. routine use different channels |
| Calendar flooding | Phase 3: Booking Flow Universalization | Max daily bookings enforced; per-number rate limit active; zone buffers as hard constraints |
| Silent fallback failures | Phase 6: Recovery SMS Universal Fallback | SMS delivery status tracked; failed SMS retried; dead-letter alerts configured |
| Emergency oversight loss | Phase 5: Notification Priority System | Emergency acknowledgment flow active; escalation chain fires on timeout |
| Test suite regression | Phase 1: Agent Prompt Rewrite (and every phase) | Test count increases per phase; old tests reconciled, not deleted |
| Dashboard confusion | Phase 7: Dashboard Visual Parity | Badge labels updated; booking status is primary; urgency is secondary |
| Stale slot data | Phase 3: Booking Flow Universalization | refresh_slots tool registered; all-stale terminal path exists |

## Sources

- Direct codebase analysis: `src/lib/agent-prompt.js`, `src/lib/scheduling/booking.js`, `src/lib/call-processor.js`, `src/lib/notifications.js`, `src/lib/triage/classifier.js`, `src/server/retell-llm-ws.js`, `src/app/api/webhooks/retell/route.js`, `src/app/api/cron/send-recovery-sms/route.js`
- Test suite analysis: `tests/agent/prompt.test.js`, `tests/scheduling/booking.test.js`
- PROJECT.md milestone specification and requirement changes
- Domain knowledge: LLM prompt engineering for voice AI systems, Twilio SMS delivery semantics, calendar booking system design patterns

---
*Pitfalls research for: Booking-first digital dispatcher pivot*
*Researched: 2026-03-24*
