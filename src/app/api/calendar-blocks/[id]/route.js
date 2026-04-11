import { after } from 'next/server';
import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

/**
 * PATCH /api/calendar-blocks/[id]
 * Updates an existing time block. Only provided fields are updated.
 * If the block has an external_event_id, updates the calendar event too.
 */
export async function PATCH(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();

  const updates = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.start_time !== undefined) updates.start_time = body.start_time;
  if (body.end_time !== undefined) updates.end_time = body.end_time;
  if (body.is_all_day !== undefined) updates.is_all_day = !!body.is_all_day;
  if (body.note !== undefined) updates.note = body.note;

  const { data, error } = await supabase
    .from('calendar_blocks')
    .update(updates)
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .select('id, title, start_time, end_time, is_all_day, note, external_event_id, created_at')
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // Async: update external calendar event if one exists
  if (data.external_event_id) {
    after(async () => {
      try {
        const { data: creds } = await supabase
          .from('calendar_credentials')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_primary', true)
          .single();

        if (!creds) return;

        if (creds.provider === 'google') {
          const { createOAuth2Client } = await import('@/lib/scheduling/google-calendar.js');
          const { google } = await import('googleapis');
          const oauth2Client = createOAuth2Client();
          oauth2Client.setCredentials({
            access_token: creds.access_token,
            refresh_token: creds.refresh_token,
            expiry_date: creds.expiry_date,
          });
          const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
          await calendar.events.patch({
            calendarId: 'primary',
            eventId: data.external_event_id,
            requestBody: {
              summary: `${data.title} — Blocked`,
              start: { dateTime: data.start_time, timeZone: 'UTC' },
              end: { dateTime: data.end_time, timeZone: 'UTC' },
              location: data.note || '',
            },
          });
        } else if (creds.provider === 'outlook') {
          const { refreshOutlookAccessToken } = await import('@/lib/scheduling/outlook-calendar.js');
          let accessToken = creds.access_token;
          if (creds.expiry_date <= Date.now() + 300000) {
            const tokenData = await refreshOutlookAccessToken(creds.refresh_token);
            accessToken = tokenData.access_token;
          }
          await fetch(`https://graph.microsoft.com/v1.0/me/events/${data.external_event_id}`, {
            method: 'PATCH',
            headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              subject: `${data.title} — Blocked`,
              start: { dateTime: data.start_time, timeZone: 'UTC' },
              end: { dateTime: data.end_time, timeZone: 'UTC' },
            }),
          });
        }
      } catch (err) {
        console.error('[calendar-blocks] Calendar update failed:', err.message);
      }
    });
  }

  return Response.json({ block: data });
}

/**
 * DELETE /api/calendar-blocks/[id]
 * Deletes a time block. If the block has an external_event_id,
 * removes the event from the connected calendar too.
 */
export async function DELETE(request, { params }) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const deleteGroup = searchParams.get('group') === 'true';

  // Fetch block(s) to get external_event_ids before deleting
  const { data: block } = await supabase
    .from('calendar_blocks')
    .select('id, external_event_id, group_id')
    .eq('id', id)
    .eq('tenant_id', tenantId)
    .single();

  let blocksToClean = [];
  if (deleteGroup && block?.group_id) {
    // Fetch all blocks in the group for calendar cleanup
    const { data: groupBlocks } = await supabase
      .from('calendar_blocks')
      .select('id, external_event_id')
      .eq('tenant_id', tenantId)
      .eq('group_id', block.group_id);

    blocksToClean = (groupBlocks || []).filter((b) => b.external_event_id);

    // Delete all blocks in the group
    const { error } = await supabase
      .from('calendar_blocks')
      .delete()
      .eq('tenant_id', tenantId)
      .eq('group_id', block.group_id);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
  } else {
    // Delete single block
    const { error } = await supabase
      .from('calendar_blocks')
      .delete()
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      return Response.json({ error: error.message }, { status: 500 });
    }
    if (block?.external_event_id) {
      blocksToClean = [block];
    }
  }

  // Async: remove from external calendar for all deleted blocks
  if (blocksToClean.length > 0) {
    after(async () => {
      try {
        const { data: creds } = await supabase
          .from('calendar_credentials')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_primary', true)
          .single();

        if (!creds) return;

        for (const b of blocksToClean) {
          try {
            if (creds.provider === 'google') {
              const { createOAuth2Client } = await import('@/lib/scheduling/google-calendar.js');
              const { google } = await import('googleapis');
              const oauth2Client = createOAuth2Client();
              oauth2Client.setCredentials({ access_token: creds.access_token, refresh_token: creds.refresh_token, expiry_date: creds.expiry_date });
              const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
              await calendar.events.delete({ calendarId: 'primary', eventId: b.external_event_id });
            } else if (creds.provider === 'outlook') {
              const { refreshOutlookAccessToken } = await import('@/lib/scheduling/outlook-calendar.js');
              let accessToken = creds.access_token;
              if (creds.expiry_date <= Date.now() + 300000) {
                const tokenData = await refreshOutlookAccessToken(creds.refresh_token);
                accessToken = tokenData.access_token;
              }
              await fetch(`https://graph.microsoft.com/v1.0/me/events/${b.external_event_id}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${accessToken}` },
              });
            }
          } catch (err) {
            console.error(`[calendar-blocks] Calendar event deletion failed for ${b.id}:`, err.message);
          }
        }
      } catch (err) {
        console.error('[calendar-blocks] Calendar cleanup failed:', err.message);
      }
    });
  }

  return Response.json({ success: true });
}
