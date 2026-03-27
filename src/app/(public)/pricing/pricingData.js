export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    callLimit: 40,
    overageRate: 2.48,
    description: 'For solo operators just getting started',
    cta: 'Start Free Trial',
    ctaHref: '/onboarding',
    highlighted: false,
    inheritsFrom: null,
    features: [
      'AI call answering 24/7',
      'Smart urgency triage',
      'Books appointments on the spot',
      'Instant emergency SMS alerts',
      'Detailed dashboard & analytics',
      'Lead capture & CRM',
      'Google & Outlook Calendar sync',
      'Multi-language support (EN/ES)',
      'Recovery SMS fallback',
    ],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 249,
    callLimit: 120,
    overageRate: 2.08,
    description: 'For growing crews booking 3-5 jobs per day',
    cta: 'Start Free Trial',
    ctaHref: '/onboarding',
    highlighted: true,
    badge: 'Most Popular',
    inheritsFrom: 'Starter',
    features: [
      'Up to 120 calls/month',
      'Priority email support',
    ],
  },
  {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: 599,
    callLimit: 400,
    overageRate: 1.50,
    description: 'For multi-crew operations at full capacity',
    cta: 'Start Free Trial',
    ctaHref: '/onboarding',
    highlighted: false,
    inheritsFrom: 'Growth',
    features: [
      'Up to 400 calls/month',
      'Priority support + onboarding call',
    ],
  },
];

export const ENTERPRISE_TIER = {
  id: 'enterprise',
  name: 'Enterprise',
  monthlyPrice: null,
  callLimit: null,
  description: 'For franchises and multi-location operations',
  cta: 'Contact Us',
  ctaHref: '/contact?type=sales',
  highlighted: false,
  features: [
    'Unlimited calls',
    'Dedicated account manager',
    'Custom integrations',
    'Custom SLAs & onboarding',
  ],
};

export const COMPARISON_FEATURES = [
  { name: 'Monthly calls', starter: '40', growth: '120', scale: '400', enterprise: 'Unlimited' },
  { name: 'Annual calls', starter: '480', growth: '1,440', scale: '4,800', enterprise: 'Unlimited' },
  { name: 'Overage rate', starter: '$2.48/call', growth: '$2.08/call', scale: '$1.50/call', enterprise: 'Custom' },
  { name: 'Support level', starter: 'Email', growth: 'Priority email', scale: 'Priority + onboarding', enterprise: 'Dedicated' },
  { name: 'AI receptionist 24/7', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Lead capture & CRM', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'SMS + email notifications', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Priority triage engine', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Google Calendar sync', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Outlook Calendar sync', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Booking-first dispatcher', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Multi-language (EN/ES)', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Recovery SMS fallback', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Custom integrations', starter: false, growth: false, scale: false, enterprise: true },
];

export function getAnnualPrice(monthlyPrice) {
  if (monthlyPrice === null) return null;
  return Math.round(monthlyPrice * 0.8);
}
