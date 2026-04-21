# Jobs — Voco Dashboard

## What this is

A Job is booked work — a service call where Voco scheduled an appointment with the customer. Every Job has an appointment time, a customer, and a status that tracks it from scheduled through to paid. If a caller didn't book, the call is tracked as an Inquiry instead (see inquiries.md).

## Where it lives in the dashboard

Go to [Jobs](/dashboard/jobs). The list shows all your booked work, sorted by urgency then recency. Click any row to open the job detail flyout.

## Fields

- **Customer** — linked customer record (click name to open Customer detail page)
- **Status** — current pipeline stage (see lifecycle below)
- **Urgency** — Emergency / Urgent / Routine (set by AI triage during the call)
- **Job type** — what kind of work (e.g. "Plumbing", "HVAC repair")
- **Appointment time** — when the job is scheduled
- **Revenue amount** — estimated or confirmed job value
- **Priority flag** — marks the customer for direct-ring bypass (no AI)

## Lifecycle / status flow

```
Scheduled → Completed → Paid
                     ↘ Cancelled
          ↘ Lost
```

- **Scheduled** — appointment booked, work not yet done
- **Completed** — work done, invoice not yet paid (or no invoice)
- **Paid** — invoice paid or marked paid manually
- **Cancelled** — appointment cancelled before work started
- **Lost** — job fell through (customer went elsewhere, no-show, etc.)

Note: Jobs do not have a Kanban board view by design. The list view with status pills lets you filter by stage with live counts without context-switching.

## Common tasks

### How do I change a job's status?
Click the job row to open the flyout. Use the status dropdown at the top of the flyout to move the job to the next stage.

### How do I find a specific job?
Use the search bar at the top of the Jobs page to search by customer name or phone. Click a status pill (Scheduled, Completed, Paid, Lost, Cancelled) to filter by stage — each pill shows its live count. Use the Filters button (mobile) or inline dropdowns (desktop) to filter by urgency, job type, or date range.

### How do I create an invoice from a job?
Click the job row to open the flyout and click **Create Invoice**. This pre-fills the invoice with the customer's name and job details.

### How do I listen to a call recording?
Click the job row to open the flyout. The call recording player and full transcript appear in the detail panel.

### How do I mark a job as Priority?
Open the job flyout and toggle the Priority switch. Priority customers always ring your pickup numbers directly and bypass the AI. Manage the full list under [Call Routing](/dashboard/more/call-routing).

### How do I batch-create invoices?
On the Jobs page, click **Select** (visible when there are completed jobs with no invoice). Check the jobs you want to invoice, then click **Review & Create** to generate draft invoices for all selected jobs at once.

## Related

- Jobs ← Customers (see customers.md)
- [Inquiries](/dashboard/inquiries) (see inquiries.md — unbooked calls)
- [Calendar](/dashboard/calendar)
- [Invoices](/dashboard/invoices)
- [Calls](/dashboard/calls)
