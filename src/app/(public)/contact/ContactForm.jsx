'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Loader2 } from 'lucide-react';

export function ContactForm() {
  const [isPending, setIsPending] = useState(false);
  const searchParams = useSearchParams();
  const requestedType = searchParams.get('type') || '';
  const preselectedType = ['sales', 'support', 'partnerships'].includes(requestedType) ? requestedType : 'sales';

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
      toast.success("Message sent. We'll reply within one business day.");
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
        <label htmlFor="name" className="block text-sm font-medium text-mk-ink mb-2">Name</label>
        <input
          id="name"
          name="name"
          type="text"
          required
          className="w-full rounded-lg border border-mk-ink/15 bg-white px-4 py-3 text-sm text-mk-ink placeholder:text-mk-faint focus:outline-none focus:border-mk-signal-deep focus:shadow-[0_0_0_3px_rgba(0,179,126,0.2)] transition-all"
          placeholder="Your full name"
        />
      </div>

      {/* Email */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-mk-ink mb-2">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          required
          className="w-full rounded-lg border border-mk-ink/15 bg-white px-4 py-3 text-sm text-mk-ink placeholder:text-mk-faint focus:outline-none focus:border-mk-signal-deep focus:shadow-[0_0_0_3px_rgba(0,179,126,0.2)] transition-all"
          placeholder="you@company.com"
        />
      </div>

      {/* Inquiry Type */}
      <div>
        <label htmlFor="inquiryType" className="block text-sm font-medium text-mk-ink mb-2">Topic</label>
        <select
          id="inquiryType"
          name="inquiryType"
          required
          defaultValue={preselectedType}
          className="w-full rounded-lg border border-mk-ink/15 bg-white px-4 py-3 text-sm text-mk-ink focus:outline-none focus:border-mk-signal-deep focus:shadow-[0_0_0_3px_rgba(0,179,126,0.2)] transition-all appearance-none"
        >
          <option value="" disabled >What is this about?</option>
          <option value="sales">Book a demo</option>
          <option value="support">Support</option>
          <option value="partnerships">Partnerships</option>
        </select>
      </div>

      {/* Message */}
      <div>
        <label htmlFor="message" className="block text-sm font-medium text-mk-ink mb-2">Message</label>
        <textarea
          id="message"
          name="message"
          required
          rows={5}
          className="w-full rounded-lg border border-mk-ink/15 bg-white px-4 py-3 text-sm text-mk-ink placeholder:text-mk-faint focus:outline-none focus:border-mk-signal-deep focus:shadow-[0_0_0_3px_rgba(0,179,126,0.2)] transition-all resize-y"
          placeholder="What do callers ring you about, and which systems should the agent work in?"
        />
      </div>

      {/* Response time SLA */}
      <p className="text-sm text-mk-muted">We reply within one business day.</p>

      {/* Submit */}
      <Button
        type="submit"
        disabled={isPending}
        aria-busy={isPending}
        className="w-full bg-mk-signal text-mk-ink hover:bg-[#00C48A] min-h-[48px] text-base font-medium rounded-full disabled:opacity-50"
      >
        {isPending ? <><Loader2 className="size-4 animate-spin mr-2" />Sending...</> : 'Send'}
      </Button>
    </form>
  );
}
