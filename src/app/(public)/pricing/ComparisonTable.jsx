import { COMPARISON_FEATURES, PRICING_TIERS } from './pricingData';
import { Check } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

export default function ComparisonTable() {
  return (
    <AnimatedSection direction="up">
      <div className="rounded-2xl border border-stone-200/60 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px]">
            <thead>
              <tr className="border-b border-stone-200/60 bg-stone-50">
                <th scope="col" className="py-4 px-6 text-left text-sm font-medium text-[#475569] w-[200px]">
                  Feature
                </th>
                {PRICING_TIERS.map((tier) => (
                  <th key={tier.id} scope="col" className="py-4 px-4 text-center text-sm font-semibold text-[#0F172A]">
                    {tier.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARISON_FEATURES.map((feature, rowIndex) => (
                <tr key={feature.name} className={`border-b border-stone-100 ${rowIndex % 2 === 1 ? 'bg-stone-50/60' : ''}`}>
                  <th scope="row" className="py-3.5 px-6 text-left text-sm text-[#0F172A] font-medium">
                    {feature.name}
                  </th>
                  {['starter', 'growth', 'scale', 'enterprise'].map((tierId) => {
                    const val = feature[tierId];
                    return (
                      <td key={tierId} className="py-3.5 px-4 text-center text-sm">
                        {val === true ? (
                          <Check className="size-4 text-[#F97316] mx-auto" />
                        ) : val === false ? (
                          <span className="text-[#475569]/30">&mdash;</span>
                        ) : (
                          <span className="text-[#0F172A] font-medium">{val}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AnimatedSection>
  );
}
