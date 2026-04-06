import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Phone, Clock, DollarSign, Check } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { PERSONAS } from '@/data/personas';

const ICON_MAP = { Phone, Clock, DollarSign };

export function generateStaticParams() {
  return PERSONAS.map((p) => ({ persona: p.slug }));
}

export async function generateMetadata({ params }) {
  const { persona: personaSlug } = await params;
  const item = PERSONAS.find((p) => p.slug === personaSlug);

  if (!item) {
    return { title: 'Not Found | Voco' };
  }

  return {
    title: `AI Receptionist for ${item.trade}s | Voco`,
    description: `${item.subheadline} ${item.headline}`,
    alternates: {
      canonical: `https://voco.live/for/${personaSlug}`,
    },
    openGraph: {
      images: [
        `/og?title=${encodeURIComponent('AI Receptionist for ' + item.trade + 's')}&type=PERSONA`,
      ],
    },
  };
}

export default async function PersonaDetailPage({ params }) {
  const { persona: personaSlug } = await params;
  const item = PERSONAS.find((p) => p.slug === personaSlug);

  if (!item) {
    notFound();
  }

  return (
    <div className="bg-white">

      {/* JSON-LD */}
      <SchemaMarkup
        schema={{
          '@context': 'https://schema.org',
          '@type': 'WebPage',
          name: 'AI Receptionist for ' + item.trade + 's',
          description: item.subheadline,
          url: 'https://voco.live/for/' + personaSlug,
        }}
      />

      {/* ── Section 1: Hero ───────────────────────────────── */}
      <AnimatedSection direction="up">
        <section className="bg-white">
          <div className="max-w-6xl mx-auto px-6 pt-24 md:pt-32 pb-16">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-semibold text-[#0F172A] leading-tight">
              {item.headline}
            </h1>
            <p className="text-lg md:text-xl text-[#475569] mt-6 max-w-2xl">
              {item.subheadline}
            </p>
            <div className="flex items-center flex-wrap gap-4 mt-8">
              <AuthAwareCTA variant="hero" />
              <Link
                href="/#how-it-works"
                className="text-sm text-[#F97316] font-medium ml-4"
              >
                See how it works
              </Link>
            </div>
            <p className="text-xs text-[#64748B] mt-3">
              14-day free trial — no credit card required
            </p>
          </div>
        </section>
      </AnimatedSection>

      {/* ── Section 2: Pain Points ────────────────────────── */}
      <AnimatedSection direction="up">
        <section className="bg-[#F5F5F4]">
          <div className="py-16 md:py-24">
            <div className="max-w-6xl mx-auto px-6">
              <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] text-center mb-12">
                Sound familiar?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                {item.painPoints.map((point) => {
                  const IconComponent = ICON_MAP[point.icon] || Phone;
                  return (
                    <div key={point.title}>
                      <div className="w-10 h-10 rounded-xl bg-[#F97316]/10 flex items-center justify-center mb-4">
                        <IconComponent className="w-5 h-5 text-[#F97316]" />
                      </div>
                      <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                        {point.title}
                      </h3>
                      <p className="text-sm text-[#475569] leading-relaxed">
                        {point.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ── Section 3: Feature Highlights ─────────────────── */}
      <AnimatedSection direction="up">
        <section className="bg-white">
          <div className="py-16 md:py-24 max-w-6xl mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {item.features.map((feature) => (
                <div key={feature.title} className="bg-[#F5F5F4] rounded-2xl p-8">
                  <h3 className="text-xl font-semibold text-[#0F172A] mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-[#475569] leading-relaxed mb-4">
                    {feature.description}
                  </p>
                  <ul className="space-y-2">
                    {feature.checks.map((check) => (
                      <li key={check} className="flex items-center gap-2 text-sm text-[#475569]">
                        <Check className="w-4 h-4 text-[#F97316] shrink-0" />
                        {check}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ── Section 4: Testimonial ────────────────────────── */}
      <AnimatedSection direction="up">
        <section className="bg-[#F5F5F4]">
          <div className="py-16 md:py-24 max-w-3xl mx-auto px-6">
            <blockquote className="border-l-[3px] border-[#F97316] pl-6">
              <p className="text-xl md:text-2xl text-[#0F172A] italic leading-relaxed">
                &ldquo;{item.testimonial.quote}&rdquo;
              </p>
              <footer className="text-sm text-[#64748B] mt-4 not-italic">
                {item.testimonial.author}
              </footer>
            </blockquote>
          </div>
        </section>
      </AnimatedSection>

      {/* ── Section 5: CTA ────────────────────────────────── */}
      <AnimatedSection direction="up">
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[#1C1412]" aria-hidden="true" />
          <div
            className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.15),transparent_70%)]"
            aria-hidden="true"
          />
          <div className="relative py-16 md:py-24 max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-white mb-6">
              Ready to stop losing jobs to voicemail?
            </h2>
            <AuthAwareCTA variant="cta" />
          </div>
        </section>
      </AnimatedSection>

    </div>
  );
}
