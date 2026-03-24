import { Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

export function EmptyStateCalendar({ padding = 'py-16' }) {
  return (
    <div className={`flex flex-col items-center justify-center ${padding} text-center`}>
      <Calendar className="h-10 w-10 text-stone-300 mb-4" aria-hidden="true" />
      <h2 className="text-base font-semibold text-[#0F172A] mb-2">No appointments yet</h2>
      <p className="text-sm text-[#475569] max-w-sm mb-6">
        When your AI books jobs, confirmed appointments appear here with job details and time slots.
      </p>
      <Button asChild>
        <Link href="/dashboard/settings#calendar">Connect Calendar</Link>
      </Button>
    </div>
  );
}
