/**
 * @react-pdf/renderer Document component for estimate PDF generation.
 *
 * CRITICAL WHITE-LABEL (D-09): This file is brand-neutral.
 * No "Powered by", no platform URLs, no platform logos — only tenant business info.
 *
 * Supports both single-price estimates and tiered (good/better/best) estimates.
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';
import { renderToBuffer } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1C1917' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  businessName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  businessInfo: { fontSize: 10, color: '#57534E', lineHeight: 1.5 },
  estimateTitle: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', textAlign: 'right' },
  estimateSubtitle: { fontSize: 10, color: '#57534E', textAlign: 'right', marginTop: 2 },
  estimateMeta: { fontSize: 10, color: '#57534E', textAlign: 'right', lineHeight: 1.5 },
  billTo: { marginBottom: 24 },
  billToLabel: { fontSize: 9, fontWeight: 'bold', color: '#78716C', marginBottom: 4, textTransform: 'uppercase' },
  billToName: { fontSize: 12, fontWeight: 'bold', color: '#1C1917' },
  tableHeader: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#D6D3D1', paddingBottom: 6, marginBottom: 4 },
  tableHeaderCell: { fontSize: 9, fontWeight: 'bold', color: '#78716C', textTransform: 'uppercase' },
  tableRow: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 0.5, borderBottomColor: '#E7E5E4' },
  tableRowAlt: { backgroundColor: '#FAFAF9' },
  tableCell: { fontSize: 10, color: '#1C1917' },
  totalsSection: { marginTop: 16, alignItems: 'flex-end' },
  totalRow: { flexDirection: 'row', justifyContent: 'flex-end', width: 200, paddingVertical: 4 },
  totalLabel: { fontSize: 10, color: '#57534E', width: 120 },
  totalValue: { fontSize: 10, color: '#1C1917', width: 80, textAlign: 'right' },
  grandTotal: { fontSize: 14, fontWeight: 'bold', color: '#0F172A' },
  grandTotalLabel: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', width: 120 },
  footer: { marginTop: 32, borderTopWidth: 1, borderTopColor: '#D6D3D1', paddingTop: 16 },
  footerText: { fontSize: 9, color: '#78716C', lineHeight: 1.5 },
  // Tiered layout styles
  tieredContainer: { flexDirection: 'row', marginTop: 8 },
  tierColumn: { flex: 1 },
  tierDivider: { width: 0.5, backgroundColor: '#D6D3D1' },
  tierLabel: { fontSize: 14, fontWeight: 'bold', color: '#0F172A', marginBottom: 8 },
  tierTotalSection: { marginTop: 12, borderTopWidth: 1, borderTopColor: '#D6D3D1', paddingTop: 8 },
  tierTotalRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 2 },
  tierTotalLabel: { fontSize: 9, color: '#57534E' },
  tierTotalValue: { fontSize: 9, color: '#1C1917', textAlign: 'right' },
  tierGrandTotal: { fontSize: 12, fontWeight: 'bold', color: '#0F172A' },
});

/** Column widths for the line items table */
const COL = {
  description: { width: '50%' },
  qty:         { width: '15%' },
  rate:        { width: '15%' },
  amount:      { width: '20%', textAlign: 'right' },
};

/** Narrower column widths for tiered layout */
const TIER_COL = {
  description: { width: '50%' },
  qty:         { width: '15%' },
  rate:        { width: '15%' },
  amount:      { width: '20%', textAlign: 'right' },
};

/**
 * Format a monetary value with comma separators and 2 decimal places.
 */
function formatMoney(val) {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Get the display description for a line item.
 */
function getItemDescription(item) {
  if (item.item_type === 'materials' && item.markup_pct > 0) {
    return `${item.description} (${(item.markup_pct * 100).toFixed(0)}% markup)`;
  }
  return item.description || '';
}

/**
 * Get the display amount string for a line item.
 */
function getItemAmountDisplay(item) {
  const total = Number(item.line_total || 0);
  if (item.item_type === 'discount') {
    return `-$${formatMoney(Math.abs(total))}`;
  }
  return `$${formatMoney(total)}`;
}

/**
 * BusinessHeader — shared header for both single-price and tiered layouts.
 */
function BusinessHeader({ estimate, settings }) {
  return (
    <View style={styles.header}>
      <View style={{ maxWidth: 250 }}>
        {settings.logo_url ? (
          <Image
            src={settings.logo_url}
            style={{ maxHeight: 48, maxWidth: 120, marginBottom: 8 }}
          />
        ) : null}
        <Text style={styles.businessName}>{settings.business_name || ''}</Text>
        {settings.address ? (
          <Text style={styles.businessInfo}>{settings.address}</Text>
        ) : null}
        <Text style={styles.businessInfo}>
          {settings.phone || ''}{settings.phone && settings.email ? ' | ' : ''}{settings.email || ''}
        </Text>
        {settings.license_number ? (
          <Text style={styles.businessInfo}>License: {settings.license_number}</Text>
        ) : null}
      </View>
      <View>
        <Text style={styles.estimateTitle}>ESTIMATE</Text>
        <Text style={styles.estimateMeta}>Estimate #{estimate.estimate_number || ''}</Text>
        <Text style={styles.estimateMeta}>Created: {estimate.created_date || ''}</Text>
        {estimate.valid_until ? (
          <Text style={styles.estimateMeta}>Valid Until: {estimate.valid_until}</Text>
        ) : null}
      </View>
    </View>
  );
}

/**
 * BillToSection — customer info block.
 */
function BillToSection({ estimate }) {
  return (
    <View style={styles.billTo}>
      <Text style={styles.billToLabel}>Estimate For</Text>
      <Text style={styles.billToName}>{estimate.customer_name || ''}</Text>
      {estimate.customer_address ? (
        <Text style={styles.businessInfo}>{estimate.customer_address}</Text>
      ) : null}
      {estimate.customer_phone ? (
        <Text style={styles.businessInfo}>{estimate.customer_phone}</Text>
      ) : null}
      {estimate.customer_email ? (
        <Text style={styles.businessInfo}>{estimate.customer_email}</Text>
      ) : null}
    </View>
  );
}

/**
 * LineItemsTable — renders line items for single-price estimates.
 */
function LineItemsTable({ lineItems }) {
  return (
    <View>
      <View style={styles.tableHeader}>
        <Text style={[styles.tableHeaderCell, COL.description]}>Description</Text>
        <Text style={[styles.tableHeaderCell, COL.qty]}>Qty</Text>
        <Text style={[styles.tableHeaderCell, COL.rate]}>Rate</Text>
        <Text style={[styles.tableHeaderCell, COL.amount]}>Amount</Text>
      </View>
      {lineItems.map((item, index) => (
        <View
          key={item.id || index}
          style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
        >
          <Text style={[styles.tableCell, COL.description]}>
            {getItemDescription(item)}
          </Text>
          <Text style={[styles.tableCell, COL.qty]}>
            {item.item_type === 'travel' || item.item_type === 'flat_rate' || item.item_type === 'discount'
              ? '\u2014'
              : String(item.quantity || 1)}
          </Text>
          <Text style={[styles.tableCell, COL.rate]}>
            {item.item_type === 'discount'
              ? '\u2014'
              : `$${formatMoney(item.unit_price)}`}
          </Text>
          <Text style={[styles.tableCell, COL.amount]}>
            {getItemAmountDisplay(item)}
          </Text>
        </View>
      ))}
    </View>
  );
}

/**
 * TierColumn — renders a single tier in the tiered layout.
 */
function TierColumn({ tier }) {
  const subtotal = Number(tier.subtotal || 0);
  const taxAmount = Number(tier.tax_amount || 0);
  const total = Number(tier.total || 0);

  return (
    <View style={{ padding: 8 }}>
      <Text style={styles.tierLabel}>{tier.tier_label || 'Tier'}</Text>

      {/* Compact line items table */}
      <View style={{ borderBottomWidth: 0.5, borderBottomColor: '#D6D3D1', paddingBottom: 4, marginBottom: 4 }}>
        <View style={{ flexDirection: 'row' }}>
          <Text style={[{ fontSize: 8, fontWeight: 'bold', color: '#78716C', textTransform: 'uppercase' }, TIER_COL.description]}>Description</Text>
          <Text style={[{ fontSize: 8, fontWeight: 'bold', color: '#78716C', textTransform: 'uppercase' }, TIER_COL.qty]}>Qty</Text>
          <Text style={[{ fontSize: 8, fontWeight: 'bold', color: '#78716C', textTransform: 'uppercase' }, TIER_COL.rate]}>Rate</Text>
          <Text style={[{ fontSize: 8, fontWeight: 'bold', color: '#78716C', textTransform: 'uppercase', textAlign: 'right' }, TIER_COL.amount]}>Amount</Text>
        </View>
      </View>

      {(tier.line_items || []).map((item, index) => (
        <View
          key={item.id || index}
          style={{ flexDirection: 'row', paddingVertical: 3, borderBottomWidth: 0.25, borderBottomColor: '#E7E5E4' }}
        >
          <Text style={[{ fontSize: 8, color: '#1C1917' }, TIER_COL.description]}>
            {getItemDescription(item)}
          </Text>
          <Text style={[{ fontSize: 8, color: '#1C1917' }, TIER_COL.qty]}>
            {item.item_type === 'travel' || item.item_type === 'flat_rate' || item.item_type === 'discount'
              ? '\u2014'
              : String(item.quantity || 1)}
          </Text>
          <Text style={[{ fontSize: 8, color: '#1C1917' }, TIER_COL.rate]}>
            {item.item_type === 'discount' ? '\u2014' : `$${formatMoney(item.unit_price)}`}
          </Text>
          <Text style={[{ fontSize: 8, color: '#1C1917', textAlign: 'right' }, TIER_COL.amount]}>
            {getItemAmountDisplay(item)}
          </Text>
        </View>
      ))}

      {/* Tier totals */}
      <View style={styles.tierTotalSection}>
        <View style={styles.tierTotalRow}>
          <Text style={styles.tierTotalLabel}>Subtotal</Text>
          <Text style={styles.tierTotalValue}>${formatMoney(subtotal)}</Text>
        </View>
        {taxAmount > 0 ? (
          <View style={styles.tierTotalRow}>
            <Text style={styles.tierTotalLabel}>Tax</Text>
            <Text style={styles.tierTotalValue}>${formatMoney(taxAmount)}</Text>
          </View>
        ) : null}
        <View style={[styles.tierTotalRow, { borderTopWidth: 0.5, borderTopColor: '#D6D3D1', marginTop: 4, paddingTop: 6 }]}>
          <Text style={styles.tierGrandTotal}>Estimated Total</Text>
          <Text style={[styles.tierGrandTotal, { textAlign: 'right' }]}>${formatMoney(total)}</Text>
        </View>
      </View>
    </View>
  );
}

/**
 * EstimatePDF — @react-pdf/renderer Document component.
 *
 * Renders both single-price and tiered estimate layouts.
 *
 * @param {{ estimate: object, settings: object, lineItems: Array, tiers: Array }} props
 */
export function EstimatePDF({ estimate, settings = {}, lineItems = [], tiers = [] }) {
  const isTiered = tiers && tiers.length > 0;
  const subtotal = Number(estimate.subtotal || 0);
  const taxAmount = Number(estimate.tax_amount || 0);
  const total = Number(estimate.total || 0);

  // Calculate column widths for tiered layout
  const tierCount = tiers.length;

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* Header */}
        <BusinessHeader estimate={estimate} settings={settings} />

        {/* Bill To */}
        <BillToSection estimate={estimate} />

        {isTiered ? (
          /* Tiered Layout */
          <View>
            <Text style={styles.estimateSubtitle}>Options for your consideration</Text>

            <View style={styles.tieredContainer}>
              {tiers.map((tier, index) => (
                <View key={index} style={{ flexDirection: 'row', flex: 1 }}>
                  {index > 0 && <View style={styles.tierDivider} />}
                  <View style={styles.tierColumn}>
                    <TierColumn tier={tier} />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          /* Single-Price Layout */
          <View>
            <LineItemsTable lineItems={lineItems} />

            {/* Totals */}
            <View style={styles.totalsSection}>
              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Subtotal</Text>
                <Text style={styles.totalValue}>${formatMoney(subtotal)}</Text>
              </View>
              {taxAmount > 0 ? (
                <View style={styles.totalRow}>
                  <Text style={styles.totalLabel}>Tax</Text>
                  <Text style={styles.totalValue}>${formatMoney(taxAmount)}</Text>
                </View>
              ) : null}
              <View style={[styles.totalRow, { borderTopWidth: 1, borderTopColor: '#D6D3D1', marginTop: 4, paddingTop: 8 }]}>
                <Text style={styles.grandTotalLabel}>Estimated Total</Text>
                <Text style={[styles.grandTotal, { width: 80, textAlign: 'right' }]}>${formatMoney(total)}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Footer */}
        <View style={styles.footer}>
          {estimate.valid_until ? (
            <Text style={styles.footerText}>
              This estimate is valid until {estimate.valid_until}.
            </Text>
          ) : null}
          {estimate.notes ? (
            <Text style={[styles.footerText, { marginTop: estimate.valid_until ? 8 : 0 }]}>
              {estimate.notes}
            </Text>
          ) : null}
        </View>

      </Page>
    </Document>
  );
}

/**
 * Generate an estimate PDF buffer.
 *
 * @param {object} estimate - { estimate_number, customer_*, created_date, valid_until, notes, subtotal, tax_amount, total }
 * @param {Array} lineItems - Array of line items (for single-price, tier_id = null)
 * @param {Array} tiers - Array of { tier_label, line_items, subtotal, tax_amount, total } (empty for single-price)
 * @param {object} settings - { business_name, address, phone, email, logo_url, license_number }
 * @returns {Promise<Buffer>}
 */
export async function generateEstimatePDF(estimate, lineItems, tiers, settings) {
  const buffer = await renderToBuffer(
    <EstimatePDF
      estimate={estimate}
      settings={settings || {}}
      lineItems={lineItems || []}
      tiers={tiers || []}
    />
  );
  return buffer;
}
