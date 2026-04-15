import { AnimatedSection } from './AnimatedSection';

const LIVE_INTEGRATIONS = [
  { name: 'Google Calendar', slug: 'google-calendar' },
  { name: 'Outlook', slug: 'outlook' },
];

const COMING_SOON_INTEGRATIONS = [
  { name: 'Jobber', slug: 'jobber' },
  { name: 'Housecall Pro', slug: 'housecall-pro' },
  { name: 'ServiceTitan', slug: 'servicetitan' },
  { name: 'Zapier', slug: 'zapier' },
];

export function IntegrationsStrip() {
  return (
    <section className="bg-[#FAFAF9] py-24 md:py-32 px-6">
      <AnimatedSection>
        <div className="relative z-[1] max-w-6xl mx-auto">
          <div className="max-w-2xl">
            <div className="text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase mb-4">Your stack, not ours</div>
            <h2 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-[1.1] tracking-tight">
              Plays nice with<br />what you already run.
            </h2>
            <p className="mt-5 text-[17px] text-[#475569] leading-relaxed max-w-lg">
              Voco syncs your calendar today. Your CRM is next — no rip-and-replace, no migration weekend.
            </p>
          </div>

          <div className="mt-16 md:mt-20">
            <div className="flex items-baseline gap-3 mb-8">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#166534] tracking-[0.18em] uppercase">
                <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
                Live now
              </span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>
            <div className="flex flex-wrap items-center gap-x-12 md:gap-x-16 gap-y-8">
              {LIVE_INTEGRATIONS.map((int) => (
                <IntegrationMark key={int.slug} name={int.name} slug={int.slug} live />
              ))}
            </div>
          </div>

          <div className="mt-16 md:mt-20">
            <div className="flex items-baseline gap-3 mb-8">
              <span className="text-[11px] font-semibold text-[#94A3B8] tracking-[0.18em] uppercase">Coming soon</span>
              <span className="h-px flex-1 bg-stone-200" />
            </div>
            <div className="flex flex-wrap items-center gap-x-12 md:gap-x-16 gap-y-8">
              {COMING_SOON_INTEGRATIONS.map((int) => (
                <IntegrationMark key={int.slug} name={int.name} slug={int.slug} live={false} />
              ))}
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

function IntegrationMark({ name, slug, live }) {
  return (
    <div className="flex items-center gap-3">
      <div className={live ? 'flex items-center justify-center' : 'flex items-center justify-center grayscale opacity-50'} aria-hidden="true">
        <IntegrationLogo slug={slug} />
      </div>
      <span className={live ? 'text-[17px] font-semibold text-[#0F172A]' : 'text-[17px] font-semibold text-[#94A3B8]'}>
        {name}
      </span>
    </div>
  );
}

function IntegrationLogo({ slug }) {
  switch (slug) {
    case 'google-calendar':
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden="true">
          <rect x="8" y="8" width="32" height="32" rx="4" fill="#FFFFFF" stroke="#DADCE0" />
          <path d="M8 8h32v6H8z" fill="#4285F4" />
          <text x="24" y="31" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="700" fill="#4285F4">31</text>
          <circle cx="16" cy="11" r="1.5" fill="#FFFFFF" />
          <circle cx="32" cy="11" r="1.5" fill="#FFFFFF" />
        </svg>
      );
    case 'outlook':
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden="true">
          <rect x="4" y="12" width="24" height="26" rx="2" fill="#0078D4" />
          <text x="16" y="32" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="700" fill="#FFFFFF">O</text>
          <rect x="28" y="14" width="16" height="10" fill="#28A8EA" />
          <rect x="28" y="24" width="16" height="10" fill="#0078D4" />
          <path d="M28 14l8 5 8-5" stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        </svg>
      );
    case 'jobber':
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#0A8C5F" />
          <text x="24" y="32" textAnchor="middle" fontFamily="Georgia, serif" fontSize="24" fontWeight="700" fill="#FFFFFF" fontStyle="italic">J</text>
        </svg>
      );
    case 'housecall-pro':
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#1B5FA3" />
          <path d="M24 12l10 9v13h-6v-7h-8v7h-6V21z" fill="#FFFFFF" />
        </svg>
      );
    case 'servicetitan':
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden="true">
          <rect x="4" y="4" width="40" height="40" rx="8" fill="#0F172A" />
          <path d="M16 18h16v3h-6.5v12h-3V21H16z" fill="#D13B2E" />
        </svg>
      );
    case 'zapier':
      return (
        <svg viewBox="0 0 48 48" className="w-10 h-10" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#FF4A00" />
          <path d="M24 11l1.5 9 9 1.5-9 1.5L24 32l-1.5-9L13.5 21.5l9-1.5z" fill="#FFFFFF" />
        </svg>
      );
    default:
      return null;
  }
}
