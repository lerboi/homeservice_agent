'use client';

/**
 * The hero visual: a call on the left, what happens in the backend on the
 * right, revealed in step so cause and effect are visible (speech, then the
 * action it triggers). Loops. With reduced motion the finished state is shown
 * and nothing moves.
 *
 * It is an illustration of the scheduling flow the product runs today
 * (availability check, read-back, booking, calendar event), not a recording.
 */

import { useEffect, useState } from 'react';
import { CalendarCheck, Check } from 'lucide-react';

const SCRIPT = [
  { kind: 'say', who: 'caller', text: 'Hi, can I book a product demo for Thursday afternoon?', hold: 1900 },
  { kind: 'act', verb: 'check', text: 'calendar.availability', detail: 'Thu 26 Nov · 2 open', hold: 1100 },
  { kind: 'say', who: 'agent', text: 'I have two thirty or four o’clock on Thursday. Which works better?', hold: 2100 },
  { kind: 'say', who: 'caller', text: 'Four works. It’s Alex Tan.', hold: 1500 },
  { kind: 'say', who: 'agent', text: 'So that’s Alex Tan, Thursday at four. Shall I book it?', hold: 1900 },
  { kind: 'say', who: 'caller', text: 'Yes please.', hold: 1000 },
  { kind: 'act', verb: 'create', text: 'appointment.create', detail: 'Thu 4:00 PM · Alex Tan', hold: 800 },
  { kind: 'act', verb: 'write', text: 'google_calendar.events.insert', detail: 'event created', hold: 900, event: true },
  { kind: 'say', who: 'agent', text: 'You’re booked for Thursday at four. Anything else?', hold: 4200 },
];

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

export function LiveCallDemo() {
  const reduced = usePrefersReducedMotion();
  // Number of script steps currently visible. Starts complete so the server
  // render and a no-JS page show the whole exchange.
  const [shown, setShown] = useState(SCRIPT.length);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    if (reduced) return undefined;
    const start = setTimeout(() => {
      setStarted(true);
      setShown(0);
    }, 1200);
    return () => clearTimeout(start);
  }, [reduced]);

  useEffect(() => {
    if (reduced || !started) return undefined;
    const delay = shown >= SCRIPT.length ? 2600 : shown === 0 ? 500 : SCRIPT[shown - 1].hold;
    const timer = setTimeout(() => {
      setShown((n) => (n >= SCRIPT.length ? 0 : n + 1));
    }, delay);
    return () => clearTimeout(timer);
  }, [shown, started, reduced]);

  const visible = SCRIPT.slice(0, reduced ? SCRIPT.length : shown);
  const speech = visible.filter((s) => s.kind === 'say');
  const actions = visible.filter((s) => s.kind === 'act');
  const eventCreated = actions.some((a) => a.event);
  const live = !reduced && started && shown < SCRIPT.length;
  const lastSpeaker = speech.length ? speech[speech.length - 1].who : null;

  return (
    <div
      className="grid h-full overflow-hidden rounded-2xl border border-mk-line bg-white text-left text-mk-ink md:grid-cols-[1.15fr_1fr]"
      role="img"
      aria-label="Illustration: a caller books a product demo by voice while the appointment is created and written to Google Calendar."
    >
      {/* Call */}
      <div className="flex min-h-[380px] flex-col border-b md:min-h-[484px] border-mk-line md:border-b-0 md:border-r" aria-hidden="true">
        <div className="flex h-11 items-center justify-between border-b border-mk-line px-4">
          <span className="flex items-center gap-2 font-code text-[10px] uppercase tracking-[0.16em] text-mk-muted">
            <span className={`h-1.5 w-1.5 rounded-full ${live ? 'bg-mk-signal' : 'bg-mk-ink/25'}`} />
            Call
          </span>
          <span className="flex h-4 items-center gap-[3px]">
            {[0, 1, 2, 3, 4].map((i) => (
              <span
                key={i}
                className={`h-full w-[2px] rounded-full ${live && lastSpeaker === 'agent' ? 'mk-bar bg-mk-signal' : 'scale-y-[0.3] bg-mk-ink/25'}`}
                style={{ animationDelay: `${i * 110}ms` }}
              />
            ))}
          </span>
        </div>
        <div className="flex flex-1 flex-col justify-end gap-3.5 p-5">
          {speech.map((line, i) => (
            <div key={`${i}-${line.text}`} className="mk-rise">
              <p className={`font-code text-[10px] uppercase tracking-[0.16em] ${line.who === 'agent' ? 'text-mk-signal-deep' : 'text-mk-faint'}`}>
                {line.who === 'agent' ? 'Voco' : 'Caller'}
              </p>
              <p className="mt-0.5 text-[15px] leading-snug text-mk-ink">{line.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Backend */}
      <div className="flex min-h-[300px] flex-col bg-mk-paper/60" aria-hidden="true">
        <div className="flex h-11 items-center border-b border-mk-line px-4">
          <span className="font-code text-[10px] uppercase tracking-[0.16em] text-mk-muted">Your systems</span>
        </div>
        <div className="flex flex-1 flex-col gap-3 p-5">
          {actions.length === 0 && (
            <p className="font-code text-xs text-mk-faint">waiting for the call…</p>
          )}
          {actions.map((action) => (
            <div key={action.text} className="mk-rise flex items-start gap-2.5">
              <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full bg-mk-signal/15 text-mk-signal-deep">
                <Check className="size-2.5" strokeWidth={3.5} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-code text-xs text-mk-ink">{action.text}</p>
                <p className="font-code text-[11px] text-mk-muted">{action.detail}</p>
              </div>
            </div>
          ))}

          {eventCreated && (
            <div className="mk-rise mt-auto flex overflow-hidden rounded-lg border border-mk-signal/60 bg-white">
              <span className="w-1 shrink-0 bg-mk-signal" />
              <div className="p-3.5">
                <p className="flex items-center gap-1.5 font-code text-[10px] uppercase tracking-[0.16em] text-mk-muted">
                  <CalendarCheck className="size-3.5" />
                  Google Calendar
                </p>
                <p className="mt-1.5 text-sm font-semibold text-mk-ink">Alex Tan: Product demo</p>
                <p className="mt-0.5 font-code text-[11px] text-mk-muted">Thu, 26 Nov · 4:00 – 5:00 PM</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
