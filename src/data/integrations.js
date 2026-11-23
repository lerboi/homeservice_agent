/**
 * Backends Voco can act in, for the public site (/integrations,
 * /integrations/[tool], the landing page).
 *
 * Framing (owner decision, 2026-11-23): connectors are presented as
 * available, done-for-you. "Voco connects to …" is true of the sales model:
 * a business books a demo and the Voco team sets the connection up with
 * them. The copy must not promise self-serve one-click setup.
 *
 * `actions` are the things the voice agent does in that system during or
 * right after a call.
 */
export const INTEGRATION_GROUPS = [
  { id: 'calendars', title: 'Calendars', blurb: 'Read availability, write bookings.' },
  { id: 'crm', title: 'CRM', blurb: 'Find the caller, create and update records.' },
  { id: 'field', title: 'Field and practice tools', blurb: 'Jobs, visits and clients in the tool your team works from.' },
  { id: 'messaging', title: 'Messaging', blurb: 'Confirm with the caller, alert your team.' },
  { id: 'payments', title: 'Payments and accounting', blurb: 'Look up what is owed and what was paid.' },
  { id: 'automation', title: 'Automation and your own API', blurb: 'Anything else, through a webhook or your REST API.' },
];

export const INTEGRATIONS = [
  // ── Calendars ──────────────────────────────────────────────────────────
  {
    slug: 'google-calendar',
    name: 'Google Calendar',
    group: 'calendars',
    summary: 'The agent reads your availability from Google Calendar and writes each booking back as an event.',
    actions: [
      'Check free and busy time before offering a slot',
      'Create the event when the caller confirms',
      'Title the event with who it is with and what it is for',
      'Respect time you block off in the calendar',
    ],
  },
  {
    slug: 'outlook-calendar',
    name: 'Outlook Calendar',
    group: 'calendars',
    summary: 'For teams on Microsoft 365: availability comes from Outlook and bookings land there.',
    actions: [
      'Check free and busy time before offering a slot',
      'Create the event when the caller confirms',
      'Keep the event in the business’s own timezone',
      'Respect time you block off in the calendar',
    ],
  },
  {
    slug: 'calendly',
    name: 'Calendly',
    group: 'calendars',
    summary: 'Callers who would rather talk than click a link get the same Calendly slots, booked by voice.',
    actions: [
      'Offer the open times of an event type',
      'Book the invitee with their name and contact details',
      'Trigger the confirmations you already have set up',
    ],
  },
  {
    slug: 'cal-com',
    name: 'Cal.com',
    group: 'calendars',
    summary: 'Voice booking on top of your Cal.com event types and availability rules.',
    actions: [
      'Offer the open times of an event type',
      'Create the booking for the caller',
      'Leave reschedule and cancel to your existing flows',
    ],
  },

  // ── CRM ────────────────────────────────────────────────────────────────
  {
    slug: 'hubspot',
    name: 'HubSpot',
    group: 'crm',
    summary: 'Calls become contacts, deals and tasks in HubSpot, with the transcript attached.',
    actions: [
      'Match the caller to an existing contact',
      'Create a contact and a deal for a new enquiry',
      'Log the call with its transcript and recording',
      'Create a follow-up task for the owner',
    ],
  },
  {
    slug: 'salesforce',
    name: 'Salesforce',
    group: 'crm',
    summary: 'Leads, cases and tasks created in Salesforce from what the caller said.',
    actions: [
      'Look the caller up by phone number',
      'Create a lead or a case',
      'Log the call as an activity',
      'Assign a follow-up task',
    ],
  },
  {
    slug: 'pipedrive',
    name: 'Pipedrive',
    group: 'crm',
    summary: 'New enquiries enter the right Pipedrive pipeline as a person and a deal.',
    actions: [
      'Find or create the person',
      'Open a deal in the stage you choose',
      'Add a note with the call summary',
      'Schedule the follow-up activity',
    ],
  },
  {
    slug: 'zoho-crm',
    name: 'Zoho CRM',
    group: 'crm',
    summary: 'Leads and call logs written to Zoho CRM as the conversation ends.',
    actions: [
      'Find the caller’s lead or contact',
      'Create a lead for a new enquiry',
      'Log the call and its outcome',
      'Create a task for the record’s owner',
    ],
  },

  // ── Field and practice tools ───────────────────────────────────────────
  {
    slug: 'jobber',
    name: 'Jobber',
    group: 'field',
    summary: 'The agent knows the caller’s jobs and visits in Jobber and books around your crew’s schedule.',
    actions: [
      'Recognise an existing client by phone number',
      'Read their upcoming visits and open jobs',
      'Book around visits already on the schedule',
      'Create a request for new work',
    ],
  },
  {
    slug: 'servicetitan',
    name: 'ServiceTitan',
    group: 'field',
    summary: 'Customer lookups and new bookings against your ServiceTitan account.',
    actions: [
      'Look up the customer and their locations',
      'Create a booking for the dispatch board',
      'Add the call notes to the customer record',
    ],
  },
  {
    slug: 'housecall-pro',
    name: 'Housecall Pro',
    group: 'field',
    summary: 'Customers and jobs in Housecall Pro, created and updated from the call.',
    actions: [
      'Find or create the customer',
      'Schedule a job or an estimate visit',
      'Attach the call summary to the job',
    ],
  },

  // ── Messaging ──────────────────────────────────────────────────────────
  {
    slug: 'sms',
    name: 'SMS',
    group: 'messaging',
    summary: 'Text messages to the caller and to your team, sent from your business number.',
    actions: [
      'Confirm a booking to the caller',
      'Send a link the caller asked for',
      'Alert the owner about a call that needs them',
    ],
  },
  {
    slug: 'whatsapp',
    name: 'WhatsApp',
    group: 'messaging',
    summary: 'Confirmations and follow-ups on WhatsApp for customers who prefer it.',
    actions: [
      'Send the booking confirmation',
      'Follow up with the details discussed on the call',
      'Notify a team group',
    ],
  },
  {
    slug: 'email',
    name: 'Email',
    group: 'messaging',
    summary: 'A written record of the call to the people who need it.',
    actions: [
      'Email the call summary and transcript to your team',
      'Send the caller a confirmation',
      'Escalate an urgent call to an on-call address',
    ],
  },
  {
    slug: 'slack',
    name: 'Slack',
    group: 'messaging',
    summary: 'Calls that need attention posted to the Slack channel your team already watches.',
    actions: [
      'Post new leads and bookings to a channel',
      'Mention the person on call for urgent requests',
      'Link to the transcript and recording',
    ],
  },

  // ── Payments and accounting ────────────────────────────────────────────
  {
    slug: 'stripe',
    name: 'Stripe',
    group: 'payments',
    summary: 'The agent can answer payment questions from Stripe and send the caller a link to pay.',
    actions: [
      'Look up a customer’s recent payments',
      'Tell the caller whether an invoice is paid',
      'Send a payment link by text or email',
    ],
  },
  {
    slug: 'xero',
    name: 'Xero',
    group: 'payments',
    summary: 'Invoice and balance questions answered from Xero.',
    actions: [
      'Recognise the caller as a Xero contact',
      'Read outstanding invoices and balances',
      'Note the call against the contact',
    ],
  },
  {
    slug: 'quickbooks',
    name: 'QuickBooks',
    group: 'payments',
    summary: 'Customer balances and invoice status read from QuickBooks during the call.',
    actions: [
      'Find the customer by phone number',
      'Read open invoices and their due dates',
      'Pass payment questions to your accounts team with context',
    ],
  },

  // ── Automation and custom ──────────────────────────────────────────────
  {
    slug: 'zapier',
    name: 'Zapier',
    group: 'automation',
    summary: 'Hand any call outcome to a Zap and reach the thousands of apps behind it.',
    actions: [
      'Trigger a Zap when a call ends',
      'Pass the caller, the outcome and the transcript',
      'Start different Zaps for different outcomes',
    ],
  },
  {
    slug: 'make',
    name: 'Make',
    group: 'automation',
    summary: 'Call outcomes as the first step of a Make scenario.',
    actions: [
      'Start a scenario when a call ends',
      'Send structured data: who called, what they wanted, what was done',
      'Branch on the outcome',
    ],
  },
  {
    slug: 'webhooks',
    name: 'Webhooks',
    group: 'automation',
    summary: 'A signed HTTP request to your endpoint for the events you care about.',
    actions: [
      'Post when a call starts, ends or books',
      'Include the transcript and the structured outcome',
      'Retry on failure',
    ],
  },
  {
    slug: 'rest-api',
    name: 'Your own API',
    group: 'automation',
    summary: 'If your system has an API, the agent can call it: read a record mid-call, write one when the caller confirms.',
    actions: [
      'Look up an order, an account or a booking',
      'Create or update a record in your system',
      'Use only the endpoints and scopes you grant',
    ],
  },
];

export function getIntegration(slug) {
  return INTEGRATIONS.find((i) => i.slug === slug) || null;
}

export function integrationsByGroup() {
  return INTEGRATION_GROUPS.map((group) => ({
    ...group,
    items: INTEGRATIONS.filter((i) => i.group === group.id),
  }));
}
