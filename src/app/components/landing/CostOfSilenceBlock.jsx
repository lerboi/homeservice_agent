import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { AnimatedSection } from './AnimatedSection';

export function CostOfSilenceBlock() {
  return (
    <section id="cost-of-silence" className="bg-white py-20 md:py-28 px-6">
      <AnimatedSection>
        <div className="relative z-[1] max-w-3xl mx-auto text-center">
          <div className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">The cost of silence</div>
          <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] mb-8">The math isn&apos;t close</h2>
          <div className="mb-6">
            <span className="inline-block text-5xl md:text-6xl font-semibold text-[#0F172A] border-b-4 border-[#F97316] pb-1">$260,400</span>
            <span className="block text-[15px] text-[#475569] mt-2">lost per year</span>
          </div>
          <p className="text-[15px] text-[#475569] leading-relaxed max-w-xl mx-auto mb-6">
            3 missed calls per week × $1,670 average ticket × 52 weeks. If you answer even one more, Voco pays for itself this month.
          </p>
          <Link
            href="/pricing#calculator"
            className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#F97316] hover:text-[#EA580C] transition-colors"
          >
            Calculate yours <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </AnimatedSection>
    </section>
  );
}
