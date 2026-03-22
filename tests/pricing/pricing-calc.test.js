import { describe, test, expect } from '@jest/globals';
import { getAnnualPrice, PRICING_TIERS } from '../../src/app/(public)/pricing/pricingData.js';

describe('getAnnualPrice', () => {
  test('calculates 20% discount for Starter ($99 -> $79)', () => {
    expect(getAnnualPrice(99)).toBe(79);
  });
  test('calculates 20% discount for Growth ($249 -> $199)', () => {
    expect(getAnnualPrice(249)).toBe(199);
  });
  test('calculates 20% discount for Scale ($599 -> $479)', () => {
    expect(getAnnualPrice(599)).toBe(479);
  });
  test('returns null for Enterprise (custom pricing)', () => {
    expect(getAnnualPrice(null)).toBeNull();
  });
});

describe('PRICING_TIERS', () => {
  test('has exactly 4 tiers', () => {
    expect(PRICING_TIERS).toHaveLength(4);
  });
  test('Growth tier is highlighted with Most Popular badge', () => {
    const growth = PRICING_TIERS.find(t => t.id === 'growth');
    expect(growth.highlighted).toBe(true);
    expect(growth.badge).toBe('Most Popular');
  });
  test('Enterprise tier has Contact Us CTA linking to /contact', () => {
    const enterprise = PRICING_TIERS.find(t => t.id === 'enterprise');
    expect(enterprise.cta).toBe('Contact Us');
    expect(enterprise.ctaHref).toBe('/contact');
  });
});
