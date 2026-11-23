import Link from 'next/link';
import { ArrowRight, Play } from 'lucide-react';
import { buttonClasses } from '@/components/marketing/primitives';
import { BOOK_DEMO_HREF, WATCH_DEMO_HREF } from '@/data/site';

/**
 * The public site's call to action: "Book a demo" plus, optionally, "Watch
 * the demo". The same for every visitor: public pages carry no sign-in,
 * dashboard or self-serve signup link.
 *
 * @param {boolean} onInk     - true when placed on an ink (dark) section
 * @param {boolean} withWatch - also render the "Watch the demo" button
 * @param {string}  variant   - primary button variant ('primary' green, 'spark' amber)
 */
export function DemoCTA({ onInk = false, withWatch = true, size = 'lg', variant = 'primary', className = '' }) {
  const secondary = onInk ? 'secondaryOnInk' : 'secondary';

  return (
    <div className={`flex flex-wrap items-center gap-3 ${className}`}>
      <Link href={BOOK_DEMO_HREF} className={buttonClasses({ variant, size })}>
        Book a demo
        <ArrowRight className="size-4" />
      </Link>
      {withWatch && (
        <Link href={WATCH_DEMO_HREF} className={buttonClasses({ variant: secondary, size })}>
          <Play className="size-3.5" />
          Watch the demo
        </Link>
      )}
    </div>
  );
}
