import { Moon, Filter, Calendar, Bell } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AnimatedSection } from './AnimatedSection';

const features = [
  {
    icon: Moon,
    title: 'The Night Shift, Sorted',
    body: '24/7 AI answering. No voicemail. No missed leads. No excuses.',
    justification: 'One $3,000 emergency booking at 2 AM covers a month.',
    delay: 0,
  },
  {
    icon: Filter,
    title: 'The Golden Lead Filter',
    body: 'Every call is triaged — burst pipe or quote for next month. You know before you call back.',
    justification: 'Stop wasting call-back time on tire-kickers.',
    delay: 0.08,
  },
  {
    icon: Calendar,
    title: 'Money in the Calendar',
    body: 'Emergency calls lock a slot while the caller is still on the line. No back-and-forth.',
    justification: "Booked means committed. Leads don't cool off.",
    delay: 0.16,
  },
  {
    icon: Bell,
    title: 'Instant Emergency SMS',
    body: 'When a burst pipe or gas smell comes in, you get a text in seconds — not the morning.',
    justification: 'Be first. Not fastest to call back.',
    delay: 0.24,
  },
];

export function FeaturesGrid() {
  return (
    <section id="features" className="bg-landing-surface py-16 md:py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-semibold text-center mb-12 text-landing-dark">
          Four Reasons This Pays for Itself
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <AnimatedSection key={feature.title} delay={feature.delay}>
                <Card className="p-6 border-0 shadow-md">
                  <CardContent className="p-0">
                    <Icon className="size-6 mb-3 text-landing-accent" aria-hidden="true" />
                    <h3 className="text-xl font-semibold mb-2 text-landing-dark">{feature.title}</h3>
                    <p className="text-landing-muted mb-3">{feature.body}</p>
                    <p className="text-sm text-landing-success font-medium">{feature.justification}</p>
                  </CardContent>
                </Card>
              </AnimatedSection>
            );
          })}
        </div>
      </div>
    </section>
  );
}
