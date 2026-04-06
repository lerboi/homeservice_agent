import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import { GlossaryFAQ } from '@/app/(public)/glossary/GlossaryFAQ';
import { GLOSSARY_TERMS } from '@/data/glossary';

export async function generateStaticParams() {
  return GLOSSARY_TERMS.map((t) => ({ term: t.slug }));
}

export async function generateMetadata({ params }) {
  const { term: termSlug } = await params;
  const item = GLOSSARY_TERMS.find((t) => t.slug === termSlug);

  if (!item) {
    return { title: 'Not Found | Voco' };
  }

  const description = item.definition.slice(0, 160);

  return {
    title: `${item.term} | Voco`,
    description,
    alternates: {
      canonical: `https://voco.live/glossary/${termSlug}`,
    },
    openGraph: {
      title: `${item.term} | Voco`,
      description,
      images: [
        {
          url: `https://voco.live/og?title=${encodeURIComponent(item.term)}&type=GLOSSARY`,
          width: 1200,
          height: 630,
          alt: item.term,
        },
      ],
    },
  };
}

export default async function GlossaryDetailPage({ params }) {
  const { term: termSlug } = await params;
  const item = GLOSSARY_TERMS.find((t) => t.slug === termSlug);

  if (!item) {
    notFound();
  }

  // FAQPage JSON-LD schema
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: item.faqItems.map((faq) => ({
      '@type': 'Question',
      name: faq.q,
      acceptedAnswer: {
        '@type': 'Answer',
        text: faq.a,
      },
    })),
  };

  // Related terms
  const relatedTerms = item.relatedSlugs
    .map((s) => GLOSSARY_TERMS.find((t) => t.slug === s))
    .filter(Boolean);

  return (
    <div className="bg-white">
      <SchemaMarkup schema={faqSchema} />

      <div className="max-w-3xl mx-auto px-6 pt-24 md:pt-32 pb-16 md:pb-24">
        {/* Back to hub */}
        <Link
          href="/glossary"
          className="inline-flex items-center gap-1.5 text-sm text-[#64748B] hover:text-[#0F172A] transition-colors mb-8"
        >
          <ArrowLeft className="size-4" />
          All terms
        </Link>

        {/* Definition section */}
        <AnimatedSection>
          <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A] tracking-tight">
            {item.term}
          </h1>
          <p className="text-lg text-[#475569] leading-relaxed mt-6">
            {item.definition}
          </p>
        </AnimatedSection>

        {/* FAQ accordion */}
        {item.faqItems.length > 0 && (
          <div className="mt-12">
            <h2 className="text-2xl font-semibold text-[#0F172A] mt-12 mb-6">
              Frequently Asked Questions
            </h2>
            <GlossaryFAQ items={item.faqItems} />
          </div>
        )}

        {/* Related terms */}
        {relatedTerms.length > 0 && (
          <div className="mt-12">
            <h2 className="text-lg font-semibold text-[#0F172A] mt-12 mb-4">
              Related terms
            </h2>
            <div className="flex flex-wrap gap-2">
              {relatedTerms.map((related) => (
                <Link
                  key={related.slug}
                  href={`/glossary/${related.slug}`}
                  className="rounded-full border border-stone-200 px-3 py-1 text-sm text-[#475569] hover:border-[#F97316] hover:text-[#F97316] transition-colors"
                >
                  {related.term}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA section */}
      <AnimatedSection>
        <section className="bg-[#F5F5F4] py-16 md:py-20">
          <div className="max-w-3xl mx-auto px-6 text-center">
            <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] mb-4 tracking-tight">
              Ready to put it into practice?
            </h2>
            <p className="text-[#475569] mb-8 leading-relaxed">
              Set up your AI receptionist in under 5 minutes. No tech skills required.
            </p>
            <AuthAwareCTA variant="cta" />
          </div>
        </section>
      </AnimatedSection>
    </div>
  );
}
