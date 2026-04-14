import { AnimatedSection } from './AnimatedSection';

export function IdentitySection() {
  return (
    <section className="bg-white py-20 md:py-28 px-6">
      <div className="max-w-[720px] mx-auto text-center">
        <AnimatedSection>
          <p className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">
            You&apos;re still the boss
          </p>
          <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] leading-tight tracking-tight mb-8">
            Your business. Your voice. Your rules.
          </h2>
          <div className="flex flex-col gap-6 text-[15px] text-[#475569] leading-relaxed">
            <p>
              Voco doesn&apos;t show up on your truck. It doesn&apos;t meet your customers. It doesn&apos;t know your neighborhood the way you do.
            </p>
            <p>
              What it does is pick up the phone when you&apos;re on the roof, in a crawlspace, or finally asleep after a 14-hour day — and it answers the way you told it to.
            </p>
            <p>
              Every job you earned is still yours. Voco just makes sure the next one doesn&apos;t hang up before you can answer.
            </p>
          </div>
        </AnimatedSection>
      </div>
    </section>
  );
}
