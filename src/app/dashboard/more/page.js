'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { card } from '@/lib/design-tokens';
import {
  Wrench,
  Clock,
  MapPin,
  PhoneCall,
  Bot,
  Bell,
  CreditCard,
  UserCircle,
  ChevronRight,
  BarChart3,
  FileText,
} from 'lucide-react';

const MORE_ITEMS = [
  { href: '/dashboard/more/services-pricing', label: 'Services & Pricing', description: 'Manage your service list and urgency tags', icon: Wrench },
  { href: '/dashboard/more/working-hours', label: 'Working Hours', description: 'Set your weekly availability schedule', icon: Clock },
  { href: '/dashboard/more/service-zones', label: 'Service Zones & Travel', description: 'Define coverage areas and travel buffers', icon: MapPin },
  { href: '/dashboard/more/escalation-contacts', label: 'Escalation Contacts', description: 'Set up your emergency contact chain', icon: PhoneCall },
  { href: '/dashboard/more/notifications', label: 'Notifications', description: 'SMS and email alerts per call outcome', icon: Bell },
  { href: '/dashboard/more/billing', label: 'Billing', description: 'Plan, usage, and invoices', icon: CreditCard },
  { href: '/dashboard/analytics', label: 'Analytics', description: 'View call volume and performance trends', icon: BarChart3 },
  { href: '/dashboard/more/invoice-settings', label: 'Invoice Settings', description: 'Business info, tax rate, and invoice numbering', icon: FileText },
  { href: '/dashboard/more/ai-voice-settings', label: 'AI & Voice Settings', description: 'Phone number, AI tone, and test call', icon: Bot },
  { href: '/dashboard/more/account', label: 'Account', description: 'Profile and account management', icon: UserCircle },
];

export default function MorePage() {
  return (
    <div data-tour="more-page">
      <h1 className="text-xl font-semibold text-[#0F172A] mb-4">More</h1>
      <div className={`${card.base} divide-y divide-stone-100 overflow-hidden`}>
        {MORE_ITEMS.map((item, i) => {
          const Icon = item.icon;
          return (
            <motion.div
              key={item.href}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.03, ease: 'easeOut' }}
            >
              <Link
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
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
