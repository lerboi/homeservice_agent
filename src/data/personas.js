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
    relatedSlugs: ['hvac-technician', 'electrician', 'handyman'],
  },
  {
    slug: 'hvac-technician',
    trade: 'HVAC Technician',
    headline: 'Never Miss a Cooling Emergency Again. Voco Answers Every HVAC Call.',
    subheadline: 'Built for HVAC techs who are on a rooftop when the phone rings.',
    painPoints: [
      {
        icon: 'Phone',
        title: 'Peak season overwhelms your phone',
        body: 'The first 95-degree day can triple your call volume overnight. No office staff can scale that fast. Every unanswered call walks to your competitor.',
      },
      {
        icon: 'Clock',
        title: 'Emergencies cannot wait for callbacks',
        body: 'A family with no AC in July or no heat in January is calling three companies at once. The first one to answer gets the $450 service call.',
      },
      {
        icon: 'DollarSign',
        title: 'Seasonal revenue slips through the cracks',
        body: 'HVAC companies lose $300K+ in peak season revenue from missed calls alone. That is more than enough to fund another truck and technician.',
      },
    ],
    features: [
      {
        title: 'Weather-proof call handling',
        description:
          'When call volume spikes with the temperature, Voco answers every call instantly. No hold times, no overwhelmed front desk, no lost leads.',
        checks: ['Unlimited concurrent calls', 'Zero hold time', 'Instant pickup'],
      },
      {
        title: 'Emergency heat and cooling triage',
        description:
          'Voco detects emergency language — "no AC," "furnace out," "gas smell" — and books callers into same-day slots with priority alerts to you.',
        checks: ['Smart urgency detection', 'Same-day booking', 'Priority SMS alerts'],
      },
      {
        title: 'Maintenance contract scheduling',
        description:
          'Routine tune-ups and annual maintenance calls are booked automatically. Voco checks your calendar and confirms the appointment while the customer is on the line.',
        checks: ['Calendar-aware', 'Travel time buffers', 'Seasonal scheduling'],
      },
    ],
    testimonial: {
      quote:
        'Last July we were missing 15 calls a day during the heat wave. Voco picked up every single one. We booked $12,000 in extra work that first week alone.',
      author: 'Sarah K., HVAC Business Owner — Phoenix, AZ',
    },
    relatedSlugs: ['plumber', 'electrician', 'handyman'],
  },
  {
    slug: 'electrician',
    trade: 'Electrician',
    headline: 'Book More Electrical Jobs Without Touching Your Phone.',
    subheadline: 'Built for electricians who cannot answer calls with their hands in a panel.',
    painPoints: [
      {
        icon: 'Phone',
        title: 'Safety-critical work blocks every call',
        body: 'Working in a live panel is not the time to answer the phone. But the homeowner calling about a $3,000 panel upgrade will not wait for your callback.',
      },
      {
        icon: 'Clock',
        title: 'High-value leads vanish in minutes',
        body: 'Property managers and general contractors call three electricians and book the first to confirm. Your 30-minute callback delay costs you the job.',
      },
      {
        icon: 'DollarSign',
        title: 'EV charger demand is booming',
        body: 'EV charger installs are $1,200-$2,500 jobs from first-time buyers who have no go-to electrician. They book whoever answers first.',
      },
    ],
    features: [
      {
        title: 'Instant professional answering',
        description:
          'Voco picks up in under one second with your business name. Panel upgrades, outlet installs, wiring repairs, EV chargers — every call type handled.',
        checks: ['24/7 coverage', 'Trade-specific vocabulary', 'All service types'],
      },
      {
        title: 'Electrical emergency detection',
        description:
          'Sparking outlets, burning smells, power outages — Voco identifies electrical emergencies and books same-day appointments with priority alerts.',
        checks: ['Smart triage', 'Priority notifications', 'Same-day slots'],
      },
      {
        title: 'Automatic calendar booking',
        description:
          'Voco checks your real availability, accounts for travel time, and confirms the appointment with the caller. You surface from the job to a full calendar.',
        checks: ['Google and Outlook sync', 'Travel buffers', 'No double-booking'],
      },
    ],
    testimonial: {
      quote:
        'I was losing commercial leads because I could not answer during jobs. First month with Voco, I landed two tenant buildout contracts worth $28,000.',
      author: 'James R., Master Electrician — Dallas, TX',
    },
    relatedSlugs: ['plumber', 'hvac-technician', 'handyman'],
  },
  {
    slug: 'handyman',
    trade: 'Handyman',
    headline: 'Turn Every Missed Call Into a Booked Handyman Job.',
    subheadline: 'Built for handymen juggling 5 different job types a day.',
    painPoints: [
      {
        icon: 'Phone',
        title: 'Solo operators cannot answer mid-job',
        body: 'You are on a ladder, under a deck, or knee-deep in a bathroom remodel. Your phone rings. By the time you call back, they have hired someone from Nextdoor.',
      },
      {
        icon: 'Clock',
        title: 'Small jobs add up fast — if you book them',
        body: 'A $150 faucet install plus a $200 door repair plus a $175 drywall patch is $525 in a day. But only if you answer the calls that bring them in.',
      },
      {
        icon: 'DollarSign',
        title: 'No budget for a receptionist',
        body: 'Answering services charge $300-800/month. For a solo handyman doing $4K-6K in monthly revenue, that is a huge overhead. Voco costs less than one missed job.',
      },
    ],
    features: [
      {
        title: 'Handles every job type',
        description:
          'Drywall, plumbing, electrical, carpentry, painting, assembly — Voco understands the full range of handyman services and categorizes each call correctly.',
        checks: ['Multi-trade vocabulary', 'Job categorization', 'Custom service list'],
      },
      {
        title: 'Fills your calendar automatically',
        description:
          'Voco checks your availability and books the next open slot. Small jobs get stacked efficiently. Bigger projects get the time they need. No double-booking.',
        checks: ['Smart scheduling', 'Travel time buffers', 'Calendar sync'],
      },
      {
        title: 'Professional image on every call',
        description:
          'Callers hear your business name and a professional greeting instantly. You sound like a company, not a solo operator juggling a phone between jobs.',
        checks: ['Your business name', 'Instant pickup', '24/7 availability'],
      },
    ],
    testimonial: {
      quote:
        'I went from 3-4 jobs a week to 8-10 just by not missing calls anymore. Voco paid for itself on day one.',
      author: 'Carlos M., Licensed Handyman — Denver, CO',
    },
    relatedSlugs: ['plumber', 'hvac-technician', 'electrician'],
  },
];
