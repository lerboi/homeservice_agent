import { createSupabaseServer } from '@/lib/supabase-server';
import { getTenantId } from '@/lib/get-tenant-id';
import { getTenantFeatures } from '@/lib/features';
import { formatEstimateNumber } from '@/lib/estimate-number';
import { calculateLineTotal, calculateInvoiceTotals } from '@/lib/invoice-calculations';

const VALID_STATUSES = ['draft', 'sent', 'approved', 'declined', 'expired'];

/**
 * GET /api/estimates
 * Returns estimate list with summary aggregates and status counts.
 *
 * Query params:
 *   status  — filter by estimate status (one of VALID_STATUSES)
 *   search  — filter by customer_name or estimate_number (case-insensitive substring)
 *   lead_id — filter by linked lead
 *
 * Returns: { estimates, summary: { pending_count, approved_value, conversion_rate }, status_counts }
 */
export async function GET(request) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const features = await getTenantFeatures(tenantId);
  if (!features.invoicing) {
    return new Response(null, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const statusFilter = searchParams.get('status');
  const search = searchParams.get('search');
  const leadId = searchParams.get('lead_id');

  // Pagination
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 500);
  const offset = parseInt(searchParams.get('offset') || '0', 10);

  // Build list query
  let query = supabase
    .from('estimates')
    .select('*', { count: 'exact' })
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: false });

  if (statusFilter && VALID_STATUSES.includes(statusFilter)) {
    query = query.eq('status', statusFilter);
  }

  if (search) {
    query = query.or(`customer_name.ilike.%${search}%,estimate_number.ilike.%${search}%`);
  }

  if (leadId) {
    query = query.eq('lead_id', leadId);
  }

  query = query.range(offset, offset + limit - 1);

  const { data: estimates, error: listError, count: totalCount } = await query;
  if (listError) {
    return Response.json({ error: listError.message }, { status: 500 });
  }

  // For each estimate, fetch tier info to determine if tiered and get tier range
  const estimateIds = (estimates || []).map((e) => e.id);
  let tiersByEstimate = {};

  if (estimateIds.length > 0) {
    const { data: tiers } = await supabase
      .from('estimate_tiers')
      .select('estimate_id, total')
      .in('estimate_id', estimateIds)
      .order('total', { ascending: true });

    for (const tier of tiers || []) {
      if (!tiersByEstimate[tier.estimate_id]) {
        tiersByEstimate[tier.estimate_id] = [];
      }
      tiersByEstimate[tier.estimate_id].push(Number(tier.total));
    }
  }

  // Enrich estimates with tier_count and tier_range
  const enrichedEstimates = (estimates || []).map((est) => {
    const tierTotals = tiersByEstimate[est.id] || [];
    const enriched = { ...est, tier_count: tierTotals.length };
    if (tierTotals.length > 0) {
      enriched.tier_range = {
        min: Math.min(...tierTotals),
        max: Math.max(...tierTotals),
      };
    }
    return enriched;
  });

  // Aggregate: pending_count (status='sent')
  const { data: pendingData } = await supabase
    .from('estimates')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'sent');

  const pending_count = pendingData?.length ?? 0;

  // Count sent estimates explicitly for pending_count
  const { count: sentCount } = await supabase
    .from('estimates')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('status', 'sent');

  // Aggregate: approved_value — sum of estimate-level total + tier-level totals for tiered estimates
  const { data: approvedEstimates } = await supabase
    .from('estimates')
    .select('id, total')
    .eq('tenant_id', tenantId)
    .eq('status', 'approved');

  let approved_value = 0;
  const approvedIds = (approvedEstimates || []).map((e) => e.id);

  // Sum estimate-level totals (non-null means single-price)
  for (const est of approvedEstimates || []) {
    if (est.total != null) {
      approved_value += Number(est.total);
    }
  }

  // For tiered approved estimates (total is null), sum from estimate_tiers
  if (approvedIds.length > 0) {
    const { data: approvedTiers } = await supabase
      .from('estimate_tiers')
      .select('estimate_id, total')
      .in('estimate_id', approvedIds);

    // Check which approved estimates have null total (tiered) and sum their highest tier
    const tieredApproved = (approvedEstimates || []).filter((e) => e.total == null);
    for (const est of tieredApproved) {
      const estTiers = (approvedTiers || []).filter((t) => t.estimate_id === est.id);
      if (estTiers.length > 0) {
        // Use the highest tier total as the approved value for tiered estimates
        const maxTier = Math.max(...estTiers.map((t) => Number(t.total)));
        approved_value += maxTier;
      }
    }
  }

  // Aggregate: conversion_rate = (approved / (approved + declined + expired)) * 100
  const { data: allForConversion } = await supabase
    .from('estimates')
    .select('status')
    .eq('tenant_id', tenantId)
    .in('status', ['approved', 'declined', 'expired']);

  let approvedCount = 0;
  let denominator = 0;
  for (const est of allForConversion || []) {
    denominator++;
    if (est.status === 'approved') approvedCount++;
  }
  const conversion_rate = denominator > 0
    ? Number(((approvedCount / denominator) * 100).toFixed(1))
    : 0;

  // Status counts for tab badges
  const status_counts = {};
  for (const status of VALID_STATUSES) {
    status_counts[status] = 0;
  }
  const { data: allEstimates } = await supabase
    .from('estimates')
    .select('status')
    .eq('tenant_id', tenantId);

  for (const est of allEstimates || []) {
    if (status_counts[est.status] !== undefined) {
      status_counts[est.status]++;
    }
  }

  return Response.json({
    estimates: enrichedEstimates,
    total_count: totalCount ?? (enrichedEstimates || []).length,
    limit,
    offset,
    summary: {
      pending_count: sentCount ?? 0,
      approved_value: Number(approved_value.toFixed(2)),
      conversion_rate,
    },
    status_counts,
  });
}

/**
 * POST /api/estimates
 * Create a new estimate with atomic sequential estimate number.
 *
 * Body: {
 *   lead_id?, customer_name, customer_phone, customer_email, customer_address,
 *   job_type, valid_until?, notes,
 *   line_items: [{ item_type, description, quantity, unit_price, markup_pct, taxable, sort_order }],
 *   tiers?: [{ tier_label, line_items: [...] }]
 * }
 */
export async function POST(request) {
  const supabase = await createSupabaseServer();
  const tenantId = await getTenantId();
  if (!tenantId) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const features = await getTenantFeatures(tenantId);
  if (!features.invoicing) {
    return new Response(null, { status: 404 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const {
    lead_id,
    customer_name,
    customer_phone,
    customer_email,
    customer_address,
    job_type,
    valid_until,
    notes,
    line_items = [],
    tiers,
  } = body;

  // Fetch invoice settings for estimate prefix and tax rate
  const { data: settingsRow } = await supabase
    .from('invoice_settings')
    .select('estimate_prefix, tax_rate')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  const settings = settingsRow || { estimate_prefix: 'EST', tax_rate: 0 };

  // Atomically get the next estimate sequence number
  const currentYear = new Date().getFullYear();
  const { data: seqData, error: seqError } = await supabase.rpc('get_next_estimate_number', {
    p_tenant_id: tenantId,
    p_year: currentYear,
  });

  if (seqError) {
    return Response.json({ error: 'Failed to generate estimate number: ' + seqError.message }, { status: 500 });
  }

  const estimateNumber = formatEstimateNumber(settings.estimate_prefix || 'EST', currentYear, seqData);
  const taxRate = Number(settings.tax_rate) || 0;
  const isTiered = Array.isArray(tiers) && tiers.length > 0;

  if (isTiered) {
    // Tiered estimate: estimate-level totals are NULL
    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .insert({
        tenant_id: tenantId,
        lead_id: lead_id || null,
        estimate_number: estimateNumber,
        status: 'draft',
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_address: customer_address || null,
        job_type: job_type || null,
        valid_until: valid_until || null,
        notes: notes || null,
        subtotal: null,
        tax_amount: null,
        total: null,
      })
      .select()
      .single();

    if (estimateError) {
      return Response.json({ error: estimateError.message }, { status: 500 });
    }

    const insertedTiers = [];
    const allLineItems = [];

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      const tierLineItems = tier.line_items || [];

      // Calculate tier totals
      const tierTotals = calculateInvoiceTotals(tierLineItems, taxRate);

      const { data: tierRow, error: tierError } = await supabase
        .from('estimate_tiers')
        .insert({
          estimate_id: estimate.id,
          tenant_id: tenantId,
          tier_label: tier.tier_label || `Tier ${i + 1}`,
          sort_order: i,
          subtotal: tierTotals.subtotal,
          tax_amount: tierTotals.tax_amount,
          total: tierTotals.total,
        })
        .select()
        .single();

      if (tierError) {
        return Response.json({ error: 'Failed to create tier: ' + tierError.message }, { status: 500 });
      }

      insertedTiers.push(tierRow);

      // Insert tier line items
      if (tierLineItems.length > 0) {
        const lineItemRows = tierLineItems.map((item, idx) => ({
          estimate_id: estimate.id,
          tier_id: tierRow.id,
          tenant_id: tenantId,
          sort_order: item.sort_order ?? idx,
          item_type: item.item_type,
          description: item.description || '',
          quantity: item.quantity ?? 1,
          unit_price: item.unit_price ?? 0,
          markup_pct: item.markup_pct ?? 0,
          taxable: item.taxable !== false,
          line_total: calculateLineTotal(item.item_type, {
            quantity: item.quantity,
            unit_price: item.unit_price,
            markup_pct: item.markup_pct,
          }),
        }));

        const { data: li, error: liError } = await supabase
          .from('estimate_line_items')
          .insert(lineItemRows)
          .select();

        if (liError) {
          return Response.json({ error: 'Failed to insert tier line items: ' + liError.message }, { status: 500 });
        }
        allLineItems.push(...(li || []));
      }
    }

    return Response.json({ estimate, tiers: insertedTiers, line_items: allLineItems }, { status: 201 });

  } else {
    // Single-price estimate
    const { subtotal, tax_amount, total } = calculateInvoiceTotals(line_items, taxRate);

    const { data: estimate, error: estimateError } = await supabase
      .from('estimates')
      .insert({
        tenant_id: tenantId,
        lead_id: lead_id || null,
        estimate_number: estimateNumber,
        status: 'draft',
        customer_name: customer_name || null,
        customer_phone: customer_phone || null,
        customer_email: customer_email || null,
        customer_address: customer_address || null,
        job_type: job_type || null,
        valid_until: valid_until || null,
        notes: notes || null,
        subtotal,
        tax_amount,
        total,
      })
      .select()
      .single();

    if (estimateError) {
      return Response.json({ error: estimateError.message }, { status: 500 });
    }

    // Insert line items with tier_id = NULL
    let insertedLineItems = [];
    if (line_items.length > 0) {
      const lineItemRows = line_items.map((item, idx) => ({
        estimate_id: estimate.id,
        tier_id: null,
        tenant_id: tenantId,
        sort_order: item.sort_order ?? idx,
        item_type: item.item_type,
        description: item.description || '',
        quantity: item.quantity ?? 1,
        unit_price: item.unit_price ?? 0,
        markup_pct: item.markup_pct ?? 0,
        taxable: item.taxable !== false,
        line_total: calculateLineTotal(item.item_type, {
          quantity: item.quantity,
          unit_price: item.unit_price,
          markup_pct: item.markup_pct,
        }),
      }));

      const { data: li, error: liError } = await supabase
        .from('estimate_line_items')
        .insert(lineItemRows)
        .select();

      if (liError) {
        return Response.json({ error: 'Failed to insert line items: ' + liError.message }, { status: 500 });
      }
      insertedLineItems = li || [];
    }

    return Response.json({ estimate, line_items: insertedLineItems }, { status: 201 });
  }
}
