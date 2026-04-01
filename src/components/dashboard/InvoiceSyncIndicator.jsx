'use client';

import { CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

const PROVIDER_NAMES = {
  quickbooks: 'QuickBooks',
  xero: 'Xero',
  freshbooks: 'FreshBooks',
};

function getProviderDisplayName(provider) {
  return PROVIDER_NAMES[provider] || provider;
}

export default function InvoiceSyncIndicator({ syncStatus }) {
  if (!syncStatus) return null;

  const { provider, status, error_message } = syncStatus;
  const displayName = getProviderDisplayName(provider);

  let icon;
  let tooltipText;

  switch (status) {
    case 'synced':
      icon = <CheckCircle2 className="h-4 w-4 text-emerald-500" />;
      tooltipText = `${displayName}: Synced`;
      break;
    case 'failed':
      icon = <AlertCircle className="h-4 w-4 text-red-500" />;
      tooltipText = `${displayName}: Failed — ${error_message || 'Unknown error'}`;
      break;
    case 'pending':
      icon = <Clock className="h-4 w-4 text-amber-500" />;
      tooltipText = `${displayName}: Pending`;
      break;
    default:
      return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex items-center">{icon}</span>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
