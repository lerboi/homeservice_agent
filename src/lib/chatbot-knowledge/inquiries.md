# Callbacks — Voco Dashboard

## What this is

When a caller reaches Voco but doesn't book — maybe they wanted a quote, called outside your hours, or just weren't ready — Voco saves them as a callback so nothing slips through. These callers appear in the **Callbacks** view of the [Calls](/dashboard/calls?view=callbacks) page. When you follow up and book them, you convert the callback into a Job. (Internally these records are called "inquiries" — same thing.)

## Where it lives in the dashboard

Go to [Calls → Callbacks](/dashboard/calls?view=callbacks). There is no separate Inquiries tab anymore — everything phone-shaped lives under Calls. When callers are waiting, a banner at the top of the Calls page shows the count and opens this view. It opens on the **Open** filter by default so you see who's still waiting on you. Click any row to open the detail flyout; use **← All calls** to return to the call log.

## Fields

- **Customer** — linked customer record (click name to open Customer detail page)
- **Status** — current state: Open, Booked, or Lost
- **Urgency** — Emergency / Urgent / Routine (set by AI triage)
- **Job type** — what kind of work the caller described
- **Service address** — address the caller gave (if any)

## Lifecycle / status flow

```
Open → Booked (you booked them → becomes a Job)
     → Lost (they went elsewhere or you closed it)
```

- **Open** — caller hasn't been booked yet; you haven't decided the outcome
- **Booked** — you followed up and booked the job; a linked Job record was created
- **Lost** — caller went with someone else, or you decided not to pursue

Same-call booking: if the AI books the appointment during the original call, the callback is automatically marked Booked and a Job is created — you only see the Job. Nothing lands in Callbacks for you to act on.

## Common tasks

### How do I convert a callback to a job?
In [Callbacks](/dashboard/calls?view=callbacks), click the row to open the flyout. Click **Convert to Job** — this opens a booking sheet pre-filled with the caller's name, phone, and service address. Fill in the appointment details and save. The callback's status changes to Booked and a new Job is created.

### How do I mark a callback as lost?
Open the flyout and click **Mark as Lost**. A toast confirms the change with an Undo option (5-second window).

### How do I find a specific callback?
In the Callbacks view, click a status pill (Open, Booked, Lost) to filter — each pill shows its live count. For full call history and search, go back to **All calls**.

## Stale callbacks

Open callbacks stay Open indefinitely. Voco does NOT auto-close old ones after
N days, does NOT dim them visually, and does NOT send nagging reminders. You
decide when a caller is actually lost.

If you followed up by text or a callback outside Voco, open the row and click
Convert to Job (if you booked them) or Mark as Lost (if they went with someone
else). If you haven't decided yet, leave it Open — the inbox model works best
when the unread pile reflects reality.

This is a deliberate product choice (D-07a): auto-closing old callbacks risks
hiding real opportunities. If a 90-day-old open callback appears in your list,
that's intentional — it's up to you to decide its fate, not the system.

## Related

- Callbacks ← Customers (see customers.md)
- Callbacks → Jobs (convert to job — see jobs.md)
- [Calls](/dashboard/calls)
- [Jobs](/dashboard/jobs)
