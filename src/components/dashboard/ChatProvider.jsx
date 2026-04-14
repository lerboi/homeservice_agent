'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

// Greeting constant — lifted verbatim from the pre-Phase-48 ChatbotSheet.jsx so visual
// parity is preserved the moment ChatbotSheet is refactored to consume this context.
const GREETING = {
  id: 'greeting',
  role: 'ai',
  content:
    "Hi, I'm Voco AI. I can help you navigate the dashboard, understand your data, or answer questions about how features work. What would you like to know?",
};

const ChatContext = createContext(null);

/**
 * ChatProvider — owns chat state for every consumer mounted below it.
 *
 * Wraps the dashboard layout (src/app/dashboard/layout.js) so both the
 * always-mounted `ChatbotSheet` and the future home-page `ChatPanel`
 * (Plan 48-05) share the same message history in-session (CONTEXT.md D-10).
 *
 * Per D-11 messages are ephemeral — no localStorage, no DB persistence.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children
 * @param {string} [props.currentRoute] — usually Next.js `usePathname()`
 */
export function ChatProvider({ children, currentRoute: currentRouteProp }) {
  const [messages, setMessages] = useState([GREETING]);
  const [isLoading, setIsLoading] = useState(false);
  const [currentRoute, setCurrentRoute] = useState(currentRouteProp || '/dashboard');

  // Track latest messages in a ref so sendMessage can compute the history slice
  // without recreating the callback every time messages change.
  const messagesRef = useRef(messages);
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Keep context.currentRoute in sync with the prop from layout's usePathname().
  useEffect(() => {
    if (currentRouteProp) setCurrentRoute(currentRouteProp);
  }, [currentRouteProp]);

  const sendMessage = useCallback(
    async (input) => {
      const trimmed = (input ?? '').trim();
      if (!trimmed) return;

      // history = the last 10 messages BEFORE the new user message is appended,
      // mapped ai→assistant. Matches pre-refactor ChatbotSheet behavior exactly.
      const history = messagesRef.current.slice(-10).map((m) => ({
        role: m.role === 'ai' ? 'assistant' : 'user',
        content: m.content,
      }));

      const userMsg = { id: Date.now(), role: 'user', content: trimmed };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, currentRoute, history }),
        });

        let aiContent;
        if (res.ok) {
          const data = await res.json();
          aiContent = data.reply;
        } else {
          aiContent = 'Something went wrong on my end. Please try again in a moment.';
        }

        setMessages((prev) => [
          ...prev,
          { id: Date.now() + 1, role: 'ai', content: aiContent },
        ]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now() + 2,
            role: 'ai',
            error: true,
            content: "Message didn't send. Check your connection and try again.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [currentRoute]
  );

  const clearChat = useCallback(() => {
    setMessages([GREETING]);
    setIsLoading(false);
  }, []);

  // Retry is a UI-owned concern in Phase 48 scope — the provider exposes a stub
  // so future callers have a stable signature to implement against.
  const retryMessage = useCallback(async () => {
    /* no-op stub; surfacing error recovery is deferred */
  }, []);

  return (
    <ChatContext.Provider
      value={{ messages, isLoading, currentRoute, sendMessage, retryMessage, clearChat }}
    >
      {children}
    </ChatContext.Provider>
  );
}

/**
 * useChatContext — hook consumed by every chat surface (ChatbotSheet,
 * future ChatPanel). Throws if called outside a ChatProvider so prop-drilling
 * mistakes fail loud.
 */
export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChatContext must be used within ChatProvider');
  return ctx;
}
