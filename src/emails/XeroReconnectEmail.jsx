import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';

/**
 * Phase 55 D-14 — Token-refresh failure email.
 *
 * Sent once per failure by notifyXeroRefreshFailure. Copy locked by UI-SPEC
 * §Copywriting Contract: plain language, no PII, no balance, no invoice numbers.
 */
export function XeroReconnectEmail({ reconnectUrl }) {
  return (
    <Html>
      <Head />
      <Preview>Your Xero connection needs attention</Preview>
      <Body
        style={{
          fontFamily: 'Inter, system-ui, sans-serif',
          backgroundColor: '#fafafa',
          padding: '24px',
        }}
      >
        <Container
          style={{
            backgroundColor: '#ffffff',
            padding: '32px',
            borderRadius: '12px',
            maxWidth: '560px',
          }}
        >
          <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px' }}>
            Reconnect Xero
          </Heading>
          <Text
            style={{
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#374151',
            }}
          >
            Your Xero connection has stopped working. Until you reconnect, your
            AI receptionist won&apos;t see caller billing info on incoming calls.
          </Text>
          <Section style={{ margin: '24px 0' }}>
            <Link
              href={reconnectUrl}
              style={{
                display: 'inline-block',
                backgroundColor: '#C2410C',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Reconnect Xero
            </Link>
          </Section>
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            Calls will still be answered. Booking, triage, and notifications
            work as usual — only the Xero customer-history lookup is paused.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default XeroReconnectEmail;
