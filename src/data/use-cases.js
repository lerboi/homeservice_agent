/**
 * Use cases for the public site, keyed on the task the caller wants done
 * (not on an industry). Rendered by /use-cases, /use-cases/[slug] and the
 * landing page grid.
 *
 * Copy rule: describe what the agent does in the business's own systems, in
 * a done-for-you framing (Voco connects the systems during setup). Do not
 * promise self-serve setup or name numbers that cannot be measured.
 *
 * `log` is the action log shown beside the example call: what happens in the
 * backend while the conversation runs.
 */
export const USE_CASES = [
  {
    slug: 'appointment-booking',
    icon: 'CalendarCheck',
    title: 'Appointment booking',
    short: 'The caller picks a time. The event is in your calendar before they hang up.',
    headline: 'Callers book themselves in, by talking.',
    summary:
      'Voco checks your real availability, offers times, reads the booking back, and writes the appointment to your calendar while the caller is still on the line.',
    call: [
      { who: 'caller', text: 'Hi, can I book a consultation for Thursday afternoon?' },
      { who: 'agent', text: 'I have two thirty or four o’clock on Thursday. Which works better?' },
      { who: 'caller', text: 'Four. It’s Alex Tan.' },
      { who: 'agent', text: 'So that’s Alex Tan, Thursday at four. Shall I book it?' },
      { who: 'caller', text: 'Yes please.' },
      { who: 'agent', text: 'You’re booked for Thursday at four.' },
    ],
    log: [
      { verb: 'check', text: 'Availability · Thu afternoon · 2 open' },
      { verb: 'create', text: 'Appointment · Thu 4:00 PM · Alex Tan' },
      { verb: 'write', text: 'Google Calendar · event created' },
      { verb: 'send', text: 'Confirmation · text message' },
    ],
    steps: [
      { title: 'Reads your availability', body: 'Working hours, existing bookings and anything already blocked in the connected calendar.' },
      { title: 'Offers real times', body: 'Only times a tool has confirmed are offered. The agent never guesses a free slot.' },
      { title: 'Confirms, then books', body: 'It reads the name and time back and waits for a yes. The booking is atomic, so two callers cannot take the same slot.' },
      { title: 'Writes it where you look', body: 'The event lands in your calendar with who it is with and what it is for.' },
    ],
    integrations: ['google-calendar', 'outlook-calendar', 'calendly', 'cal-com', 'sms'],
  },
  {
    slug: 'lead-intake',
    icon: 'UserPlus',
    title: 'Lead intake',
    short: 'Name, need and contact details captured and filed in your CRM.',
    headline: 'Every enquiry becomes a record, not a voicemail.',
    summary:
      'When the caller is not ready to book, Voco takes their details and what they need, then creates the lead in your CRM with the conversation attached.',
    call: [
      { who: 'caller', text: 'I’m looking for a quote for an office fit-out.' },
      { who: 'agent', text: 'Happy to pass that on. Who am I speaking with?' },
      { who: 'caller', text: 'Priya Nair, from Northwind.' },
      { who: 'agent', text: 'Thanks, Priya. What’s the best number for the team to reach you on?' },
      { who: 'caller', text: 'This one is fine.' },
      { who: 'agent', text: 'Done. Someone will call you back on this number.' },
    ],
    log: [
      { verb: 'match', text: 'Caller · no existing contact' },
      { verb: 'create', text: 'Contact · Priya Nair · Northwind' },
      { verb: 'create', text: 'Lead · Office fit-out quote' },
      { verb: 'notify', text: 'Sales channel · new lead' },
    ],
    steps: [
      { title: 'Asks what you would ask', body: 'The questions are yours: what they need, how soon, how to reach them.' },
      { title: 'Checks for an existing record', body: 'A returning caller is matched to their contact instead of being created twice.' },
      { title: 'Files the lead', body: 'A new record in your CRM with the details, the transcript and the recording.' },
      { title: 'Tells your team', body: 'A message to the people who follow up, on the channel they already watch.' },
    ],
    integrations: ['hubspot', 'salesforce', 'pipedrive', 'zoho-crm', 'slack', 'email'],
  },
  {
    slug: 'task-and-callback-scheduling',
    icon: 'ListChecks',
    title: 'Tasks and callbacks',
    short: 'A follow-up is created, assigned and due, with the context attached.',
    headline: 'Promised callbacks that actually get scheduled.',
    summary:
      'When a call needs a person later, Voco creates the task or callback in your system with what was asked, who asked and when it is due.',
    call: [
      { who: 'caller', text: 'Can someone from accounts call me about my invoice?' },
      { who: 'agent', text: 'Of course. Is tomorrow morning all right?' },
      { who: 'caller', text: 'Before eleven, please.' },
      { who: 'agent', text: 'I’ve asked accounts to call you tomorrow before eleven.' },
    ],
    log: [
      { verb: 'match', text: 'Caller · existing account' },
      { verb: 'create', text: 'Task · Callback re: invoice' },
      { verb: 'assign', text: 'Team · Accounts · due tomorrow 11:00' },
      { verb: 'notify', text: 'Assignee · task link' },
    ],
    steps: [
      { title: 'Understands the ask', body: 'What the caller wants, and who in your business handles it.' },
      { title: 'Agrees a time', body: 'Within the hours you have set for callbacks.' },
      { title: 'Creates the task', body: 'In the tool your team works from, with the call attached.' },
      { title: 'Hands off cleanly', body: 'Nobody has to listen to a voicemail to learn what was promised.' },
    ],
    integrations: ['hubspot', 'salesforce', 'jobber', 'slack', 'webhooks', 'zapier'],
  },
  {
    slug: 'order-and-account-lookup',
    icon: 'Search',
    title: 'Order and account lookup',
    short: 'The caller asks where things stand. The agent reads it from your system.',
    headline: 'Answers from your data, not from a script.',
    summary:
      'Voco looks the caller up in your system and tells them what they called to find out: the status of an order, the next visit, the balance on an account.',
    call: [
      { who: 'caller', text: 'Hi, I’m calling to check on my order.' },
      { who: 'agent', text: 'I can see one order on this number, placed on Monday. It ships tomorrow.' },
      { who: 'caller', text: 'Great. Can you text me the tracking link?' },
      { who: 'agent', text: 'Sent. Anything else?' },
    ],
    log: [
      { verb: 'match', text: 'Caller ID · customer found' },
      { verb: 'read', text: 'Orders · 1 open · ships tomorrow' },
      { verb: 'send', text: 'Text message · tracking link' },
      { verb: 'log', text: 'Customer record · call noted' },
    ],
    steps: [
      { title: 'Recognises the caller', body: 'By the number they call from, or by the details you choose to ask for.' },
      { title: 'Reads the record', body: 'Through your API or the system’s own, with access limited to what the agent needs.' },
      { title: 'Says only what it finds', body: 'If the record is not there, it says so and offers a person.' },
      { title: 'Leaves a trace', body: 'The call is noted on the customer’s record.' },
    ],
    integrations: ['rest-api', 'webhooks', 'stripe', 'xero', 'quickbooks', 'jobber'],
  },
  {
    slug: 'after-hours-coverage',
    icon: 'Moon',
    title: 'After-hours coverage',
    short: 'Nights, weekends and overflow answered the same way as office hours.',
    headline: 'The line is answered when the office is closed.',
    summary:
      'Outside your hours, or when every line is busy, Voco answers, does what it can in your systems, and escalates what cannot wait by the rules you set.',
    call: [
      { who: 'caller', text: 'Sorry to call so late. I need to move tomorrow’s appointment.' },
      { who: 'agent', text: 'No problem. I can do Wednesday at ten or Thursday at two.' },
      { who: 'caller', text: 'Wednesday at ten.' },
      { who: 'agent', text: 'Moved to Wednesday at ten. You’ll get a confirmation by text.' },
    ],
    log: [
      { verb: 'read', text: 'Appointment · Tue 9:00 AM' },
      { verb: 'check', text: 'Availability · Wed, Thu' },
      { verb: 'update', text: 'Appointment · Wed 10:00 AM' },
      { verb: 'send', text: 'Confirmation · text message' },
    ],
    steps: [
      { title: 'Answers every call', body: 'Out of hours, at lunch, or when the team is already on the phone.' },
      { title: 'Does the routine work', body: 'Bookings, changes and questions are handled in your systems on the spot.' },
      { title: 'Escalates by your rules', body: 'You decide what counts as urgent and who is called, texted or emailed.' },
      { title: 'Reports in the morning', body: 'Transcripts and recordings for every call, ready when you are.' },
    ],
    integrations: ['google-calendar', 'outlook-calendar', 'sms', 'email', 'slack', 'whatsapp'],
  },
];

/** Capabilities shown in the landing grid that have no page of their own. */
export const EXTRA_CAPABILITIES = [
  { icon: 'MessagesSquare', title: 'Answer questions', short: 'Hours, services, policies: answered from the information you give it.' },
  { icon: 'PhoneForwarded', title: 'Hand off to a person', short: 'Transfers the call when the caller asks or your rules say so.' },
  { icon: 'MessageSquareText', title: 'Send confirmations', short: 'A text or email to the caller once the work is done.' },
];

export function getUseCase(slug) {
  return USE_CASES.find((u) => u.slug === slug) || null;
}
