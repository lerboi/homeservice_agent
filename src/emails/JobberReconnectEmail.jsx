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
 * Phase 56 Plan 04 — Jobber token-refresh failure email.
 *
 * Mirrors XeroReconnectEmail structurally (P55 D-14 pattern carried forward
 * per Phase 56 CONTEXT.md). Sent once per failure by notifyJobberRefreshFailure.
 * Copy locked by UI-SPEC §Copywriting Contract.
 *
 * Security: accepts ONLY `reconnectUrl`. NEVER accepts tokenSet / accessToken /
 * refreshToken / clientSecret props — token material must never appear in email
 * body per threat register T-56-04-01.
 */
export function JobberReconnectEmail({ reconnectUrl }) {
  return (
    <Html>
      <Head />
      <Preview>Your Jobber connection needs attention</Preview>
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
            Reconnect Jobber
          </Heading>
          <Text
            style={{
              fontSize: '14px',
              lineHeight: '1.5',
              color: '#374151',
            }}
          >
            Your Jobber connection has stopped working. Until you reconnect,
            your AI receptionist won&apos;t see caller job history on incoming calls.
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
              Reconnect Jobber
            </Link>
          </Section>
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            Calls will still be answered. Booking, triage, and notifications
            work as usual — only the Jobber customer-history lookup is paused.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default JobberReconnectEmail;
