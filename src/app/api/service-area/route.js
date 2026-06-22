import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

// M16 P1 (Capability A) — the single Service Area: one flat coverage list
// (postal codes + town/city names) plus the owner's out-of-area handling.
// Replaces the multi-zone /api/zones CRUD + the zone_travel_buffers matrix.
// The agent reads coverage as the UNION of postal_codes[] + cities[] across the
// tenant's service_zones rows; this route presents that union as one area and
// collapses writes back into a single canonical row.

const OUT_OF_AREA_ACTIONS = ['callback', 'decline_referral', 'trip_fee'];

function dedupeTrim(arr) {
  const seen = new Set();
  const out = [];
  for (const v of Array.isArray(arr) ? arr : []) {
    const s = typeof v === 'string' ? v.trim() : '';
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const [zonesRes, tenantRes] = await Promise.all([
      supabase
        .from('service_zones')
        .select('postal_codes, cities, created_at')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true }),
      supabase
        .from('tenants')
        .select('out_of_area_action, out_of_area_referral_note')
        .eq('id', tenantId)
        .single(),
    ]);

    if (zonesRes.error) {
      return Response.json({ error: zonesRes.error.message }, { status: 500 });
    }
    if (tenantRes.error) {
      return Response.json({ error: tenantRes.error.message }, { status: 500 });
    }

    // Union across any legacy multi-zone rows — the agent matches the same way.
    const postal_codes = dedupeTrim((zonesRes.data || []).flatMap((z) => z.postal_codes || []));
    const cities = dedupeTrim((zonesRes.data || []).flatMap((z) => z.cities || []));

    return Response.json({
      postal_codes,
      cities,
      out_of_area_action: tenantRes.data?.out_of_area_action || 'callback',
      out_of_area_referral_note: tenantRes.data?.out_of_area_referral_note || '',
    });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const postal_codes = dedupeTrim(body.postal_codes);
    const cities = dedupeTrim(body.cities);

    let action = body.out_of_area_action;
    if (action === undefined || action === null || action === '') action = 'callback';
    if (!OUT_OF_AREA_ACTIONS.includes(action)) {
      return Response.json({ error: 'Invalid out_of_area_action' }, { status: 400 });
    }

    const referralRaw = typeof body.out_of_area_referral_note === 'string'
      ? body.out_of_area_referral_note.trim()
      : '';
    const referralValue = referralRaw || null;

    // 1. Persist the owner's out-of-area handling on the tenant.
    const { error: tenantErr } = await supabase
      .from('tenants')
      .update({
        out_of_area_action: action,
        out_of_area_referral_note: referralValue,
      })
      .eq('id', tenantId);
    if (tenantErr) {
      return Response.json({ error: tenantErr.message }, { status: 500 });
    }

    // 2. Collapse coverage into ONE canonical service_zones row. Update the
    //    oldest row in place and delete any extras (legacy multi-zone); their
    //    zone_travel_buffers rows cascade away on delete (the matrix is retired).
    const { data: existing, error: exErr } = await supabase
      .from('service_zones')
      .select('id')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    if (exErr) {
      return Response.json({ error: exErr.message }, { status: 500 });
    }

    const rows = existing || [];
    if (rows.length === 0) {
      const { error: insErr } = await supabase
        .from('service_zones')
        .insert({ tenant_id: tenantId, name: 'Service Area', postal_codes, cities });
      if (insErr) {
        return Response.json({ error: insErr.message }, { status: 500 });
      }
    } else {
      const { error: updErr } = await supabase
        .from('service_zones')
        .update({ name: 'Service Area', postal_codes, cities })
        .eq('id', rows[0].id)
        .eq('tenant_id', tenantId);
      if (updErr) {
        return Response.json({ error: updErr.message }, { status: 500 });
      }
      const extraIds = rows.slice(1).map((r) => r.id);
      if (extraIds.length > 0) {
        const { error: delErr } = await supabase
          .from('service_zones')
          .delete()
          .eq('tenant_id', tenantId)
          .in('id', extraIds);
        if (delErr) {
          return Response.json({ error: delErr.message }, { status: 500 });
        }
      }
    }

    return Response.json({
      postal_codes,
      cities,
      out_of_area_action: action,
      out_of_area_referral_note: referralValue || '',
    });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
