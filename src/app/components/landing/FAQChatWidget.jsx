'use client';

import { useState, useRef, useEffect } from 'react';
import { SendHorizonal, Loader2 } from 'lucide-react';
import { FAQ_CHAT_SUGGESTIONS } from '@/data/faq';

const SUGGESTIONS = FAQ_CHAT_SUGGESTIONS;

const ERROR_COPY = "Couldn't connect right now — try refreshing the page.";

const MARKDOWN_LINK_RE = /\[([^\]]+)\]\(([^)\s]+)\)/g;

function renderAssistantContent(text) {
  const nodes = [];
  let cursor = 0;
  let keyIndex = 0;
  MARKDOWN_LINK_RE.lastIndex = 0;
  let match;
  while ((match = MARKDOWN_LINK_RE.exec(text)) !== null) {
    if (match.index > cursor) {
      nodes.push(text.slice(cursor, match.index));
    }
    const [, label, href] = match;
    const external = /^https?:\/\//.test(href);
    nodes.push(
      <a
        key={`ln-${keyIndex++}`}
        href={href}
        target={external ? '_blank' : undefined}
        rel={external ? 'noopener noreferrer' : undefined}
        className="font-semibold text-mk-signal-deep underline underline-offset-2 hover:text-mk-ink"
      >
        {label}
      </a>
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < text.length) nodes.push(text.slice(cursor));
  return nodes.length ? nodes : text;
}

export function FAQChatWidget() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const threadRef = useRef(null);

  // Auto-scroll to latest message
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const send = async (text) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;
    setInput('');
    setIsLoading(true);
    const userMsg = { role: 'user', content: trimmed };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    try {
      const res = await fetch('/api/public-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          currentRoute: '/',
          // Pitfall 3: cap client-side history at last 10 entries before POST
          history: nextMessages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'API error');
      setMessages((prev) => [...prev, { role: 'assistant', content: data.reply }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: ERROR_COPY }]);
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    send(input);
  };

  const onChipClick = (chip) => {
    if (isLoading) return;
    send(chip);
  };

  return (
    <div className="rounded-2xl border border-mk-line bg-mk-paper flex flex-col h-[520px] max-h-[80vh]">
      {/* Header */}
      <div className="px-4 py-4 border-b border-mk-line">
        <p className="text-[15px] font-semibold text-mk-ink">Still wondering?</p>
        <p className="text-[14px] text-mk-muted">Ask Voco directly.</p>
      </div>

      {/* Message thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[14px] text-mk-muted">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChipClick(s)}
                  disabled={isLoading}
                  className="inline-flex px-3 py-2 rounded-full bg-white border border-mk-line text-[14px] text-mk-muted hover:border-mk-signal hover:text-mk-ink transition-colors disabled:opacity-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={
                m.role === 'user'
                  ? 'bg-mk-ink text-white rounded-2xl rounded-br-sm px-4 py-2 text-[15px] max-w-[85%] whitespace-pre-wrap'
                  : 'bg-white border border-mk-line rounded-2xl rounded-bl-sm px-4 py-2 text-[15px] text-mk-muted max-w-[85%] whitespace-pre-wrap'
              }
            >
              {m.role === 'assistant' ? renderAssistantContent(m.content) : m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-mk-line rounded-2xl rounded-bl-sm px-4 py-2 text-[15px] text-mk-muted max-w-[85%] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={onSubmit} className="border-t border-mk-line px-4 py-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about Voco…"
          disabled={isLoading}
          className="flex-1 rounded-xl border border-mk-line bg-white px-4 py-2 text-[15px] text-mk-ink caret-mk-signal placeholder:text-[#94A3B8] focus:outline-none focus:border-mk-signal disabled:opacity-60"
          aria-label="Ask Voco anything about the product"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="w-9 h-9 rounded-xl bg-mk-ink text-white flex items-center justify-center hover:bg-mk-ink-soft transition-colors disabled:opacity-50 shrink-0"
          aria-label="Send message"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
