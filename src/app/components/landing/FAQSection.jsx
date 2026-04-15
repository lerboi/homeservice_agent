'use client';

import { AnimatedSection } from './AnimatedSection';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { FAQChatWidget } from './FAQChatWidget';

const FAQS = [
  {
    value: 'q1',
    q: 'Does Voco sound robotic?',
    a: (
      <>
        In 2025 blind tests, 85% of callers couldn&apos;t tell Voco apart from a human receptionist. It speaks with natural pauses, handles interruptions, and matches the tone you configure.{' '}
        <a href="#audio-demo" className="text-[#F97316] underline">Hear it yourself →</a>
      </>
    ),
  },
  {
    value: 'q2',
    q: 'What happens if Voco gets a job detail wrong?',
    a: 'Every call is recorded and transcribed. You review the transcript before the job runs, and corrections take one click in the lead flyout. Voco learns from every correction you make.',
  },
  {
    value: 'q3',
    q: 'How much does Voco cost?',
    a: (
      <>
        Starter is $99/month for 40 calls. Growth is $249/month for 120 calls. Scale is $599/month for 400 calls. Annual billing saves 20%. Overage is per-call at your tier rate —{' '}
        <a href="/pricing" className="text-[#F97316] underline">see full pricing →</a>.
      </>
    ),
  },
  {
    value: 'q4',
    q: 'Does Voco actually understand my trade?',
    a: 'Voco is trained on plumbing, HVAC, electrical, handyman, and roofing language out of the box — compressor short-cycles, tripped GFCIs, flashing replacements. Custom trade vocabulary is available on request. Just tell Voco what your customers call things.',
  },
  {
    value: 'q5',
    q: 'How long does setup really take?',
    a: "The median owner is live in 4 minutes 12 seconds. Forward your number, set your hours, pick your greeting — that's it. No installations, no integrations required to start.",
  },
  {
    value: 'q6',
    q: "What happens if Voco doesn't know an answer?",
    a: "Voco says so, collects the caller's info, and either escalates to your phone on your rules or schedules a callback. You decide the escalation chain — Voco follows what you set.",
  },
  {
    value: 'q7',
    q: 'Can I listen to what Voco says on my calls?',
    a: 'Yes — every call has a full recording and transcript in your dashboard. You can search, filter, and flag calls for review. Nothing Voco does happens off-the-books.',
  },
  {
    value: 'q8',
    q: 'What languages does Voco support?',
    a: 'Voco answers calls in English, Spanish, Mandarin, Malay, Tagalog, Vietnamese, and 70+ more. It handles Singlish fluently and can code-switch mid-call — so a caller who starts in English and switches to Hokkien stays understood. No setup required; language is auto-detected per call.',
  },
  {
    value: 'q9',
    q: 'What about complex or high-ticket jobs — like a full system install quote?',
    a: "Voco captures the caller's needs, gathers key details (property size, existing system, timeline, budget range), and books a site-visit estimate with your best-qualified technician. You get a complete lead card before the callback. High-ticket call samples are on the roadmap for a follow-up update.",
  },
];

export function FAQSection() {
  return (
    <section id="faq" className="bg-white py-20 md:py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <AnimatedSection>
          <div className="text-center mb-12">
            <p className="text-[14px] font-semibold text-[#F97316] tracking-wide uppercase mb-3">
              Got questions?
            </p>
            <h2 className="text-3xl md:text-[2.25rem] font-semibold text-[#0F172A] leading-tight tracking-tight">
              Everything you&apos;ve wondered about Voco
            </h2>
          </div>
        </AnimatedSection>

        <div className="grid grid-cols-1 lg:grid-cols-[3fr_2fr] gap-12">
          {/* Accordion column */}
          <div>
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map(({ value, q, a }) => (
                <AccordionItem key={value} value={value} className="border-b border-stone-200/60">
                  <AccordionTrigger className="text-[15px] font-semibold text-[#0F172A] py-4 text-left min-h-[44px] hover:no-underline">
                    {q}
                  </AccordionTrigger>
                  <AccordionContent className="text-[15px] text-[#475569] leading-relaxed pb-4">
                    {a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>

          {/* Chat widget column */}
          <div>
            <FAQChatWidget />
          </div>
        </div>
      </div>
    </section>
  );
}
