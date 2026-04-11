import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * GET /api/calendar-blocks
 * Returns calendar_blocks for the authenticated tenant within a date range.
 */
export async function GET(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  if (!start || !end) {
    return Response.json({ error: 'start and end query params required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_blocks')
    .select('id, title, start_time, end_time, is_all_day, note, external_event_id, group_id, created_at')
    .eq('tenant_id', tenantId)
    .lte('start_time', end)
    .gte('end_time', start)
    .order('start_time', { ascending: true });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // For blocks with a group_id, look up how many total blocks share that group
  // (including those outside the current date range) so the UI can show "Delete all N days"
  const blocks = data || [];
  const groupIds = [...new Set(blocks.map((b) => b.group_id).filter(Boolean))];
  if (groupIds.length > 0) {
    const { data: groupCounts } = await supabase
      .from('calendar_blocks')
      .select('group_id')
      .eq('tenant_id', tenantId)
      .in('group_id', groupIds);

    const countMap = {};
    for (const row of (groupCounts || [])) {
      countMap[row.group_id] = (countMap[row.group_id] || 0) + 1;
    }
    for (const block of blocks) {
      if (block.group_id) {
        block.group_count = countMap[block.group_id] || 1;
      }
    }
  }

  return Response.json({ blocks });
}

/**
 * POST /api/calendar-blocks
 * Creates a new time block. If sync_to_calendar is true (default),
 * pushes a "busy" event to the tenant's primary connected calendar.
 */
export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { title, start_time, end_time, is_all_day, note, sync_to_calendar, group_id } = body;

  if (!title || !title.trim()) {
    return Response.json({ error: 'title is required' }, { status: 400 });
  }
  if (!start_time) {
    return Response.json({ error: 'start_time is required' }, { status: 400 });
  }
  if (!end_time) {
    return Response.json({ error: 'end_time is required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('calendar_blocks')
    .insert({
      tenant_id: tenantId,
      title: title.trim(),
      start_time,
      end_time,
      is_all_day: !!is_all_day,
      note: note || null,
      ...(group_id ? { group_id } : {}),
    })
    .select('id, title, start_time, end_time, is_all_day, note, external_event_id, group_id, created_at')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Sync to connected calendar if requested (default true).
  // Runs inline (awaited) so multi-day rapid-fire POSTs each complete their
  // calendar event creation before the response returns and the next request starts.
  if (sync_to_calendar !== false) {
    try {
        const { data: creds } = await supabase
          .from('calendar_credentials')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_primary', true)
          .single();

        if (!creds) return;

        const isAllDay = !!data.is_all_day;
        // Extract date string (YYYY-MM-DD) for all-day events
        const blockDate = data.start_time.slice(0, 10);
        // Next day for all-day end (Google/Outlook all-day = exclusive end date)
        const nextDay = new Date(blockDate + 'T00:00:00');
        nextDay.setDate(nextDay.getDate() + 1);
        const endDateStr = `${nextDay.getFullYear()}-${String(nextDay.getMonth() + 1).padStart(2, '0')}-${String(nextDay.getDate()).padStart(2, '0')}`;

        let eventId;
        if (creds.provider === 'google') {
          if (isAllDay) {
            // All-day: use date-only format so it spans the whole day in any timezone
            const { createOAuth2Client } = await import('@/lib/scheduling/google-calendar.js');
            const { google } = await import('googleapis');
            const oauth2Client = createOAuth2Client();
            oauth2Client.setCredentials({
              access_token: creds.access_token,
              refresh_token: creds.refresh_token,
              expiry_date: creds.expiry_date,
            });
            const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
            const event = await calendar.events.insert({
              calendarId: 'primary',
              requestBody: {
                summary: `${data.title} — Blocked`,
                start: { date: blockDate },
                end: { date: endDateStr },
                description: data.note || undefined,
              },
            });
            eventId = event.data.id;
          } else {
            const { createCalendarEvent } = await import('@/lib/scheduling/google-calendar.js');
            eventId = await createCalendarEvent({
              credentials: creds,
              appointment: {
                id: data.id,
                tenant_id: tenantId,
                start_time: data.start_time,
                end_time: data.end_time,
                job_type: data.title,
                caller_name: 'Blocked',
                service_address: data.note || '',
                urgency: 'routine',
              },
            });
          }
        } else if (creds.provider === 'outlook') {
          if (isAllDay) {
            const { refreshOutlookAccessToken } = await import('@/lib/scheduling/outlook-calendar.js');
            let accessToken = creds.access_token;
            if (creds.expiry_date <= Date.now() + 300000) {
              const tokenData = await refreshOutlookAccessToken(creds.refresh_token);
              accessToken = tokenData.access_token;
            }
            const event = await fetch('https://graph.microsoft.com/v1.0/me/events', {
              method: 'POST',
              headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
              body: JSON.stringify({
                subject: `${data.title} — Blocked`,
                isAllDay: true,
                start: { dateTime: `${blockDate}T00:00:00`, timeZone: 'UTC' },
                end: { dateTime: `${endDateStr}T00:00:00`, timeZone: 'UTC' },
                body: data.note ? { contentType: 'Text', content: data.note } : undefined,
              }),
            }).then((r) => r.json());
            eventId = event.id;
          } else {
            const { createOutlookCalendarEvent } = await import('@/lib/scheduling/outlook-calendar.js');
            eventId = await createOutlookCalendarEvent({
              credentials: creds,
              appointment: {
                id: data.id,
                tenant_id: tenantId,
                start_time: data.start_time,
                end_time: data.end_time,
                job_type: data.title,
                caller_name: 'Blocked',
                service_address: data.note || '',
                urgency: 'routine',
              },
            });
          }
        }

        if (eventId) {
          await supabase
            .from('calendar_blocks')
            .update({ external_event_id: eventId })
            .eq('id', data.id);
        }
    } catch (err) {
      console.error('[calendar-blocks] Calendar sync failed:', err.message);
    }
  }

  return Response.json({ block: data }, { status: 201 });
}
