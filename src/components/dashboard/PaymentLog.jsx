'use client';

import { useState, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import RecordPaymentDialog from './RecordPaymentDialog';
import { btn } from '@/lib/design-tokens';

function formatCurrency(value) {
  return Number(value).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function PaymentLog({ invoiceId, invoiceTotal, initialPayments, onStatusChange }) {
  const [payments, setPayments] = useState(initialPayments || null);
  const [paymentsSum, setPaymentsSum] = useState(0);
  const [balance, setBalance] = useState(Number(invoiceTotal) || 0);
  const [loading, setLoading] = useState(!initialPayments);
  const [dialogOpen, setDialogOpen] = useState(false);

  const fetchPayments = useCallback(async () => {
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/payments`);
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPayments(data.payments);
      setPaymentsSum(data.payments_sum);
      setBalance(data.balance);
    } catch {
      toast.error('Failed to load payments');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    if (!initialPayments) {
      fetchPayments();
    }
  }, [fetchPayments, initialPayments]);

  function handlePaymentRecorded(result) {
    setPaymentsSum(result.payments_sum);
    setBalance(result.balance);
    onStatusChange?.(result.status);
    fetchPayments();
  }

  async function handleDelete(paymentId) {
    try {
      const res = await fetch(
        `/api/invoices/${invoiceId}/payments?payment_id=${paymentId}`,
        { method: 'DELETE' }
      );
      if (!res.ok) throw new Error('Failed');
      const result = await res.json();
      setPaymentsSum(result.payments_sum);
      setBalance(result.balance);
      onStatusChange?.(result.status);
      fetchPayments();
      toast.success('Payment removed');
    } catch {
      toast.error('Failed to remove payment');
    }
  }

  const total = Number(invoiceTotal) || 0;

  return (
    <div className="space-y-4">
      {/* Balance display */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Total</span>
          <span>${formatCurrency(total)}</span>
        </div>
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Payments</span>
          <span>-${formatCurrency(paymentsSum)}</span>
        </div>
        <div className="border-t border-border pt-2 mt-1">
          <div className="flex justify-between items-baseline">
            <span className="text-sm font-medium text-foreground">Balance Due</span>
            <span
              className={`text-[28px] font-semibold ${
                balance > 0 ? 'text-[var(--brand-accent)]' : 'text-emerald-600'
              }`}
            >
              ${formatCurrency(balance)}
            </span>
          </div>
        </div>
      </div>

      {/* Record Payment button */}
      <Button
        onClick={() => setDialogOpen(true)}
        className={`w-full ${btn.primary}`}
      >
        Record Payment
      </Button>

      <RecordPaymentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        invoiceId={invoiceId}
        onPaymentRecorded={handlePaymentRecorded}
      />

      {/* Payment list */}
      <div className="space-y-2">
        {loading ? (
          <>
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </>
        ) : !payments || payments.length === 0 ? (
          <p className="text-muted-foreground italic text-sm text-center py-4">No payments recorded</p>
        ) : (
          <TooltipProvider>
            {payments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between py-2 px-3 rounded-md bg-muted border border-border"
              >
                <span className="text-sm text-foreground min-w-[100px]">
                  {formatDate(payment.payment_date)}
                </span>
                <span className="text-sm font-medium text-foreground">
                  ${formatCurrency(payment.amount)}
                </span>
                <span className="text-sm text-muted-foreground flex-1 text-right mx-3 truncate">
                  {payment.note || ''}
                </span>
                <AlertDialog>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <AlertDialogTrigger asChild>
                        <button
                          className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                          aria-label="Remove payment"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </AlertDialogTrigger>
                    </TooltipTrigger>
                    <TooltipContent>Remove payment</TooltipContent>
                  </Tooltip>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove Payment</AlertDialogTitle>
                      <AlertDialogDescription>
                        Remove this payment record? The invoice balance will be recalculated.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleDelete(payment.id)}
                        className="bg-red-600 hover:bg-red-700 text-white"
                      >
                        Remove
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            ))}
          </TooltipProvider>
        )}
      </div>
    </div>
  );
}
