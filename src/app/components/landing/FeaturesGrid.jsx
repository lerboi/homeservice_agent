import { Moon, Filter, Calendar, Bell } from 'lucide-react';
import { AnimatedStagger, AnimatedItem } from './AnimatedSection';

const features = [
  {
    icon: Moon,
    title: 'The Night Shift, Sorted',
    body: '24/7 AI answering. No voicemail. No missed leads. No excuses.',
    justification: 'One $3,000 emergency booking at 2 AM covers your entire month.',
    gradient: 'from-indigo-500/10 to-indigo-500/5',
    iconBg: 'bg-indigo-500/10',
    iconColor: 'text-indigo-500',
  },
  {
    icon: Filter,
    title: 'The Golden Lead Filter',
    body: 'Every call is triaged — burst pipe or quote for next month. You know before you call back.',
    justification: 'Stop wasting call-back time on tire-kickers.',
    gradient: 'from-amber-500/10 to-amber-500/5',
    iconBg: 'bg-amber-500/10',
    iconColor: 'text-amber-600',
  },
  {
    icon: Calendar,
    title: 'Money in the Calendar',
    body: 'Emergency calls lock a slot while the caller is still on the line. No back-and-forth.',
    justification: "Booked means committed. Leads don't cool off.",
    gradient: 'from-emerald-500/10 to-emerald-500/5',
    iconBg: 'bg-emerald-500/10',
    iconColor: 'text-emerald-600',
  },
  {
    icon: Bell,
    title: 'Instant Emergency SMS',
    body: "When a burst pipe or gas smell comes in, you get a text in seconds — not the next morning.",
    justification: 'Be first on site. Not fastest to call back.',
    gradient: 'from-rose-500/10 to-rose-500/5',
    iconBg: 'bg-rose-500/10',
    iconColor: 'text-rose-500',
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="bg-white py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-16">
          <p className="text-sm font-medium text-[#C2410C] tracking-wide uppercase mb-3">
            Why it pays for itself
          </p>
          <h2 className="text-3xl md:text-4xl font-semibold text-[#0F172A] tracking-tight">
            Four features. One question:
            <br className="hidden sm:block" />
            <span className="text-[#475569]">How much did your last missed call cost?</span>
          </h2>
        </div>

        <AnimatedStagger className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <AnimatedItem key={feature.title}>
                <div className={`group relative rounded-2xl border border-black/[0.04] bg-gradient-to-br ${feature.gradient} p-6 md:p-8 transition-all duration-300 hover:shadow-[0_8px_30px_-12px_rgba(0,0,0,0.12)] hover:-translate-y-0.5`}>
                  {/* Icon */}
                  <div className={`inline-flex size-11 items-center justify-center rounded-xl ${feature.iconBg} mb-4`}>
                    <Icon className={`size-5 ${feature.iconColor}`} strokeWidth={1.75} />
                  </div>

                  <h3 className="text-lg font-semibold text-[#0F172A] mb-2">
                    {feature.title}
                  </h3>
                  <p className="text-[15px] text-[#475569] leading-relaxed mb-4">
                    {feature.body}
                  </p>

                  {/* Justification line */}
                  <div className="flex items-center gap-2 pt-4 border-t border-black/[0.04]">
                    <div className="size-1.5 rounded-full bg-[#166534]" />
                    <p className="text-sm font-medium text-[#166534]">
                      {feature.justification}
                    </p>
                  </div>
                </div>
              </AnimatedItem>
            );
          })}
        </AnimatedStagger>
      </div>
    </section>
  );
}
