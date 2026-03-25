# E2E Manual Test: Onboarding Gate Revalidation (Booking-First + 5-Minute Timer)

**Covers:** HARDEN-03, D-07, D-08, D-09
**Reviewer:** Human — follow each step, record PASS or FAIL
**Estimated time:** ~5 minutes (this is the gate you are verifying)

---

## Prerequisites

Before starting, verify:

- [ ] You have access to the app's signup/onboarding page
- [ ] A fresh email address is available to create a new account (do not use an existing account)
- [ ] A phone number is available to receive the SMS verification code and the test call
- [ ] The Retell phone provisioning service is operational
- [ ] You have a timer (phone timer or stopwatch)

---

## Timer Instructions

**Start the timer at Step 1 (account creation). Stop the timer at Step 8 (test call completed).**

The pass/fail gate: the full wizard must complete in **under 5 minutes**.

---

## Test Steps

### Step 0 — Start Timer

Start your timer now. Time begins from the moment you navigate to the signup page.

**[ ] Timer started**

---

### Step 1 — Navigate to Signup and Create Account

1. Open the app signup URL (e.g., `https://[app-url]/auth/signup` or the onboarding entry point).
2. Enter your email address and create a password.
3. Submit the form.

**Expected:** Email verification or OTP step appears.

**[ ] PASS** — Signup form submits successfully and OTP/verification step appears
**[ ] FAIL** — Signup fails, error displayed, or step does not advance

---

### Step 2 — Complete Email/OTP Verification (Step 1 of Wizard)

1. Check your email for the OTP code.
2. Enter the OTP code in the verification field.
3. Submit.

**Expected:** Wizard advances to Step 2 (business profile).

**[ ] PASS** — OTP accepted and wizard advances
**[ ] FAIL** — OTP rejected, email not received within 30 seconds, or wizard does not advance

---

### Step 3 — Complete Business Profile (Step 2 of Wizard)

1. Enter a business name (e.g., "Test Plumbing Co").
2. Select a trade (e.g., "Plumber").
3. Select or add at least one service (e.g., "Leak repair").
4. Select a tone preset (e.g., "Professional").
5. Submit / click Next.

**Expected:** Wizard advances to Step 3 (phone setup).

**[ ] PASS** — Business profile saved and wizard advances
**[ ] FAIL** — Save fails, validation errors block progress, or wizard does not advance

---

### Step 4 — Complete Phone Provisioning (Step 3 of Wizard)

1. A Retell phone number should be provisioned automatically, or you are prompted to select one.
2. Enter your personal phone number for SMS verification.
3. Submit to receive an SMS verification code.
4. Enter the SMS code when received.
5. Confirm the phone number.

**Expected:** Phone provisioned and SMS-verified. Wizard advances to Step 4 (test call).

**[ ] PASS** — Retell number provisioned, SMS verification passed, wizard advances
**[ ] FAIL** — Number provisioning fails, SMS not received within 60 seconds, or wizard does not advance

---

### Step 5 — Trigger the Test Call (Step 4 of Wizard)

1. The wizard should display a "Trigger Test Call" button or equivalent.
2. Click to trigger the test call.
3. Your phone will ring within 5–10 seconds.

**Expected:** Your phone rings and the AI answers.

**[ ] PASS** — Call initiated and AI answers within 10 seconds
**[ ] FAIL** — Call not initiated, phone does not ring, or error displayed

---

### Step 6 — Verify AI Attempts Booking During the Call (D-07)

When the AI answers:

1. Speak naturally as if you are a real customer:
   > "Hi, I need help with a leaking pipe at 789 Elm Street."

2. The AI should respond in booking-first mode — it should offer to book an appointment, not just take a message.

**Expected:**
- AI treats you as a real caller
- AI offers available appointment slots
- AI attempts to book (not just capture info and hang up)

**[ ] PASS** — AI offers booking slots and attempts to schedule an appointment
**[ ] FAIL** — AI does not offer booking, only takes a message, or does not engage with booking flow

---

### Step 7 — Optionally Complete or Decline the Booking

You may either:
- **Complete the booking**: Accept a slot, confirm the address when read back. The AI will confirm the appointment.
- **Decline**: Say "no thanks" — the AI should capture your info and end the call.

Either path is valid for this test. The key verification in Step 8 applies only if you completed the booking.

**[ ] Booking completed** or **[ ] Booking declined** (both are valid — note which path you took)

---

### Step 8 — Stop Timer and Verify Wizard Completion

After the call ends:

1. Stop your timer.
2. The wizard should automatically detect the call ended and advance to a completion screen (celebration overlay or "Setup complete" message).

**[ ] Timer stopped**

**[ ] PASS** — Wizard shows completion screen after call ends
**[ ] FAIL** — Wizard does not advance after call ends, or shows an error

---

### Step 9 — Verify Test Booking Auto-Cancelled (D-08)

**Only applies if you completed a booking in Step 7.**

After the call ends (allow up to 60 seconds for processing):

1. Navigate to the dashboard Appointments view.
2. Look for the appointment created during the test call.

**Expected:**
- The appointment created during the test call should have `status = 'cancelled'`
- OR the appointment should not appear in active/upcoming appointments (only in cancelled view if filtering is available)
- The associated lead should show `status = 'new'` (not 'booked'), since the test appointment was auto-cancelled

**[ ] PASS** — Test appointment is cancelled; calendar is clean; no test booking persists in active appointments
**[ ] FAIL** — Test appointment remains active in calendar, calendar is cluttered by test bookings

**[ ] SKIP** — Booking was declined in Step 7 (not applicable)

---

### Step 10 — Record Total Time

Look at your timer.

**Gate:** Total wizard time must be **under 5 minutes**.

**[ ] PASS** — Total time < 5:00 minutes
**[ ] FAIL** — Total time >= 5:00 minutes

---

## Overall Verdict

**OVERALL PASS** requires ALL applicable checkpoints to pass:

| # | Checkpoint | Result |
|---|-----------|--------|
| 1 | Signup and OTP verification completed without friction | [ ] PASS / [ ] FAIL |
| 2 | Business profile saved (Step 2 of wizard) | [ ] PASS / [ ] FAIL |
| 3 | Phone provisioned and SMS-verified (Step 3 of wizard) | [ ] PASS / [ ] FAIL |
| 4 | Test call initiated and AI answered within 10 seconds | [ ] PASS / [ ] FAIL |
| 5 | AI attempted booking during test call (booking-first behavior, D-07) | [ ] PASS / [ ] FAIL |
| 6 | Test call booking auto-cancelled after call ended (D-08) — if booking was made | [ ] PASS / [ ] FAIL / [ ] N/A |
| 7 | Total wizard time under 5 minutes | [ ] PASS / [ ] FAIL |

**[ ] OVERALL PASS — all applicable checkpoints passed**
**[ ] OVERALL FAIL — one or more checkpoints failed**

---

## Notes / Issues Found

_Record any unexpected behavior, errors, friction points, or timing issues here:_

```
Date tested:
Tested by:
Email used:
Phone number used:
Timer reading at step 8:
Booking path taken (completed / declined):
Notes:
```
