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
          <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] text-center mb-12">
            Works with what you already use
          </h2>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-6 items-start justify-items-center">
            {LIVE_INTEGRATIONS.map((int) => (
              <IntegrationTile key={int.slug} name={int.name} slug={int.slug} status="live" />
            ))}
            {COMING_SOON_INTEGRATIONS.map((int) => (
              <IntegrationTile key={int.slug} name={int.name} slug={int.slug} status="coming-soon" />
            ))}
          </div>
        </div>
      </AnimatedSection>
    </section>
  );
}

function IntegrationTile({ name, slug, status }) {
  const isLive = status === 'live';
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className={isLive ? 'h-10 flex items-center' : 'h-10 flex items-center grayscale opacity-50'}
        aria-label={name}
      >
        <IntegrationLogo slug={slug} />
      </div>
      <span className="text-[14px] font-semibold text-[#0F172A]">{name}</span>
      {isLive ? (
        <span className="text-[11px] font-semibold text-[#166534] bg-[#166534]/10 border border-[#166534]/20 px-2 py-0.5 rounded-full">Live</span>
      ) : (
        <span className="text-[11px] font-semibold text-[#475569] bg-stone-100 border border-stone-200 px-2 py-0.5 rounded-full">Coming soon</span>
      )}
    </div>
  );
}

function IntegrationLogo({ slug }) {
  switch (slug) {
    case 'google-calendar':
      return (
        <span className="font-semibold text-[16px]">
          <span style={{ color: '#4285F4' }}>G</span>
          <span style={{ color: '#EA4335' }}>o</span>
          <span style={{ color: '#FBBC04' }}>o</span>
          <span style={{ color: '#4285F4' }}>g</span>
          <span style={{ color: '#34A853' }}>l</span>
          <span style={{ color: '#EA4335' }}>e</span>
        </span>
      );
    case 'outlook':
      return <span className="font-semibold text-[16px] text-[#0078D4]">Outlook</span>;
    case 'jobber':
      return <span className="font-bold text-[16px] text-[#0A8C5F]">Jobber</span>;
    case 'housecall-pro':
      return <span className="font-bold text-[16px] text-[#1B5FA3]">Housecall Pro</span>;
    case 'servicetitan':
      return <span className="font-bold text-[16px] text-[#D13B2E]">ServiceTitan</span>;
    case 'zapier':
      return <span className="font-bold text-[16px] text-[#FF4A00]">Zapier</span>;
    default:
      return null;
  }
}
