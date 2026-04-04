export const metadata = {
  title: 'Privacy Policy — Voco',
  description: 'How Voco Private Limited collects, uses, and protects your personal data.',
};

const LAST_UPDATED = 'March 30, 2026';

export default function PrivacyPolicyPage() {
  return (
    <div className="bg-[#050505] min-h-screen">
      {/* Page hero */}
      <section className="pt-32 pb-16 px-6 border-b border-white/[0.06]">
        <div className="max-w-3xl mx-auto">
          <p className="text-sm text-[#F97316] font-medium uppercase tracking-widest mb-4">Legal</p>
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">Privacy Policy</h1>
          <p className="text-[#71717A] text-sm">Last updated: {LAST_UPDATED}</p>
        </div>
      </section>

      {/* Content */}
      <section className="py-16 px-6">
        <div className="max-w-3xl mx-auto space-y-6 text-[#A1A1AA] text-[15px] leading-7">

          <p>
            Voco Private Limited (&quot;Voco&quot;, &quot;we&quot;, &quot;our&quot;, or &quot;us&quot;) is incorporated in Singapore. We operate an AI-powered receptionist platform for home service businesses accessible at voco.live.
          </p>
          <p>
            This Privacy Policy explains how we collect, use, disclose, and protect personal data in accordance with Singapore&apos;s <strong className="text-[#E4E4E7] font-medium">Personal Data Protection Act 2012 (PDPA)</strong>. By using our services, you consent to the practices described below.
          </p>

          <SectionHeading>1. Data We Collect</SectionHeading>
          <SubHeading>From business owners (subscribers)</SubHeading>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-[#E4E4E7] font-medium">Account data</strong> — name, email address, business name, trade type, business address, and phone number provided during sign-up and onboarding.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Billing data</strong> — payment method details processed by Stripe. We do not store full card numbers.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Configuration data</strong> — working hours, service zones, escalation contacts, and calendar credentials you provide to configure the AI receptionist.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Usage data</strong> — call logs, appointment records, lead records, and analytics generated through your use of the platform.</li>
          </ul>
          <SubHeading>From callers (your customers)</SubHeading>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-[#E4E4E7] font-medium">Call data</strong> — name, phone number, service address, and job description shared during an AI-answered call.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Call recordings and transcripts</strong> — recordings of calls handled by the AI receptionist. Callers are informed of recording at the start of each call.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Appointment data</strong> — booking details created during a call, including date, time, and service address.</li>
          </ul>
          <SubHeading>Automatically collected</SubHeading>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-[#E4E4E7] font-medium">Log data</strong> — IP address, browser type, pages visited, and timestamps when you access our website or dashboard.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Cookies</strong> — session cookies required for authentication. We do not use advertising or third-party tracking cookies.</li>
          </ul>

          <SectionHeading>2. How We Use Your Data</SectionHeading>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li>Provide and operate the AI receptionist service, including answering calls, booking appointments, and sending notifications.</li>
            <li>Process billing and manage your subscription through Stripe.</li>
            <li>Send transactional emails (lead alerts, booking confirmations, account notifications) via Resend.</li>
            <li>Sync appointments with connected Google or Outlook calendars at your direction.</li>
            <li>Improve service quality, diagnose errors, and monitor platform performance.</li>
            <li>Comply with legal obligations and enforce our Terms of Service.</li>
          </ul>
          <p>We do not sell your personal data or your customers&apos; personal data to any third party.</p>

          <SectionHeading>3. Third-Party Service Providers</SectionHeading>
          <p>
            We share data with trusted third-party sub-processors solely to operate the platform. These providers handle functions such as database hosting, authentication, telephony, AI processing, payment processing, email delivery, calendar synchronisation, error monitoring, and application hosting. Each sub-processor is bound by data processing agreements and their own privacy policies.
          </p>
          <p>
            Some of our service providers are based outside Singapore. By using our services, you consent to the transfer of your data to these providers in accordance with the PDPA&apos;s cross-border transfer obligations.
          </p>
          <p>
            For a full list of our sub-processors, please contact us at{' '}
            <a href="mailto:support@voco.live" className="text-[#F97316] hover:underline">support@voco.live</a>.
          </p>

          <SectionHeading>4. Call Recordings and AI Processing</SectionHeading>
          <p>
            The Voco AI receptionist records and transcribes inbound calls to provide the service. A disclosure is played to callers at the beginning of every call. As the business owner (subscriber), you are responsible for ensuring your use of call recordings complies with applicable laws in your jurisdiction, including any additional consent requirements.
          </p>
          <p>
            AI-generated responses during calls are produced by Google&apos;s Gemini model. Audio is processed in real time and is not permanently retained by Google beyond the session.
          </p>

          <SectionHeading>5. Data Retention</SectionHeading>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-[#E4E4E7] font-medium">Account data</strong> — retained for the duration of your subscription and for 90 days after account closure, then permanently deleted.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Call recordings and transcripts</strong> — retained for 12 months from the date of the call, then deleted.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Billing records</strong> — retained for 7 years as required by Singapore&apos;s accounting and tax regulations.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Log data</strong> — retained for 30 days.</li>
          </ul>

          <SectionHeading>6. Your Rights Under the PDPA</SectionHeading>
          <p>As an individual whose personal data we hold, you have the right to:</p>
          <ul className="list-disc list-outside ml-5 space-y-2">
            <li><strong className="text-[#E4E4E7] font-medium">Access</strong> — request a copy of the personal data we hold about you.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Correction</strong> — request that we correct inaccurate or incomplete personal data.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Withdrawal of consent</strong> — withdraw consent to collection, use, or disclosure of your personal data at any time. Note that withdrawal may affect your ability to use the service.</li>
            <li><strong className="text-[#E4E4E7] font-medium">Data portability</strong> — request your account data in a machine-readable format where technically feasible.</li>
          </ul>
          <p>
            To exercise any of these rights, email us at{' '}
            <a href="mailto:support@voco.live" className="text-[#F97316] hover:underline">support@voco.live</a>.
            We will respond within 30 days.
          </p>

          <SectionHeading>7. Security</SectionHeading>
          <p>
            We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, row-level security policies on our database, and access controls limiting data access to authorised personnel only. Despite these measures, no system is entirely secure. If you become aware of a security concern, please contact{' '}
            <a href="mailto:support@voco.live" className="text-[#F97316] hover:underline">support@voco.live</a>.
          </p>

          <SectionHeading>8. Children&apos;s Privacy</SectionHeading>
          <p>
            Our services are not directed at individuals under 18 years of age. We do not knowingly collect personal data from minors. If you believe a minor has provided us with personal data, please contact us and we will delete it promptly.
          </p>

          <SectionHeading>9. Changes to This Policy</SectionHeading>
          <p>
            We may update this Privacy Policy from time to time. When we do, we will revise the &quot;Last updated&quot; date at the top of this page. For material changes, we will notify subscribers by email at least 14 days before the change takes effect. Continued use of the service after the effective date constitutes acceptance of the updated policy.
          </p>

          <SectionHeading>10. Contact Us</SectionHeading>
          <p>For privacy-related enquiries or to exercise your rights:</p>
          <div className="bg-white/[0.03] border border-white/[0.08] rounded-xl p-6 not-italic space-y-1">
            <p className="text-[#E4E4E7] font-medium">Voco Private Limited</p>
            <p>Singapore</p>
            <p>
              Email:{' '}
              <a href="mailto:support@voco.live" className="text-[#F97316] hover:underline">
                support@voco.live
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

function SubHeading({ children }) {
  return (
    <h3 className="text-base font-semibold text-[#E4E4E7] mt-6 mb-1">
      {children}
    </h3>
  );
}
