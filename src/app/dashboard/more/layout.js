'use client';

import { usePathname } from 'next/navigation';
import MoreBackButton from '@/components/dashboard/MoreBackButton';

export default function MoreLayout({ children }) {
  const pathname = usePathname();
  // Show back button on sub-pages (not on /dashboard/more itself)
  const isSubPage = pathname !== '/dashboard/more' && pathname !== '/dashboard/more/';

  return (
    <div>
      {isSubPage && <MoreBackButton />}
      {children}
    </div>
  );
}
