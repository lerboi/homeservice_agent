import { Card } from '@/components/ui/card';
import { AnimatedSection } from './AnimatedSection';

const testimonials = [
  {
    quote:
      'I was losing $4k a month in missed calls. First week with HomeService AI, I booked two emergency jobs at midnight.',
    attribution: '— Dave R., Master Plumber, Auckland',
    delay: 0,
  },
  {
    quote:
      "The triage alone is worth it. I know before I pick up whether it's a burst pipe or someone wanting a quote for three months from now.",
    attribution: '— James K., HVAC Owner, Brisbane',
    delay: 0.08,
  },
  {
    quote:
      'Setup took four minutes. I heard my AI answer my own test call and nearly fell off my chair.',
    attribution: '— Mark T., Electrician, Singapore',
    delay: 0.16,
  },
];

export function SocialProofSection() {
  return (
    <section id="testimonials" className="bg-landing-dark py-16 md:py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-semibold text-center mb-12 text-white">
          What Trades Owners Are Saying
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {testimonials.map((testimonial) => (
            <AnimatedSection key={testimonial.attribution} delay={testimonial.delay}>
              <Card className="bg-white/10 border-white/20 text-white">
                <div className="px-6 pb-6">
                  <p className="text-base leading-relaxed mb-4">&ldquo;{testimonial.quote}&rdquo;</p>
                  <p className="text-sm text-white/60 font-medium">{testimonial.attribution}</p>
                </div>
              </Card>
            </AnimatedSection>
          ))}
        </div>
      </div>
    </section>
  );
}
