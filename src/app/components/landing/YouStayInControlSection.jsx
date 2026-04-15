import { AnimatedSection, AnimatedStagger, AnimatedItem } from './AnimatedSection';
import { Star, Phone, AlertCircle, Bell } from 'lucide-react';

export function YouStayInControlSection() {
  return (
    <>
      <section className="bg-white py-24 md:py-32 px-6">
        <AnimatedSection>
          <div className="max-w-5xl mx-auto">
            <div className="max-w-2xl">
              <div className="text-[13px] font-semibold text-[#F97316] tracking-[0.18em] uppercase mb-4">Your rules, your way</div>
              <h2 className="text-4xl md:text-5xl font-semibold text-[#0F172A] leading-[1.1] tracking-tight">
                You Stay in Control.
              </h2>
              <p className="mt-5 text-[17px] text-[#475569] leading-relaxed">
                Three dials — who Voco answers for, when it picks up, and how it reports back. Change them anytime, or leave the smart defaults on and forget it.
              </p>
            </div>

            <AnimatedStagger className="mt-16 md:mt-20 grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
              <AnimatedItem>
                <ControlColumn
                  label="Regulars ring you"
                  caption="Pick the contacts who always ring straight through to your phone."
                  mock={<VipListMock />}
                />
              </AnimatedItem>
              <AnimatedItem>
                <ControlColumn
                  label="Off-hours are covered"
                  caption="Set the hours Voco answers and the hours calls come direct to you."
                  mock={<HoursMock />}
                />
              </AnimatedItem>
              <AnimatedItem>
                <ControlColumn
                  label="Every call lands on your phone"
                  caption="Choose what Voco sends you after a call — urgency, transcript, one-tap callback."
                  mock={<NotificationMock />}
                />
              </AnimatedItem>
            </AnimatedStagger>
          </div>
        </AnimatedSection>
      </section>

      <section className="relative bg-[#1C1412] py-20 md:py-28 px-6 overflow-hidden">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(249,115,22,0.10), transparent 70%)' }}
          aria-hidden="true"
        />
        <AnimatedSection>
          <div className="relative max-w-3xl mx-auto text-center">
            <blockquote className="text-[28px] md:text-[36px] font-semibold text-[#F5F5F5] leading-tight tracking-tight">
              &ldquo;You set the rules. Voco follows them.&rdquo;
            </blockquote>
          </div>
        </AnimatedSection>
      </section>
    </>
  );
}

function ControlColumn({ label, caption, mock }) {
  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-gradient-to-br from-[#FAFAF9] to-white border border-stone-200/80 p-4 md:p-5 min-h-[200px] md:min-h-[220px] flex">
        {mock}
      </div>
      <div>
        <h3 className="text-[17px] font-semibold text-[#0F172A] leading-snug">{label}</h3>
        <p className="mt-1.5 text-[14px] text-[#475569] leading-relaxed">{caption}</p>
      </div>
    </div>
  );
}

// Tiny mock: a contacts list showing regulars routed to "You" vs unknown → "Voco"
function VipListMock() {
  const rows = [
    { name: 'Mary Chen', sub: 'Regular · 8 calls', route: 'you', star: true },
    { name: 'Dave Hernandez', sub: 'Regular · 4 calls', route: 'you', star: true },
    { name: 'Unknown caller', sub: 'New number', route: 'voco', star: false },
  ];
  return (
    <div className="w-full flex flex-col gap-1.5 text-left" aria-hidden="true">
      <div className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.18em] uppercase mb-1">Incoming</div>
      {rows.map((r) => (
        <div key={r.name} className="flex items-center gap-2.5 py-1.5">
          <div className={r.star ? 'w-7 h-7 rounded-full bg-[#F97316]/10 flex items-center justify-center shrink-0' : 'w-7 h-7 rounded-full bg-stone-100 flex items-center justify-center shrink-0'}>
            {r.star ? <Star className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" /> : <Phone className="w-3.5 h-3.5 text-[#94A3B8]" />}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[12px] font-semibold text-[#0F172A] truncate">{r.name}</div>
            <div className="text-[10px] text-[#94A3B8] truncate">{r.sub}</div>
          </div>
          <span
            className={
              r.route === 'you'
                ? 'text-[10px] font-semibold text-[#166534] bg-[#166534]/10 px-2 py-0.5 rounded-full whitespace-nowrap'
                : 'text-[10px] font-semibold text-[#F97316] bg-[#F97316]/10 px-2 py-0.5 rounded-full whitespace-nowrap'
            }
          >
            {r.route === 'you' ? '→ You' : '→ Voco'}
          </span>
        </div>
      ))}
    </div>
  );
}

// Tiny mock: weekly grid showing when Voco answers vs you
function HoursMock() {
  const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  // 6 blocks per day = morning/day/evening/night + weekend handling
  // value: 'you' | 'voco'
  const grid = [
    // Mon–Fri: you 9a–5p, voco rest
    ['voco', 'voco', 'you', 'you', 'voco', 'voco'],
    ['voco', 'voco', 'you', 'you', 'voco', 'voco'],
    ['voco', 'voco', 'you', 'you', 'voco', 'voco'],
    ['voco', 'voco', 'you', 'you', 'voco', 'voco'],
    ['voco', 'voco', 'you', 'you', 'voco', 'voco'],
    // Sat–Sun: voco all day
    ['voco', 'voco', 'voco', 'voco', 'voco', 'voco'],
    ['voco', 'voco', 'voco', 'voco', 'voco', 'voco'],
  ];
  return (
    <div className="w-full flex flex-col gap-2 text-left" aria-hidden="true">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.18em] uppercase">This week</div>
        <div className="flex items-center gap-2 text-[9px] font-semibold uppercase tracking-wider">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#0F172A]" /> <span className="text-[#475569]">You</span></span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-[#F97316]" /> <span className="text-[#475569]">Voco</span></span>
        </div>
      </div>
      <div className="flex flex-col gap-1">
        {DAYS.map((day, i) => (
          <div key={day} className="flex items-center gap-2">
            <span className="text-[10px] font-semibold text-[#475569] w-7 shrink-0">{day}</span>
            <div className="flex gap-0.5 flex-1">
              {grid[i].map((slot, j) => (
                <div
                  key={j}
                  className={
                    slot === 'you'
                      ? 'h-3 flex-1 rounded-sm bg-[#0F172A]'
                      : 'h-3 flex-1 rounded-sm bg-[#F97316]'
                  }
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Tiny mock: phone-style notification with triage summary
function NotificationMock() {
  return (
    <div className="w-full flex flex-col gap-2 text-left" aria-hidden="true">
      <div className="text-[10px] font-semibold text-[#94A3B8] tracking-[0.18em] uppercase mb-1">New text · just now</div>
      <div className="rounded-xl bg-white border border-stone-200 shadow-sm p-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-[#F97316] flex items-center justify-center shrink-0">
            <Bell className="w-3.5 h-3.5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[11px] font-semibold text-[#0F172A]">Voco</div>
            <div className="text-[10px] text-[#94A3B8]">Call handled · 1 min ago</div>
          </div>
          <span className="inline-flex items-center gap-1 text-[9px] font-semibold text-[#B91C1C] bg-[#B91C1C]/10 px-1.5 py-0.5 rounded-full uppercase tracking-wide">
            <AlertCircle className="w-2.5 h-2.5" />
            Emergency
          </span>
        </div>
        <div className="text-[12px] text-[#0F172A] font-medium leading-snug">
          Water heater leak · 1247 Oak St
        </div>
        <div className="text-[11px] text-[#475569] leading-snug">
          Customer wants tech ASAP. Slot held: 6:30 PM.
        </div>
        <div className="flex items-center gap-1.5 pt-1 border-t border-stone-100">
          <span className="text-[10px] font-semibold text-[#F97316]">Transcript</span>
          <span className="text-[9px] text-stone-300">·</span>
          <span className="text-[10px] font-semibold text-[#F97316]">Recording</span>
          <span className="text-[9px] text-stone-300">·</span>
          <span className="text-[10px] font-semibold text-[#F97316]">Confirm</span>
        </div>
      </div>
    </div>
  );
}
