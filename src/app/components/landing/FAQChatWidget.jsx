'use client';

import { useState, useRef, useEffect } from 'react';
import { SendHorizonal, Loader2 } from 'lucide-react';

const SUGGESTIONS = [
  'Does it really sound natural?',
  'How long does setup take?',
  'What does it cost?',
];

const ERROR_COPY = "Couldn't connect right now — try refreshing the page.";

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
    <div className="rounded-2xl border border-stone-200/60 bg-[#FAFAF9] shadow-sm flex flex-col min-h-[400px]">
      {/* Header */}
      <div className="px-4 py-4 border-b border-stone-200/60">
        <p className="text-[15px] font-semibold text-[#0F172A]">Still wondering?</p>
        <p className="text-[14px] text-[#71717A]">Ask Voco directly.</p>
      </div>

      {/* Message thread */}
      <div ref={threadRef} className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-3">
        {messages.length === 0 && (
          <div className="flex flex-col gap-2">
            <p className="text-[14px] text-[#71717A]">Try one of these:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => onChipClick(s)}
                  disabled={isLoading}
                  className="inline-flex px-3 py-2 rounded-full bg-white border border-stone-200/60 text-[14px] text-[#475569] hover:border-[#F97316]/40 hover:text-[#0F172A] transition-colors disabled:opacity-50"
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
                  ? 'bg-[#F97316] text-white rounded-2xl rounded-br-sm px-4 py-2 text-[15px] max-w-[85%]'
                  : 'bg-white border border-stone-200/60 rounded-2xl rounded-bl-sm px-4 py-2 text-[15px] text-[#475569] max-w-[85%]'
              }
            >
              {m.content}
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white border border-stone-200/60 rounded-2xl rounded-bl-sm px-4 py-2 text-[15px] text-[#71717A] max-w-[85%] flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
              <span>Thinking…</span>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <form onSubmit={onSubmit} className="border-t border-stone-200/60 px-4 py-2 flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask anything about Voco…"
          disabled={isLoading}
          className="flex-1 rounded-xl border border-stone-200 bg-white px-4 py-2 text-[15px] placeholder:text-[#71717A] focus:outline-none focus:border-[#F97316]/50 disabled:opacity-60"
          aria-label="Ask Voco anything about the product"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="w-9 h-9 rounded-xl bg-[#F97316] text-white flex items-center justify-center hover:bg-[#EA6B0F] transition-colors disabled:opacity-50 shrink-0"
          aria-label="Send message"
        >
          {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <SendHorizonal className="w-4 h-4" />}
        </button>
      </form>
    </div>
  );
}
