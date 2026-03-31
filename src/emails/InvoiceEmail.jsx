/**
 * React Email template for invoice delivery.
 *
 * CRITICAL WHITE-LABEL (D-09): NO platform branding visible to the customer.
 * Only tenant business info from settings. The invoice PDF is attached separately;
 * this template is the email body.
 */

import { Html, Head, Body, Container, Section, Text, Hr, Img } from '@react-email/components';

/**
 * @param {{ invoice: object, settings: object, lineItems: Array }} props
 */
export default function InvoiceEmail({ invoice, settings, lineItems }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={main}>
        <Container style={container}>
          {/* Business header — logo if available, then business name */}
          {settings?.logo_url && (
            <Img src={settings.logo_url} width={120} style={logo} alt={settings.business_name || ''} />
          )}
          <Text style={businessName}>{settings?.business_name || ''}</Text>

          {/* Greeting */}
          <Text style={heading}>Invoice {invoice?.invoice_number || ''}</Text>
          <Text style={paragraph}>
            Dear {invoice?.customer_name || 'Customer'},
          </Text>
          <Text style={paragraph}>
            Please find attached your invoice for ${Number(invoice?.total || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}.
          </Text>

          {/* Key details box */}
          <Section style={detailsBox}>
            <Text style={detailRow}>Invoice #: {invoice?.invoice_number || ''}</Text>
            <Text style={detailRow}>Amount Due: ${Number(invoice?.total || 0).toFixed(2)}</Text>
            <Text style={detailRow}>Due Date: {invoice?.due_date || ''}</Text>
            {invoice?.payment_terms && (
              <Text style={detailRow}>Terms: {invoice.payment_terms}</Text>
            )}
          </Section>

          <Hr style={hr} />

          {/* Footer — BUSINESS NAME ONLY, NO PLATFORM BRANDING (D-09) */}
          <Text style={footer}>
            Sent by {settings?.business_name || 'Your Service Provider'}
            {settings?.phone ? ` | ${settings.phone}` : ''}
            {settings?.email ? ` | ${settings.email}` : ''}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Inline styles (email client compatible) ──────────────────────────────────

const main = {
  backgroundColor: '#f5f5f4',
  fontFamily: 'Arial, sans-serif',
};

const container = {
  backgroundColor: '#ffffff',
  padding: '40px',
  borderRadius: '8px',
  margin: '40px auto',
  maxWidth: '600px',
};

const logo = {
  marginBottom: '16px',
};

const businessName = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#1C1917',
  margin: '0 0 8px',
};

const heading = {
  fontSize: '20px',
  fontWeight: 'bold',
  color: '#1C1917',
  marginTop: '24px',
  marginBottom: '8px',
};

const paragraph = {
  fontSize: '14px',
  color: '#57534E',
  lineHeight: '1.5',
  margin: '4px 0',
};

const detailsBox = {
  backgroundColor: '#FAFAF9',
  borderRadius: '8px',
  padding: '16px',
  margin: '16px 0',
};

const detailRow = {
  fontSize: '14px',
  color: '#1C1917',
  margin: '4px 0',
};

const hr = {
  borderTop: '1px solid #E7E5E4',
  margin: '24px 0',
};

const footer = {
  fontSize: '12px',
  color: '#A8A29E',
  textAlign: 'center',
  marginTop: '24px',
};
