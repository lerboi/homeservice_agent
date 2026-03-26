/**
 * React Email template for trial reminder notifications.
 * Used for day 7, day 12, and trial_will_end (3 days before trial end).
 * Design tokens: navy #0F172A, bodyText #475569, brandOrange #C2410C, warmSurface #F5F5F4
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
 * @param {{ businessName: string, daysUsed: number, daysRemaining: number,
 *           callsUsed: number, callsLimit: number, upgradeUrl: string }} props
 */
export function TrialReminderEmail({
  businessName,
  daysUsed,
  daysRemaining,
  callsUsed,
  callsLimit,
  upgradeUrl,
}) {
  // Dynamic heading based on trial stage
  let heading;
  if (daysUsed <= 7) {
    heading = '7 days in — here\u2019s how your trial is going';
  } else if (daysRemaining <= 2) {
    heading = '2 days left — keep the calls coming';
  } else {
    heading = 'Your trial ends in 3 days';
  }

  // Body copy varies by stage
  let bodyCopy;
  if (daysUsed <= 7) {
    bodyCopy = `You\u2019re 7 days into your Voco trial, ${businessName}. Here\u2019s a quick look at how your AI receptionist has been performing. Upgrade now to keep the calls answered after your trial ends.`;
  } else if (daysRemaining <= 2) {
    bodyCopy = `Only 2 days left in your Voco trial. Don\u2019t let missed calls cost you jobs \u2014 upgrade now to keep your AI receptionist answering 24/7.`;
  } else {
    bodyCopy = `Your Voco trial ends in 3 days. Upgrade now to keep your calls answered and never lose a lead to voicemail.`;
  }

  return (
    <Html lang="en">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header — standard navy */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>Voco</Text>
          </Section>

          {/* Main content */}
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>{heading}</Heading>

            <Text style={bodyTextStyle}>{bodyCopy}</Text>

            <Hr style={dividerStyle} />

            {/* Usage stats */}
            <Section style={detailsStyle}>
              <DetailRow label="CALLS USED" value={`${callsUsed} of ${callsLimit}`} />
              <DetailRow label="DAYS REMAINING" value={String(daysRemaining)} />
            </Section>

            <Hr style={dividerStyle} />

            {/* CTA */}
            <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <Button href={upgradeUrl} style={buttonStyle}>
                Upgrade Now
              </Button>
            </Section>
          </Section>

          {/* Footer */}
          <Section style={footerStyle}>
            <Text style={footerTextStyle}>
              Sent by Voco. To manage your notification settings, visit your
              dashboard.
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

const sectionStyle = {
  padding: '32px 32px 16px',
};

const headingStyle = {
  color: '#0F172A', // navy
  fontSize: '22px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 16px',
};

const bodyTextStyle = {
  color: '#475569', // bodyText
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
  color: '#475569', // bodyText
  fontSize: '13px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: 0,
  minWidth: '120px',
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
  fontWeight: '700',
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
