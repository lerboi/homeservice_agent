import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { Star, Quote } from 'lucide-react';

const testimonials = [
  {
    quote: 'I was losing $4k a month in missed calls. First week with HomeService AI, I booked two emergency jobs at midnight.',
    name: 'Dave R.',
    role: 'Master Plumber',
    location: 'Auckland',
    initial: 'D',
    color: 'bg-amber-600',
    metric: '$4k/mo recovered',
  },
  {
    quote: "The triage alone is worth it. I know before I pick up whether it's a burst pipe or someone wanting a quote for three months from now.",
    name: 'James K.',
    role: 'HVAC Owner',
    location: 'Brisbane',
    initial: 'J',
    color: 'bg-sky-600',
    metric: '3x faster response',
  },
  {
    quote: 'Setup took four minutes. I heard my AI answer my own test call and nearly fell off my chair.',
    name: 'Mark T.',
    role: 'Electrician',
    location: 'Singapore',
    initial: 'M',
    color: 'bg-emerald-600',
    metric: '4 min setup',
  },
];

function StarRating() {
  return (
    <div className="flex gap-0.5">
      {[...Array(5)].map((_, i) => (
        <Star key={i} className="size-3.5 fill-amber-400 text-amber-400" />
      ))}
    </div>
  );
}

export function SocialProofSection() {
  return (
    <section id="testimonials" className="relative bg-[#0F172A] py-20 md:py-28 px-6 overflow-hidden">
      {/* Grid texture */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:48px_48px]" />
      {/* Gradient accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[radial-gradient(ellipse,rgba(194,65,12,0.05),transparent_60%)]" />

      <div className="relative max-w-5xl mx-auto">
        <AnimatedSection className="text-center mb-16">
          <p className="text-sm font-medium text-[#C2410C] tracking-wide uppercase mb-3">
            From the field
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-white tracking-tight">
            Real trades. Real results.
          </h2>
          <p className="text-base text-white/40 mt-3 max-w-lg mx-auto">
            Hear from business owners who stopped losing jobs to voicemail.
          </p>
        </AnimatedSection>

        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {testimonials.map((t) => (
            <AnimatedItem key={t.name}>
              <div className="group h-full flex flex-col rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-sm transition-all duration-300 hover:bg-white/[0.05] hover:border-white/[0.1]">
                {/* Metric badge */}
                <div className="px-6 pt-6 pb-0">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#166534]/10 border border-[#166534]/20 mb-4">
                    <div className="size-1 rounded-full bg-[#166534]" />
                    <span className="text-[11px] font-medium text-[#166534]">{t.metric}</span>
                  </div>
                </div>

                {/* Quote */}
                <div className="px-6 flex-1">
                  <Quote className="size-5 text-white/10 mb-3 -scale-x-100" strokeWidth={1.5} />
                  <blockquote className="text-[15px] text-white/70 leading-relaxed">
                    {t.quote}
                  </blockquote>
                </div>

                {/* Attribution */}
                <div className="px-6 pb-6 pt-5 mt-4">
                  <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
                    <div className="flex items-center gap-3">
                      <div className={`size-9 rounded-full ${t.color} flex items-center justify-center text-sm text-white font-medium shadow-sm`}>
                        {t.initial}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{t.name}</p>
                        <p className="text-xs text-white/35">{t.role}, {t.location}</p>
                      </div>
                    </div>
                    <StarRating />
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
