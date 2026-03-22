import { COMPARISON_FEATURES, PRICING_TIERS } from './pricingData';
import { Check } from 'lucide-react';
import { AnimatedSection } from '@/app/components/landing/AnimatedSection';

export default function ComparisonTable() {
  return (
    <AnimatedSection direction="up">
      <div className="overflow-x-auto -mx-6 px-6">
        <table className="w-full min-w-[640px]">
          <thead className="sticky top-16 z-10 bg-[#F5F5F4]">
            <tr className="border-b border-[#0F172A]/10">
              <th scope="col" className="py-4 text-left text-sm font-medium text-[#475569] w-[200px]">
                Feature
              </th>
              {PRICING_TIERS.map((tier) => (
                <th key={tier.id} scope="col" className="py-4 text-center text-sm font-semibold text-[#0F172A]">
                  {tier.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {COMPARISON_FEATURES.map((feature) => (
              <tr key={feature.name} className="border-b border-[#0F172A]/5 hover:bg-[#F5F5F4]/60">
                <th scope="row" className="py-4 text-left text-sm text-[#0F172A] font-medium">
                  {feature.name}
                </th>
                {['starter', 'growth', 'scale', 'enterprise'].map((tierId) => {
                  const val = feature[tierId];
                  return (
                    <td key={tierId} className="py-4 text-center text-sm">
                      {val === true ? (
                        <Check className="size-4 text-[#166534] mx-auto" />
                      ) : val === false ? (
                        <span className="text-[#475569]/40">&mdash;</span>
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
    </AnimatedSection>
  );
}
