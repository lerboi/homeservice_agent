import { AnimatedSection } from './AnimatedSection';

const INTEGRATIONS = [
  { name: 'Google Calendar', slug: 'google-calendar' },
  { name: 'Outlook Calendar', slug: 'outlook' },
  { name: 'Jobber', slug: 'jobber' },
  { name: 'Xero', slug: 'xero' },
  { name: 'WhatsApp', slug: 'whatsapp' },
];

const COMING_SOON = [
  { name: 'Housecall Pro', slug: 'housecall-pro' },
  { name: 'ServiceTitan', slug: 'servicetitan' },
];

export function IntegrationsStrip() {
  return (
    <section id="integrations" className="bg-[#FAFAF9] py-24 md:py-32 px-6">
      <AnimatedSection>
        <div className="relative z-[1] max-w-4xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center">
            {/* Logos — left on desktop, below on mobile */}
            <div className="order-2 md:order-1 flex flex-col gap-10">
              {/* Main integrations */}
              <div className="grid grid-cols-3 gap-x-6 gap-y-8 md:gap-y-10">
                {INTEGRATIONS.map((int) => (
                  <IntegrationMark key={int.slug} name={int.name} slug={int.slug} />
                ))}
              </div>

              {/* Coming soon divider + logos */}
              <div className="flex flex-col gap-5">
                <div className="flex items-center gap-3">
                  <span className="text-[11px] font-semibold text-[#94A3B8] tracking-[0.18em] uppercase">Coming soon</span>
                  <span className="h-px flex-1 bg-stone-200" />
                </div>
                <div className="grid grid-cols-3 gap-x-6 gap-y-8">
                  {COMING_SOON.map((int) => (
                    <IntegrationMark key={int.slug} name={int.name} slug={int.slug} muted />
                  ))}
                </div>
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

function IntegrationMark({ name, slug, muted }) {
  return (
    <div className="flex flex-col items-center md:items-start gap-3">
      <div
        className={muted ? 'flex items-center justify-center grayscale opacity-60' : 'flex items-center justify-center'}
        aria-hidden="true"
      >
        <IntegrationLogo slug={slug} />
      </div>
      <span
        className={
          muted
            ? 'text-[13px] md:text-[15px] font-semibold text-[#94A3B8] text-center md:text-left leading-tight'
            : 'text-[13px] md:text-[15px] font-semibold text-[#0F172A] text-center md:text-left leading-tight'
        }
      >
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
    case 'xero':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#13B5EA" />
          <path d="M17 17l14 14M31 17L17 31" stroke="#FFFFFF" strokeWidth="3.5" strokeLinecap="round" />
        </svg>
      );
    case 'whatsapp':
      return (
        <svg viewBox="0 0 48 48" className="w-11 h-11 md:w-16 md:h-16" aria-hidden="true">
          <circle cx="24" cy="24" r="20" fill="#25D366" />
          <path
            d="M24 13c-5.5 0-10 4.5-10 10 0 1.9.5 3.7 1.4 5.2L14 35l7-1.4c1.5.8 3.2 1.3 4.9 1.3 5.5 0 10-4.5 10-10s-4.5-10-10-10zm5.8 14.1c-.2.7-1.2 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1-.4-.1-1-.3-1.7-.6-3-1.3-4.9-4.3-5.1-4.5-.1-.2-1.2-1.6-1.2-3s.7-2.1 1-2.4c.2-.3.5-.4.7-.4h.5c.2 0 .4 0 .5.4.2.5.7 1.7.8 1.8.1.1.1.3 0 .4-.1.2-.1.3-.3.4-.1.2-.3.3-.4.5-.1.1-.3.3-.1.6.2.3.7 1.2 1.6 2 1.1 1 2 1.3 2.3 1.4.3.1.4.1.6-.1.2-.2.7-.8.8-1.1.1-.3.3-.2.5-.1s1.3.6 1.5.8c.2.1.4.2.4.3.1.1.1.6-.1 1.3z"
            fill="#FFFFFF"
          />
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
    default:
      return null;
  }
}
