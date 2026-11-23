/**
 * Voco Agent: the copy and examples behind /agent and the agent half of the
 * home page. Written for an owner who is not technical: jobs and outcomes,
 * not connectors. Every conversation here is an illustration, not a record
 * of a customer.
 */

/** Where the owner talks to the agent. */
export const AGENT_CHANNELS = [
  { id: 'whatsapp', name: 'WhatsApp', line: 'Message it between jobs, from the phone you already carry.' },
  { id: 'telegram', name: 'Telegram', line: 'A private chat with your business, with files and voice notes.' },
  { id: 'slack', name: 'Slack', line: 'In the channel your team already works in, so everyone sees the answer.' },
  { id: 'email', name: 'Email', line: 'Write to it like a colleague, or just read the summary it sends.' },
];

/**
 * The scripted conversations the chat illustration plays, one per channel.
 * Shape per conversation: ask → sources it reads → answer → instruction → what it did.
 */
export const AGENT_CONVERSATIONS = [
  {
    channel: 'whatsapp',
    ask: 'What are customers unhappy about this month?',
    sources: ['Google reviews', 'Support inbox', 'Feedback form'],
    answer: 'Three things keep coming up:',
    points: ['Slow replies at weekends', 'Parking is hard to find', 'Invoices arrive late'],
    instruction: 'Reply to those reviews, and add parking directions to the booking email.',
    done: ['Replied to 6 reviews', 'Booking email updated'],
  },
  {
    channel: 'slack',
    ask: 'Why were bookings down last week?',
    sources: ['Google Search', 'Website visits', 'Calendar'],
    answer: 'Your booking page slipped off the first page of Google for two searches on Tuesday. Fewer people found you; the ones who did booked as usual.',
    points: [],
    instruction: 'Fix what you can.',
    done: ['Page title and description rewritten', 'Sent you a 3-step plan for the rest'],
  },
  {
    channel: 'telegram',
    ask: 'I’m out Thursday. Move my meetings to Friday and let everyone know.',
    sources: ['Calendar', 'Email'],
    answer: 'Four meetings on Thursday. Three fit on Friday. Dana can only do Monday at 10.',
    points: [],
    instruction: 'Monday’s fine.',
    done: ['4 meetings moved', '4 people told by email'],
  },
  {
    channel: 'email',
    ask: 'What needs me today?',
    sources: ['Inbox', 'Support desk', 'Calendar'],
    answer: 'Five emails need you. The rest are handled or can wait. Two are urgent:',
    points: ['A supplier wants an answer by noon', 'A customer is asking for a refund'],
    instruction: 'Draft both replies for me.',
    done: ['2 replies waiting for your OK', 'Refund logged in the support desk'],
  },
];

/** The problem each job removes, in the owner's words, and what the agent does about it. */
export const AGENT_RELIEFS = [
  {
    pain: 'Reviews pile up and nobody has time to answer them.',
    relief: 'It reads every one, tells you what people keep saying, and replies in your voice.',
  },
  {
    pain: 'You pay for a website and have no idea if it brings in work.',
    relief: 'It tells you in plain words which searches bring customers, which pages lose them, and fixes what it can.',
  },
  {
    pain: 'The inbox runs your morning.',
    relief: 'It sorts what needs you from what does not, drafts the replies, and files the rest.',
  },
  {
    pain: 'One change to the diary means ten messages.',
    relief: 'Tell it once. It moves the meetings and lets everyone know.',
  },
  {
    pain: 'The same customer questions come in every day.',
    relief: 'It answers the routine ones from your own records and passes you the ones that need a person.',
  },
];

/** Jobs it does. `icon` must exist in src/components/marketing/icons.js. */
export const AGENT_JOBS = [
  {
    id: 'feedback',
    icon: 'Star',
    title: 'Customer feedback',
    body: 'Reads reviews, survey answers and complaints, groups what people keep saying, and replies to them.',
    say: 'What did customers say this week?',
    size: 'wide',
  },
  {
    id: 'search',
    icon: 'TrendingUp',
    title: 'Being found on Google',
    body: 'Watches where you appear in search and what people looked for, and explains changes without jargon.',
    say: 'Are we showing up for “near me” searches?',
  },
  {
    id: 'inbox',
    icon: 'Inbox',
    title: 'Email',
    body: 'Sorts the inbox, drafts replies, chases the ones that went quiet.',
    say: 'Who is still waiting on a reply from us?',
  },
  {
    id: 'calendar',
    icon: 'CalendarCheck',
    title: 'Calendar',
    body: 'Books, moves and cancels, and tells the people affected.',
    say: 'Clear my Friday afternoon.',
  },
  {
    id: 'support',
    icon: 'LifeBuoy',
    title: 'Customer support',
    body: 'Answers routine questions from your records, opens and updates tickets, hands you the hard ones.',
    say: 'Any support requests open for more than two days?',
  },
  {
    id: 'reports',
    icon: 'ClipboardList',
    title: 'The weekly picture',
    body: 'One message on Monday: what happened, what changed, and what it suggests you do about it.',
    say: 'Send me the summary every Monday at eight.',
    size: 'wide',
  },
];

/** An example of a week's log. Illustration only. */
export const AGENT_WEEK = [
  { day: 'Mon', time: '08:00', text: 'Sent the weekly summary', kind: 'report' },
  { day: 'Mon', time: '09:12', text: 'Replied to the weekend’s reviews', kind: 'act' },
  { day: 'Tue', time: '11:40', text: 'Flagged a drop in search visits and rewrote the booking page title', kind: 'act' },
  { day: 'Wed', time: '08:05', text: 'Sorted the inbox: 5 for you, 2 drafts ready', kind: 'report' },
  { day: 'Thu', time: '14:30', text: 'Moved four meetings to Friday and told everyone', kind: 'act' },
  { day: 'Fri', time: '16:00', text: 'Closed three routine support requests, passed one to you', kind: 'act' },
];

/** How much it may do on its own is the owner's choice. */
export const AGENT_CONTROLS = [
  {
    title: 'You decide what it does alone',
    body: 'Some jobs it can just do. Others it prepares and waits for your OK. You set which is which, job by job.',
  },
  {
    title: 'Everything is written down',
    body: 'Each answer shows where it came from, and each action is logged, so you can check what was done and why.',
  },
  {
    title: 'It only reaches what you connect',
    body: 'It works in the accounts you agree to and nowhere else. Remove a connection and it loses that access.',
  },
];

export const AGENT_STEPS = [
  { n: '01', title: 'Tell us how the business runs', body: 'What takes your time, which tools you use, what you wish someone would just handle.' },
  { n: '02', title: 'We connect it for you', body: 'Voco links the agent to those accounts, sets its rules with you, and tests it on real questions.' },
  { n: '03', title: 'Message it', body: 'From WhatsApp, Telegram, Slack or email. Ask, or tell it what to do.' },
];
