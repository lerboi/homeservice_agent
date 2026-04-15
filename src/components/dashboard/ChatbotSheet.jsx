'use client';

import { useState, useEffect, useRef } from 'react';
import { MessageSquare, Send } from 'lucide-react';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import ChatMessage from './ChatMessage';
import TypingIndicator from './TypingIndicator';
import { useChatContext } from './ChatProvider';

export default function ChatbotSheet({ open, onOpenChange }) {
  // Chat history + send lives in ChatProvider (CONTEXT.md D-10 — Plan 48-02 lift).
  // Only the ephemeral input field + viewport flag remain local to the sheet.
  const { messages, isLoading, sendMessage } = useChatContext();
  const [input, setInput] = useState('');
  const [isMobile, setIsMobile] = useState(false);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Detect mobile viewport
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    setIsMobile(mq.matches);
    const handler = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Auto-scroll to bottom when messages change or loading state changes
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, isLoading]);

  // Focus input when sheet opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  async function handleSend() {
    const trimmed = input.trim();
    if (!trimmed) return;
    setInput('');
    await sendMessage(trimmed);
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !isLoading) {
      handleSend();
    }
  }

  function handleNavigate() {
    onOpenChange(false);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isMobile ? 'bottom' : 'right'}
        className={
          isMobile
            ? 'max-h-[85vh] rounded-t-2xl p-0 flex flex-col bg-card'
            : 'w-[400px] sm:max-w-[400px] p-0 flex flex-col bg-card'
        }
        aria-label="Voco AI chat assistant"
      >
        {/* Drag handle — mobile only */}
        {isMobile && (
          <div className="flex justify-center pt-3 pb-0">
            <div className="w-8 h-1 rounded-full bg-muted-foreground/30" />
          </div>
        )}

        {/* Header */}
        <SheetHeader className="px-4 py-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-[var(--brand-accent)]" />
            <SheetTitle className="text-base font-semibold">Voco AI</SheetTitle>
            <SheetDescription className="sr-only">
              Ask questions about your dashboard, navigate features, or get help
            </SheetDescription>
            <Badge variant="secondary" className="text-xs">
              Help &amp; Navigation
            </Badge>
          </div>
        </SheetHeader>

        {/* Message list */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" aria-live="polite">
          {messages.map((msg) => (
            <ChatMessage
              key={msg.id}
              role={msg.role}
              content={msg.content}
              onNavigate={handleNavigate}
            />
          ))}
          {isLoading && <TypingIndicator />}
          <div ref={messagesEndRef} />
        </div>

        {/* Input row */}
        <div className="px-4 pb-4 pt-2 border-t border-border shrink-0">
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
              className="bg-[var(--brand-accent)] hover:bg-[var(--brand-accent)]/90 text-[var(--brand-accent-fg)] h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
              <span className="sr-only">Send message</span>
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
