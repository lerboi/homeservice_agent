/**
 * Accounting sync orchestration — push-on-send and status updates.
 *
 * pushToAccounting: Called inside sendSingleInvoice after status update to 'sent'.
 *   Pushes the invoice to connected accounting software (QBO/Xero/FreshBooks).
 *   If no accounting is connected, returns early (normal case).
 *
 * pushStatusUpdate: Called from PATCH /api/invoices/[id] on paid/void transitions.
 *   Updates the invoice status in the accounting platform if previously synced.
 *
 * Both functions are non-fatal — callers wrap in try/catch and log only.
 * Failures are recorded in accounting_sync_log for visibility.
 *
 * @module accounting/sync
 */

// Phase 54: accounting/adapter.js deleted; sync.js now imports from integrations/adapter.
// getAccountingAdapter is aliased from getIntegrationAdapter for minimal-diff readability.
import { getIntegrationAdapter as getAccountingAdapter, refreshTokenIfNeeded } from '@/lib/integrations/adapter';

/**
 * Push an invoice to the tenant's connected accounting software.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Service-role Supabase client
 * @param {string} tenantId
 * @param {Object} invoice - Invoice row from DB
 * @param {Array} lineItems - Line item rows from DB
 * @param {Object} settings - Invoice settings row
 */
export async function pushToAccounting(supabase, tenantId, invoice, lineItems, settings) {
  // Check if tenant has accounting connected
  const { data: credentials } = await supabase
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .maybeSingle();

  if (!credentials) {
    // No accounting connected — this is the normal case for most tenants
    return;
  }

  const attemptedAt = new Date().toISOString();

  try {
    // Refresh token if expired or within 5-minute buffer
    const freshCreds = await refreshTokenIfNeeded(supabase, credentials);

    // Get the platform adapter
    const adapter = await getAccountingAdapter(freshCreds.provider);

    // Initialize adapter with credentials
    adapter.setCredentials({
      access_token: freshCreds.access_token,
      refresh_token: freshCreds.refresh_token,
      realm_id: freshCreds.realm_id,
      xero_tenant_id: freshCreds.xero_tenant_id,
      account_id: freshCreds.account_id,
    });

    // Find or create customer in accounting platform
    await adapter.findOrCreateCustomer(
      invoice.customer_name,
      invoice.customer_email
    );

    // Push the invoice
    const result = await adapter.pushInvoice(invoice, lineItems, settings);

    // Log success to accounting_sync_log
    await supabase.from('accounting_sync_log').upsert(
      {
        tenant_id: tenantId,
        invoice_id: invoice.id,
        provider: freshCreds.provider,
        external_id: result.externalId,
        status: 'synced',
        synced_at: new Date().toISOString(),
        attempted_at: attemptedAt,
        error_message: null,
      },
      { onConflict: 'invoice_id,provider' }
    );

    // Update last_synced_at on credentials
    await supabase
      .from('accounting_credentials')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('id', freshCreds.id);
  } catch (err) {
    // Log failure to accounting_sync_log
    await supabase.from('accounting_sync_log').upsert(
      {
        tenant_id: tenantId,
        invoice_id: invoice.id,
        provider: credentials.provider,
        external_id: null,
        status: 'failed',
        synced_at: null,
        attempted_at: attemptedAt,
        error_message: err?.message || String(err),
      },
      { onConflict: 'invoice_id,provider' }
    );

    // Re-throw so caller can log with console.warn
    throw err;
  }
}

/**
 * Push a status update (paid/void) to accounting software for a previously synced invoice.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase - Service-role Supabase client
 * @param {string} tenantId
 * @param {string} invoiceId - Invoice UUID
 * @param {string} newStatus - 'paid' or 'void'
 */
export async function pushStatusUpdate(supabase, tenantId, invoiceId, newStatus) {
  // Only process paid or void
  if (newStatus !== 'paid' && newStatus !== 'void') {
    return;
  }

  // Check if this invoice was previously synced
  const { data: syncLog } = await supabase
    .from('accounting_sync_log')
    .select('*')
    .eq('invoice_id', invoiceId)
    .eq('status', 'synced')
    .maybeSingle();

  if (!syncLog) {
    // Invoice was never pushed to accounting — nothing to update
    return;
  }

  // Fetch credentials for the provider that synced this invoice
  const { data: credentials } = await supabase
    .from('accounting_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('provider', syncLog.provider)
    .maybeSingle();

  if (!credentials) {
    // Accounting was disconnected since sync — nothing to do
    return;
  }

  // Refresh token if needed
  const freshCreds = await refreshTokenIfNeeded(supabase, credentials);

  // Get adapter and update status
  const adapter = await getAccountingAdapter(freshCreds.provider);
  adapter.setCredentials({
    access_token: freshCreds.access_token,
    refresh_token: freshCreds.refresh_token,
    realm_id: freshCreds.realm_id,
    xero_tenant_id: freshCreds.xero_tenant_id,
    account_id: freshCreds.account_id,
  });

  await adapter.updateInvoiceStatus(syncLog.external_id, newStatus);
}
