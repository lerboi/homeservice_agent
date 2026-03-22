import { AnimatedSection } from '@/app/components/landing/AnimatedSection';
import { ContactForm } from './ContactForm';

export const metadata = {
  title: 'Contact - HomeService AI',
  description: 'Get in touch with the HomeService AI team.',
};

export default function ContactPage() {
  return (
    <>
      {/* ContactHero */}
      <section className="relative bg-[#0F172A] pt-36 pb-20 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(194,65,12,0.08)_0%,_transparent_70%)]" />
        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <AnimatedSection>
            <h1 className="text-[2.25rem] md:text-[3rem] lg:text-[3.75rem] font-semibold text-white tracking-tight leading-[1.1]">
              Get in Touch
            </h1>
            <p className="mt-6 text-lg text-white/60">
              Have a question about HomeService AI? We&apos;d love to hear from you.
            </p>
            <p className="mt-3 text-sm text-[#C2410C] font-medium">
              We respond within 24 hours
            </p>
          </AnimatedSection>
        </div>
      </section>

      {/* ContactFormSection */}
      <section className="bg-[#F5F5F4] py-20">
        <div className="max-w-xl mx-auto px-6">
          <AnimatedSection>
            <ContactForm />
          </AnimatedSection>
        </div>
      </section>
    </>
  );
}
