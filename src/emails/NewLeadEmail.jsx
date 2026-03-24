/**
 * React Email template for owner lead alert.
 * Uses project design tokens: navy (#0F172A), bodyText (#475569),
 * brandOrange (#C2410C) for CTA, warmSurface (#F5F5F4) for background.
 */

import {
  Html,
  Head,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Section,
} from '@react-email/components';

/**
 * @param {{ lead: object, businessName: string, dashboardUrl: string }} props
 */
export function NewLeadEmail({ lead, businessName, dashboardUrl }) {
  const urgency = lead?.urgency_classification || lead?.urgency || 'routine';
  const isEmergency = urgency === 'emergency';
  const callerName = lead?.caller_name || 'Unknown caller';
  const jobType = lead?.job_type || 'General inquiry';
  const address = lead?.address || 'No address provided';
  const phone = lead?.from_number || 'N/A';

  return (
    <Html lang="en">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header */}
          <Section style={{ ...headerStyle, backgroundColor: isEmergency ? '#DC2626' : '#0F172A' }}>
            <Text style={brandStyle}>{businessName}</Text>
            {isEmergency && (
              <Text style={emergencyBadgeStyle}>EMERGENCY BOOKING</Text>
            )}
          </Section>

          {/* Main heading */}
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>
              {isEmergency ? 'EMERGENCY booking' : 'New booking'} &mdash; {callerName}
            </Heading>

            <Text style={subheadStyle}>
              A new lead just came in. Here are the details:
            </Text>

            <Hr style={dividerStyle} />

            {/* Lead detail rows */}
            <Section style={detailsStyle}>
              <DetailRow label="Caller" value={callerName} />
              <DetailRow label="Job type" value={jobType} />
              <DetailRow label="Address" value={address} />
              <DetailRow label="Phone" value={phone} />
              <DetailRow label="Urgency" value={urgency} />
            </Section>

            <Hr style={dividerStyle} />

            {/* CTA */}
            <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <Button href={dashboardUrl} style={buttonStyle}>
                View Lead in Dashboard
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Sent by Voco for {businessName}. To manage your
              notification settings, visit your dashboard.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// ─── Row helper ───────────────────────────────────────────────────────────────

function DetailRow({ label, value }) {
  return (
    <Section style={rowStyle}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </Section>
  );
}

// ─── Inline styles ────────────────────────────────────────────────────────────

const bodyStyle = {
  backgroundColor: '#F5F5F4', // warmSurface
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
  backgroundColor: '#0F172A', // navy
  padding: '20px 32px',
};

const brandStyle = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '700',
  margin: 0,
};

const emergencyBadgeStyle = {
  color: '#ffffff',
  fontSize: '11px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  margin: '4px 0 0',
  opacity: '0.9',
};

const sectionStyle = {
  padding: '32px 32px 16px',
};

const headingStyle = {
  color: '#0F172A', // navy
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 8px',
};

const subheadStyle = {
  color: '#475569', // bodyText
  fontSize: '15px',
  margin: '0 0 24px',
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
  color: '#475569', // bodyText
  fontSize: '13px',
  fontWeight: '600',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: 0,
  minWidth: '100px',
};

const valueStyle = {
  color: '#0F172A', // navy
  fontSize: '15px',
  margin: 0,
};

const buttonStyle = {
  backgroundColor: '#C2410C', // brandOrange
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 28px',
  textDecoration: 'none',
};

const footerStyle = {
  backgroundColor: '#F5F5F4', // warmSurface
  borderTop: '1px solid #e2e8f0',
  padding: '20px 32px',
};

const footerTextStyle = {
  color: '#94a3b8',
  fontSize: '13px',
  margin: 0,
};
