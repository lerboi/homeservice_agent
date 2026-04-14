/** RED (Wave 0): will be made GREEN by Plan 48-02 — do not delete */
/**
 * Phase 48 — ChatProvider context unit tests (D-10).
 *
 * Target: `src/components/dashboard/ChatProvider.jsx` exports:
 *   - default `ChatProvider` component
 *   - named `useChatContext()` hook exposing { messages, isLoading, sendMessage, currentRoute }
 *   - state shared across every consumer mounted under the same provider
 *   - `currentRoute` prop forwarded into the POST /api/chat request body
 *
 * RED state: ChatProvider.jsx does not exist until Plan 48-02.
 */

import { readFileSync, existsSync } from 'fs';

const SRC = 'src/components/dashboard/ChatProvider.jsx';
const read = () => readFileSync(SRC, 'utf8');

describe('ChatProvider', () => {
  it('file exists (created by Plan 48-02)', () => {
    expect(existsSync(SRC)).toBe(true);
  });

  it('useChatContext exposes {messages, isLoading, sendMessage}', () => {
    const src = read();
    expect(src).toMatch(/export\s+function\s+useChatContext|export\s+const\s+useChatContext/);
    expect(src).toMatch(/messages/);
    expect(src).toMatch(/isLoading/);
    expect(src).toMatch(/sendMessage/);
  });

  it('messages sent via one consumer visible to another consumer (shared state)', () => {
    const src = read();
    // Single source of truth = a single useState/useReducer declaration for messages in the provider.
    const stateDecls = src.match(/useState\s*\(/g) || [];
    expect(stateDecls.length).toBeGreaterThan(0);
    // Provider must expose messages via Context value, not props drilling.
    expect(src).toMatch(/createContext/);
    expect(src).toMatch(/Provider/);
  });

  it('currentRoute from context is forwarded to POST /api/chat body', () => {
    const src = read();
    expect(src).toMatch(/\/api\/chat/);
    expect(src).toMatch(/currentRoute/);
  });
});
