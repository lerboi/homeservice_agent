/**
 * Tests verifying the calls API includes routing columns and does not filter
 * out owner-pickup calls. Covers ROUTE-17.
 *
 * Uses file-content-based assertions — passes once calls route is extended
 * with routing_mode and outbound_dial_duration_sec columns.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

describe('calls API routing integration', () => {
  const callsRouteContent = fs.readFileSync(
    path.join(__dirname, '../../src/app/api/calls/route.js'),
    'utf8'
  );

  test('calls API select includes routing_mode column', () => {
    expect(callsRouteContent).toContain('routing_mode');
  });

  test('calls API select includes outbound_dial_duration_sec column', () => {
    expect(callsRouteContent).toContain('outbound_dial_duration_sec');
  });

  test('calls API does not filter out owner_pickup calls', () => {
    // Ensure no .neq or .not filter excludes owner_pickup routing_mode
    expect(callsRouteContent).not.toMatch(/\.neq\s*\(\s*['"]routing_mode['"]/);
    expect(callsRouteContent).not.toMatch(/\.not\s*\(\s*['"]routing_mode['"]/);
    expect(callsRouteContent).not.toContain("routing_mode', 'owner_pickup'");
  });
});
