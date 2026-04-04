'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Phone, Calendar, FileText, ClipboardList, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

const TYPE_CONFIG = {
  call: { icon: Phone, color: 'bg-blue-50 text-blue-600', dot: 'bg-blue-400' },
  appointment: { icon: Calendar, color: 'bg-green-50 text-green-600', dot: 'bg-green-400' },
  invoice: { icon: FileText, color: 'bg-orange-50 text-[#C2410C]', dot: 'bg-[#C2410C]' },
  estimate: { icon: ClipboardList, color: 'bg-violet-50 text-violet-600', dot: 'bg-violet-400' },
};

function formatRelativeTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export default function CustomerTimeline({ phone, leadId }) {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!phone && !leadId) { setLoading(false); return; }

    async function fetchTimeline() {
      try {
        const params = new URLSearchParams();
        if (phone) params.set('phone', phone);
        if (leadId) params.set('lead_id', leadId);
        const res = await fetch(`/api/customer-timeline?${params}`);
        if (res.ok) {
          const data = await res.json();
          setEvents(data.events || []);
        }
      } catch {}
      setLoading(false);
    }

    fetchTimeline();
  }, [phone, leadId]);

  if (loading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  if (events.length === 0) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <Clock className="size-3.5 text-stone-400" />
        <h3 className="text-xs font-medium text-stone-400 uppercase tracking-wider">Customer Journey</h3>
      </div>

      <div className="relative pl-5">
        {/* Vertical line */}
        <div className="absolute left-[7px] top-1 bottom-1 w-px bg-stone-200" />

        <div className="space-y-3">
          {events.map((event, i) => {
            const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.call;
            const Icon = config.icon;
            const isLast = i === events.length - 1;

            const content = (
              <div className="flex items-start gap-3 relative">
                {/* Dot on the line */}
                <div className={`absolute -left-5 top-1.5 size-[9px] rounded-full ${config.dot} ring-2 ring-white`} />

                {/* Icon */}
                <div className={`flex items-center justify-center size-7 rounded-md shrink-0 ${config.color}`}>
                  <Icon className="size-3.5" />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-[#0F172A] truncate">{event.title}</p>
                  <div className="flex items-center gap-2">
                    {event.subtitle && (
                      <span className="text-[10px] text-stone-500">{event.subtitle}</span>
                    )}
                    <span className="text-[10px] text-stone-400">{formatRelativeTime(event.timestamp)}</span>
                  </div>
                </div>
              </div>
            );

            if (event.href) {
              return (
                <Link key={`${event.type}-${event.id}`} href={event.href} className="block hover:bg-stone-50 -mx-1 px-1 rounded transition-colors">
                  {content}
                </Link>
              );
            }

            return <div key={`${event.type}-${event.id}`}>{content}</div>;
          })}
        </div>
      </div>
    </div>
  );
}
