import { describe, test, expect } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SOURCE = readFileSync(
  resolve(process.cwd(), 'src/components/dashboard/JobberCopyBanner.jsx'),
  'utf8',
);

describe('JobberCopyBanner — UI-SPEC §4 locked copy + behavior contract', () => {
  test('1. exports named JobberCopyBanner', () => {
    expect(SOURCE).toMatch(/export function JobberCopyBanner/);
  });

  test('2. localStorage key matches the spec exactly', () => {
    expect(SOURCE).toContain('voco_jobber_copy_banner_dismissed');
  });

  test('3. banner copy renders verbatim (UI-SPEC §4)', () => {
    expect(SOURCE).toContain(
      'Jobber push is coming soon — Voco bookings stay in Voco until then. Click any booking to copy it into Jobber.',
    );
  });

  test('4. early-returns null when jobberConnected is false', () => {
    expect(SOURCE).toMatch(/if \(!jobberConnected \|\| dismissed\) return null/);
  });

  test('5. dismissed state initialised to true (no flash before localStorage read)', () => {
    expect(SOURCE).toMatch(/useState\(true\)/);
  });

  test('6. handleDismiss writes "1" to localStorage and sets dismissed=true', () => {
    expect(SOURCE).toMatch(/localStorage\.setItem\(BANNER_DISMISS_KEY,\s*'1'\)/);
    expect(SOURCE).toMatch(/setDismissed\(true\)/);
  });

  test('7. dismiss button has accessible aria-label', () => {
    expect(SOURCE).toContain('aria-label="Dismiss Jobber notification banner"');
  });

  test('8. uses framer-motion AnimatePresence for slide-out exit', () => {
    expect(SOURCE).toContain('AnimatePresence');
    expect(SOURCE).toMatch(/exit=\{\{[^}]*opacity:\s*0/);
  });

  test('9. localStorage write is wrapped in try/catch (incognito-safe)', () => {
    expect(SOURCE).toMatch(/try\s*\{[^}]*localStorage\.setItem[^}]*\}\s*catch/);
  });

  test('10. role="status" set on the banner for screen readers', () => {
    expect(SOURCE).toContain('role="status"');
  });
});
