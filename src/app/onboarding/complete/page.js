'use client';

import { useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function OnboardingComplete() {
  const t = useTranslations('onboarding');
  const router = useRouter();
  const searchParams = useSearchParams();

  const number = searchParams.get('number') || '';
  const numberPretty = searchParams.get('number_pretty') || number;

  const [loading, setLoading] = useState(false);
  const [testCallSuccess, setTestCallSuccess] = useState(false);
  const [errorTestCall, setErrorTestCall] = useState('');

  async function handleTestCall() {
    setErrorTestCall('');
    setLoading(true);
    try {
      const res = await fetch('/api/onboarding/test-call', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!res.ok) {
        setErrorTestCall(
          t('error_test_call_failed', { number: numberPretty || number })
        );
        setLoading(false);
        return;
      }

      setTestCallSuccess(true);
      toast.success('Test call placed! Answer your phone.');
    } catch {
      setErrorTestCall(
        t('error_test_call_failed', { number: numberPretty || number })
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="text-3xl font-semibold text-slate-900 leading-tight">
        {t('activation_heading')}
      </h1>
      <p className="mt-2 mb-6 text-base text-slate-500">
        {t('activation_subtext', { number: numberPretty || number })}
      </p>

      {/* Retell number display card */}
      {(number || numberPretty) && (
        <Card className="mb-6 border-slate-200 bg-slate-50">
          <CardContent className="flex items-center justify-center py-6">
            <span className="text-xl font-semibold text-slate-900 text-center">
              {numberPretty || number}
            </span>
          </CardContent>
        </Card>
      )}

      {/* Test your AI button */}
      {!testCallSuccess ? (
        <div>
          <Button
            type="button"
            onClick={handleTestCall}
            disabled={loading}
            className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 active:scale-95
                       text-white transition-all duration-150"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
                Calling you...
              </>
            ) : (
              t('cta_activation')
            )}
          </Button>

          {errorTestCall && (
            <Alert variant="destructive" className="mt-4">
              <AlertDescription>{errorTestCall}</AlertDescription>
            </Alert>
          )}

          {(number || numberPretty) && (
            <p className="mt-4 text-sm text-slate-500 text-center">
              Or dial <span className="font-semibold">{numberPretty || number}</span> directly from your phone
            </p>
          )}
        </div>
      ) : (
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-2 text-green-600">
            <CheckCircle className="h-8 w-8" aria-hidden="true" />
            <span className="text-xl font-semibold">Your AI is live!</span>
          </div>
          <p className="text-base text-slate-500">
            Answer your phone — your AI is calling you now.
          </p>
          <Button
            type="button"
            onClick={() => router.push('/dashboard/services')}
            className="w-full min-h-11 bg-blue-600 hover:bg-blue-700 text-white"
          >
            Continue to dashboard
          </Button>
        </div>
      )}
    </div>
  );
}
