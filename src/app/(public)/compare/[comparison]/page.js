import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Check, X } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { AuthAwareCTA } from '@/components/landing/AuthAwareCTA';
import { SchemaMarkup } from '@/components/SchemaMarkup';
import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { COMPARISONS } from '@/data/comparisons';

export function generateStaticParams() {
  return COMPARISONS.map((c) => ({ comparison: c.slug }));
}

export async function generateMetadata({ params }) {
  const { comparison: comparisonSlug } = await params;
  const item = COMPARISONS.find((c) => c.slug === comparisonSlug);

  if (!item) {
    return { title: 'Not Found | Voco' };
  }

  return {
    title: `${item.title} | Voco`,
    description: item.subheadline,
    alternates: {
      canonical: `https://voco.live/compare/${comparisonSlug}`,
    },
    openGraph: {
      images: [
        `/og?title=${encodeURIComponent(item.title)}&type=COMPARE`,
      ],
    },
  };
}

export default async function ComparisonDetailPage({ params }) {
  const { comparison: comparisonSlug } = await params;
  const item = COMPARISONS.find((c) => c.slug === comparisonSlug);

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
          name: item.title,
          description: item.subheadline,
          url: 'https://voco.live/compare/' + comparisonSlug,
        }}
      />

      {/* ── Hero ──────────────────────────────────────────── */}
      <AnimatedSection direction="up">
        <section className="bg-white">
          <div className="max-w-5xl mx-auto px-6 pt-24 md:pt-32 pb-12">
            <Link
              href="/compare"
              className="text-sm text-[#475569] hover:text-[#0F172A] transition-colors inline-flex items-center gap-1"
            >
              &larr; All comparisons
            </Link>
            <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-tight mt-4">
              {item.title}
            </h1>
            <p className="text-lg text-[#475569] mt-4">{item.subheadline}</p>
          </div>
        </section>
      </AnimatedSection>

      {/* ── Comparison Table ──────────────────────────────── */}
      <AnimatedSection direction="up">
        <section className="bg-white">
          <div className="max-w-5xl mx-auto px-6 pb-16">
            <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="px-6 py-4 text-sm font-medium text-[#0F172A]">
                      Feature
                    </TableHead>
                    <TableHead className="px-6 py-4 text-sm font-semibold text-[#F97316] bg-[#F97316]/5">
                      Voco
                    </TableHead>
                    <TableHead className="px-6 py-4 text-sm font-medium text-[#0F172A]">
                      {item.competitorName}
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {item.features.map((feature) => (
                    <TableRow key={feature.name}>
                      <TableCell
                        as="th"
                        scope="row"
                        className="px-6 py-4 text-sm font-medium text-[#0F172A]"
                      >
                        {feature.name}
                      </TableCell>
                      <TableCell className="px-6 py-4 bg-[#F97316]/5">
                        {feature.voco ? (
                          <span className="flex items-center">
                            <Check className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
                            <span className="sr-only">Supported</span>
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <X className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span className="sr-only">Not supported</span>
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="px-6 py-4">
                        {feature.competitor ? (
                          <span className="flex items-center">
                            <Check className="w-4 h-4 text-[#F97316]" aria-hidden="true" />
                            <span className="sr-only">Supported</span>
                          </span>
                        ) : (
                          <span className="flex items-center">
                            <X className="w-4 h-4 text-slate-400" aria-hidden="true" />
                            <span className="sr-only">Not supported</span>
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </section>
      </AnimatedSection>

      {/* ── Verdict ───────────────────────────────────────── */}
      <AnimatedSection direction="up">
        <section className="bg-white">
          <div className="max-w-5xl mx-auto px-6 py-16">
            <div className="bg-[#F5F5F4] rounded-2xl p-8 md:p-12">
              <h2 className="text-2xl md:text-3xl font-semibold text-[#0F172A] mb-4">
                {item.verdictHeading}
              </h2>
              <p className="text-base text-[#475569] leading-relaxed mb-8">
                {item.verdictBody}
              </p>
              <AuthAwareCTA variant="cta" />
            </div>
          </div>
        </section>
      </AnimatedSection>

    </div>
  );
}
