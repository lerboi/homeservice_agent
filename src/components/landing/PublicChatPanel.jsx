'use client';

import { useState, useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MessageSquare, Send, X, Bot } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ChatNavLink from '@/components/dashboard/ChatNavLink';
import TypingIndicator from '@/components/dashboard/TypingIndicator';
import { parseMessageContent } from '@/lib/parse-message-content';

const PUBLIC_LINK_REGEX = /\[([^\]]+)\]\((\/(?!dashboard)[^)]+)\)/g;

const GREETING = {
  id: 'greeting',
  role: 'ai',
  content:
    "Hi! I'm Voco AI. Ask me anything about pricing, features, or how Voco works for your business. What would you like to know?",
};

export default function PublicChatPanel({ onClose }) {
  const [messages, setMessages] = useState([GREETING]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [visible, setVisible] = useState(false);
  const pathname = usePathname();

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Animate in on next frame after mount
  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
  }, []);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // Focus input after animation
  useEffect(() => {
    if (visible) setTimeout(() => inputRef.current?.focus(), 300);
  }, [visible]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;

    const userMessage = { id: Date.now(), role: 'user', content: trimmed };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    const history = messages.slice(-10).map((m) => ({
      role: m.role === 'ai' ? 'assistant' : 'user',
      content: m.content,
    }));

    try {
      const res = await fetch('/api/public-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: trimmed, currentRoute: pathname, history }),
      });

      let aiContent;
      if (res.ok) {
        const data = await res.json();
        aiContent = data.reply;
      } else {
        aiContent = 'Something went wrong on my end. Please try again in a moment.';
      }

      setMessages((prev) => [...prev, { id: Date.now() + 1, role: 'ai', content: aiContent }]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { id: Date.now() + 1, role: 'ai', content: 'Something went wrong on my end. Please try again in a moment.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  }

  function handleNavigate() {
    onClose();
  }

  function renderMessage(msg) {
    if (msg.role === 'user') {
      return (
        <div key={msg.id} className="flex justify-end">
          <div className="bg-[#C2410C] text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm">
            <p className="whitespace-pre-wrap">{msg.content}</p>
          </div>
        </div>
      );
    }

    const { text, links } = parseMessageContent(msg.content, new RegExp(PUBLIC_LINK_REGEX.source, 'g'));

    return (
      <div key={msg.id} className="flex items-start gap-3 justify-start">
        <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#F5F5F4] border border-stone-200 shrink-0">
          <Bot className="h-3.5 w-3.5 text-[#475569]" />
        </div>
        <div className="bg-[#F5F5F4] text-[#0F172A] rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] text-sm leading-relaxed">
          <p className="whitespace-pre-wrap">{text}</p>
          {links.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {links.map((link, i) => (
                <ChatNavLink
                  key={`${link.href}-${i}`}
                  href={link.href}
                  label={link.label}
                  onNavigate={handleNavigate}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={`fixed z-50 bottom-28 right-4 lg:right-6 w-[calc(100vw-2rem)] sm:w-[380px]
        bg-white rounded-2xl shadow-2xl border border-stone-200 flex flex-col
        max-h-[min(500px,calc(100vh-6rem))] origin-bottom-right
        transition-all duration-300 ease-out
        ${visible
          ? 'opacity-100 scale-100 translate-y-0'
          : 'opacity-0 scale-95 translate-y-2'
        }`}
      role="dialog"
      aria-label="Voco AI chat assistant"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-stone-100 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-[#C2410C]" />
          <span className="text-base font-semibold text-[#0F172A]">Voco AI</span>
          <Badge variant="secondary" className="text-xs">
            Product Questions
          </Badge>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-md hover:bg-stone-100 transition-colors"
          aria-label="Close chat"
        >
          <X className="h-4 w-4 text-[#64748B]" />
        </button>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
        {messages.map(renderMessage)}
        {isLoading && <TypingIndicator />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input row */}
      <div className="px-4 pb-4 pt-2 border-t border-stone-100 shrink-0">
        <div className="flex items-center gap-2">
          <Input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask a question..."
            maxLength={500}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            size="icon-lg"
            className="bg-[#C2410C] hover:bg-[#C2410C]/90 text-white h-10 w-10 shrink-0"
          >
            <Send className="h-4 w-4" />
            <span className="sr-only">Send message</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
