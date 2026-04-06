import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Calendar, Clock, Bell, RefreshCw } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { INTEGRATIONS } from '@/data/integrations';

const ICON_MAP = {
  Calendar,
  Clock,
  Bell,
  RefreshCw,
};

export async function generateStaticParams() {
  return INTEGRATIONS.map((i) => ({ tool: i.slug }));
}

export async function generateMetadata({ params }) {
  const { tool: toolSlug } = await params;
  const item = INTEGRATIONS.find((i) => i.slug === toolSlug);

  if (!item) {
    return { title: 'Not Found | Voco' };
  }

  return {
    title: `${item.toolName} Integration | Voco`,
    description: item.description.slice(0, 160),
    alternates: {
      canonical: `https://voco.live/integrations/${toolSlug}`,
    },
    openGraph: {
      images: [
        {
          url: `/og?title=${encodeURIComponent(item.toolName + ' + Voco')}&type=INTEGRATION`,
        },
      ],
    },
  };
}

export default async function IntegrationDetailPage({ params }) {
  const { tool: toolSlug } = await params;
  const item = INTEGRATIONS.find((i) => i.slug === toolSlug);

  if (!item) {
    notFound();
  }

  const relatedItems = item.relatedSlugs
    .map((slug) => INTEGRATIONS.find((i) => i.slug === slug))
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-white">
      <SchemaMarkup
        schema={{
          '@context': 'https://schema.org',
          '@type': 'SoftwareApplication',
          name: 'Voco',
          applicationCategory: 'BusinessApplication',
          operatingSystem: 'Web',
          description:
            'AI receptionist for home service businesses — integrates with ' +
            item.toolName,
        }}
      />

      {/* Hero section */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 pt-24 md:pt-32 pb-12">
          <AnimatedSection direction="up">
            <Link
              href="/integrations"
              className="inline-flex items-center gap-2 text-sm text-[#475569] hover:text-[#F97316] transition-colors mb-8"
            >
              <ArrowLeft className="w-4 h-4" />
              All integrations
            </Link>

            {/* Logo connector row */}
            <div className="flex items-center">
              <span className="text-xl font-semibold text-[#0F172A]">Voco</span>
              <span className="mx-4 text-2xl text-[#64748B]">+</span>
              <span className="text-xl font-semibold text-[#0F172A]">
                {item.toolName}
              </span>
            </div>

            <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-tight mt-8">
              Voco + {item.toolName}
            </h1>
            <p className="text-lg text-[#475569] mt-4 max-w-2xl">
              {item.description.slice(0, 160)}
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Description section */}
      <section className="bg-white">
        <div className="max-w-5xl mx-auto px-6 pb-12">
          <AnimatedSection direction="up">
            <p className="max-w-2xl text-base text-[#475569] leading-relaxed">
              {item.description}
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Use cases section */}
      <section className="bg-[#F5F5F4] py-16 md:py-24">
        <div className="max-w-5xl mx-auto px-6">
          <AnimatedSection direction="up">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] text-center mb-12">
              What you can do
            </h2>
          </AnimatedSection>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {item.useCases.map((useCase, index) => {
              const IconComponent = ICON_MAP[useCase.icon];
              return (
                <AnimatedSection key={index} direction="up" delay={index * 0.05}>
                  <Card className="bg-white border border-stone-200/60 p-6">
                    {IconComponent && (
                      <IconComponent className="w-8 h-8 text-[#F97316] mb-4" />
                    )}
                    <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                      {useCase.title}
                    </h3>
                    <p className="text-sm text-[#475569] leading-relaxed">
                      {useCase.body}
                    </p>
                  </Card>
                </AnimatedSection>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA section */}
      <section className="bg-[#F5F5F4]">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <AnimatedSection direction="up">
            <div className="bg-white rounded-2xl p-8 md:p-12 text-center border border-stone-200/60">
              <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] mb-6">
                {item.ctaHeading}
              </h2>
              <AuthAwareCTA variant="cta" />
            </div>
          </AnimatedSection>
        </div>
      </section>

      {/* Related integrations */}
      {relatedItems.length > 0 && (
        <section className="bg-white">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <AnimatedSection direction="up">
              <h2 className="text-2xl font-semibold text-[#0F172A] mb-8">
                Related integrations
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {relatedItems.map((related) => (
                  <Link
                    key={related.slug}
                    href={'/integrations/' + related.slug}
                    className="block"
                  >
                    <Card className="bg-white border border-stone-200/60 p-6 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200">
                      <span className="bg-[#F97316]/10 text-[#F97316] text-xs font-medium rounded-full px-2.5 py-0.5">
                        INTEGRATION
                      </span>
                      <p className="text-base font-semibold text-[#0F172A] mt-3">
                        {related.toolName}
                      </p>
                      <p className="text-sm text-[#475569] line-clamp-2 mt-1">
                        {related.description}
                      </p>
                    </Card>
                  </Link>
                ))}
              </div>
            </AnimatedSection>
          </div>
        </section>
      )}
    </div>
  );
}
