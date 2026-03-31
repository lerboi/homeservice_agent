'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase-browser';
import { Loader2 } from 'lucide-react';
import UpgradeCheckoutCards from '@/components/billing/UpgradeCheckoutCards';

export default function UpgradePage() {
  const [previousPlanId, setPreviousPlanId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadPreviousPlan() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }
      const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle();
      if (!tenant) { setLoading(false); return; }
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('plan_id')
        .eq('tenant_id', tenant.id)
        .eq('is_current', true)
        .maybeSingle();
      setPreviousPlanId(sub?.plan_id || null);
      setLoading(false);
    }
    loadPreviousPlan();
  }, []);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-4xl mx-auto px-4 pt-16 pb-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-[28px] font-semibold text-[#0F172A]">
            Pick a plan to reactivate your AI receptionist
          </h1>
          <p className="text-sm text-[#475569] mt-3 max-w-[480px] mx-auto">
            Your subscription has ended. Choose a plan below to resume 24/7 call answering for your business.
          </p>
        </div>

        {/* Plan Cards */}
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="animate-spin h-8 w-8 text-stone-400" />
          </div>
        ) : (
          <UpgradeCheckoutCards previousPlanId={previousPlanId} />
        )}

        {/* Footer */}
        <div className="text-center mt-8">
          <a href="/auth/signin" className="text-sm text-[#475569] underline">
            Return to sign in
          </a>
        </div>
      </div>
    </div>
  );
}
