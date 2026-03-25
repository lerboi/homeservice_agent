# E2E Manual Test: English Booking-First Happy Path

**Covers:** HARDEN-01 (English baseline), D-02, D-03
**Reviewer:** Human — follow each step, record PASS or FAIL
**Estimated time:** 10–15 minutes

---

## Prerequisites

Before starting, verify:

- [ ] A tenant account exists with `onboarding_complete = true`
- [ ] Working hours are configured (tenant must have at least one available slot today or tomorrow)
- [ ] A valid Retell phone number is provisioned for the tenant
- [ ] You have access to a test phone to place the inbound call
- [ ] The dashboard is accessible at the app URL
- [ ] Owner phone and email are configured to receive notifications

---

## Test Steps

### Step 1 — Dial the Retell Number

1. Use a personal phone (not the owner's phone) to call the tenant's Retell number.
2. Wait for the AI to pick up — it should answer within 2 seconds.

**Expected:** AI answers with greeting: "Hello, thank you for calling [business name]. This call may be recorded for quality purposes. What can I help you with today?"

**[ ] PASS** — AI answers in English, within 2 seconds
**[ ] FAIL** — AI does not answer, answers late, or greets in wrong language

---

### Step 2 — State the Service Request in English

Speak the following:

> "Hi, I need a plumber. My kitchen sink is leaking. I'm at 123 Main Street, Springfield."

**Expected:**
- AI acknowledges the issue
- AI asks for your name (if not already given)
- AI begins offering appointment slots — booking-first behavior, not just triage

**[ ] PASS** — AI responds in English, captures job type and address, moves toward booking
**[ ] FAIL** — AI responds in wrong language, does not attempt to book, or asks irrelevant questions

---

### Step 3 — Confirm Name

If the AI asks for your name, respond:

> "This is Alex Johnson."

**Expected:** AI acknowledges the name and proceeds toward slot offer.

**[ ] PASS** — AI captures the name and continues
**[ ] FAIL** — AI ignores the name or repeats the question

---

### Step 4 — Receive Slot Offer and Select

The AI should present 2–3 available appointment slots.

Choose the first offered slot by saying:

> "The first one works for me."

**Expected:**
- AI reads back the service address for confirmation: "Just to confirm, we'll be coming to 123 Main Street, Springfield — is that correct?"

**[ ] PASS** — AI reads back address and asks for verbal confirmation
**[ ] FAIL** — AI proceeds to book without reading back the address

---

### Step 5 — Confirm Address

Respond: "Yes, that's correct."

**Expected:**
- AI confirms the booking: "Great, I've booked your appointment with [business name] for [date] at [time]. You'll receive a confirmation text shortly."
- AI ends the call gracefully

**[ ] PASS** — AI confirms booking, mentions confirmation SMS, ends the call
**[ ] FAIL** — AI does not confirm, double-books, or does not end the call

---

### Step 6 — Check Caller SMS Confirmation

Within 60 seconds, check the test phone used to make the call for an SMS message.

**Expected SMS content (exact format):**

```
Your appointment with [business_name] is confirmed for [date] at [time] at [address].
```

Example:
```
Your appointment with Springfield Plumbing is confirmed for Monday March 25th at 10 AM at 123 Main Street, Springfield.
```

**[ ] PASS** — SMS received in English within 60 seconds with correct business name, date, time, and address
**[ ] FAIL** — No SMS received, SMS is in wrong language, or SMS has incorrect content

---

### Step 7 — Check Owner Notification

Check the owner phone and email for an inbound booking notification.

**Expected SMS to owner:**
```
[business_name]: New booking — Alex Johnson, plumbing at 123 Main Street. Callback: [link] | Dashboard: [link]
```

**Expected email to owner:** HTML email with booking details (business name, caller name, job type, address, time).

**[ ] PASS** — Owner SMS and/or email received with correct booking details
**[ ] FAIL** — No notification received, or notification has wrong data

---

### Step 8 — Check Dashboard

Navigate to the dashboard and open the Leads view.

**Expected:**
- A new lead appears for the test call
- Lead status: **booked**
- Lead details show: caller name "Alex Johnson", job type, service address
- An appointment is linked to the lead with correct date and time

**[ ] PASS** — Lead visible in dashboard with status "booked" and correct appointment details
**[ ] FAIL** — Lead missing, status incorrect, or appointment not linked

---

## Overall Verdict

**OVERALL PASS** requires ALL of the following checkpoints to pass:

| # | Checkpoint | Result |
|---|-----------|--------|
| 1 | AI answered in English within 2 seconds | [ ] PASS / [ ] FAIL |
| 2 | AI used booking-first behavior (offered slots without being asked) | [ ] PASS / [ ] FAIL |
| 3 | AI performed mandatory address read-back before booking | [ ] PASS / [ ] FAIL |
| 4 | Caller received English confirmation SMS within 60 seconds | [ ] PASS / [ ] FAIL |
| 5 | Owner received booking notification (SMS or email) | [ ] PASS / [ ] FAIL |
| 6 | Dashboard shows lead as "booked" with appointment | [ ] PASS / [ ] FAIL |

**[ ] OVERALL PASS — all 6 checkpoints passed**
**[ ] OVERALL FAIL — one or more checkpoints failed**

---

## Notes / Issues Found

_Record any unexpected behavior, errors, or observations here:_

```
Date tested:
Tested by:
Tenant used:
Retell number called:
Notes:
```
