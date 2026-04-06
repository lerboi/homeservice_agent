'use client';

import * as Accordion from '@radix-ui/react-accordion';
import { ChevronDown } from 'lucide-react';

/**
 * GlossaryFAQ — light-surface FAQ accordion for glossary detail pages.
 * Uses light styling (border-stone-200, text-[#0F172A]) instead of the
 * dark-surface FAQSection used on the pricing page.
 *
 * @param {{ items: Array<{ q: string, a: string }> }} props
 */
export function GlossaryFAQ({ items }) {
  if (!items || items.length === 0) return null;

  return (
    <Accordion.Root type="single" collapsible className="w-full">
      {items.map((item, index) => (
        <Accordion.Item
          key={index}
          value={`faq-${index}`}
          className="border-b border-stone-200"
        >
          <Accordion.Trigger className="flex items-center justify-between w-full py-4 text-left text-[#0F172A] font-semibold text-base group min-h-[44px]">
            {item.q}
            <ChevronDown className="size-5 text-[#F97316] transition-transform duration-200 group-data-[state=open]:rotate-180 shrink-0 ml-4" />
          </Accordion.Trigger>
          <Accordion.Content className="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
            <p className="text-[#475569] text-[15px] leading-relaxed pb-5">
              {item.a}
            </p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
