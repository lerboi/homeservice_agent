'use client';
import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

const FAQ_ITEMS = [
  {
    q: 'How long does setup take?',
    a: "Under 5 minutes. You'll enter your business name, choose your trade, and hear your AI receptionist answer a real call — all before your first coffee break. No technical skills needed.",
  },
  {
    q: 'Do I need any technical skills to use Voco?',
    a: "None at all. If you can fill out a form on your phone, you can set up Voco. We handle the AI, the phone number, and the call routing — you just show up for the jobs.",
  },
  {
    q: 'Can callers tell they\'re talking to an AI?',
    a: "Some might sense it, but most don't stop to ask. What matters is that your phone gets answered in one ring, every time, with your business name and a professional tone. Callers care more about being helped than who's helping.",
  },
  {
    q: 'What if the AI gets confused on a call?',
    a: "Voco is built for this. If a caller asks something outside the AI's scope, it captures their info and routes the call to you with a full summary. You never lose a lead — even on edge cases.",
  },
  {
    q: 'How does the 14-day trial work?',
    a: "Sign up, complete the 5-minute setup, and your AI receptionist starts answering calls immediately. You have 14 full days to evaluate Voco with real calls. No payment required to start.",
  },
  {
    q: 'Can I cancel anytime?',
    a: "Yes. No lock-in contracts. Cancel from your dashboard settings at any time, and your service stops at the end of the current billing period. No cancellation fees.",
  },
  {
    q: 'What happens if I go over my call limit?',
    a: "We don't cut you off mid-month. Calls beyond your plan limit are charged at a transparent per-call overage rate shown on your invoice. Only calls lasting 20 seconds or more count toward your limit — quick hang-ups and wrong numbers are always free. You can upgrade anytime to get a better per-call rate.",
  },
  {
    q: 'What happens if I upgrade mid-cycle?',
    a: "You only pay the difference. If you're on Starter and upgrade to Growth halfway through your billing period, we prorate the cost — you're only charged for the remaining time at the new rate, minus what you've already paid. No double-charging, no surprises.",
  },
  {
    q: 'Where are call recordings stored? Who can access them?',
    a: "Recordings are stored on encrypted servers in the US. Only your account can access your recordings and transcripts — no one else sees your call data. Voco does not share or sell your data.",
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
            <Accordion.Trigger className="flex items-center justify-between w-full py-5 text-left text-white font-semibold text-lg group min-h-[44px]">
              {item.q}
              <ChevronDown className="size-5 text-[#F97316] transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0 ml-4" />
            </Accordion.Trigger>
            <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
              <p className="text-white/60 text-[15px] leading-relaxed pb-5">
                {item.a}
              </p>
            </Accordion.Content>
          </Accordion.Item>
        ))}
      </Accordion.Root>
    </AnimatedSection>
  );
}
