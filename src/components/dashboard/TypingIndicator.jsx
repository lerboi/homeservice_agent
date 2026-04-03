'use client';

import { Bot } from 'lucide-react';

export default function TypingIndicator() {
  return (
    <div className="flex items-start gap-3" role="status" aria-label="Voco AI is typing">
      {/* Avatar — 28px circle matching AI message avatar */}
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-[#F5F5F4] border border-stone-200 shrink-0">
        <Bot className="h-3.5 w-3.5 text-[#475569]" />
      </div>
      {/* Dot bubble */}
      <div className="bg-[#F5F5F4] rounded-2xl rounded-bl-sm px-4 py-3 flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full bg-[#475569] animate-pulse motion-reduce:animate-none motion-reduce:opacity-50"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-[#475569] animate-pulse motion-reduce:animate-none motion-reduce:opacity-50"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2 h-2 rounded-full bg-[#475569] animate-pulse motion-reduce:animate-none motion-reduce:opacity-50"
          style={{ animationDelay: '300ms' }}
        />
      </div>
    </div>
  );
}
