/**
 * Vercel Cron -- Invoice Payment Reminders + Late Fee Application (D-11/D-14)
 *
 * Schedule: daily at 09:00 UTC (0 9 * * *)
 * Sends payment reminders at -3, 0, +3, +7 days relative to due date.
 * Applies late fees to overdue invoices when enabled in settings.
 * Idempotency via invoice_reminders table UNIQUE constraint.
 */

import { supabase } from '@/lib/supabase';
import { getResendClient, getTwilioClient } from '@/lib/notifications';
import { InvoiceReminderEmail, getReminderSubject } from '@/emails/InvoiceReminderEmail';
import { calculateLateFee, shouldApplyLateFee } from '@/lib/late-fee-calculations';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import { addDays, differenceInDays, format } from 'date-fns';

export async function GET(request) {
  // Auth check (same pattern as trial-reminders)
  if (!process.env.CRON_SECRET) {
    return Response.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    console.log('401: Unauthorized');
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const today = new Date().toISOString().split('T')[0];
  let remindersSent = 0;
  let lateFeesApplied = 0;

  // ── Phase 53 — feature flag pre-filter ──────────────────────────────────
  // Skip every tenant with features_enabled.invoicing = false. PostgREST `->>`
  // returns TEXT, so the literal value MUST be the string 'true' (not boolean
  // true). Wrong syntax silently matches zero tenants and disables the cron
  // for everyone. Verified against live DB during Plan 05 Task 3.
  const { data: enabledTenants, error: tenantError } = await supabase
    .from('tenants')
    .select('id')
    .eq('features_enabled->>invoicing', 'true');

  if (tenantError) {
    console.error('[invoice-reminders] Failed to fetch enabled tenants:', tenantError);
    return Response.json({ error: 'Tenant filter failed' }, { status: 500 });
  }

  const enabledTenantIds = (enabledTenants || []).map((t) => t.id);

  // Short-circuit when no tenants are enabled — saves the rest of the queries.
  if (enabledTenantIds.length === 0) {
    console.log('[invoice-reminders] No tenants with invoicing enabled — skipping');
    return Response.json({ reminders_sent: 0, late_fees_applied: 0 });
  }

  // ─── PART 1: Reminder Dispatch ──────────────────────────────────────────────

  try {
    // Query invoices eligible for reminders
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, due_date, total, status, tenant_id,
        customer_name, customer_email, customer_phone,
        reminders_enabled
      `)
      .in('tenant_id', enabledTenantIds)              // ← Phase 53 filter
      .in('status', ['sent', 'overdue', 'partially_paid'])
      .eq('reminders_enabled', true)
      .not('due_date', 'is', null);

    if (invoiceError) {
      console.error('[invoice-reminders] Failed to query invoices:', invoiceError);
      return Response.json({ error: 'Invoice query failed' }, { status: 500 });
    }

    if (invoices?.length) {
      // Batch-fetch tenant info and invoice settings
      const tenantIds = [...new Set(invoices.map((i) => i.tenant_id))];

      const [tenantsResult, settingsResult] = await Promise.all([
        supabase
          .from('tenants')
          .select('id, business_name, owner_email, owner_phone')
          .in('id', tenantIds),
        supabase
          .from('invoice_settings')
          .select('tenant_id, business_name, phone, email')
          .in('tenant_id', tenantIds),
      ]);

      const tenantMap = new Map((tenantsResult.data || []).map((t) => [t.id, t]));
      const settingsMap = new Map((settingsResult.data || []).map((s) => [s.tenant_id, s]));

      // Batch-fetch existing reminders for idempotency
      const invoiceIds = invoices.map((i) => i.id);
      const { data: existingReminders } = await supabase
        .from('invoice_reminders')
        .select('invoice_id, reminder_type')
        .in('invoice_id', invoiceIds);

      const sentSet = new Set(
        (existingReminders || []).map((r) => `${r.invoice_id}:${r.reminder_type}`)
      );

      // Determine which reminders are due for each invoice
      const REMINDER_POINTS = [
        { offset: -3, type: 'before_3' },
        { offset: 0, type: 'due_date' },
        { offset: 3, type: 'overdue_3' },
        { offset: 7, type: 'overdue_7' },
      ];

      for (const invoice of invoices) {
        const dueDate = new Date(invoice.due_date);

        for (const point of REMINDER_POINTS) {
          const triggerDate = format(addDays(dueDate, point.offset), 'yyyy-MM-dd');
          if (triggerDate !== today) continue;

          // Idempotency check
          if (sentSet.has(`${invoice.id}:${point.type}`)) continue;

          const tenant = tenantMap.get(invoice.tenant_id);
          const settings = settingsMap.get(invoice.tenant_id);
          if (!tenant) continue;

          const businessName = settings?.business_name || tenant.business_name || 'Your service provider';
          const businessPhone = settings?.phone || '';
          const businessEmail = settings?.email || '';
          const amountDue = `$${Number(invoice.total).toFixed(2)}`;
          const formattedDueDate = format(dueDate, 'MMM d, yyyy');
          const subject = getReminderSubject(point.type);

          // SMS status phrases per UI-SPEC
          const statusPhrases = {
            before_3: `is due on ${formattedDueDate}`,
            due_date: 'is due today',
            overdue_3: `was due on ${formattedDueDate}`,
            overdue_7: `was due on ${formattedDueDate}`,
          };

          // Send email via Resend
          try {
            await getResendClient().emails.send({
              from: 'noreply@voco.live',
              to: invoice.customer_email,
              subject,
              react: InvoiceReminderEmail({
                customerName: invoice.customer_name,
                businessName,
                invoiceNumber: invoice.invoice_number,
                amountDue,
                dueDate: formattedDueDate,
                reminderType: point.type,
                businessPhone,
                businessEmail,
              }),
            });
          } catch (err) {
            console.error(`[invoice-reminders] Email failed for invoice ${invoice.id}:`, err?.message);
          }

          // Send SMS via Twilio (non-fatal)
          try {
            if (invoice.customer_phone) {
              const smsBody = `${businessName}: Payment reminder -- Invoice #${invoice.invoice_number} for ${amountDue} ${statusPhrases[point.type]}. Questions? Call ${businessPhone}`;
              await getTwilioClient().messages.create({
                body: smsBody,
                from: process.env.TWILIO_FROM_NUMBER,
                to: invoice.customer_phone,
              });
            }
          } catch (err) {
            console.error(`[invoice-reminders] SMS failed for invoice ${invoice.id}:`, err?.message);
          }

          // Record reminder for idempotency
          await supabase.from('invoice_reminders').upsert(
            {
              invoice_id: invoice.id,
              tenant_id: invoice.tenant_id,
              reminder_type: point.type,
              sent_at: new Date().toISOString(),
            },
            { onConflict: 'invoice_id,reminder_type', ignoreDuplicates: true }
          );

          remindersSent++;
          console.log(`[invoice-reminders] Sent ${point.type} for invoice ${invoice.id}`);
        }
      }
    }
  } catch (err) {
    console.error('[invoice-reminders] Reminder dispatch error:', err);
  }

  // ─── PART 2: Late Fee Application ──────────────────────────────────────────

  try {
    // Query overdue invoices with late fees enabled in settings
    const { data: overdueInvoices, error: overdueError } = await supabase
      .from('invoices')
      .select(`
        id, invoice_number, total, due_date, status, tenant_id,
        late_fee_applied_at
      `)
      .in('tenant_id', enabledTenantIds)              // ← Phase 53 filter
      .in('status', ['overdue', 'partially_paid'])
      .lt('due_date', today);

    if (overdueError) {
      console.error('[invoice-reminders] Failed to query overdue invoices:', overdueError);
    } else if (overdueInvoices?.length) {
      // Get settings for all tenants with overdue invoices
      const tenantIds = [...new Set(overdueInvoices.map((i) => i.tenant_id))];
      const { data: settingsData } = await supabase
        .from('invoice_settings')
        .select('tenant_id, late_fee_enabled, late_fee_type, late_fee_amount')
        .in('tenant_id', tenantIds)
        .eq('late_fee_enabled', true);

      const lateFeeSettings = new Map((settingsData || []).map((s) => [s.tenant_id, s]));

      for (const invoice of overdueInvoices) {
        const feeSettings = lateFeeSettings.get(invoice.tenant_id);
        if (!feeSettings) continue;

        // Check if we should apply a late fee
        const shouldApply = shouldApplyLateFee({
          lateFeeType: feeSettings.late_fee_type,
          lateFeeAppliedAt: invoice.late_fee_applied_at,
          today,
        });

        if (!shouldApply) continue;

        // Get existing late fee sum for this invoice
        const { data: existingLateFees } = await supabase
          .from('invoice_line_items')
          .select('line_total')
          .eq('invoice_id', invoice.id)
          .eq('item_type', 'late_fee');

        const existingLateFeeSum = (existingLateFees || []).reduce(
          (sum, item) => sum + Number(item.line_total),
          0
        );

        // Calculate the fee
        const { feeAmount } = calculateLateFee({
          invoiceTotal: Number(invoice.total),
          lateFeeType: feeSettings.late_fee_type,
          lateFeeAmount: Number(feeSettings.late_fee_amount),
          existingLateFeeSum,
        });

        if (feeAmount <= 0) continue;

        const daysOverdue = differenceInDays(new Date(today), new Date(invoice.due_date));

        // Insert late fee line item
        await supabase.from('invoice_line_items').insert({
          invoice_id: invoice.id,
          tenant_id: invoice.tenant_id,
          item_type: 'late_fee',
          description: `Late fee -- ${daysOverdue} days overdue`,
          quantity: 1,
          unit_price: feeAmount,
          markup_pct: 0,
          taxable: false,
          line_total: feeAmount,
          sort_order: 9999,
        });

        // Recalculate invoice totals
        const { data: allItems } = await supabase
          .from('invoice_line_items')
          .select('item_type, quantity, unit_price, markup_pct, taxable')
          .eq('invoice_id', invoice.id);

        // Get tax rate from invoice settings
        const { data: invSettings } = await supabase
          .from('invoice_settings')
          .select('tax_rate')
          .eq('tenant_id', invoice.tenant_id)
          .maybeSingle();

        const taxRate = invSettings?.tax_rate || 0;
        const totals = calculateInvoiceTotals(allItems || [], taxRate);

        await supabase
          .from('invoices')
          .update({
            subtotal: totals.subtotal,
            tax_amount: totals.tax_amount,
            total: totals.total,
            late_fee_applied_at: new Date().toISOString(),
          })
          .eq('id', invoice.id);

        lateFeesApplied++;
        console.log(`[invoice-reminders] Applied late fee of $${feeAmount} to invoice ${invoice.id}`);
      }
    }
  } catch (err) {
    console.error('[invoice-reminders] Late fee application error:', err);
  }

  return Response.json({ reminders_sent: remindersSent, late_fees_applied: lateFeesApplied });
}
