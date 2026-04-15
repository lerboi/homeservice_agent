'use client';

import { Bot } from 'lucide-react';
import ChatNavLink from './ChatNavLink';
import { parseMessageContent as _parseMessageContent } from '@/lib/parse-message-content';

// Re-export for test compatibility
export { parseMessageContent } from '@/lib/parse-message-content';

// Internal alias used within this component
const parseMessageContent = _parseMessageContent;

export default function ChatMessage({ role, content, onNavigate }) {
  if (role === 'user') {
    return (
      <div className="flex justify-end">
        <div className="bg-[var(--brand-accent)] text-[var(--brand-accent-fg)] rounded-2xl rounded-br-sm px-4 py-2 max-w-[80%] text-sm">
          <p className="whitespace-pre-wrap">{content}</p>
        </div>
      </div>
    );
  }

  // AI message
  const { text, links } = parseMessageContent(content);

  return (
    <div className="flex items-start gap-3 justify-start">
      {/* Avatar */}
      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-muted border border-border shrink-0">
        <Bot className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      {/* Bubble */}
      <div className="bg-muted text-foreground rounded-2xl rounded-bl-sm px-4 py-2 max-w-[80%] text-sm leading-relaxed">
        <p className="whitespace-pre-wrap">{text}</p>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {links.map((link, i) => (
              <ChatNavLink
                key={`${link.href}-${i}`}
                href={link.href}
                label={link.label}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
