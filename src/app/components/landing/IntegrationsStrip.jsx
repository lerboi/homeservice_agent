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
    <section className="bg-[#FAFAF9] py-20 md:py-28 px-6">
      <AnimatedSection>
        <div className="relative z-[1] max-w-5xl mx-auto">
          <div className="text-center mb-3">
            <div className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">Your stack, not ours</div>
            <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A]">Plays nice with what you already run</h2>
            <p className="mt-3 text-[15px] text-[#475569] max-w-xl mx-auto">
              Syncing your calendar today. Your CRM next — no rip-and-replace.
            </p>
          </div>

          <div className="mt-12 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
            {LIVE_INTEGRATIONS.map((int) => (
              <IntegrationCard key={int.slug} name={int.name} slug={int.slug} status="live" />
            ))}
            {COMING_SOON_INTEGRATIONS.map((int) => (
              <IntegrationCard key={int.slug} name={int.name} slug={int.slug} status="coming-soon" />
            ))}
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

function IntegrationCard({ name, slug, status }) {
  const isLive = status === 'live';
  return (
    <div
      className={
        isLive
          ? 'group rounded-2xl bg-white border border-stone-200 p-4 flex flex-col items-center gap-3 shadow-sm hover:shadow-md transition-shadow'
          : 'rounded-2xl bg-white border border-stone-200 p-4 flex flex-col items-center gap-3'
      }
    >
      <div
        className={
          isLive
            ? 'w-14 h-14 rounded-2xl flex items-center justify-center shadow-md ring-1 ring-stone-900/5'
            : 'w-14 h-14 rounded-2xl flex items-center justify-center ring-1 ring-stone-900/5 grayscale opacity-60'
        }
        aria-hidden="true"
      >
        <IntegrationLogo slug={slug} />
      </div>
      <div className="flex flex-col items-center gap-1 min-h-[44px]">
        <span className="text-[13px] font-semibold text-[#0F172A] text-center leading-tight">{name}</span>
        {isLive ? (
          <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[#166534] bg-[#166534]/10 border border-[#166534]/20 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-[#16A34A]" />
            Live
          </span>
        ) : (
          <span className="text-[10px] font-semibold text-[#475569] bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            Coming soon
          </span>
        )}
      </div>
    </div>
  );
}

function IntegrationLogo({ slug }) {
  switch (slug) {
    case 'google-calendar':
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden="true">
          <rect x="3" y="4" width="18" height="18" rx="3" fill="#FFFFFF" stroke="#DADCE0" strokeWidth="0.5" />
          <path d="M3 7h18v1H3z" fill="#4285F4" />
          <path d="M7 3v3M17 3v3" stroke="#4285F4" strokeWidth="1.5" strokeLinecap="round" />
          <text x="12" y="17" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="8" fontWeight="600" fill="#4285F4">31</text>
        </svg>
      );
    case 'outlook':
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden="true">
          <rect x="2" y="5" width="12" height="14" rx="1.5" fill="#0078D4" />
          <text x="8" y="16" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="9" fontWeight="700" fill="#FFFFFF">O</text>
          <rect x="14" y="7" width="8" height="5" fill="#28A8EA" />
          <rect x="14" y="12" width="8" height="5" fill="#0078D4" />
          <path d="M14 7l4 2.5 4-2.5" stroke="#FFFFFF" strokeWidth="0.8" fill="none" />
        </svg>
      );
    case 'jobber':
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#0A8C5F" />
          <text x="12" y="16" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="11" fontWeight="700" fill="#FFFFFF">J</text>
        </svg>
      );
    case 'housecall-pro':
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#1B5FA3" />
          <path d="M12 6l6 5v7h-4v-4h-4v4H6v-7z" fill="#FFFFFF" />
        </svg>
      );
    case 'servicetitan':
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#D13B2E" />
          <text x="12" y="16" textAnchor="middle" fontFamily="system-ui, sans-serif" fontSize="10" fontWeight="700" fill="#FFFFFF">ST</text>
        </svg>
      );
    case 'zapier':
      return (
        <svg viewBox="0 0 24 24" className="w-8 h-8" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="5" fill="#FF4A00" />
          <path d="M12 5l2.2 4.4 4.8.7-3.5 3.4.8 4.8L12 15.9l-4.3 2.4.8-4.8L5 10.1l4.8-.7z" fill="#FFFFFF" />
        </svg>
      );
    default:
      return null;
  }
}
