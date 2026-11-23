/**
 * A static call transcript beside the backend actions it caused. Used on the
 * use-case pages. Server component: no motion, no JavaScript.
 */
import { Check } from 'lucide-react';

export function CallAndLog({ call, log, className = '' }) {
  return (
    <div className={`grid overflow-hidden rounded-2xl border border-mk-line bg-white md:grid-cols-[1.15fr_1fr] ${className}`}>
      <div className="border-b border-mk-line md:border-b-0 md:border-r">
        <div className="flex h-11 items-center border-b border-mk-line px-4">
          <span className="font-code text-[10px] uppercase tracking-[0.16em] text-mk-muted">The call</span>
        </div>
        <ol className="space-y-3.5 p-5">
          {call.map((line, i) => (
            <li key={i}>
              <p className={`font-code text-[10px] uppercase tracking-[0.16em] ${line.who === 'agent' ? 'text-mk-signal-deep' : 'text-mk-faint'}`}>
                {line.who === 'agent' ? 'Voco' : 'Caller'}
              </p>
              <p className="mt-0.5 text-[15px] leading-snug text-mk-ink">{line.text}</p>
            </li>
          ))}
        </ol>
      </div>
      <div className="bg-mk-paper/60">
        <div className="flex h-11 items-center border-b border-mk-line px-4">
          <span className="font-code text-[10px] uppercase tracking-[0.16em] text-mk-muted">In your systems</span>
        </div>
        <ol className="space-y-3 p-5">
          {log.map((entry, i) => (
            <li key={i} className="flex items-start gap-2.5">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-mk-signal/15 text-mk-signal-deep">
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
              <p className="font-code text-xs leading-relaxed text-mk-ink">
                <span className="text-mk-faint">{entry.verb} </span>
                {entry.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
