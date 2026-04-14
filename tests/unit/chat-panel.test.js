/** RED (Wave 0): will be made GREEN by Plan 48-05 — do not delete */
/**
 * Phase 48 — ChatPanel component tests (HOME-04).
 *
 * Target: `src/components/dashboard/ChatPanel.jsx`
 *  - Reads messages via useChatContext() (not local useState)
 *  - Submitting input calls sendMessage from context
 *
 * RED state: ChatPanel.jsx does not exist until Plan 48-05.
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/ChatPanel.jsx';
const read = () => readFileSync(SRC, 'utf8');

describe('ChatPanel', () => {
  it('file exists (created by Plan 48-05)', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('renders messages from useChatContext', () => {
    const src = read();
    expect(src).toMatch(/useChatContext/);
    expect(src).toMatch(/messages/);
    // Panel must NOT hold its own messages state — all state lives in ChatProvider per D-10.
    expect(src).not.toMatch(/useState\s*\(\s*\[\s*\{[^}]*role\s*:/);
  });

  it('submitting input calls sendMessage from context', () => {
    const src = read();
    expect(src).toMatch(/sendMessage/);
    // Must wire a form/button onSubmit or onClick that calls sendMessage.
    expect(src).toMatch(/(onSubmit|onClick|handleSubmit|handleSend)/);
  });
});
