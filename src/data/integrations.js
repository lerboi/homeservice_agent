export const INTEGRATIONS = [
  {
    slug: 'google-calendar',
    toolName: 'Google Calendar',
    description:
      'Voco syncs bidirectionally with Google Calendar so your AI receptionist always knows your real availability. When a caller requests an appointment, Voco checks your calendar in real time, finds the next open slot with travel time buffers, and books it — all while the caller is on the line.',
    useCases: [
      {
        icon: 'Calendar',
        title: 'Auto-sync appointments',
        body: 'Every booking Voco makes appears in your Google Calendar within seconds. No double-entry, no missed appointments.',
      },
      {
        icon: 'Clock',
        title: 'Real-time availability',
        body: 'Block time in Google Calendar and Voco instantly knows. Personal appointments, lunch breaks, days off — all respected automatically.',
      },
      {
        icon: 'Bell',
        title: 'Conflict prevention',
        body: 'Voco never double-books. If a slot is taken in Google Calendar, it offers the next available time with built-in travel buffers between jobs.',
      },
      {
        icon: 'RefreshCw',
        title: 'Bidirectional sync',
        body: 'Changes flow both ways. Edit an appointment in Google Calendar and Voco updates. Reschedule in Voco and Google Calendar reflects it.',
      },
    ],
    ctaHeading: 'Connect Google Calendar to Voco in 5 minutes',
    relatedSlugs: [],
  },
];
