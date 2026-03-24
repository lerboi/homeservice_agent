'use client';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

const FAQ_ITEMS = [
  {
    q: 'Can I cancel anytime?',
    a: "Absolutely. There are no lock-in contracts. Cancel from your dashboard settings at any time, and your service stops at the end of the current billing period. No cancellation fees, no hoops to jump through.",
  },
  {
    q: 'What happens if I exceed my call limit?',
    a: "We don't cut you off mid-month. Calls beyond your plan limit are billed at a transparent per-call overage rate shown on your invoice. You can upgrade your plan anytime to get a better per-call rate.",
  },
  {
    q: 'Is there a free trial?',
    a: "Yes. Every plan comes with a 14-day free trial -- no credit card required. You'll have your AI receptionist answering calls within 5 minutes of signing up.",
  },
  {
    q: 'What is your refund policy?',
    a: "We offer a 30-day money-back guarantee. If Voco doesn't pay for itself within the first month, we'll refund your subscription -- no questions asked.",
  },
];

export default function FAQSection() {
  return (
    <AnimatedSection direction="up">
      <Accordion.Root type="single" collapsible className="space-y-3 max-w-3xl mx-auto">
        {FAQ_ITEMS.map((item, index) => (
          <Accordion.Item
            key={index}
            value={`item-${index}`}
            className="border-b border-white/[0.08]"
          >
            <Accordion.Trigger className="flex items-center justify-between w-full py-5 text-left text-[#F1F5F9] font-semibold text-lg group min-h-[44px]">
              {item.q}
              <ChevronDown className="size-5 text-[#C2410C] transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0 ml-4" />
            </Accordion.Trigger>
            <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <p className="text-[#94A3B8] text-[15px] leading-relaxed pb-5">
                {item.a}
              </p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </AnimatedSection>
  );
}
