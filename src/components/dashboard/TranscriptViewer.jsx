'use client';

import { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

/**
 * TranscriptViewer — collapsible speaker-labeled transcript display.
 * Renders structured turns (array of { role, content }) or plain text fallback.
 *
 * @param {{ transcriptStructured: Array | null, transcriptText: string | null }} props
 */
export default function TranscriptViewer({ transcriptStructured, transcriptText }) {
  const [expanded, setExpanded] = useState(false);

  const hasContent = (transcriptStructured && transcriptStructured.length > 0) || transcriptText;

  if (!hasContent) {
    return (
      <div className="text-sm text-stone-400 italic">
        No transcript available for this call.
      </div>
    );
  }

  return (
    <div>
      {/* Toggle button */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="flex items-center gap-1.5 text-sm font-semibold text-[#0F172A] hover:text-[#0F172A]/80 transition-colors duration-150"
        aria-expanded={expanded}
        aria-controls="transcript-content"
      >
        {expanded ? (
          <ChevronUp className="w-4 h-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="w-4 h-4" aria-hidden="true" />
        )}
        {expanded ? 'Hide transcript' : 'Show transcript'}
      </button>

      {/* Transcript content */}
      {expanded && (
        <div
          id="transcript-content"
          role="log"
          aria-label="Call transcript"
          className="mt-3 max-h-[300px] overflow-y-auto rounded-lg border border-stone-200/60 bg-white"
        >
          {transcriptStructured && transcriptStructured.length > 0 ? (
            // Speaker-labeled structured turns
            <div className="divide-y divide-stone-100">
              {transcriptStructured.map((turn, index) => {
                const isCaller = turn.role === 'user';
                const label = isCaller ? 'Caller' : 'AI';
                const ariaLabel = isCaller ? 'Caller:' : 'AI:';
                return (
                  <div
                    key={index}
                    className={`px-3 py-2.5 ${index % 2 === 0 ? 'bg-stone-50' : 'bg-white'}`}
                  >
                    <span
                      className="text-[12px] font-semibold text-[#475569] uppercase tracking-wide block mb-0.5"
                      aria-label={ariaLabel}
                    >
                      {label}
                    </span>
                    <p className="text-sm text-[#0F172A]/80 leading-relaxed">
                      {turn.content}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            // Plain text fallback
            <pre className="p-3 text-sm text-[#0F172A]/80 whitespace-pre-wrap font-sans leading-relaxed">
              {transcriptText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
