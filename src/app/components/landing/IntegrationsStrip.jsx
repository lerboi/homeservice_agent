import { AnimatedSection } from './AnimatedSection';

const INTEGRATIONS = [
  { name: 'Google Calendar', slug: 'google-calendar' },
  { name: 'Outlook', slug: 'outlook' },
  { name: 'Jobber', slug: 'jobber' },
  { name: 'Housecall Pro', slug: 'housecall-pro' },
  { name: 'ServiceTitan', slug: 'servicetitan' },
  { name: 'Zapier', slug: 'zapier' },
];

export function IntegrationsStrip() {
  return (
    <section className="bg-[#FAFAF9] py-24 md:py-32 px-6">
      <AnimatedSection>
        <div className="relative z-[1] max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Logos — left on desktop, below on mobile */}
            <div className="order-2 md:order-1">
              <div className="grid grid-cols-3 md:grid-cols-2 gap-x-6 gap-y-8 md:gap-y-10">
                {INTEGRATIONS.map((int) => (
                  <IntegrationMark key={int.slug} name={int.name} slug={int.slug} />
                ))}
              </div>
            </div>

            {/* Text — right on desktop, above on mobile */}
            <div className="order-1 md:order-2 md:text-right">
              <div className="text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase mb-4">Your stack, not ours</div>
              <h2 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-[1.1] tracking-tight">
                Plays nice with<br className="hidden md:inline" /> what you<br className="hidden md:inline" /> already run.
              </h2>
              <p className="mt-5 text-[17px] text-[#475569] leading-relaxed md:ml-auto max-w-md md:max-w-none">
                Voco connects to the tools you already trust — calendars, CRMs, and the glue between them. No rip-and-replace, no migration weekend.
              </p>
            </div>
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

function IntegrationMark({ name, slug }) {
  return (
    <div className="flex flex-col items-center md:items-start gap-3">
      <div className="flex items-center justify-center" aria-hidden="true">
        <IntegrationLogo slug={slug} />
      </div>
      <span className="text-[13px] md:text-[15px] font-semibold text-[#0F172A] text-center md:text-left leading-tight">
        {name}
      </span>
    </div>
  );
}

function IntegrationLogo({ slug }) {
  switch (slug) {
    case 'google-calendar':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <rect x="8" y="8" width="32" height="32" rx="4" fill="#FFFFFF" stroke="#DADCE0" />
          <path d="M8 8h32v6H8z" fill="#4285F4" />
          <text x="24" y="31" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="14" fontWeight="700" fill="#4285F4">31</text>
          <circle cx="16" cy="11" r="1.5" fill="#FFFFFF" />
          <circle cx="32" cy="11" r="1.5" fill="#FFFFFF" />
        </svg>
      );
    case 'outlook':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <rect x="4" y="12" width="24" height="26" rx="2" fill="#0078D4" />
          <text x="16" y="32" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="18" fontWeight="700" fill="#FFFFFF">O</text>
          <rect x="28" y="14" width="16" height="10" fill="#28A8EA" />
          <rect x="28" y="24" width="16" height="10" fill="#0078D4" />
          <path d="M28 14l8 5 8-5" stroke="#FFFFFF" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
        </svg>
      );
    case 'jobber':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#0A8C5F" />
          <text x="24" y="32" textAnchor="middle" fontFamily="Georgia, serif" fontSize="24" fontWeight="700" fill="#FFFFFF" fontStyle="italic">J</text>
        </svg>
      );
    case 'housecall-pro':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#1B5FA3" />
          <path d="M24 12l10 9v13h-6v-7h-8v7h-6V21z" fill="#FFFFFF" />
        </svg>
      );
    case 'servicetitan':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <rect x="4" y="4" width="40" height="40" rx="8" fill="#0F172A" />
          <path d="M16 18h16v3h-6.5v12h-3V21H16z" fill="#D13B2E" />
        </svg>
      );
    case 'zapier':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#FF4A00" />
          <path d="M24 11l1.5 9 9 1.5-9 1.5L24 32l-1.5-9L13.5 21.5l9-1.5z" fill="#FFFFFF" />
        </svg>
      );
    default:
      return null;
  }
}
