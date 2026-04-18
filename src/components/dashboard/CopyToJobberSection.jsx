'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Copy, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { buildJobberPasteBlock } from './CopyToJobberSection.helpers';

export { buildJobberPasteBlock };

export function CopyToJobberSection({ appointment, jobberConnected }) {
  const [isCopying, setIsCopying] = useState(false);

  if (!jobberConnected || !appointment) return null;

  const handleCopy = async () => {
    setIsCopying(true);
    try {
      await navigator.clipboard.writeText(buildJobberPasteBlock(appointment));
      toast.success('Copied to clipboard');
    } catch {
      toast.error("Couldn't copy — try manually selecting the text");
    } finally {
      setTimeout(() => setIsCopying(false), 500);
    }
  };

  return (
    <div className="border-t border-border pt-4 mt-4">
      <h3 className="text-sm font-medium">Copy to Jobber</h3>
      <p className="text-xs text-muted-foreground mb-3">Paste into a new Jobber visit</p>
      <div className="flex gap-2 flex-wrap">
        <Button
          onClick={handleCopy}
          disabled={isCopying}
          aria-label="Copy appointment details to clipboard"
          className="bg-[var(--brand-accent)] text-white min-h-[44px]"
        >
          {isCopying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          <span className="ml-2">Copy details</span>
        </Button>
        <Button asChild variant="outline" size="sm" className="min-h-[44px]">
          <a
            href="https://secure.getjobber.com/work_orders/new"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open Jobber new visit screen (opens in new tab)"
          >
            <ExternalLink className="h-4 w-4" />
            <span className="ml-2">Open in Jobber</span>
          </a>
        </Button>
      </div>
    </div>
  );
}
