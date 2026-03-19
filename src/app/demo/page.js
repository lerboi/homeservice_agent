import Link from 'next/link';
import { Button } from '@/components/ui/button';

export default function DemoPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-landing-surface px-6">
      <h1 className="text-3xl font-semibold text-landing-dark mb-4">Demo Coming Soon</h1>
      <p className="text-landing-muted mb-8 text-center max-w-md">
        We&apos;re putting together a walkthrough of HomeService AI in action. In the meantime, the fastest
        way to see it is to try it yourself.
      </p>
      <Button
        asChild
        size="lg"
        className="bg-landing-accent text-white hover:bg-landing-accent/90 min-h-[44px]"
      >
        <Link href="/onboarding">Start My 5-Minute Setup</Link>
      </Button>
    </div>
  );
}
