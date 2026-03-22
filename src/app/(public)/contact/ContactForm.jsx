'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function ContactForm() {
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setIsPending(true);
    const form = e.target;
    const body = {
      name: form.name.value.trim(),
      email: form.email.value.trim(),
      inquiryType: form.inquiryType.value,
      message: form.message.value.trim(),
      _honeypot: form._honeypot.value,
    };

    // Client-side validation
    if (!body.name || !body.email || !body.inquiryType || !body.message) {
      toast.error('Please fill in all required fields.');
      setIsPending(false);
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) {
      toast.error('Please enter a valid email address.');
      setIsPending(false);
      return;
    }

    try {
      const res = await fetch('/api/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed');
      toast.success("Message sent. We'll reply within 24 hours.");
      form.reset();
    } catch {
      toast.error('Something went wrong. Please try again or email us directly.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 relative">
      {/* Honeypot -- invisible to users and screen readers */}
      <input
        type="text"
        name="_honeypot"
        aria-hidden="true"
        tabIndex={-1}
        autoComplete="off"
        className="absolute opacity-0 top-0 left-0 h-0 w-0 overflow-hidden"
      />

      {/* Name */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-[#0F172A] mb-2">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-lg border border-[#0F172A]/10 bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#475569]/50 focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30 transition-shadow"
          placeholder="Your full name"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-[#0F172A] mb-2">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-[#0F172A]/10 bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#475569]/50 focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30 transition-shadow"
          placeholder="you@company.com"
        />
      </div>

      {/* Inquiry Type */}
      <div>
        <label htmlFor="inquiryType" className="block text-sm font-medium text-[#0F172A] mb-2">Inquiry Type</label>
        <select
          id="inquiryType"
          name="inquiryType"
          required
          defaultValue=""
          className="w-full rounded-lg border border-[#0F172A]/10 bg-white px-4 py-3 text-sm text-[#0F172A] focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30 transition-shadow appearance-none"
        >
          <option value="" disabled>Select an inquiry type</option>
          <option value="sales">Sales</option>
          <option value="support">Support</option>
          <option value="partnerships">Partnerships</option>
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-[#0F172A] mb-2">Message</label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full rounded-lg border border-[#0F172A]/10 bg-white px-4 py-3 text-sm text-[#0F172A] placeholder:text-[#475569]/50 focus:outline-none focus:ring-2 focus:ring-[#C2410C]/30 transition-shadow resize-y"
          placeholder="How can we help?"
        />
      </div>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full bg-[#C2410C] text-white hover:bg-[#C2410C]/90 shadow-[0_4px_16px_0_rgba(194,65,12,0.4)] min-h-[44px] text-base font-medium rounded-lg disabled:opacity-50"
      >
        {isPending ? <><Loader2 className="size-4 animate-spin mr-2" />Sending...</> : 'Send Message'}
      </Button>
    </form>
  );
}
