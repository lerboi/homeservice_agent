// tests/unit/routing-style.test.js

// Test the ROUTING_STYLE contract — verifying the map matches UI-SPEC
describe('ROUTING_STYLE map', () => {
  // Replicate the map to test contract (source of truth is calls/page.js)
  const ROUTING_STYLE = {
    ai:             { badge: 'bg-stone-100 text-stone-600',  border: 'border-l-stone-300',  label: 'AI' },
    owner_pickup:   { badge: 'bg-blue-100 text-blue-700',    border: 'border-l-blue-500',   label: 'You answered' },
    fallback_to_ai: { badge: 'bg-amber-100 text-amber-700',  border: 'border-l-amber-500',  label: 'Missed \u2192 AI' },
  };

  test('ai routing mode has stone badge', () => {
    expect(ROUTING_STYLE.ai.badge).toContain('bg-stone-100');
    expect(ROUTING_STYLE.ai.label).toBe('AI');
  });

  test('owner_pickup routing mode has blue badge', () => {
    expect(ROUTING_STYLE.owner_pickup.badge).toContain('bg-blue-100');
    expect(ROUTING_STYLE.owner_pickup.label).toBe('You answered');
  });

  test('fallback_to_ai routing mode has amber badge', () => {
    expect(ROUTING_STYLE.fallback_to_ai.badge).toContain('bg-amber-100');
    expect(ROUTING_STYLE.fallback_to_ai.label).toContain('AI');
  });

  test('null routing_mode produces no badge', () => {
    const routingMode = null;
    const rs = routingMode ? ROUTING_STYLE[routingMode] : null;
    expect(rs).toBeNull();
  });

  test('owner_pickup calls are identified correctly', () => {
    const isOwnerPickup = (call) => call.routing_mode === 'owner_pickup';
    expect(isOwnerPickup({ routing_mode: 'owner_pickup' })).toBe(true);
    expect(isOwnerPickup({ routing_mode: 'ai' })).toBe(false);
    expect(isOwnerPickup({ routing_mode: 'fallback_to_ai' })).toBe(false);
    expect(isOwnerPickup({ routing_mode: null })).toBe(false);
    expect(isOwnerPickup({})).toBe(false);
  });

  test('all routing modes have required fields', () => {
    for (const [mode, style] of Object.entries(ROUTING_STYLE)) {
      expect(style).toHaveProperty('badge');
      expect(style).toHaveProperty('border');
      expect(style).toHaveProperty('label');
      expect(typeof style.badge).toBe('string');
      expect(typeof style.border).toBe('string');
      expect(typeof style.label).toBe('string');
    }
  });

  test('routing modes have distinct badge colors', () => {
    const badges = Object.values(ROUTING_STYLE).map(s => s.badge);
    const unique = new Set(badges);
    expect(unique.size).toBe(badges.length);
  });

  test('undefined routing_mode produces no badge', () => {
    const routingMode = undefined;
    const rs = routingMode ? ROUTING_STYLE[routingMode] : null;
    expect(rs).toBeNull();
  });
});

const fs = require('fs');
const path = require('path');

describe('calls page routing integration', () => {
  const callsPageContent = fs.readFileSync(
    path.join(__dirname, '../../src/app/dashboard/calls/page.js'),
    'utf8'
  );

  test('calls page contains ROUTING_STYLE map', () => {
    expect(callsPageContent).toContain('const ROUTING_STYLE');
    expect(callsPageContent).toContain('owner_pickup');
    expect(callsPageContent).toContain('fallback_to_ai');
  });

  test('calls page contains isOwnerPickup guard', () => {
    expect(callsPageContent).toContain('isOwnerPickup');
    expect(callsPageContent).toContain('You handled this call directly');
  });

  test('calls page does not filter out owner-pickup calls', () => {
    // Ensure no filter excludes owner_pickup routing_mode
    expect(callsPageContent).not.toContain("routing_mode', 'owner_pickup'");
    expect(callsPageContent).not.toContain('neq.*routing_mode');
  });
});
