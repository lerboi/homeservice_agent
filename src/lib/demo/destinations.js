/**
 * Demo Studio "Save to" registry: where a demo booking is written.
 *
 * `external` destinations are the tenant's connected calendars
 * (calendar_credentials.provider). The id is what goes into the room metadata
 * (`demo.destination`) and what the agent's calendar push receives as its
 * explicit provider. `voco` keeps the booking in Voco's own calendar only.
 */
export const DESTINATIONS = [
  {
    id: 'google',
    label: 'Google Calendar',
    kind: 'external',
    provider: 'google',
    authPath: '/api/google-calendar/auth',
    openLabel: 'Open in Google Calendar',
  },
  {
    id: 'outlook',
    label: 'Outlook Calendar',
    kind: 'external',
    provider: 'outlook',
    authPath: '/api/outlook-calendar/auth',
    openLabel: 'Open in Outlook',
  },
  {
    id: 'voco',
    label: 'Voco calendar only',
    kind: 'internal',
    provider: null,
    authPath: null,
    openLabel: null,
  },
];

export const DESTINATION_IDS = DESTINATIONS.map((d) => d.id);

export function getDestination(id) {
  return DESTINATIONS.find((d) => d.id === id) || null;
}

/**
 * Whether a call may be started with this destination, given its status row
 * from GET /api/admin/demo/status. The internal calendar is always available;
 * an external one must be connected AND have passed the live token check.
 */
export function isDestinationSelectable(status) {
  if (!status) return false;
  if (status.kind === 'internal') return true;
  return status.connected === true && status.healthy === true;
}

/** Short state shown next to a destination: the health dot's meaning. */
export function destinationState(status) {
  if (!status) return 'unknown';
  if (status.kind === 'internal') return 'ready';
  if (!status.connected) return 'not_connected';
  return status.healthy ? 'ready' : 'needs_reconnect';
}
