import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';
import { INTEGRATIONS } from '@/data/integrations';
import { card } from '@/lib/design-tokens';

export const metadata = {
  title: 'Integrations | Voco',
  description: 'Connect Voco to the tools you already use — Google Calendar, Outlook, and more.',
  alternates: {
    canonical: 'https://voco.live/integrations',
  },
};

export default function IntegrationsPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Header section */}
      <section className="bg-[#F5F5F4] pt-24 md:pt-28 pb-16 md:pb-20">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection direction="up">
            <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A]">
              Integrations
            </h1>
            <p className="text-lg text-[#475569] mt-4">
              Connect Voco to the tools you already use.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Card grid section */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <AnimatedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {INTEGRATIONS.map((integration) => (
              <AnimatedItem key={integration.slug}>
                <Link href={'/integrations/' + integration.slug} className="block h-full">
                  <Card
                    className={[card.base, card.hover, 'p-6 h-full flex flex-col gap-3 cursor-pointer'].join(' ')}
                  >
                    <div className="flex items-center gap-2">
                      <span className="bg-[#F97316]/10 text-[#F97316] text-xs font-medium rounded-full px-2.5 py-0.5">
                        INTEGRATION
                      </span>
                    </div>
                    <p className="text-base font-semibold text-[#0F172A]">
                      {integration.toolName}
                    </p>
                    <p className="text-sm text-[#475569] line-clamp-2 flex-1">
                      {integration.description}
                    </p>
                    <span className="text-sm text-[#F97316] font-medium mt-auto">
                      Learn more
                    </span>
                  </Card>
                </Link>
              </AnimatedItem>
            ))}
          </AnimatedStagger>
        </div>
      </section>
    </div>
  );
}
