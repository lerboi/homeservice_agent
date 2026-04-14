import { AnimatedSection } from './AnimatedSection';

export function OwnerControlPullQuote() {
  return (
    <section className="relative overflow-hidden py-20 md:py-24 px-6">
      {/* Dark warm base — matches FinalCTA mood but with less orange intensity */}
      <div className="absolute inset-0 bg-[#1C1412]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(249,115,22,0.10),transparent_60%)]" />

      <div className="relative max-w-[640px] mx-auto text-center">
        <AnimatedSection>
          <p className="text-[24px] md:text-[30px] font-semibold text-white leading-tight">
            &ldquo;You set the rules. Voco follows them.&rdquo;
          </p>
          <p className="text-[14px] text-white/50 italic mt-4">
            — The Voco product principle
          </p>
        </AnimatedSection>
      </div>
    </section>
  );
}
