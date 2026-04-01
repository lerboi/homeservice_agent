/**
 * React Email template for invoice payment reminder notifications.
 * Used for 4 reminder types: before_3, due_date, overdue_3, overdue_7.
 * White-labeled: business name in header, no platform branding in body.
 * Design tokens: navy #0F172A, bodyText #475569, brandOrange #C2410C, warmSurface #F5F5F4
 */

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Hr,
  Section,
} from '@react-email/components';

const REMINDER_CONFIG = {
  before_3: {
    subject: 'Upcoming payment reminder',
    getBody: ({ customerName, invoiceNumber, amountDue, dueDate }) =>
      `Hi ${customerName}, this is a friendly reminder that invoice ${invoiceNumber} for ${amountDue} is due on ${dueDate}. Please let us know if you have any questions.`,
  },
  due_date: {
    subject: 'Payment due today',
    getBody: ({ customerName, invoiceNumber, amountDue }) =>
      `Hi ${customerName}, invoice ${invoiceNumber} for ${amountDue} is due today. Please arrange payment at your earliest convenience.`,
  },
  overdue_3: {
    subject: 'Payment overdue',
    getBody: ({ customerName, invoiceNumber, amountDue, dueDate }) =>
      `Hi ${customerName}, invoice ${invoiceNumber} for ${amountDue} was due on ${dueDate} and is now 3 days overdue. Please arrange payment promptly to avoid any late fees.`,
  },
  overdue_7: {
    subject: 'Payment overdue \u2014 action required',
    getBody: ({ customerName, invoiceNumber, amountDue }) =>
      `Hi ${customerName}, invoice ${invoiceNumber} for ${amountDue} is now 7 days overdue. Please arrange payment immediately. If you have already sent payment, please disregard this notice.`,
  },
};

/**
 * Get the email subject for a given reminder type.
 * @param {string} reminderType
 * @returns {string}
 */
export function getReminderSubject(reminderType) {
  return REMINDER_CONFIG[reminderType]?.subject || 'Payment reminder';
}

/**
 * @param {{ customerName: string, businessName: string, invoiceNumber: string,
 *           amountDue: string, dueDate: string, reminderType: string,
 *           businessPhone?: string, businessEmail?: string }} props
 */
export function InvoiceReminderEmail({
  customerName,
  businessName,
  invoiceNumber,
  amountDue,
  dueDate,
  reminderType,
  businessPhone,
  businessEmail,
}) {
  const config = REMINDER_CONFIG[reminderType] || REMINDER_CONFIG.due_date;
  const bodyText = config.getBody({ customerName, invoiceNumber, amountDue, dueDate });

  return (
    <Html lang="en">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header -- white-labeled with business name */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>{businessName}</Text>
          </Section>

          {/* Main content */}
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>{config.subject}</Heading>
            <Text style={bodyTextStyle}>{bodyText}</Text>

            <Hr style={dividerStyle} />

            {/* Invoice details */}
            <Section style={detailsStyle}>
              <DetailRow label="INVOICE" value={invoiceNumber} />
              <DetailRow label="AMOUNT DUE" value={amountDue} />
              <DetailRow label="DUE DATE" value={dueDate} />
            </Section>

            <Hr style={dividerStyle} />

            {/* Contact info */}
            {(businessPhone || businessEmail) && (
              <Section style={{ padding: '16px 0 0' }}>
                <Text style={contactTextStyle}>
                  Questions? {businessPhone ? `Call ${businessPhone}` : ''}
                  {businessPhone && businessEmail ? ' or ' : ''}
                  {businessEmail ? `email ${businessEmail}` : ''}
                </Text>
              </Section>
            )}
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Sent on behalf of {businessName}.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// --- Row helper ---

function DetailRow({ label, value }) {
  return (
    <Section style={rowStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </Section>
  );
}

// --- Inline styles ---

const bodyStyle = {
  backgroundColor: '#F5F5F4',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  margin: 0,
  padding: '40px 0',
};

const containerStyle = {
  backgroundColor: '#ffffff',
  borderRadius: '12px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden',
  boxShadow: '0 1px 3px 0 rgba(0,0,0,0.08)',
};

const headerStyle = {
  backgroundColor: '#0F172A',
  padding: '20px 32px',
};

const brandStyle = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '700',
  margin: 0,
};

const sectionStyle = {
  padding: '32px 32px 16px',
};

const headingStyle = {
  color: '#0F172A',
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 16px',
};

const bodyTextStyle = {
  color: '#475569',
  fontSize: '15px',
  fontWeight: '400',
  lineHeight: '1.5',
  margin: '0 0 8px',
};

const dividerStyle = {
  borderColor: '#e2e8f0',
  margin: '0',
};

const detailsStyle = {
  padding: '16px 0',
};

const rowStyle = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'baseline',
  padding: '6px 0',
};

const labelStyle = {
  color: '#475569',
  fontSize: '13px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: 0,
  minWidth: '120px',
};

const valueStyle = {
  color: '#0F172A',
  fontSize: '15px',
  margin: 0,
};

const contactTextStyle = {
  color: '#475569',
  fontSize: '14px',
  margin: 0,
};

const footerStyle = {
  backgroundColor: '#F5F5F4',
  borderTop: '1px solid #e2e8f0',
  padding: '20px 32px',
};

const footerTextStyle = {
  color: '#94a3b8',
  fontSize: '13px',
  margin: 0,
};
