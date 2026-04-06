import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { AnimatedSection, AnimatedStagger, AnimatedItem } from '@/app/components/landing/AnimatedSection';
import { GLOSSARY_TERMS } from '@/data/glossary';

export const metadata = {
  title: 'Glossary | Voco',
  description: 'Home service and AI terminology explained — from AI receptionist to voice triage.',
  alternates: {
    canonical: 'https://voco.live/glossary',
  },
};

export default function GlossaryPage() {
  return (
    <div className="bg-white">
      {/* Header */}
      <section className="bg-[#F5F5F4] py-16 md:py-20">
        <div className="max-w-6xl mx-auto px-6">
          <AnimatedSection>
            <h1 className="text-4xl md:text-5xl font-semibold text-[#0F172A] tracking-tight">
              Glossary
            </h1>
            <p className="text-lg text-[#475569] mt-4 max-w-xl leading-relaxed">
              AI and home service terminology explained.
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* Card grid */}
      <section className="bg-white">
        <div className="max-w-6xl mx-auto px-6 py-16">
          <AnimatedStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {GLOSSARY_TERMS.map((termItem) => (
              <AnimatedItem key={termItem.slug}>
                <Link href={`/glossary/${termItem.slug}`} className="block group h-full">
                  <Card className="bg-white rounded-2xl shadow-[0_1px_3px_0_rgba(0,0,0,0.04),0_1px_2px_-1px_rgba(0,0,0,0.03)] border border-stone-200/60 hover:shadow-[0_4px_12px_0_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-all duration-200 p-5 gap-3 h-full">
                    {/* Badge */}
                    <span className="inline-flex items-center bg-[#F97316]/10 text-[#F97316] text-xs font-medium rounded-full px-2.5 py-0.5 w-fit">
                      GLOSSARY
                    </span>

                    {/* Term name */}
                    <h2 className="text-base font-semibold text-[#0F172A]">
                      {termItem.term}
                    </h2>

                    {/* Definition preview */}
                    <p className="text-sm text-[#475569] line-clamp-2 leading-relaxed">
                      {termItem.definition.slice(0, 120)}
                      {termItem.definition.length > 120 ? '…' : ''}
                    </p>

                    {/* Read link */}
                    <div className="mt-auto pt-2">
                      <span className="text-sm text-[#F97316] font-medium flex items-center gap-1 group-hover:gap-1.5 transition-all">
                        Read definition
                        <ArrowRight className="size-3.5" />
                      </span>
                    </div>
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
