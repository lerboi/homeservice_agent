/**
 * Turn the agent's live event stream (`voco.events`) into the Demo Studio's
 * "live actions" timeline. Pure functions, unit-tested.
 *
 * Event shapes (livekit-agent src/lib/demo.py, src/agent.py, book_appointment):
 *   { type: 'tool', name, args, state, is_error }
 *   { type: 'booked', appointment_id, start, end, when, caller_name, reason }
 *   { type: 'calendar_saved', appointment_id, provider, event_id, link }
 *   { type: 'calendar_failed', appointment_id, provider, action? }
 * The appointments agent (livekit-agent src/agents/appointments) adds:
 *   { type: 'rescheduled', appointment_id, start, end, previous_start, caller_name, reason }
 *   { type: 'calendar_updated', appointment_id, provider, event_id, link }
 *   { type: 'cancelled', appointment_id, start, end, caller_name, reason }
 *   { type: 'calendar_removed', appointment_id, provider, event_id }
 *   { type: 'session', agent, llm, model, fallback }   once, when the agent is ready
 */

import { getDestination } from './destinations.js';
import { getModel } from './models.js';
import { getQuality } from './voice-quality.js';
import { getLanguage } from './languages.js';

// Weekday, day and month assembled from parts: the joined string differs
// between JS engines ("Tue 24 Nov" vs "Tue, 24 Nov"), the parts do not.
function dayParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone,
  }).formatToParts(date);
  const get = (type) => parts.find((p) => p.type === type)?.value || '';
  return { weekday: get('weekday'), day: get('day'), month: get('month') };
}

function formatDate(dateStr) {
  // "2026-11-24" → "Tue 24 Nov". Parsed as a plain calendar date (no timezone).
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || '');
  if (!m) return dateStr || '';
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  const { weekday, day, month } = dayParts(d, 'UTC');
  return `${weekday} ${day} ${month}`;
}

function formatClock(timeStr) {
  // "15:00" → "3:00 PM"; anything else is shown as given.
  const m = /^(\d{1,2}):(\d{2})/.exec(timeStr || '');
  if (!m) return timeStr || '';
  const h = Number(m[1]);
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'AM' : 'PM'}`;
}

function stateToken(state) {
  // "STATE:day_has_slots date_label=… count=9" → "day_has_slots"
  const m = /^STATE:([a-z_]+)/i.exec(state || '');
  return m ? m[1] : '';
}

/** "Tue, 24 Nov · 12:00 – 1:00 PM" in the business's timezone. */
export function formatEventWhen(startIso, endIso, timeZone) {
  try {
    const start = new Date(startIso);
    const end = new Date(endIso);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return '';
    const { weekday, day: dayNum, month } = dayParts(start, timeZone);
    const day = `${weekday}, ${dayNum} ${month}`;
    const time = (d) =>
      new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone }).format(d);
    const startText = time(start);
    const endText = time(end);
    // Drop the first AM/PM when both ends share it: "12:00 – 1:00 PM".
    const sameHalf = startText.slice(-2) === endText.slice(-2);
    return `${day} · ${sameHalf ? startText.slice(0, -3) : startText} – ${endText}`;
  } catch {
    return '';
  }
}

/** Calendar event title, matching the agent's scheduling event wording. */
export function eventTitle(callerName, reason) {
  const caller = (callerName || '').trim();
  const why = (reason || '').trim();
  const capitalised = why ? why[0].toUpperCase() + why.slice(1) : '';
  if (caller && capitalised) return `${caller}: ${capitalised}`;
  return caller || capitalised || 'Appointment';
}

function toolAction(event) {
  const args = event.args || {};
  const token = stateToken(event.state);
  // The agent stopped itself from looking up a time the caller never said and
  // asked for one instead: nothing was checked, so nothing is shown.
  if (token === 'time_not_given') return null;
  switch (event.name) {
    case 'check_slot': {
      const when = [formatDate(args.date), formatClock(args.time)].filter(Boolean).join(', ');
      // The agent's token for a free time is slot_ok.
      const open = token === 'slot_ok' || token === 'slot_available';
      return {
        tone: 'done',
        title: 'Checked availability',
        detail: when ? `${when}${token ? (open ? ' · open' : ' · not open') : ''}` : '',
      };
    }
    case 'check_day': {
      const count = /count=(\d+)/.exec(event.state || '');
      const day = formatDate(args.date);
      return {
        tone: 'done',
        title: 'Looked up open times',
        detail: [day, count ? `${count[1]} open` : ''].filter(Boolean).join(' · '),
      };
    }
    case 'next_available_days':
      return { tone: 'done', title: 'Found the next open days', detail: '' };
    case 'find_appointment': {
      const found = token === 'appointment_found';
      return {
        tone: found ? 'done' : 'info',
        title: found ? 'Found the appointment' : 'Looked for the appointment',
        detail: args.caller_name ? `Under ${args.caller_name}${found ? '' : ' · nothing found'}` : '',
      };
    }
    case 'reschedule_appointment':
      // A completed move is shown from the richer `rescheduled` event instead.
      if ((event.state || '').startsWith('RESCHEDULED')) return null;
      if (token === 'needs_confirmation') {
        return { tone: 'info', title: 'Asked the caller to confirm', detail: '' };
      }
      if (token === 'slot_taken') {
        return { tone: 'warn', title: 'That time was just taken', detail: 'The appointment is unchanged' };
      }
      return { tone: 'warn', title: 'The appointment was not moved', detail: '' };
    case 'cancel_appointment':
      if ((event.state || '').startsWith('CANCELLED')) return null;
      if (token === 'needs_confirmation') {
        return { tone: 'info', title: 'Asked the caller to confirm', detail: '' };
      }
      return { tone: 'warn', title: 'The appointment was not cancelled', detail: '' };
    case 'book_appointment':
      // A successful booking is shown from the richer `booked` event instead.
      if ((event.state || '').startsWith('BOOKED')) return null;
      if (token === 'slot_taken') {
        return { tone: 'warn', title: 'That time was just taken', detail: 'Offering the next open time' };
      }
      if (token === 'needs_confirmation') {
        return { tone: 'info', title: 'Asked the caller to confirm', detail: '' };
      }
      return { tone: 'warn', title: 'Booking did not go through', detail: '' };
    case 'end_call':
      return { tone: 'info', title: 'Ended the call', detail: '' };
    default:
      return { tone: 'info', title: String(event.name || 'Action').replace(/_/g, ' '), detail: '' };
  }
}

function calendarLabel(provider) {
  return getDestination(provider)?.label || 'the calendar';
}

// What could not be done, by the `action` on a calendar_failed event.
const FAILED_VERB = {
  create: 'Could not save to',
  move: 'Could not update',
  remove: 'Could not remove from',
  connect: 'Could not reach',
};

/** The card for the appointment a `rescheduled` or `cancelled` event names. */
function cardFor(event, booking, timeZone, status) {
  const same = booking && booking.appointmentId === event.appointment_id;
  return {
    appointmentId: event.appointment_id,
    title: eventTitle(event.caller_name, event.reason),
    when: formatEventWhen(event.start, event.end, timeZone),
    start: event.start,
    end: event.end,
    // The calendar the event is in is known only if this call created it;
    // otherwise the calendar_updated / calendar_removed event fills it in.
    provider: same ? booking.provider : null,
    link: same ? booking.link : null,
    saved: false,
    failed: false,
    status,
  };
}

/**
 * Why a call has no audio to download, from the agent's `recording_failed`
 * event ({ type, reason: 'quota' | 'error' }), or '' when the recording started.
 */
export function recordingProblem(events) {
  const failed = (events || []).find((e) => e && e.type === 'recording_failed');
  if (!failed) return '';
  return failed.reason === 'quota'
    ? 'No recording: this month’s recording minutes on the LiveKit plan are used up. The call itself was not affected.'
    : 'No recording: LiveKit could not start it for this call. The call itself was not affected.';
}

/**
 * @param {Array} events - raw events in arrival order
 * @param {{ timeZone?: string }} opts
 * @returns {{ actions: Array, booking: object|null }}
 *   actions: [{ id, tone: 'done'|'info'|'warn', title, detail, link? }]
 *   booking: the calendar event for the card, or null. `status` is
 *   'booked' | 'moved' | 'cancelled'; `saved` means the calendar reflects it.
 */
export function buildTimeline(events, { timeZone = 'UTC' } = {}) {
  const actions = [];
  let booking = null;

  for (const event of events || []) {
    if (!event || typeof event.type !== 'string') continue;
    const id = event.id || `${event.type}-${event.ts}`;

    if (event.type === 'session') {
      // Sent once when the agent is ready: which model this call is really
      // running on (the page's choice, or the worker's own setting).
      const model = getModel(event.llm);
      actions.push({
        id,
        tone: 'info',
        title: `Running on ${model?.label || event.model || 'the default model'}`,
        detail: [
          event.fallback ? `Falls back to ${event.fallback}` : '',
          getQuality(event.voice_quality) ? `Voice quality: ${getQuality(event.voice_quality).label}` : '',
          getLanguage(event.stt_language) ? `Listening: ${getLanguage(event.stt_language).label}` : '',
        ].filter(Boolean).join(' · '),
      });
    } else if (event.type === 'tool') {
      const action = toolAction(event);
      if (action) actions.push({ id, ...action });
    } else if (event.type === 'booked') {
      booking = {
        appointmentId: event.appointment_id,
        title: eventTitle(event.caller_name, event.reason),
        when: formatEventWhen(event.start, event.end, timeZone),
        start: event.start,
        end: event.end,
        provider: null,
        link: null,
        saved: false,
        failed: false,
        status: 'booked',
      };
      actions.push({ id, tone: 'done', title: 'Booked the appointment', detail: booking.when });
    } else if (event.type === 'rescheduled') {
      booking = cardFor(event, booking, timeZone, 'moved');
      const length = new Date(event.end).getTime() - new Date(event.start).getTime();
      const previousStart = new Date(event.previous_start).getTime();
      booking.previousWhen = Number.isNaN(previousStart + length)
        ? ''
        : formatEventWhen(event.previous_start, new Date(previousStart + length).toISOString(), timeZone);
      actions.push({ id, tone: 'done', title: 'Moved the appointment', detail: booking.when });
    } else if (event.type === 'cancelled') {
      booking = cardFor(event, booking, timeZone, 'cancelled');
      actions.push({ id, tone: 'done', title: 'Cancelled the appointment', detail: booking.when });
    } else if (event.type === 'calendar_updated' || event.type === 'calendar_removed') {
      const removed = event.type === 'calendar_removed';
      if (booking && (!event.appointment_id || event.appointment_id === booking.appointmentId)) {
        booking = {
          ...booking,
          provider: event.provider,
          link: removed ? null : event.link || booking.link || null,
          saved: true,
        };
      }
      actions.push({
        id,
        tone: 'done',
        title: `${removed ? 'Removed from' : 'Updated in'} ${calendarLabel(event.provider)}`,
        detail: '',
        link: removed ? null : event.link || null,
      });
    } else if (event.type === 'calendar_saved') {
      const destination = getDestination(event.provider);
      const label = destination?.label || 'the calendar';
      if (booking && (!event.appointment_id || event.appointment_id === booking.appointmentId)) {
        booking = { ...booking, provider: event.provider, link: event.link || null, saved: true };
      }
      actions.push({ id, tone: 'done', title: `Saved to ${label}`, detail: '', link: event.link || null });
    } else if (event.type === 'calendar_failed') {
      if (booking) booking = { ...booking, provider: event.provider, failed: true };
      actions.push({
        id,
        tone: 'warn',
        title: `${FAILED_VERB[event.action] || FAILED_VERB.create} ${calendarLabel(event.provider)}`,
        detail: 'The booking is in Voco; check the connection',
      });
    }
  }

  return { actions, booking };
}
