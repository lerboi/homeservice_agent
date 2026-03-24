import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: zones, error: zonesError } = await supabase
      .from('service_zones')
      .select('id, name, postal_codes, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (zonesError) return Response.json({ error: zonesError.message }, { status: 500 });

    const zoneIds = (zones || []).map((z) => z.id);
    let travelBuffers = [];

    if (zoneIds.length >= 2) {
      const { data: buffers, error: buffersError } = await supabase
        .from('zone_travel_buffers')
        .select('id, zone_a_id, zone_b_id, buffer_mins')
        .eq('tenant_id', tenantId);

      if (buffersError) return Response.json({ error: buffersError.message }, { status: 500 });
      travelBuffers = buffers || [];
    }

    return Response.json({ zones: zones || [], travelBuffers });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { name, postal_codes } = await request.json();

    if (!name?.trim()) {
      return Response.json({ error: 'Zone name is required' }, { status: 400 });
    }

    // Enforce 5-zone limit
    const { count, error: countError } = await supabase
      .from('service_zones')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (countError) return Response.json({ error: countError.message }, { status: 500 });
    if (count >= 5) {
      return Response.json({ error: 'Maximum of 5 service zones allowed' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('service_zones')
      .insert({
        tenant_id: tenantId,
        name: name.trim(),
        postal_codes: postal_codes || [],
      })
      .select('id, name, postal_codes, created_at')
      .single();

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ zone: data }, { status: 201 });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/zones — update travel buffers (body: { buffers: [{ zone_a_id, zone_b_id, buffer_mins }] })
export async function PUT(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { buffers } = await request.json();

    if (!Array.isArray(buffers)) {
      return Response.json({ error: 'buffers must be an array' }, { status: 400 });
    }

    const rows = buffers.map(({ zone_a_id, zone_b_id, buffer_mins }) => ({
      tenant_id: tenantId,
      zone_a_id,
      zone_b_id,
      buffer_mins,
    }));

    const { data, error } = await supabase
      .from('zone_travel_buffers')
      .upsert(rows, { onConflict: 'zone_a_id,zone_b_id' })
      .select('id, zone_a_id, zone_b_id, buffer_mins');

    if (error) return Response.json({ error: error.message }, { status: 500 });
    return Response.json({ travelBuffers: data });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
