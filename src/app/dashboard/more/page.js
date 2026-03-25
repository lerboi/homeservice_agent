'use client';

import Link from 'next/link';
import { card } from '@/lib/design-tokens';
import {
  Wrench,
  Clock,
  CalendarSync,
  MapPin,
  PhoneCall,
  Bot,
  UserCircle,
  ChevronRight,
} from 'lucide-react';

const MORE_ITEMS = [
  { href: '/dashboard/more/services-pricing', label: 'Services & Pricing', description: 'Manage your service list and urgency tags', icon: Wrench },
  { href: '/dashboard/more/working-hours', label: 'Working Hours', description: 'Set your weekly availability schedule', icon: Clock },
  { href: '/dashboard/more/calendar-connections', label: 'Calendar Connections', description: 'Connect Google or Outlook calendars', icon: CalendarSync },
  { href: '/dashboard/more/service-zones', label: 'Service Zones & Travel', description: 'Define coverage areas and travel buffers', icon: MapPin },
  { href: '/dashboard/more/escalation-contacts', label: 'Escalation Contacts', description: 'Set up your emergency contact chain', icon: PhoneCall },
  { href: '/dashboard/more/ai-voice-settings', label: 'AI & Voice Settings', description: 'Phone number, AI tone, and test call', icon: Bot },
  { href: '/dashboard/more/account', label: 'Account', description: 'Profile and account management', icon: UserCircle },
];

export default function MorePage() {
  return (
    <div data-tour="more-page">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">More</h1>
      <div className={`${card.base} divide-y divide-stone-100 overflow-hidden`}>
        {MORE_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-4 px-5 py-4 hover:bg-stone-50 transition-colors min-h-[48px]"
            >
              <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-stone-100 shrink-0">
                <Icon className="h-5 w-5 text-[#475569]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[#0F172A]">{item.label}</p>
                <p className="text-xs text-[#475569] truncate">{item.description}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-stone-400 shrink-0" />
            </Link>
          );
        })}
      </div>
    </div>
  );
}
