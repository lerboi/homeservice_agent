/**
 * React Email template for the post-checkout welcome email.
 * Sent from the Stripe checkout webhook after phone provisioning succeeds —
 * this is the FIRST email a new customer receives, and the only place their
 * AI receptionist's number is delivered to them directly.
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
 * @param {{ businessName: string, phoneNumber: string, trialEndDate: string | null,
 *           dashboardUrl: string }} props
 */
export function WelcomeEmail({ businessName, phoneNumber, trialEndDate, dashboardUrl }) {
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
            <Heading style={headingStyle}>
              {businessName ? `${businessName}, your` : 'Your'} AI receptionist is live
            </Heading>

            <Text style={bodyTextStyle}>
              Your new business number is ready. Every call to it is answered by
              your AI receptionist — 24/7, including the ones you used to miss.
            </Text>

            <Section style={numberBoxStyle}>
              <Text style={numberLabelStyle}>YOUR AI RECEPTIONIST NUMBER</Text>
              <Text style={numberValueStyle}>{phoneNumber}</Text>
            </Section>

            <Text style={bodyTextStyle}>
              <strong>Try it right now:</strong> call the number from your cell
              and book a test job — hear exactly what your customers will hear.
            </Text>
            <Text style={bodyTextStyle}>
              <strong>Then make it count:</strong> forward your existing business
              line to this number, and add it to your website and Google Business
              Profile so new customers reach your AI directly.
            </Text>

            {trialEndDate ? (
              <Text style={bodyTextStyle}>
                Your free trial runs until <strong>{trialEndDate}</strong> — you
                won&apos;t be charged before then.
              </Text>
            ) : null}

            <Hr style={dividerStyle} />

            {/* CTA */}
            <Section style={{ textAlign: 'center', padding: '24px 0 8px' }}>
              <Button href={dashboardUrl} style={buttonStyle}>
                Open Your Dashboard
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
  margin: '0 0 12px',
};

const numberBoxStyle = {
  backgroundColor: '#F5F5F4', // warmSurface
  border: '1px solid #e2e8f0',
  borderRadius: '10px',
  padding: '16px 20px',
  margin: '8px 0 16px',
  textAlign: 'center',
};

const numberLabelStyle = {
  color: '#475569',
  fontSize: '12px',
  fontWeight: '700',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  margin: '0 0 4px',
};

const numberValueStyle = {
  color: '#0F172A',
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: '24px',
  fontWeight: '700',
  margin: 0,
};

const dividerStyle = {
  borderColor: '#e2e8f0',
  margin: '0',
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
