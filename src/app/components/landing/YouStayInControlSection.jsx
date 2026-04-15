import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { UserCheck, Clock, Eye } from 'lucide-react';

const CONTROLS = [
  {
    icon: UserCheck,
    label: 'WHO',
    promise: 'Your VIP list rings straight through. Everyone else gets Voco.',
  },
  {
    icon: Clock,
    label: 'WHEN',
    promise: 'Nights, weekends, lunch — you set the hours.',
  },
  {
    icon: Eye,
    label: 'WHAT',
    promise: 'Recording, transcript, and urgency tag reach you before the caller hangs up.',
  },
];

export function YouStayInControlSection() {
  return (
    <>
      <section className="bg-white py-24 md:py-32 px-6">
        <AnimatedSection>
          <div className="max-w-4xl mx-auto">
            <div className="max-w-2xl">
              <div className="text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase mb-4">Your rules, your way</div>
              <h2 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-[1.1] tracking-tight">
                You Stay in Control.
              </h2>
              <p className="mt-5 text-[17px] text-[#475569] leading-relaxed">
                Voco answers the way you told it to. Change it anytime — or leave the smart defaults on and forget it.
              </p>
            </div>

            <AnimatedStagger className="mt-16 md:mt-20 divide-y divide-stone-200/80">
              {CONTROLS.map(({ icon: Icon, label, promise }) => (
                <AnimatedItem key={label}>
                  <div className="grid grid-cols-[auto_1fr] md:grid-cols-[auto_120px_1fr] items-center gap-x-5 md:gap-x-8 gap-y-2 py-8 md:py-10">
                    <Icon className="w-7 h-7 md:w-8 md:h-8 text-[#F97316] row-span-2 md:row-span-1" strokeWidth={1.5} aria-hidden="true" />
                    <span className="text-[13px] font-semibold text-[#0F172A] tracking-[0.18em] uppercase">
                      {label}
                    </span>
                    <p className="col-span-2 md:col-span-1 text-[18px] md:text-[20px] leading-snug text-[#0F172A] font-medium">
                      {promise}
                    </p>
                  </div>
                </AnimatedItem>
              ))}
            </AnimatedStagger>
          </div>
        </AnimatedSection>
      </section>

      <section className="relative bg-[#1C1412] py-20 md:py-28 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(249,115,22,0.10), transparent 70%)' }}
          aria-hidden="true"
        />
        <AnimatedSection>
          <div className="relative max-w-3xl mx-auto text-center">
            <blockquote className="text-[28px] md:text-[36px] font-semibold text-[#F5F5F5] leading-tight tracking-tight">
              &ldquo;You set the rules. Voco follows them.&rdquo;
            </blockquote>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}
