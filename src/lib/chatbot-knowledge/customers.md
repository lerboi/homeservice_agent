# Customers — Voco Dashboard

## What this is

A Customer is a person or business Voco has heard from at least once — by phone call, booking, or inquiry. Voco automatically creates a Customer record the first time a phone number calls in. Every Job and Inquiry is attached to a Customer so you can see their full history in one place.

## Where it lives in the dashboard

Go to [Customers](/dashboard/customers). From there you can search by name or phone number and open any customer's detail page.

You can also reach a Customer detail page by clicking the customer's name on any Job or Inquiry card.

## Fields

- **Name** — caller's name as captured by the AI or edited by you
- **Phone** — E.164 format (e.g. +1 555 123 4567). Phone is the dedup key and cannot be changed directly — use Merge to combine two records
- **Default address** — service address used most often
- **Email** — optional contact email
- **Notes** — freeform notes visible only to you
- **Tags** — freeform labels (e.g. "commercial", "repeat")
- **Lifetime value** — sum of all paid invoices for this customer
- **Outstanding balance** — unpaid invoice total for this customer

## Lifecycle / status flow

Customers do not have a pipeline status. They are created once (by phone dedup) and persist forever unless merged.

```
First call from a new number → Customer created automatically
Subsequent calls from same number → same Customer record updated
Owner edits info → Customer updated
Owner merges duplicate → source Customer hidden (soft-deleted), all records repointed to target
```

## Common tasks

### How do I find a customer?
Use the search bar on the Customers page — search by name or phone number. You can also click a customer name link from any Job or Inquiry card.

### How do I edit a customer's details?
Open the customer's detail page and click **Edit Customer**. You can update name, address, email, notes, and tags. Phone is read-only — use Merge to consolidate records with different phone numbers.

### How do I merge two customer records?
Open either customer's detail page. Click the overflow menu (⋯) in the header and select **Merge into another customer…**. Type the name or phone of the target customer, review the preview (shows how many jobs, inquiries, and calls will move), then click **Merge Customer** to confirm. You can undo the merge within 7 days from the target customer's page.

### What happens when I merge?
All Jobs, Inquiries, invoices, and call recordings from the source customer move to the target customer. The source record is hidden from search. The merge is reversible for 7 days via the **Undo merge** banner on the target customer's page.

### Why can't I change a customer's phone number?
Phone is the dedup key — changing it could silently merge two real people. If a customer called from a new number, use Merge to combine the old and new records.

## Related

- Customers → Jobs (see jobs.md)
- Customers → Inquiries (see inquiries.md)
- [Calls](/dashboard/calls)
- [Invoices](/dashboard/invoices)
