/**
 * Landing-page FAQ. Answers must stay true of the product as deployed; when
 * something is set up by the Voco team rather than self-serve, say so.
 */
export const FAQ_ITEMS = [
  {
    q: 'What is the difference between Voco Voice and Voco Agent?',
    a: 'Voco Voice talks to your callers: it answers the phone and does what they rang about. Voco Agent talks to you: you message it on WhatsApp, Telegram, Slack or email, and it handles reviews, the inbox, the calendar, search data and routine support. Both work inside the systems you already run, and you can take either or both.',
    link: { href: '/agent', label: 'See Voco Agent' },
  },
  {
    q: 'Does Voco Agent act on its own?',
    a: 'Only as far as you allow. Some jobs it can simply do; others it prepares and waits for your OK. You choose which is which, job by job, and every answer and action is logged so you can check it.',
  },
  {
    q: 'What does Voco actually do on a call?',
    a: 'It answers, works out what the caller wants, and does that work in your systems while they are on the line: checks availability and books the appointment, creates the lead or the task, looks up the record. Then it confirms with the caller and leaves you a transcript and a recording.',
  },
  {
    q: 'Which systems can it work in?',
    a: 'Calendars, CRMs, field and practice tools, messaging, payments and accounting, and anything with a webhook or a REST API. We connect your systems with you during setup, so the answer for your stack is a conversation: book a demo and bring the list.',
  },
  {
    q: 'How do we get set up?',
    a: 'With us. You tell us what callers ask for and which systems hold the answers; we configure the agent, connect those systems, and test it with you before it takes a real call. You do not have to build anything.',
  },
  {
    q: 'Does it work on our existing phone number?',
    a: 'Yes. Calls reach Voco on a dedicated number that your existing line forwards to. You choose which calls it takes: all of them, only out of hours, or only when nobody picks up.',
  },
  {
    q: 'What happens when it cannot help?',
    a: 'It says so and hands over. You set the rules: transfer to a person, take a message and create a callback, or alert whoever is on call. It does not invent an answer or claim something is booked when it is not.',
  },
  {
    q: 'How fast does it reply?',
    a: 'On production calls the agent typically starts speaking 1 to 1.5 seconds after the caller stops. A turn that writes to your systems, such as a booking, takes a little longer.',
  },
  {
    q: 'Which languages does it speak?',
    a: 'It replies in the language the caller is speaking. English is the most thoroughly tested today; tell us which languages your callers use and we will test those with you before launch.',
  },
  {
    q: 'What does it cost?',
    a: 'Pricing depends on your call volume and the systems we connect, so we scope it with you rather than publish a table.',
    link: { href: '/pricing', label: 'How pricing works' },
  },
];

export const FAQ_CHAT_SUGGESTIONS = [
  'What can it do in my calendar?',
  'How does setup work?',
  'What happens if it cannot help a caller?',
];
