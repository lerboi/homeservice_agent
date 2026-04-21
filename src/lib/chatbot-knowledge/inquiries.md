# Inquiries — Voco Dashboard

## What this is

An Inquiry is an unbooked call — a caller who reached Voco but didn't schedule an appointment. Maybe they wanted a quote, called outside your hours, or just weren't ready to book. Voco creates an Inquiry automatically so nothing slips through. When you follow up and book them, you convert the Inquiry to a Job.

## Where it lives in the dashboard

Go to [Inquiries](/dashboard/inquiries). The page opens on the **Open** filter by default so you see your active inbox. Click any row to open the inquiry detail flyout.

## Fields

- **Customer** — linked customer record (click name to open Customer detail page)
- **Status** — current state: Open, Converted, or Lost
- **Urgency** — Emergency / Urgent / Routine (set by AI triage)
- **Job type** — what kind of work the caller described
- **Service address** — address the caller gave (if any)

## Lifecycle / status flow

```
Open → Converted (you booked them → becomes a Job)
     → Lost (they went elsewhere or you marked it closed)
```

- **Open** — caller hasn't been booked yet; you haven't decided the outcome
- **Converted** — you followed up and booked the job; a linked Job record was created
- **Lost** — caller went with someone else, or you decided not to pursue

Same-call convert: if the AI books the appointment during the original call, the Inquiry is automatically marked Converted and a Job is created — you only see the Job. The Inquiry is there in the history but you don't need to act on it.

## Common tasks

### How do I convert an inquiry to a job?
Open the inquiry flyout by clicking the row. Click **Convert to Job** — this opens a booking sheet pre-filled with the caller's name, phone, and service address. Fill in the appointment details and save. The inquiry status changes to Converted and a new Job is created.

### How do I mark an inquiry as lost?
Open the inquiry flyout and click **Mark as Lost**. A toast confirms the change with an Undo option (5-second window).

### How do I find a specific inquiry?
Use the search bar to search by customer name or phone. Click a status pill (Open, Converted, Lost) to filter — each pill shows its live count. Use Filters for urgency, job type, or date range.

## Stale inquiries

Open inquiries stay Open indefinitely. Voco does NOT auto-close old inquiries after
N days, does NOT dim them visually, and does NOT send nagging reminders. Owners
decide when an inquiry is actually lost.

If you followed up by text or a callback outside Voco, open the inquiry and click
Convert to Job (if you booked them) or Mark as Lost (if they went with someone
else). If you haven't decided yet, leave it Open — the inbox model works best when
the unread pile reflects reality.

This is a deliberate product choice (D-07a): auto-closing old inquiries risks hiding
real opportunities. If a 90-day-old open inquiry appears in your list, that's
intentional — it's up to you to decide its fate, not the system.

## Related

- Inquiries ← Customers (see customers.md)
- Inquiries → Jobs (convert to job — see jobs.md)
- [Calls](/dashboard/calls)
- [Jobs](/dashboard/jobs)
