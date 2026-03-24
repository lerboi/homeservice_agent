export const PRICING_TIERS = [
  {
    id: 'starter',
    name: 'Starter',
    monthlyPrice: 99,
    callLimit: 40,
    description: 'For solo operators just getting started',
    cta: 'Get Started',
    ctaHref: '/onboarding',
    highlighted: false,
    features: ['AI receptionist 24/7', 'Up to 40 calls/mo', 'Lead capture & CRM', 'SMS notifications', 'Email alerts'],
  },
  {
    id: 'growth',
    name: 'Growth',
    monthlyPrice: 249,
    callLimit: 120,
    description: 'For growing crews booking 3-5 jobs per day',
    cta: 'Get Started',
    ctaHref: '/onboarding',
    highlighted: true,
    badge: 'Most Popular',
    features: ['Everything in Starter', 'Up to 120 calls/mo', 'Priority triage engine', 'Calendar sync (Google)', 'Custom AI persona'],
  },
  {
    id: 'scale',
    name: 'Scale',
    monthlyPrice: 599,
    callLimit: 400,
    description: 'For multi-crew operations running at full capacity',
    cta: 'Get Started',
    ctaHref: '/onboarding',
    highlighted: false,
    features: ['Everything in Growth', 'Up to 400 calls/mo', 'Multi-calendar sync', 'Advanced analytics', 'Dedicated onboarding'],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: null,
    callLimit: null,
    description: 'For franchises and multi-location operations',
    cta: 'Contact Us',
    ctaHref: '/contact',
    highlighted: false,
    features: ['Everything in Scale', 'Unlimited calls', 'Custom integrations', 'SLA guarantee', 'Dedicated account manager'],
  },
];

export const COMPARISON_FEATURES = [
  { name: 'Monthly calls', starter: '40', growth: '120', scale: '400', enterprise: 'Unlimited' },
  { name: 'AI receptionist', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Lead capture & CRM', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'SMS notifications', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Email alerts', starter: true, growth: true, scale: true, enterprise: true },
  { name: 'Priority triage engine', starter: false, growth: true, scale: true, enterprise: true },
  { name: 'Calendar sync (Google)', starter: false, growth: true, scale: true, enterprise: true },
  { name: 'Custom AI persona', starter: false, growth: true, scale: true, enterprise: true },
  { name: 'Multi-calendar sync', starter: false, growth: false, scale: true, enterprise: true },
  { name: 'Advanced analytics', starter: false, growth: false, scale: true, enterprise: true },
  { name: 'Dedicated onboarding', starter: false, growth: false, scale: true, enterprise: true },
  { name: 'Custom integrations', starter: false, growth: false, scale: false, enterprise: true },
  { name: 'SLA guarantee', starter: false, growth: false, scale: false, enterprise: true },
  { name: 'Dedicated account manager', starter: false, growth: false, scale: false, enterprise: true },
];

export function getAnnualPrice(monthlyPrice) {
  if (monthlyPrice === null) return null;
  return Math.round(monthlyPrice * 0.8);
}
