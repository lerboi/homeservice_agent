export const PERSONAS = [
  {
    slug: 'plumber',
    trade: 'Plumber',
    headline: 'Stop Losing Jobs to Voicemail. Let Voco Answer Every Plumbing Call.',
    subheadline: 'Built for plumbers who are under a sink when the phone rings.',
    painPoints: [
      {
        icon: 'Phone',
        title: 'Missed calls = missed revenue',
        body: 'The average emergency plumbing job is worth $650. Every call that goes to voicemail is money walking to your competitor.',
      },
      {
        icon: 'Clock',
        title: "Can't answer mid-job",
        body: "You're elbow-deep in a pipe repair. Your phone rings. By the time you clean up and call back, they've already called someone else.",
      },
      {
        icon: 'DollarSign',
        title: 'Answering services cost $300+/mo',
        body: 'And they still put callers on hold. Voco answers instantly, books the job, and costs less than a single emergency call-out.',
      },
    ],
    features: [
      {
        title: 'Instant call answering',
        description:
          'Voco picks up in under 1 second — before the second ring. Your business name, professional greeting, every time.',
        checks: ['24/7 coverage', 'Your business name', 'Professional tone'],
      },
      {
        title: 'Automatic booking',
        description:
          'Voco checks your calendar, finds the next open slot, and books the appointment while the caller is still on the line.',
        checks: ['Calendar-aware', 'Travel time buffers', 'Conflict prevention'],
      },
      {
        title: 'Emergency detection',
        description:
          'Burst pipes and gas leaks get flagged instantly. Voco books emergency calls into same-day slots and sends you a priority alert.',
        checks: ['Smart triage', 'Priority SMS alerts', 'Same-day booking'],
      },
    ],
    testimonial: {
      quote:
        "I was losing 3-4 calls a day while on jobs. First week with Voco, I booked $4,200 in work that would've gone to voicemail.",
      author: 'Mike D., Licensed Plumber — Austin, TX',
    },
    relatedSlugs: [],
  },
];
