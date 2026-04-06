import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { PERSONAS } from '@/data/personas';
import { card } from '@/lib/design-tokens';

export const metadata = {
  title: 'AI Receptionist for Your Trade | Voco',
  description: 'See how Voco works for plumbers, HVAC techs, electricians, and more.',
  alternates: {
    canonical: 'https://voco.live/for',
  },
};

export default function PersonaHubPage() {
  return (
    <div className="bg-white">

      {/* ── Header ────────────────────────────────────────── */}
      <section className="bg-[#F5F5F4] py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A]">
            Built for Your Trade
          </h1>
          <p className="text-lg text-[#475569] mt-4">
            See how Voco works for your specific trade.
          </p>
        </div>
      </section>

      {/* ── Card Grid ─────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {PERSONAS.map((persona) => (
            <Link key={persona.slug} href={'/for/' + persona.slug} className="block group">
              <Card className={card.base + ' ' + card.hover + ' p-6'}>
                <div className="flex flex-col gap-3">
                  <span className="inline-block self-start bg-[#F97316]/10 text-[#F97316] text-xs font-medium rounded-full px-2.5 py-0.5">
                    PERSONA
                  </span>
                  <div className="text-base font-semibold text-[#0F172A]">
                    {persona.trade}
                  </div>
                  <p className="text-sm text-[#475569] line-clamp-2">
                    {persona.headline}
                  </p>
                  <span className="text-sm text-[#F97316] font-medium">
                    See how it works &rarr;
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      </section>

    </div>
  );
}
