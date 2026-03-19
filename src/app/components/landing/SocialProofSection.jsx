import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { Star } from 'lucide-react';

const testimonials = [
  {
    quote: 'I was losing $4k a month in missed calls. First week with HomeService AI, I booked two emergency jobs at midnight.',
    name: 'Dave R.',
    role: 'Master Plumber, Auckland',
    initial: 'D',
    color: 'bg-amber-600',
  },
  {
    quote: "The triage alone is worth it. I know before I pick up whether it's a burst pipe or someone wanting a quote for three months from now.",
    name: 'James K.',
    role: 'HVAC Owner, Brisbane',
    initial: 'J',
    color: 'bg-sky-600',
  },
  {
    quote: 'Setup took four minutes. I heard my AI answer my own test call and nearly fell off my chair.',
    name: 'Mark T.',
    role: 'Electrician, Singapore',
    initial: 'M',
    color: 'bg-emerald-600',
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5 mb-4">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="size-4 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

export function SocialProofSection() {
  return (
    <section id="testimonials" className="relative bg-[#0F172A] py-20 md:py-28 px-6 overflow-hidden">
      {/* Subtle gradient accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px] bg-[radial-gradient(ellipse,rgba(194,65,12,0.06),transparent_70%)]" />

      <div className="relative max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-medium text-[#C2410C] tracking-wide uppercase mb-3">
            From the field
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
            What trades owners are saying
          </h2>
        </AnimatedSection>

        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {testimonials.map((t) => (
            <AnimatedItem key={t.name}>
              <div className="h-full rounded-2xl bg-white/[0.04] border border-white/[0.06] p-6 md:p-7 backdrop-blur-sm transition-colors hover:bg-white/[0.06]">
                <StarRating />
                <blockquote className="text-[15px] text-white/80 leading-relaxed mb-6">
                  &ldquo;{t.quote}&rdquo;
                </blockquote>
                <div className="flex items-center gap-3 pt-4 border-t border-white/[0.06]">
                  <div className={`size-9 rounded-full ${t.color} flex items-center justify-center text-sm text-white font-medium`}>
                    {t.initial}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{t.name}</p>
                    <p className="text-xs text-white/40">{t.role}</p>
                  </div>
                </div>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedStagger>
      </div>
    </section>
  );
}
