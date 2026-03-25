# E2E Manual Test: Spanish Multi-Language Booking End-to-End

**Covers:** HARDEN-01 (Spanish path), D-02, D-03
**Reviewer:** Human — follow each step, record PASS or FAIL
**Estimated time:** 10–15 minutes

---

## Prerequisites

Before starting, verify:

- [ ] A tenant account exists with `onboarding_complete = true`
- [ ] Working hours are configured (tenant must have at least one available slot)
- [ ] A valid Retell phone number is provisioned for the tenant
- [ ] You have access to a test phone to place the inbound call
- [ ] The dashboard is accessible at the app URL
- [ ] Owner phone and email are configured to receive notifications

**Note:** This test requires you to speak Spanish during the call to trigger multi-language detection.

---

## Test Steps

### Step 1 — Dial the Retell Number

1. Use a personal phone (not the owner's phone) to call the tenant's Retell number.
2. Wait for the AI to pick up — it should answer within 2 seconds.

**Expected:** AI answers with its standard English greeting. The AI detects language from the caller's first utterance.

**[ ] PASS** — AI answers within 2 seconds
**[ ] FAIL** — AI does not answer or answers late

---

### Step 2 — Speak in Spanish to Trigger Language Detection

Speak the following in Spanish:

> "Hola, necesito un plomero. Mi lavabo de la cocina tiene una fuga. Estoy en 456 Oak Avenue, Springfield."

(Translation: "Hello, I need a plumber. My kitchen sink is leaking. I'm at 456 Oak Avenue, Springfield.")

**Expected:**
- AI detects Spanish from your first utterance
- AI switches to and responds entirely in Spanish
- AI acknowledges the issue and begins moving toward booking

**[ ] PASS** — AI responds in Spanish, captures the service request, and continues in Spanish
**[ ] FAIL** — AI responds in English despite Spanish input, or does not attempt to understand the request

---

### Step 3 — Provide Name in Spanish

If the AI asks for your name (in Spanish: "¿Podría decirme su nombre?"), respond:

> "Me llamo María García."

(Translation: "My name is María García.")

**Expected:** AI acknowledges the name in Spanish and proceeds toward slot offer.

**[ ] PASS** — AI captures the name and continues in Spanish
**[ ] FAIL** — AI ignores the name, switches to English, or repeats the question

---

### Step 4 — Receive Slot Offer in Spanish and Select

The AI should present 2–3 available appointment slots in Spanish.

Example of expected AI language:
> "Tengo disponibilidad el lunes a las 10 de la mañana, o el martes a las 2 de la tarde. ¿Cuál le viene mejor?"

Choose the first offered slot by saying (in Spanish):

> "El primero me viene bien."

(Translation: "The first one works for me.")

**Expected:**
- AI reads back the service address for confirmation in Spanish: "Para confirmar, iremos a 456 Oak Avenue, Springfield — ¿es correcto?"

**[ ] PASS** — AI performs address read-back in Spanish before booking
**[ ] FAIL** — AI books without address read-back, or reads back in English

---

### Step 5 — Confirm Address in Spanish

Respond: "Sí, es correcto."

**Expected:**
- AI confirms the booking in Spanish: "Perfecto, he reservado su cita con [business_name] para [fecha] a las [hora]. Recibirá un mensaje de confirmación pronto."
- AI ends the call gracefully in Spanish

**[ ] PASS** — AI confirms booking in Spanish, mentions confirmation SMS, ends the call
**[ ] FAIL** — AI confirms in English, does not confirm, or does not end the call

---

### Step 6 — Check Caller SMS Confirmation (Spanish)

Within 60 seconds, check the test phone used to make the call for an SMS message.

**Expected SMS content (exact Spanish format from messages/es.json):**

```
Su cita con {business_name} esta confirmada para el {date} a las {time} en {address}.
```

Example:
```
Su cita con Springfield Plumbing esta confirmada para el lunes 25 de marzo a las 10 AM en 456 Oak Avenue, Springfield.
```

**[ ] PASS** — SMS received in Spanish within 60 seconds, with correct business name, date, time, and address in the Spanish template format
**[ ] FAIL** — No SMS received, SMS is in English instead of Spanish, or SMS has incorrect content

---

### Step 7 — Check Owner Notification (English)

Check the owner phone and email for an inbound booking notification.

**Expected:** Owner notifications are always in English, regardless of caller language.

**Expected SMS to owner:**
```
[business_name]: New booking — María García, plumbing at 456 Oak Avenue. Callback: [link] | Dashboard: [link]
```

**[ ] PASS** — Owner SMS and/or email received in English with correct booking details
**[ ] FAIL** — No notification received, notification is in Spanish, or notification has wrong data

---

### Step 8 — Check Dashboard

Navigate to the dashboard and open the Leads view.

**Expected:**
- A new lead appears for the test call
- Lead status: **booked**
- Lead details show: caller name "María García", job type, service address "456 Oak Avenue, Springfield"
- An appointment is linked to the lead with correct date and time
- The lead may show `detected_language: 'es'` in call metadata

**[ ] PASS** — Lead visible in dashboard with status "booked" and correct appointment details
**[ ] FAIL** — Lead missing, status incorrect, or appointment not linked

---

## Overall Verdict

**OVERALL PASS** requires ALL of the following checkpoints to pass:

| # | Checkpoint | Result |
|---|-----------|--------|
| 1 | AI detected Spanish from first utterance and switched to Spanish | [ ] PASS / [ ] FAIL |
| 2 | AI used booking-first behavior in Spanish (offered slots without being asked) | [ ] PASS / [ ] FAIL |
| 3 | AI performed mandatory address read-back in Spanish before booking | [ ] PASS / [ ] FAIL |
| 4 | Caller received Spanish confirmation SMS within 60 seconds matching `messages/es.json` template | [ ] PASS / [ ] FAIL |
| 5 | Owner received booking notification in English (SMS or email) | [ ] PASS / [ ] FAIL |
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
