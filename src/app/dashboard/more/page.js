'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { card } from '@/lib/design-tokens';
import { useFeatureFlags } from '@/components/FeatureFlagsProvider';
import {
  Wrench,
  Clock,
  MapPin,
  Bot,
  Bell,
  PhoneForwarded,
  CreditCard,
  UserCircle,
  ChevronRight,
  FileText,
  Plug,
  ClipboardList,
  MessageSquare,
  Zap,
} from 'lucide-react';

const QUICK_ACCESS = [
  { href: '/dashboard/invoices', label: 'Invoices', description: 'Create and manage invoices', icon: FileText },
  { href: '/dashboard/estimates', label: 'Estimates', description: 'Create and manage estimates', icon: ClipboardList },
];

const MORE_ITEMS = [
  { href: '/dashboard/more/services-pricing', label: 'Services & Pricing', description: 'Manage your service list and urgency tags', icon: Wrench },
  { href: '/dashboard/more/working-hours', label: 'Working Hours', description: 'Set your weekly availability schedule', icon: Clock },
  { href: '/dashboard/more/service-zones', label: 'Service Zones & Travel', description: 'Define coverage areas and travel buffers', icon: MapPin },
  { href: '/dashboard/more/notifications', label: 'Notifications & Escalation', description: 'Alerts per call outcome and emergency contact chain', icon: Bell },
  { href: '/dashboard/more/call-routing', label: 'Call Routing', description: 'Forward calls on a schedule and set priority callers who always ring through', icon: PhoneForwarded },
  { href: '/dashboard/more/billing', label: 'Billing', description: 'Plan, usage, and invoices', icon: CreditCard },
  { href: '/dashboard/more/features', label: 'Features', description: 'Turn optional capabilities on or off', icon: Zap },
  { href: '/dashboard/more/invoice-settings', label: 'Invoice Settings', description: 'Business info, tax rate, and invoice numbering', icon: FileText },
  { href: '/dashboard/more/integrations', label: 'Integrations', description: 'Connect accounting software for invoice sync', icon: Plug },
  { href: '/dashboard/more/ai-voice-settings', label: 'AI & Voice Settings', description: 'Phone number, AI tone, and test call', icon: Bot },
  { href: '/dashboard/more/account', label: 'Account', description: 'Profile and account management', icon: UserCircle },
];

export default function MorePage() {
  const { invoicing } = useFeatureFlags();

  // Compute filtered lists once per render (Phase 53-06 UI hide layer)
  const visibleQuickAccess = invoicing ? QUICK_ACCESS : [];
  const visibleMoreItems = MORE_ITEMS.filter((item) => {
    if (!invoicing && (
      item.href === '/dashboard/more/invoice-settings' ||
      item.href === '/dashboard/more/integrations'
    )) return false;
    return true;
  });

  return (
    <div data-tour="more-page">
      <h1 className="text-xl font-semibold text-foreground mb-4">More</h1>

      {/* Ask Voco AI — mobile only */}
      <div className={`${card.base} overflow-hidden mb-4 lg:hidden`}>
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          <button
            onClick={() => window.dispatchEvent(new Event('open-voco-chat'))}
            className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors min-h-[48px] w-full text-left"
          >
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--brand-accent)]/[0.08] shrink-0">
              <MessageSquare className="h-5 w-5 text-[var(--brand-accent)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">Ask Voco AI</p>
              <p className="text-xs text-muted-foreground">Get instant answers about your dashboard</p>
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>
        </motion.div>
      </div>

      {/* Quick access — Invoices & Estimates (visible on mobile where they're not in bottom bar)
          Per Phase 53 UI-SPEC Surface 2: not rendered AT ALL when invoicing=false (no empty card). */}
      {visibleQuickAccess.length > 0 && (
        <div className={`${card.base} divide-y divide-border overflow-hidden mb-4 lg:hidden`}>
          {visibleQuickAccess.map((item, i) => {
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
                  className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors min-h-[48px]"
                >
                  <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-[var(--brand-accent)]/[0.08] shrink-0">
                    <Icon className="h-5 w-5 text-[var(--brand-accent)]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Settings */}
      <h2 className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2 px-1 lg:hidden">Settings</h2>
      <div className={`${card.base} divide-y divide-border overflow-hidden`}>
        {visibleMoreItems.map((item, i) => {
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
                className="flex items-center gap-4 px-5 py-4 hover:bg-muted transition-colors min-h-[48px]"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-muted shrink-0">
                  <Icon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{item.label}</p>
                  <p className="text-xs text-muted-foreground truncate">{item.description}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
