import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { UserPlus, MessageSquare, CalendarCheck, Repeat, BarChart3 } from 'lucide-react';

const ITEMS = [
  {
    icon: UserPlus,
    label: 'CRM lead created',
    desc: 'Caller details, job type, and urgency land in your pipeline the moment the call ends.',
  },
  {
    icon: MessageSquare,
    label: 'SMS + email sent',
    desc: 'You get notified instantly. The caller gets a confirmation text with their booking.',
  },
  {
    icon: CalendarCheck,
    label: 'Calendar synced',
    desc: 'Google or Outlook updated in under 60 seconds so your next job never collides.',
  },
  {
    icon: Repeat,
    label: 'Recurring slot reserved',
    desc: 'Maintenance contracts auto-spawn future appointments without you lifting a finger.',
  },
  {
    icon: BarChart3,
    label: 'Analytics updated',
    desc: 'Revenue, conversion, and missed-call metrics refresh live on your dashboard.',
  },
];

export function AfterTheCallStrip() {
  return (
    <section id="after-call" className="bg-white py-12 md:py-16 px-6">
      <div className="relative z-[1] max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <p className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">
              After the call
            </p>
            <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] leading-tight tracking-tight">
              What Voco keeps doing after the call ends
            </h2>
          </div>
        </AnimatedSection>
        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-5 gap-8 md:gap-6">
          {ITEMS.map(({ icon: Icon, label, desc }) => (
            <AnimatedItem key={label}>
              <div className="flex flex-col items-center text-center gap-3">
                <Icon className="w-6 h-6 text-[#F97316]" strokeWidth={2} aria-hidden="true" />
                <p className="text-[14px] font-semibold text-[#0F172A]">{label}</p>
                <p className="text-[14px] text-[#475569] leading-relaxed">{desc}</p>
              </div>
            </AnimatedItem>
          ))}
        </AnimatedStagger>
      </div>
    </section>
  );
}
