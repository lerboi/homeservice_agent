import { getTenantId } from '@/lib/get-tenant-id';
import { supabase } from '@/lib/supabase';

export async function GET() {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: zones, error: zonesError } = await supabase
      .from('service_zones')
      .select('id, name, postal_codes, created_at')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });

    if (zonesError) {
      console.log('500:', zonesError.message);
      return Response.json({ error: zonesError.message }, { status: 500 });
    }

    const zoneIds = (zones || []).map((z) => z.id);
    let travelBuffers = [];

    if (zoneIds.length >= 2) {
      const { data: buffers, error: buffersError } = await supabase
        .from('zone_travel_buffers')
        .select('id, zone_a_id, zone_b_id, buffer_mins')
        .eq('tenant_id', tenantId);

      if (buffersError) {
        console.log('500:', buffersError.message);
        return Response.json({ error: buffersError.message }, { status: 500 });
      }
      travelBuffers = buffers || [];
    }

    return Response.json({ zones: zones || [], travelBuffers });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, postal_codes } = await request.json();

    if (!name?.trim()) {
      console.log('400: Zone name is required');
      return Response.json({ error: 'Zone name is required' }, { status: 400 });
    }

    // Enforce 5-zone limit
    const { count, error: countError } = await supabase
      .from('service_zones')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId);

    if (countError) {
      console.log('500:', countError.message);
      return Response.json({ error: countError.message }, { status: 500 });
    }
    if (count >= 5) {
      console.log('400: Maximum of 5 service zones allowed');
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

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ zone: data }, { status: 201 });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// PUT /api/zones — update travel buffers (body: { buffers: [{ zone_a_id, zone_b_id, buffer_mins }] })
export async function PUT(request) {
  try {
    const tenantId = await getTenantId();
    if (!tenantId) {
      console.log('401: Unauthorized');
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { buffers } = await request.json();

    if (!Array.isArray(buffers)) {
      console.log('400: buffers must be an array');
      return Response.json({ error: 'buffers must be an array' }, { status: 400 });
    }

    // Validate all zone IDs belong to this tenant to prevent cross-tenant IDOR
    const submittedZoneIds = [...new Set(buffers.flatMap(b => [b.zone_a_id, b.zone_b_id]))];
    if (submittedZoneIds.length > 0) {
      const { count: validCount } = await supabase
        .from('service_zones')
        .select('id', { count: 'exact', head: true })
        .eq('tenant_id', tenantId)
        .in('id', submittedZoneIds);

      if (validCount !== submittedZoneIds.length) {
        return Response.json({ error: 'One or more zone IDs do not belong to your account' }, { status: 403 });
      }
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

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ travelBuffers: data });
  } catch (err) {
    console.log('500:', err.message, err);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
