/**
 * React Email template for payment failure notification.
 * Uses amber-700 header (#b45309) to signal financial urgency.
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
  Section,
} from '@react-email/components';

/**
 * @param {{ businessName: string, ownerName: string, portalUrl: string }} props
 */
export function PaymentFailedEmail({ businessName, ownerName, portalUrl }) {
  return (
    <Html lang="en">
      <Head />
      <Body style={bodyStyle}>
        <Container style={containerStyle}>
          {/* Header — amber-700 to signal financial urgency */}
          <Section style={headerStyle}>
            <Text style={brandStyle}>Voco</Text>
          </Section>

          {/* Main content */}
          <Section style={sectionStyle}>
            <Heading style={headingStyle}>
              Your payment didn&apos;t go through
            </Heading>

            <Text style={bodyTextStyle}>
              Hey {ownerName}, your payment didn&apos;t go through. Your service
              continues for 3 more days — update your card now to avoid any
              interruption.
            </Text>

            {/* CTA */}
            <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <Button href={portalUrl} style={buttonStyle}>
                Update Payment Method
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
  backgroundColor: '#b45309', // amber-700 — financial urgency signal
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
