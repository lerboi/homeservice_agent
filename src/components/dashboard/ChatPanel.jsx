'use client';

/**
 * ChatPanel — inline chat surface on the dashboard home page (HOME-04).
 *
 * Consumes the same React Context as `ChatbotSheet` (Plan 48-02), so messages
 * sent in either surface appear in the other without remount (HOME-05, D-10).
 *
 * Layout behaviour (Plan 48-05 page.js wiring):
 *   - lg+: parent mounts this inside a sticky `aside` — panel fills height so
 *     its internal message log scrolls instead of the page.
 *   - < lg: stacks at the bottom of the mobile flow (D-16) — height is natural.
 *
 * Per D-11 messages are ephemeral — there is NO local `useState([...messages])`
 * in this file. All history lives in `ChatProvider`.
 */

import { useEffect, useRef, useState } from 'react';
import { Send, MessageSquare } from 'lucide-react';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import { useChatContext } from './ChatProvider';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { card, focus } from '@/lib/design-tokens';

// Two canonical starter prompts per UI-SPEC Empty state block.
const STARTER_PROMPTS = [
  'How do I change my AI voice?',
  'Where do I find invoices?',
];

export default function ChatPanel() {
  const { messages, isLoading, sendMessage } = useChatContext();
  // Only the ephemeral input text is local — chat history is context-owned.
  const [input, setInput] = useState('');

  const messagesEndRef = useRef(null);

  // Auto-scroll the log to bottom when messages or loading state change —
  // same pattern as ChatbotSheet so cross-surface parity holds.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  async function handleSend(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    await sendMessage(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !isLoading) {
      e.preventDefault();
      handleSend();
    }
  }

  async function handleStarterClick(prompt) {
    if (isLoading) return;
    await sendMessage(prompt);
  }

  // Empty state: messages array contains only the AI greeting (length === 1).
  const isEmpty = messages.length <= 1;

  return (
    <section
      aria-label="Ask Voco AI"
      className={`${card.base} flex flex-col h-auto lg:h-full lg:max-h-[calc(100vh-4rem)] overflow-hidden`}
    >
      {/* Header */}
      <header className="px-4 py-3 border-b border-stone-100 shrink-0">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#C2410C]" aria-hidden="true" />
          <h2 className="font-semibold text-base text-[#0F172A] leading-[1.4]">
            Ask Voco
          </h2>
        </div>
        {isEmpty && (
          <p className="font-normal text-sm text-[#475569] leading-normal mt-1">
            Ask anything about your dashboard.
          </p>
        )}
      </header>

      {/* Message log */}
      <div
        role="log"
        aria-live="polite"
        aria-label="Conversation with Voco AI"
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 lg:min-h-[320px]"
      >
        {messages.map((msg) => (
          <ChatMessage
            key={msg.id}
            role={msg.role}
            content={msg.content}
          />
        ))}
        {isLoading && <TypingIndicator />}

        {/* Starter prompt chips — shown only when the log has just the greeting */}
        {isEmpty && !isLoading && (
          <div className="pt-2 flex flex-wrap gap-2" aria-label="Suggested prompts">
            {STARTER_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => handleStarterClick(prompt)}
                className={`${focus.ring} font-normal text-xs text-[#475569] bg-[#F5F5F4] hover:bg-stone-100 border border-stone-200 rounded-full px-3 py-1.5 transition-colors`}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <form
        onSubmit={handleSend}
        className="px-4 pb-4 pt-2 border-t border-stone-100 shrink-0"
      >
        <div className="flex items-center gap-2">
          <label htmlFor="chat-panel-input" className="sr-only">
            Message Voco AI
          </label>
          <Input
            id="chat-panel-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything about your dashboard…"
            maxLength={500}
            disabled={isLoading}
            className="flex-1 font-normal"
          />
          <Button
            type="submit"
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon-lg"
            aria-label="Send message"
            className="bg-[#C2410C] hover:bg-[#C2410C]/90 active:bg-[#9A3412] active:scale-95 text-white h-10 w-10 shrink-0 font-normal"
          >
            <Send className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </form>
    </section>
  );
}
