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
 * Phase 57 Plan 05 — post-booking "copy this to Jobber" email (UI-SPEC §Copywriting).
 *
 * Sent by notifyBookingCopyToJobber when:
 *   - Owner has Jobber connected, AND
 *   - The Voco-booked appointment has not been pushed yet (jobber_visit_id IS NULL).
 *
 * Body contains a 6-line monospace paste block (same shape as the in-flyout Copy
 * button) plus an "Open Jobber" CTA. Phase 999.3 will add a one-click "Push to
 * Jobber" button alongside, at which point this email is shown only when push
 * fails.
 *
 * Security: only renders pre-formatted text strings; no dangerouslySetInnerHTML.
 * Customer PII is the same surface already shown in the existing
 * BookingConfirmation email (T-57-05-02 accepted).
 */
export function BookingCopyToJobberEmail({ pasteBlock }) {
  return (
    <Html>
      <Head />
      <Preview>Don&apos;t forget to add this to Jobber</Preview>
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
          <Heading as="h1" style={{ fontSize: '20px', margin: '0 0 16px', color: '#111827' }}>
            Don&apos;t forget to add this to Jobber
          </Heading>
          <Text style={{ fontSize: '14px', lineHeight: '1.5', color: '#374151' }}>
            Voco has booked this job — paste the details below into a new Jobber visit so your schedule stays in sync.
          </Text>
          <Section
            style={{
              backgroundColor: '#f3f4f6',
              padding: '16px',
              borderRadius: '8px',
              whiteSpace: 'pre-wrap',
              fontFamily: 'ui-monospace, Menlo, monospace',
              fontSize: '13px',
              color: '#111827',
              margin: '16px 0',
            }}
          >
            {pasteBlock}
          </Section>
          <Section style={{ margin: '24px 0' }}>
            <Link
              href="https://secure.getjobber.com/work_orders/new"
              style={{
                display: 'inline-block',
                backgroundColor: '#1B9F4F',
                color: '#ffffff',
                padding: '12px 20px',
                borderRadius: '8px',
                textDecoration: 'none',
                fontSize: '14px',
                fontWeight: 500,
              }}
            >
              Open Jobber
            </Link>
          </Section>
          <Text style={{ fontSize: '12px', color: '#6b7280' }}>
            One-click push from Voco to Jobber is coming soon. Until then, paste keeps your schedule in sync.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export default BookingCopyToJobberEmail;
