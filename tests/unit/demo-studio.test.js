/**
 * Demo Studio pure logic: task and destination registries, session rules and
 * room metadata, and the live-actions timeline built from the agent's events.
 */

import { DESTINATIONS, destinationState, getDestination, isDestinationSelectable } from '@/lib/demo/destinations';
import { DEFAULT_SCENARIO_ID, SCENARIOS, getScenario, isScenarioLive } from '@/lib/demo/scenarios';
import {
  buildDemoRoomMetadata, buildDemoRoomName, isDemoRoomOfTenant, validateDemoRequest,
} from '@/lib/demo/session';
import { buildTimeline, eventTitle, formatEventWhen } from '@/lib/demo/actions';
import { VOICE_OPTIONS } from '@/lib/demo/voices';

const READY_GOOGLE = { id: 'google', kind: 'external', connected: true, healthy: true };
const DEAD_GOOGLE = { id: 'google', kind: 'external', connected: true, healthy: false };
const NO_OUTLOOK = { id: 'outlook', kind: 'external', connected: false, healthy: false };
const VOCO = { id: 'voco', kind: 'internal', connected: true, healthy: true };
const STATUSES = [READY_GOOGLE, NO_OUTLOOK, VOCO];

describe('scenarios', () => {
  it('has exactly one live task, scheduling, and it is the default', () => {
    expect(SCENARIOS.filter((s) => s.status === 'live').map((s) => s.id)).toEqual(['scheduling']);
    expect(DEFAULT_SCENARIO_ID).toBe('scheduling');
    expect(isScenarioLive('scheduling')).toBe(true);
  });

  it('lists the other tasks as coming soon, not selectable', () => {
    const soon = SCENARIOS.filter((s) => s.status === 'soon');
    expect(soon.length).toBeGreaterThanOrEqual(3);
    for (const s of soon) expect(isScenarioLive(s.id)).toBe(false);
    expect(getScenario('nope')).toBeNull();
    expect(isScenarioLive('nope')).toBe(false);
  });
});

describe('destinations', () => {
  it('offers Google, Outlook and the Voco calendar', () => {
    expect(DESTINATIONS.map((d) => d.id)).toEqual(['google', 'outlook', 'voco']);
    expect(getDestination('google').provider).toBe('google');
    expect(getDestination('voco').kind).toBe('internal');
    expect(getDestination('salesforce')).toBeNull();
  });

  it('external destinations need a connection that passed its check', () => {
    expect(isDestinationSelectable(READY_GOOGLE)).toBe(true);
    expect(isDestinationSelectable(DEAD_GOOGLE)).toBe(false);
    expect(isDestinationSelectable(NO_OUTLOOK)).toBe(false);
    expect(isDestinationSelectable(VOCO)).toBe(true);
    expect(isDestinationSelectable(undefined)).toBe(false);
  });

  it('names the state behind the health dot', () => {
    expect(destinationState(READY_GOOGLE)).toBe('ready');
    expect(destinationState(DEAD_GOOGLE)).toBe('needs_reconnect');
    expect(destinationState(NO_OUTLOOK)).toBe('not_connected');
    expect(destinationState(VOCO)).toBe('ready');
  });
});

describe('validateDemoRequest', () => {
  it('accepts the live task with a healthy destination', () => {
    expect(validateDemoRequest({ task: 'scheduling', destination: 'google' }, STATUSES)).toEqual({
      ok: true, task: 'scheduling', destination: 'google', voiceOverride: null,
    });
  });

  it('rejects unknown and coming-soon tasks', () => {
    expect(validateDemoRequest({ task: 'nope', destination: 'google' }, STATUSES)).toMatchObject({ ok: false, status: 400 });
    expect(validateDemoRequest({ task: 'lead_crm', destination: 'google' }, STATUSES)).toMatchObject({ ok: false, status: 400 });
    expect(validateDemoRequest({}, STATUSES)).toMatchObject({ ok: false, status: 400 });
  });

  it('rejects an unknown destination', () => {
    expect(validateDemoRequest({ task: 'scheduling', destination: 'salesforce' }, STATUSES)).toMatchObject({ ok: false, status: 400 });
  });

  it('refuses to start against a calendar that is not connected or failed its check', () => {
    const notConnected = validateDemoRequest({ task: 'scheduling', destination: 'outlook' }, STATUSES);
    expect(notConnected).toMatchObject({ ok: false, status: 409 });
    expect(notConnected.error).toMatch(/not connected/);
    const dead = validateDemoRequest({ task: 'scheduling', destination: 'google' }, [DEAD_GOOGLE, VOCO]);
    expect(dead).toMatchObject({ ok: false, status: 409 });
    expect(dead.error).toMatch(/reconnect/);
  });

  it('only accepts curated voices', () => {
    const voice = VOICE_OPTIONS[0].id;
    expect(validateDemoRequest({ task: 'scheduling', destination: 'voco', voice_override: voice }, STATUSES))
      .toMatchObject({ ok: true, voiceOverride: voice });
    expect(validateDemoRequest({ task: 'scheduling', destination: 'voco', voice_override: 'anything' }, STATUSES))
      .toMatchObject({ ok: false, status: 400 });
  });
});

describe('room name and metadata', () => {
  const tenant = { id: 'tenant-1', phone_number: '+18005550001' };

  it('keeps the test-web- prefix so dispatch and result routes are reused', () => {
    expect(buildDemoRoomName('tenant-1', 1700000000000)).toBe('test-web-tenant-1-1700000000000');
  });

  it('marks the room as a sandboxed test call carrying the demo block', () => {
    expect(buildDemoRoomMetadata({ tenant, task: 'scheduling', destination: 'google' })).toEqual({
      test_call: true,
      web_test: true,
      tenant_id: 'tenant-1',
      to_number: '+18005550001',
      demo: { task: 'scheduling', destination: 'google', keep_booking: true },
    });
  });

  it('adds the voice override only when given', () => {
    const meta = buildDemoRoomMetadata({ tenant, task: 'scheduling', destination: 'voco', voiceOverride: 'abc' });
    expect(meta.voice_override).toBe('abc');
  });

  it('scopes cleanup to web test rooms of the demo tenant', () => {
    expect(isDemoRoomOfTenant('test-web-tenant-1-1700000000000', 'tenant-1')).toBe(true);
    expect(isDemoRoomOfTenant('test-web-tenant-2-1700000000000', 'tenant-1')).toBe(false);
    expect(isDemoRoomOfTenant('call-tenant-1-1700000000000', 'tenant-1')).toBe(false);
    expect(isDemoRoomOfTenant('test-web-', '')).toBe(false);
    expect(isDemoRoomOfTenant(undefined, 'tenant-1')).toBe(false);
  });
});

describe('live actions timeline', () => {
  const tz = 'Asia/Singapore';
  const events = [
    { id: 'e1', type: 'tool', name: 'check_day', args: { date: '2026-11-24' }, state: 'STATE:day_has_slots date_label=Tuesday, November 24th count=9' },
    { id: 'e2', type: 'booked', appointment_id: 'appt-1', start: '2026-11-24T04:00:00+00:00', end: '2026-11-24T05:00:00+00:00', caller_name: 'Alex Tan', reason: 'product demo' },
    { id: 'e3', type: 'tool', name: 'book_appointment', args: {}, state: 'BOOKED: confirm the day and time' },
    { id: 'e4', type: 'calendar_saved', appointment_id: 'appt-1', provider: 'google', event_id: 'evt-1', link: 'https://calendar.example/evt-1' },
    { id: 'e5', type: 'tool', name: 'end_call', args: {}, state: '' },
  ];

  it('formats the event time in the business timezone', () => {
    expect(formatEventWhen('2026-11-24T04:00:00+00:00', '2026-11-24T05:00:00+00:00', tz)).toBe('Tue, 24 Nov · 12:00 – 1:00 PM');
    expect(formatEventWhen('2026-11-24T03:00:00+00:00', '2026-11-24T04:00:00+00:00', tz)).toBe('Tue, 24 Nov · 11:00 AM – 12:00 PM');
    expect(formatEventWhen('nonsense', 'nonsense', tz)).toBe('');
  });

  it('titles the event the way the agent writes it to the calendar', () => {
    expect(eventTitle('Alex Tan', 'product demo')).toBe('Alex Tan: Product demo');
    expect(eventTitle('Alex Tan', '')).toBe('Alex Tan');
    expect(eventTitle('', 'intro call')).toBe('Intro call');
    expect(eventTitle('', '')).toBe('Appointment');
  });

  it('builds the timeline and the event card from a full call', () => {
    const { actions, booking } = buildTimeline(events, { timeZone: tz });
    expect(actions.map((a) => a.title)).toEqual([
      'Looked up open times',
      'Booked the appointment',
      'Saved to Google Calendar',
      'Ended the call',
    ]);
    expect(actions[0].detail).toBe('Tue 24 Nov · 9 open');
    expect(actions[2].link).toBe('https://calendar.example/evt-1');
    expect(booking).toMatchObject({
      appointmentId: 'appt-1',
      title: 'Alex Tan: Product demo',
      when: 'Tue, 24 Nov · 12:00 – 1:00 PM',
      provider: 'google',
      link: 'https://calendar.example/evt-1',
      saved: true,
    });
  });

  it('does not show the successful book_appointment tool call twice', () => {
    const { actions } = buildTimeline(events, { timeZone: tz });
    expect(actions.filter((a) => /book/i.test(a.title))).toHaveLength(1);
  });

  it('describes a slot check', () => {
    const { actions } = buildTimeline([
      { id: 'a', type: 'tool', name: 'check_slot', args: { date: '2026-11-26', time: '15:00' }, state: 'STATE:slot_available token=slot_1' },
      { id: 'b', type: 'tool', name: 'check_slot', args: { date: '2026-11-26', time: '09:30' }, state: 'STATE:slot_unavailable' },
    ]);
    expect(actions[0]).toMatchObject({ title: 'Checked availability', detail: 'Thu 26 Nov, 3:00 PM · open' });
    expect(actions[1].detail).toBe('Thu 26 Nov, 9:30 AM · not open');
  });

  it('reports a booking that is not saved to the calendar', () => {
    const { actions, booking } = buildTimeline([events[1], { id: 'f', type: 'calendar_failed', appointment_id: 'appt-1', provider: 'google' }], { timeZone: tz });
    expect(actions[1]).toMatchObject({ tone: 'warn', title: 'Could not save to Google Calendar' });
    expect(booking).toMatchObject({ saved: false, failed: true, link: null });
  });

  it('shows the confirm gate and a taken slot', () => {
    const { actions } = buildTimeline([
      { id: 'a', type: 'tool', name: 'book_appointment', args: {}, state: 'STATE:needs_confirmation time=[…]' },
      { id: 'b', type: 'tool', name: 'book_appointment', args: {}, state: 'STATE:slot_taken next_available=…' },
    ]);
    expect(actions.map((a) => a.title)).toEqual(['Asked the caller to confirm', 'That time was just taken']);
  });

  it('ignores malformed events', () => {
    expect(buildTimeline([null, {}, { type: 5 }, { type: 'unknown' }])).toEqual({ actions: [], booking: null });
    expect(buildTimeline(undefined)).toEqual({ actions: [], booking: null });
  });
});
