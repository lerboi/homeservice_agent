import * as Sentry from '@sentry/nextjs';

export async function POST(request) {
  const authHeader = request.headers.get('x-sentry-test-secret');
  const isNonProd = process.env.NODE_ENV !== 'production';

  if (!isNonProd && authHeader !== process.env.SENTRY_TEST_SECRET) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const error = new Error('Deliberate Sentry test error — HARDEN-04 validation');
  const eventId = Sentry.captureException(error);
  await Sentry.flush(2000);

  return Response.json({
    message: 'Error captured. Search Sentry for this event ID.',
    sentry_event_id: eventId,
  });
}
