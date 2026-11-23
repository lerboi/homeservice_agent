'use client';

/**
 * Voco Agent's illustration: an owner messages the agent, it reads the
 * business's systems, answers, is told what to do, and does it. One scripted
 * conversation per channel (WhatsApp, Slack, Telegram, email); they play in
 * turn and the channel tabs switch between them.
 *
 * The server render and reduced motion show the first conversation complete.
 * It is an illustration, not a record of a customer.
 */

import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { AGENT_CHANNELS, AGENT_CONVERSATIONS } from '@/data/agent';

// ask → sources → answer → instruction → done
const STEPS = 5;
const HOLDS = [1500, 1500, 2800, 1700, 4200];

const CHANNEL_NAME = Object.fromEntries(AGENT_CHANNELS.map((c) => [c.id, c.name]));

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return reduced;
}

export function AgentChatDemo({ className = '' }) {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  // Steps of the current conversation that are visible. Starts complete.
  const [shown, setShown] = useState(STEPS);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (reduced) return undefined;
    const start = setTimeout(() => {
      setStarted(true);
      setShown(0);
    }, 1600);
    return () => clearTimeout(start);
  }, [reduced]);

  useEffect(() => {
    if (reduced || !started) return undefined;
    const delay = shown === 0 ? 450 : HOLDS[shown - 1];
    const timer = setTimeout(() => {
      if (shown >= STEPS) {
        setIndex((i) => (i + 1) % AGENT_CONVERSATIONS.length);
        setShown(0);
      } else {
        setShown((n) => n + 1);
      }
    }, delay);
    return () => clearTimeout(timer);
  }, [shown, started, reduced, index]);

  const pick = (i) => {
    setIndex(i);
    setShown(reduced || !started ? STEPS : 0);
  };

  const conversation = AGENT_CONVERSATIONS[index];
  const visible = reduced ? STEPS : shown;
  const reading = !reduced && started && visible === 2;

  return (
    <div className={`flex h-full flex-col overflow-hidden rounded-2xl border border-mk-line bg-white text-left text-mk-ink ${className}`}>
      <div className="flex h-11 items-center justify-between gap-3 border-b border-mk-line px-3" role="tablist" aria-label="Where you message Voco Agent">
        <div className="flex items-center gap-1">
          {AGENT_CONVERSATIONS.map((c, i) => (
            <button
              key={c.channel}
              type="button"
              role="tab"
              aria-selected={i === index}
              onClick={() => pick(i)}
              className={`h-7 rounded-full px-2.5 font-code text-[10px] uppercase tracking-[0.12em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mk-spark ${
                i === index ? 'bg-mk-spark text-mk-ink' : 'text-mk-muted hover:text-mk-ink'
              }`}
            >
              {CHANNEL_NAME[c.channel]}
            </button>
          ))}
        </div>
      </div>

      <div
        className="mk-grid-paper flex min-h-[400px] flex-1 flex-col justify-end gap-3 overflow-hidden bg-mk-paper/70 p-4 sm:p-5"
        role="img"
        aria-label={`Illustration: on ${CHANNEL_NAME[conversation.channel]}, the owner asks “${conversation.ask}” Voco Agent answers from ${conversation.sources.join(', ')}, then: ${conversation.done.join('; ')}.`}
      >
        {visible >= 1 && <Bubble key={`${index}-ask`} mine>{conversation.ask}</Bubble>}

        {visible >= 2 && (
          <div key={`${index}-src`} className="mk-rise flex flex-wrap items-center gap-1.5" aria-hidden="true">
            <span className="font-code text-[10px] uppercase tracking-[0.14em] text-mk-faint">
              {reading ? 'Reading' : 'Read'}
            </span>
            {conversation.sources.map((source) => (
              <span key={source} className="rounded-full border border-mk-line bg-white px-2 py-0.5 font-code text-[10px] text-mk-muted">
                {source}
              </span>
            ))}
            {reading && (
              <span className="ml-1 flex items-center gap-[3px]">
                {[0, 1, 2].map((d) => (
                  <span key={d} className="mk-dot size-1 rounded-full bg-mk-spark-deep" style={{ animationDelay: `${d * 160}ms` }} />
                ))}
              </span>
            )}
          </div>
        )}

        {visible >= 3 && (
          <Bubble key={`${index}-ans`}>
            {conversation.answer}
            {conversation.points.length > 0 && (
              <ol className="mt-1.5 space-y-0.5">
                {conversation.points.map((point, n) => (
                  <li key={point} className="flex gap-2">
                    <span className="font-code text-[11px] leading-[1.6] text-mk-spark-deep">{n + 1}</span>
                    {point}
                  </li>
                ))}
              </ol>
            )}
          </Bubble>
        )}

        {visible >= 4 && <Bubble key={`${index}-do`} mine>{conversation.instruction}</Bubble>}

        {visible >= 5 && (
          <div key={`${index}-done`} className="mk-rise max-w-[88%] overflow-hidden rounded-xl border border-mk-spark/70 bg-white" aria-hidden="true">
            <p className="border-b border-mk-line bg-mk-spark-wash px-3 py-1.5 font-code text-[10px] uppercase tracking-[0.14em] text-mk-spark-deep">
              Done
            </p>
            <ul className="space-y-1.5 px-3 py-2.5">
              {conversation.done.map((item) => (
                <li key={item} className="flex items-center gap-2 text-[13.5px] font-medium">
                  <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-mk-spark text-mk-ink">
                    <Check className="size-2.5" strokeWidth={3.5} />
                  </span>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ mine = false, children }) {
  return (
    <div className={`mk-rise flex ${mine ? 'justify-end' : 'justify-start'}`} aria-hidden="true">
      <div
        className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[14px] leading-snug ${
          mine ? 'rounded-br-md bg-mk-ink text-white' : 'rounded-bl-md border border-mk-line bg-white text-mk-ink'
        }`}
      >
        {!mine && <p className="mb-0.5 font-code text-[10px] uppercase tracking-[0.14em] text-mk-spark-deep">Voco Agent</p>}
        {children}
      </div>
    </div>
  );
}
