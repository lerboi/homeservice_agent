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
    relatedSlugs: ['outlook-calendar', 'stripe', 'twilio'],
  },
  {
    slug: 'outlook-calendar',
    toolName: 'Outlook Calendar',
    description:
      'Voco integrates directly with Microsoft Outlook Calendar, giving your AI receptionist real-time access to your schedule. When a caller requests an appointment, Voco checks your Outlook Calendar for availability, finds the next open slot with travel time buffers between jobs, and books the appointment — all while the caller is still on the phone. If you use Microsoft 365 for your business, Voco works seamlessly with your existing calendar.',
    useCases: [
      {
        icon: 'Calendar',
        title: 'Sync with Microsoft 365',
        body: 'Already using Outlook for your business schedule? Voco reads and writes directly to your Outlook Calendar. No new tools to learn, no extra apps to manage.',
      },
      {
        icon: 'Clock',
        title: 'Real-time availability checks',
        body: 'Block time in Outlook for personal appointments, lunch, or days off. Voco sees the block instantly and never offers that slot to a caller.',
      },
      {
        icon: 'Bell',
        title: 'Instant booking confirmations',
        body: 'When Voco books a new appointment, it appears in your Outlook Calendar immediately. You get a standard Outlook notification alongside your Voco SMS alert.',
      },
      {
        icon: 'RefreshCw',
        title: 'Two-way sync',
        body: 'Move an appointment in Outlook and Voco updates. Reschedule in Voco and Outlook reflects it. Both systems always show the same schedule.',
      },
    ],
    ctaHeading: 'Connect Outlook Calendar to Voco in 5 minutes',
    relatedSlugs: ['google-calendar', 'stripe', 'twilio'],
  },
  {
    slug: 'stripe',
    toolName: 'Stripe',
    description:
      'Voco uses Stripe to handle all subscription billing securely. Your monthly plan, usage tracking, and payment history are managed through Stripe — the same payment platform trusted by millions of businesses worldwide. You never share credit card details directly with Voco. Stripe handles PCI compliance, payment processing, and receipt generation automatically.',
    useCases: [
      {
        icon: 'Bell',
        title: 'Automated billing notifications',
        body: 'Receive email receipts for every payment. Get notified before subscription renewals. Never wonder what you are being charged or when.',
      },
      {
        icon: 'Clock',
        title: 'Usage-based tracking',
        body: 'Your call usage is tracked against your plan limits in real time. Approach your limit and Voco notifies you — no surprise charges.',
      },
      {
        icon: 'Calendar',
        title: 'Self-service billing management',
        body: 'Update your payment method, switch plans, or view invoice history through the Stripe Customer Portal. No emails to support, no waiting on hold.',
      },
      {
        icon: 'RefreshCw',
        title: 'Seamless plan upgrades',
        body: 'Outgrowing your plan? Upgrade instantly from your Voco dashboard. Stripe prorates the charge and your new call limits take effect immediately.',
      },
    ],
    ctaHeading: 'Start your free trial — billing powered by Stripe',
    relatedSlugs: ['google-calendar', 'outlook-calendar', 'twilio'],
  },
  {
    slug: 'twilio',
    toolName: 'Twilio',
    description:
      'Voco is built on Twilio, the world leader in cloud communications. Your Voco phone number is a real US or Canadian phone number provisioned through Twilio, which means carrier-grade call quality, 99.95% uptime, and support for call forwarding from your existing business number. Twilio handles the telephony infrastructure so your AI receptionist can focus on answering calls and booking jobs.',
    useCases: [
      {
        icon: 'Bell',
        title: 'Carrier-grade reliability',
        body: 'Twilio powers communications for companies like Uber, Airbnb, and Lyft. Your Voco calls ride the same infrastructure — 99.95% uptime, crystal-clear audio.',
      },
      {
        icon: 'Clock',
        title: 'Instant number provisioning',
        body: 'During signup, Voco provisions a real local phone number for your business through Twilio. You can use it as your primary number or forward your existing number to it.',
      },
      {
        icon: 'Calendar',
        title: 'SMS notifications',
        body: 'Voco uses Twilio to send you SMS alerts when calls come in, appointments are booked, or emergencies are detected. Real text messages to your phone, not app notifications.',
      },
      {
        icon: 'RefreshCw',
        title: 'Call forwarding support',
        body: 'Keep your existing business number. Set up call forwarding from your carrier to your Voco number and every inbound call is answered by your AI receptionist.',
      },
    ],
    ctaHeading: 'Get your Voco number — powered by Twilio',
    relatedSlugs: ['google-calendar', 'outlook-calendar', 'stripe'],
  },
];
