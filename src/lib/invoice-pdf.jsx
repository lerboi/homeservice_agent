/**
 * @react-pdf/renderer Document component for invoice PDF generation.
 *
 * CRITICAL WHITE-LABEL (D-09): This file is brand-neutral.
 * No "Powered by", no platform URLs, no platform logos — only tenant business info.
 */
import { Document, Page, View, Text, Image, StyleSheet } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1C1917' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  businessName: { fontSize: 16, fontWeight: 'bold', color: '#0F172A' },
  businessInfo: { fontSize: 10, color: '#57534E', lineHeight: 1.5 },
  invoiceTitle: { fontSize: 24, fontWeight: 'bold', color: '#0F172A', textAlign: 'right' },
  invoiceMeta: { fontSize: 10, color: '#57534E', textAlign: 'right', lineHeight: 1.5 },
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
});

/** Column widths for the line items table */
const COL = {
  description: { width: '50%' },
  qty:         { width: '15%' },
  rate:        { width: '15%' },
  amount:      { width: '20%', textAlign: 'right' },
};

/**
 * Format a monetary value with comma separators and 2 decimal places.
 * @param {number|string} val
 * @returns {string} e.g. "1,250.00"
 */
function formatMoney(val) {
  return Number(val || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Get the display description for a line item.
 * Materials rows show the markup percentage appended.
 */
function getItemDescription(item) {
  if (item.item_type === 'materials' && item.markup_pct > 0) {
    return `${item.description} (${(item.markup_pct * 100).toFixed(0)}% markup)`;
  }
  return item.description || '';
}

/**
 * Get the display amount string for a line item.
 * Discount rows are shown as negative.
 */
function getItemAmountDisplay(item) {
  const total = Number(item.line_total || 0);
  if (item.item_type === 'discount') {
    return `-$${formatMoney(Math.abs(total))}`;
  }
  return `$${formatMoney(total)}`;
}

/**
 * InvoicePDF — @react-pdf/renderer Document component.
 *
 * @param {{ invoice: object, settings: object, lineItems: Array }} props
 */
export function InvoicePDF({ invoice, settings, lineItems = [] }) {
  const subtotal = Number(invoice.subtotal || 0);
  const taxAmount = Number(invoice.tax_amount || 0);
  const total = Number(invoice.total || 0);

  return (
    <Document>
      <Page size="A4" style={styles.page}>

        {/* ── HEADER: Business info (left) + INVOICE title block (right) ── */}
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
            <Text style={styles.invoiceTitle}>INVOICE</Text>
            <Text style={styles.invoiceMeta}>#{invoice.invoice_number || ''}</Text>
            <Text style={styles.invoiceMeta}>Issued: {invoice.issued_date || ''}</Text>
            <Text style={styles.invoiceMeta}>Due: {invoice.due_date || ''}</Text>
          </View>
        </View>

        {/* ── BILL TO ── */}
        <View style={styles.billTo}>
          <Text style={styles.billToLabel}>Bill To</Text>
          <Text style={styles.billToName}>{invoice.customer_name || ''}</Text>
          {invoice.customer_address ? (
            <Text style={styles.businessInfo}>{invoice.customer_address}</Text>
          ) : null}
          {invoice.customer_phone ? (
            <Text style={styles.businessInfo}>{invoice.customer_phone}</Text>
          ) : null}
          {invoice.customer_email ? (
            <Text style={styles.businessInfo}>{invoice.customer_email}</Text>
          ) : null}
        </View>

        {/* ── LINE ITEMS TABLE ── */}
        {/* Table header */}
        <View style={styles.tableHeader}>
          <Text style={[styles.tableHeaderCell, COL.description]}>Description</Text>
          <Text style={[styles.tableHeaderCell, COL.qty]}>Qty</Text>
          <Text style={[styles.tableHeaderCell, COL.rate]}>Rate</Text>
          <Text style={[styles.tableHeaderCell, COL.amount]}>Amount</Text>
        </View>

        {/* Table rows with alternating shade */}
        {lineItems.map((item, index) => (
          <View
            key={item.id || index}
            style={[
              styles.tableRow,
              index % 2 === 1 ? styles.tableRowAlt : {},
            ]}
          >
            <Text style={[styles.tableCell, COL.description]}>
              {getItemDescription(item)}
            </Text>
            <Text style={[styles.tableCell, COL.qty]}>
              {item.item_type === 'travel' || item.item_type === 'flat_rate' || item.item_type === 'discount'
                ? '—'
                : String(item.quantity || 1)}
            </Text>
            <Text style={[styles.tableCell, COL.rate]}>
              {item.item_type === 'discount'
                ? '—'
                : `$${formatMoney(item.unit_price)}`}
            </Text>
            <Text style={[styles.tableCell, COL.amount]}>
              {getItemAmountDisplay(item)}
            </Text>
          </View>
        ))}

        {/* ── TOTALS ── */}
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
            <Text style={styles.grandTotalLabel}>Total Due</Text>
            <Text style={[styles.grandTotal, { width: 80, textAlign: 'right' }]}>${formatMoney(total)}</Text>
          </View>
        </View>

        {/* ── FOOTER: Payment terms + notes ── */}
        {(invoice.payment_terms || invoice.notes) ? (
          <View style={styles.footer}>
            {invoice.payment_terms ? (
              <Text style={styles.footerText}>Payment Terms: {invoice.payment_terms}</Text>
            ) : null}
            {invoice.notes ? (
              <Text style={[styles.footerText, { marginTop: invoice.payment_terms ? 8 : 0 }]}>
                {invoice.notes}
              </Text>
            ) : null}
          </View>
        ) : null}

      </Page>
    </Document>
  );
}
