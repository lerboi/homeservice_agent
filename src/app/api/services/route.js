import { supabase } from '@/lib/supabase';
import { getTenantId } from '@/lib/get-tenant-id';

const VALID_TAGS = ['emergency', 'routine', 'urgent'];

export async function GET() {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (GET)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('services')
    .select('id, name, urgency_tag, sort_order, created_at')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.log('500:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ services: data });
}

export async function POST(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (POST)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, urgency_tag = 'routine' } = await request.json();
    if (!name?.trim()) {
      console.log('400: Name required');
      return Response.json({ error: 'Name required' }, { status: 400 });
    }

    if (!VALID_TAGS.includes(urgency_tag)) {
      console.log('400: Invalid urgency_tag');
      return Response.json({ error: 'Invalid urgency_tag' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('services')
      .insert({ tenant_id: tenantId, name: name.trim(), urgency_tag })
      .select('id, name, urgency_tag, sort_order, created_at')
      .single();

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ service: data }, { status: 201 });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    console.error('[services] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (PUT)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { id, ids, urgency_tag } = body;

    if (!VALID_TAGS.includes(urgency_tag)) {
      console.log('400: Invalid urgency_tag');
      return Response.json({ error: 'Invalid urgency_tag' }, { status: 400 });
    }

    // Bulk update: { ids: string[], urgency_tag }
    if (Array.isArray(ids)) {
      if (ids.length === 0) {
        console.log('400: ids array must not be empty');
        return Response.json({ error: 'ids array must not be empty' }, { status: 400 });
      }
      const { error } = await supabase
        .from('services')
        .update({ urgency_tag })
        .in('id', ids)
        .eq('tenant_id', tenantId);

      if (error) {
        console.log('500:', error.message);
        return Response.json({ error: error.message }, { status: 500 });
      }
      return Response.json({ updated: true, count: ids.length });
    }

    // Single update: { id: string, urgency_tag }
    const { data, error } = await supabase
      .from('services')
      .update({ urgency_tag })
      .eq('id', id)
      .eq('tenant_id', tenantId)
      .select('id, name, urgency_tag')
      .single();

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ service: data });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    console.error('[services] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (DELETE)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await request.json();
    const { error } = await supabase
      .from('services')
      .update({ is_active: false })
      .eq('id', id)
      .eq('tenant_id', tenantId);

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ deleted: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    console.error('[services] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request) {
  const tenantId = await getTenantId();
  if (!tenantId) {
    console.log('401: Unauthorized (PATCH)');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { order } = await request.json();
    if (!Array.isArray(order)) {
      console.log('400: order must be an array');
      return Response.json({ error: 'order must be an array of { id, sort_order }' }, { status: 400 });
    }

    // CRITICAL: Include tenant_id in every upsert row — required by RLS WITH CHECK
    const { error } = await supabase
      .from('services')
      .upsert(
        order.map(({ id, sort_order }) => ({ id, tenant_id: tenantId, sort_order })),
        { onConflict: 'id' }
      );

    if (error) {
      console.log('500:', error.message);
      return Response.json({ error: error.message }, { status: 500 });
    }
    return Response.json({ ok: true });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return Response.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    console.error('[services] Unexpected error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
