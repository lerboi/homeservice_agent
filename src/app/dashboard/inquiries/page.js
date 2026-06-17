// Inquiries → Calls merge (2026-06-10): the Inquiries tab no longer exists as
// its own surface. Its work queue lives inside the Calls tab as the
// "Callbacks" view (/dashboard/calls?view=callbacks).
//
// This route is kept only so old deep links, bookmarks, and notification
// links keep working. The inquiries DATA MODEL, /api/inquiries routes, and
// voice-agent writes are unchanged — this was purely a frontend surface merge.

import { redirect } from 'next/navigation';

export default function InquiriesRedirect() {
  redirect('/dashboard/calls?view=callbacks');
}
