/**
 * The recorded product demo, or a designed placeholder while it does not
 * exist. The source is DEMO_VIDEO in src/data/site.js: set `src` there when
 * the recording is ready and every page that shows the demo picks it up.
 */
import { CalendarCheck, Check, Play } from 'lucide-react';
import { DEMO_VIDEO } from '@/data/site';

export function DemoVideo({ className = '' }) {
  if (DEMO_VIDEO.src) {
    return (
      <div className={`overflow-hidden rounded-2xl border border-mk-line bg-mk-ink ${className}`}>
        <video
          className="aspect-video w-full"
          controls
          preload="metadata"
          playsInline
          poster={DEMO_VIDEO.poster || undefined}
          src={DEMO_VIDEO.src}
        >
          Your browser cannot play this video.
        </video>
      </div>
    );
  }

  // Placeholder: a still of what the recording shows, clearly labelled as
  // not yet a video. No play button that does nothing.
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-mk-line bg-mk-ink text-white ${className}`}
      data-demo-placeholder="true"
    >
      <div className="grid aspect-video grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col justify-center gap-5 border-r border-white/10 p-5 sm:gap-8 sm:p-10">
          <p className="flex items-center gap-2 font-code text-[10px] uppercase tracking-[0.16em] text-white/50">
            <span className="h-1.5 w-1.5 rounded-full bg-mk-signal" />
            Live call
          </p>
          <div className="space-y-4">
            <div>
              <p className="font-code text-[10px] uppercase tracking-[0.16em] text-white/40">Caller</p>
              <p className="text-sm leading-snug text-white/90 sm:text-2xl">Can I book a demo for Thursday afternoon?</p>
            </div>
            <div>
              <p className="font-code text-[10px] uppercase tracking-[0.16em] text-mk-signal">Voco</p>
              <p className="text-sm leading-snug text-white/90 sm:text-2xl">You’re booked for Thursday at four.</p>
            </div>
          </div>
        </div>
        <div className="flex flex-col justify-center gap-5 bg-white/[0.03] p-5 sm:gap-8 sm:p-10">
          <p className="font-code text-[10px] uppercase tracking-[0.16em] text-white/50">Live actions</p>
          <div className="space-y-2.5">
            {['Looked up open times', 'Booked the appointment', 'Saved to Google Calendar'].map((line) => (
              <p key={line} className="flex items-center gap-2 text-xs text-white/85 sm:text-sm">
                <span className="flex size-4 shrink-0 items-center justify-center rounded-full bg-mk-signal/20 text-mk-signal">
                  <Check className="size-2.5" strokeWidth={3.5} />
                </span>
                {line}
              </p>
            ))}
            <div className="mt-3 hidden rounded-md border border-mk-signal/50 bg-white/[0.04] p-3 sm:block">
              <p className="flex items-center gap-1.5 font-code text-[10px] uppercase tracking-[0.16em] text-white/50">
                <CalendarCheck className="size-3.5" /> Google Calendar
              </p>
              <p className="mt-1 text-sm font-semibold">Alex Tan: Product demo</p>
            </div>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 border-t border-white/10 px-5 py-3.5 sm:px-8">
        <span className="flex size-7 items-center justify-center rounded-full border border-white/25 text-white/60">
          <Play className="size-3" />
        </span>
        <p className="text-sm text-white/70">
          The recorded walkthrough is on its way. Until then, we will run this call for you live.
        </p>
      </div>
    </div>
  );
}
