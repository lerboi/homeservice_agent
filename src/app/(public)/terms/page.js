export const metadata = {
  title: 'Terms of Service — Voco',
  description: 'Terms of Service for Voco Private Limited — the AI receptionist platform for home service businesses.',
};

const LAST_UPDATED = 'March 30, 2026';

export default function TermsOfServicePage() {
  return (
    <div className="bg-[#050505] min-h-screen">
      {/* Page hero */}
      <section className="pt-32 pb-16 px-6 border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-[#F97316] font-medium uppercase tracking-widest mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Terms of Service</h1>
          <p className="text-[#71717A] text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-[#A1A1AA] text-[15px] leading-7">

          <p>
            These Terms of Service (&quot;Terms&quot;) govern your access to and use of the Voco platform and services (&quot;Service&quot;) provided by <strong className="text-[#E4E4E7] font-medium">Voco Private Limited</strong>, a company incorporated in Singapore (&quot;Voco&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;).
          </p>
          <p>
            By creating an account or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.
          </p>

          <SectionHeading>1. The Service</SectionHeading>
          <p>
            Voco provides an AI-powered telephone receptionist for home service businesses. The Service includes:
          </p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>An AI voice agent that answers inbound calls on your behalf, 24/7.</li>
            <li>Automated appointment booking and lead capture.</li>
            <li>A dashboard for managing leads, appointments, call logs, and settings.</li>
            <li>Optional integration with Google Calendar and Microsoft Outlook Calendar.</li>
            <li>SMS and email notifications for new leads and bookings.</li>
          </ul>
          <p>
            The Service is intended for business use only. You must be at least 18 years old and have authority to enter into contracts on behalf of your business.
          </p>

          <SectionHeading>2. Account Registration</SectionHeading>
          <p>
            You must provide accurate and complete information when creating an account. You are responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. Notify us immediately at{' '}
            <a href="mailto:support@voco.live" className="text-[#F97316] hover:underline">support@voco.live</a>
            {' '}if you suspect unauthorised access.
          </p>
          <p>
            One account is permitted per business. You may not share your account with third parties or create multiple accounts to circumvent usage limits.
          </p>

          <SectionHeading>3. Free Trial</SectionHeading>
          <p>
            New accounts receive a 14-day free trial with access to the full Service. No credit card is required to start the trial. At the end of the trial period, you must subscribe to a paid plan to continue using the Service. Unused trial days are not carried over or refunded.
          </p>
          <p>
            We reserve the right to limit, modify, or discontinue the free trial offering at any time.
          </p>

          <SectionHeading>4. Subscriptions and Billing</SectionHeading>
          <p>
            Paid subscriptions are billed monthly or annually in advance, depending on the plan you select. All prices are in USD unless otherwise stated.
          </p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-[#E4E4E7] font-medium">Auto-renewal</strong> — subscriptions renew automatically at the end of each billing period. You may cancel at any time from your billing settings to prevent renewal.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Overage charges</strong> — each plan includes a monthly call allowance. Calls exceeding your plan limit are billed at the per-call overage rate listed on the pricing page. Overage charges are billed at the end of the billing period.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Mid-cycle upgrades</strong> — if you upgrade your plan mid-cycle, you will be charged a prorated amount for the remainder of the current billing period, and your new plan limits apply immediately.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Downgrades</strong> — plan downgrades take effect at the start of the next billing period.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Taxes</strong> — prices exclude applicable taxes (including GST where applicable). You are responsible for any taxes applicable in your jurisdiction.</li>
          </ul>
          <p>
            Payments are processed by Stripe. By providing a payment method, you authorise Voco to charge that method for all fees due under your subscription.
          </p>

          <SectionHeading>5. Refunds and Cancellation</SectionHeading>
          <p>
            All fees are non-refundable except where required by applicable law. If you cancel your subscription, the Service will remain active until the end of the current paid billing period, after which access will be revoked.
          </p>
          <p>
            If you experience a service outage or material failure attributable to Voco and report it within 30 days, we may at our discretion provide a pro-rated service credit.
          </p>

          <SectionHeading>6. Acceptable Use</SectionHeading>
          <p>You agree not to use the Service to:</p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>Make or receive calls that are deceptive, fraudulent, harassing, or in violation of any applicable law.</li>
            <li>Impersonate any person or entity, or misrepresent your identity to callers.</li>
            <li>Transmit spam, unsolicited commercial messages, or robocalls in violation of applicable telecommunications laws.</li>
            <li>Attempt to reverse-engineer, decompile, or extract source code from the Service.</li>
            <li>Use the Service in any way that could damage, disable, overburden, or impair Voco&apos;s infrastructure.</li>
            <li>Resell or sublicense access to the Service without our prior written consent.</li>
          </ul>
          <p>
            We reserve the right to suspend or terminate your account immediately if we determine, in our sole discretion, that you have violated these requirements.
          </p>

          <SectionHeading>7. Call Recording and Compliance</SectionHeading>
          <p>
            The Service records and transcribes calls to provide its features. Voco plays a recording disclosure to callers at the start of each call. However, you are solely responsible for ensuring that your use of the Service — including call recordings, stored transcripts, and data collected from callers — complies with all applicable laws in your jurisdiction, including any laws governing:
          </p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>Telephone call recording consent (e.g., US state wiretapping laws, GDPR in the EU, PIPEDA in Canada).</li>
            <li>Telemarketing and do-not-call regulations.</li>
            <li>Consumer protection and privacy laws.</li>
          </ul>
          <p>
            Voco accepts no liability for your failure to comply with applicable laws in your jurisdiction.
          </p>

          <SectionHeading>8. AI-Generated Content</SectionHeading>
          <p>
            The Voco AI receptionist generates responses using large language models. While we design the AI to be helpful and accurate, AI-generated responses may occasionally be incorrect, incomplete, or inappropriate. You acknowledge that:
          </p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>AI responses are not a substitute for professional advice (legal, medical, financial, etc.).</li>
            <li>You remain responsible for the accuracy of information provided by your AI receptionist to callers.</li>
            <li>Voco does not guarantee that the AI will book every call or handle every inquiry correctly.</li>
          </ul>

          <SectionHeading>9. Third-Party Integrations</SectionHeading>
          <p>
            The Service integrates with third-party services including Twilio (telephony), Google Calendar, Microsoft Outlook, and Stripe. Your use of those integrations is also subject to those providers&apos; terms of service. Voco is not responsible for the availability, accuracy, or conduct of third-party services.
          </p>

          <SectionHeading>10. Intellectual Property</SectionHeading>
          <p>
            Voco retains all rights, title, and interest in the Service, including all underlying software, algorithms, models, trademarks, and content. These Terms do not grant you any ownership interest in the Service.
          </p>
          <p>
            You retain ownership of your business data (call logs, leads, appointments, and configurations) stored in your account. You grant Voco a limited licence to process that data solely to provide the Service.
          </p>

          <SectionHeading>11. Disclaimer of Warranties</SectionHeading>
          <p>
            THE SERVICE IS PROVIDED &quot;AS IS&quot; AND &quot;AS AVAILABLE&quot; WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, OR THAT ALL CALLS WILL BE SUCCESSFULLY ANSWERED OR BOOKED.
          </p>

          <SectionHeading>12. Limitation of Liability</SectionHeading>
          <p>
            TO THE FULLEST EXTENT PERMITTED BY SINGAPORE LAW, VOCO&apos;S TOTAL LIABILITY TO YOU FOR ANY CLAIM ARISING FROM OR RELATED TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE FEES YOU PAID TO VOCO IN THE THREE MONTHS IMMEDIATELY PRECEDING THE CLAIM.
          </p>
          <p>
            IN NO EVENT SHALL VOCO BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, INCLUDING LOST PROFITS, LOST REVENUE, OR MISSED BUSINESS OPPORTUNITIES, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
          </p>

          <SectionHeading>13. Indemnification</SectionHeading>
          <p>
            You agree to indemnify and hold harmless Voco Private Limited and its officers, directors, employees, and agents from any claims, losses, damages, liabilities, or expenses (including reasonable legal fees) arising from: (a) your use of the Service; (b) your violation of these Terms; (c) your violation of any applicable law; or (d) any dispute between you and a caller or third party.
          </p>

          <SectionHeading>14. Changes to the Service</SectionHeading>
          <p>
            We reserve the right to modify, suspend, or discontinue any part of the Service at any time with reasonable notice. We may update pricing or plan terms with at least 30 days&apos; written notice to subscribers. Continued use after the effective date of any change constitutes acceptance of the updated terms.
          </p>

          <SectionHeading>15. Termination</SectionHeading>
          <p>
            Either party may terminate these Terms at any time. You may cancel your subscription from your account settings. We may suspend or terminate your account immediately for breach of these Terms, fraudulent activity, or non-payment.
          </p>
          <p>
            Upon termination, your access to the Service will cease. We will retain your data for 90 days after termination, during which you may request an export. After 90 days, your data will be permanently deleted, except for billing records retained as required by law.
          </p>

          <SectionHeading>16. Governing Law and Dispute Resolution</SectionHeading>
          <p>
            These Terms are governed by the laws of Singapore. Any dispute arising from these Terms shall first be attempted to be resolved through good-faith negotiation. If unresolved within 30 days, disputes shall be submitted to the exclusive jurisdiction of the courts of Singapore.
          </p>

          <SectionHeading>17. General</SectionHeading>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-[#E4E4E7] font-medium">Entire agreement</strong> — these Terms, together with our Privacy Policy, constitute the entire agreement between you and Voco regarding the Service.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Severability</strong> — if any provision of these Terms is found invalid or unenforceable, the remaining provisions remain in full force.</li>
            <li><strong className="text-[#E4E4E7] font-medium">No waiver</strong> — failure to enforce any provision does not constitute a waiver of our right to enforce it in the future.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Assignment</strong> — you may not assign your rights or obligations under these Terms without our written consent. We may assign these Terms in connection with a merger, acquisition, or sale of assets.</li>
          </ul>

          <SectionHeading>18. Contact Us</SectionHeading>
          <p>For questions about these Terms:</p>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 space-y-1">
            <p className="text-[#E4E4E7] font-medium">Voco Private Limited</p>
            <p>Singapore</p>
            <p>
              Email:{' '}
              <a href="mailto:legal@voco.live" className="text-[#F97316] hover:underline">
                legal@voco.live
              </a>
            </p>
          </div>

        </div>
      </section>
    </div>
  );
}

function SectionHeading({ children }) {
  return (
    <h2 className="text-xl font-semibold text-white mt-12 mb-1 pt-8 border-t border-white/[0.06]">
      {children}
    </h2>
  );
}
