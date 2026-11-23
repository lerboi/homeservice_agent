import Link from 'next/link';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { FinalCtaSection } from '@/components/marketing/LandingSections';
import { PageHero, Section } from '@/components/marketing/primitives';
import { integrationsByGroup } from '@/data/integrations';
import { pageMetadata } from '@/data/site';

export const metadata = pageMetadata({
  title: 'Integrations | Voco',
  description:
    'The systems a Voco voice agent can work in: calendars, CRMs, field tools, messaging, payments, automation platforms and your own API. We connect them for you.',
  path: '/integrations',
  ogTitle: 'It works in the tools you already run.',
  ogType: 'INTEGRATIONS',
});

export default function IntegrationsPage() {
  const groups = integrationsByGroup();
  return (
    <>
      <PageHero
        eyebrow="Integrations"
        title="It works in the tools you already run."
        lede="Voco connects to your systems for you. Tell us what you use; we set the connection up, decide with you what the agent may do there, and test it before the first real call."
      >
        <AuthAwareCTA />
      </PageHero>

      <Section tone="white">
        <div className="space-y-14">
          {groups.map((group) => (
            <div key={group.id} id={group.id} className="grid gap-6 scroll-mt-24 lg:grid-cols-[1fr_2.4fr] lg:gap-12">
              <div>
                <h2 className="font-display text-2xl font-medium tracking-[-0.02em]">{group.title}</h2>
                <p className="mt-2 text-[15px] leading-relaxed text-mk-muted">{group.blurb}</p>
              </div>
              <ul className="grid gap-px overflow-hidden rounded-2xl border border-mk-line bg-mk-line sm:grid-cols-2">
                {group.items.map((item) => (
                  <li key={item.slug} className="bg-white">
                    <Link href={`/integrations/${item.slug}`} className="block h-full p-5 transition-colors hover:bg-mk-paper">
                      <h3 className="font-display text-lg font-medium tracking-[-0.01em]">{item.name}</h3>
                      <p className="mt-1.5 text-sm leading-relaxed text-mk-muted">{item.summary}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <FinalCtaSection
        title="Running something else?"
        lede="If it has an API or accepts a webhook, the agent can work in it. Tell us what it is and what callers need done there."
      />
    </>
  );
}
