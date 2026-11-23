'use client';

/**
 * /admin/demo — Demo Studio.
 *
 * A recording station for the product demo: talk to the live voice agent from
 * the browser and watch what it does in the business's systems as it happens.
 * Built to be screen-captured at 16:9 (use the OS recorder or OBS): setup on
 * the left, the call in the middle, live actions on the right ending in the
 * calendar event the call created. "Presentation" hides setup and the admin
 * chrome for the take.
 *
 * The call runs through the shared useAgentCall hook (same LiveKit path as
 * /admin/test-agent). It is a sandboxed test call: no billing, no SMS, no CRM
 * rows. Unlike a plain test call the booking is pushed to the calendar chosen
 * under "Save to" and kept until "Remove demo booking" is pressed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck, Check, CircleAlert, Download, ExternalLink, Loader2, Maximize2, Mic, MicOff,
  Minimize2, Phone, PhoneOff, RefreshCw, Trash2,
} from 'lucide-react';
import { fmtElapsed, useAgentCall } from '@/hooks/useAgentCall';
import { buildTimeline, eventTitle, formatEventWhen } from '@/lib/demo/actions';
import { destinationState, getDestination, isDestinationSelectable } from '@/lib/demo/destinations';
import { MODEL_OPTIONS, getModel } from '@/lib/demo/models';
import { DEFAULT_DEMO_BUSINESS_NAME, cleanBusinessName } from '@/lib/demo/session';
import { DEFAULT_SCENARIO_ID } from '@/lib/demo/scenarios';

// Brand tokens for this page (the public-site palette: paper, ink, one
// green-teal signal colour). Kept local until the rebrand moves them into
// globals.css.
const INK = '#0B0F14';
const PAPER = '#F7F8F5';
const SIGNAL = '#00B37E';
const LINE = 'rgba(11,15,20,0.10)';

// GET the studio status: tenant, tasks, destination health, voices, leftovers.
async function requestStatus() {
  try {
    const res = await fetch('/api/admin/demo/status');
    const json = await res.json();
    if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
    return { data: json, error: null };
  } catch (err) {
    return { data: null, error: err.message };
  }
}

export default function DemoStudioPage() {
  const call = useAgentCall({ tag: 'demo-studio' });
  const {
    phase, inCall, error, agentJoined, muted, elapsed, segments, events, devices, deviceId,
    micLevel, micChecked, micSilent, result, recordingUrl, polling, audioBlocked, session,
    agentSpeaking, userSpeaking, audioContainerRef,
  } = call;

  const [status, setStatus] = useState(null);
  const [statusError, setStatusError] = useState(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [task, setTask] = useState(DEFAULT_SCENARIO_ID);
  const [destination, setDestination] = useState('google');
  const [voice, setVoice] = useState('');
  // GPT-4.1 mini by default: the steadier model in rehearsals. '' = the agent's own setting.
  const [llm, setLlm] = useState('openai');
  // The business the agent answers as on the recording. '' = the tenant's own name.
  const [answerAs, setAnswerAs] = useState(DEFAULT_DEMO_BUSINESS_NAME);
  const [presenting, setPresenting] = useState(false);
  const [cleanup, setCleanup] = useState({ state: 'idle', message: null }); // idle | working | done | error

  const applyStatus = useCallback(({ data, error: requestError }) => {
    if (data) setStatus(data);
    setStatusError(requestError);
    setStatusLoading(false);
  }, []);

  const loadStatus = useCallback(async () => {
    setStatusLoading(true);
    applyStatus(await requestStatus());
  }, [applyStatus]);

  useEffect(() => {
    let cancelled = false;
    requestStatus().then((outcome) => {
      if (!cancelled) applyStatus(outcome);
    });
    return () => {
      cancelled = true;
    };
  }, [applyStatus]);

  // Esc leaves presentation mode.
  useEffect(() => {
    if (!presenting) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setPresenting(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [presenting]);

  const timeZone = session?.tenant?.timezone || status?.tenant?.timezone || 'UTC';
  const { actions, booking } = useMemo(() => buildTimeline(events, { timeZone }), [events, timeZone]);

  const destinationStatus = status?.destinations?.find((d) => d.id === destination) || null;
  // Must be declared before canStart, which reads it.
  const persona = cleanBusinessName(answerAs);
  const canStart =
    Boolean(status?.tenant?.can_take_calls) &&
    isDestinationSelectable(destinationStatus) &&
    !statusLoading &&
    persona !== null;
  const businessName =
    (inCall || phase === 'ended' ? session?.tenant?.business_name : persona) ||
    status?.tenant?.business_name ||
    'Voco';
  const roomName = session?.room_name || null;

  function start() {
    setCleanup({ state: 'idle', message: null });
    call.startCall({
      sessionUrl: '/api/admin/demo/session',
      body: {
        task,
        destination,
        ...(voice ? { voice_override: voice } : {}),
        ...(llm ? { llm } : {}),
        ...(persona ? { business_name: persona } : {}),
      },
    });
  }

  async function connect(dest) {
    const def = getDestination(dest.id);
    if (!def?.authPath) return;
    try {
      const res = await fetch(def.authPath);
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error || `HTTP ${res.status}`);
      // A normal tab, not a popup: the sign-in can be completed (or automated)
      // like any page. Come back and press "Re-check" afterwards.
      window.open(json.url, '_blank', 'noopener');
    } catch (err) {
      setStatusError(`Could not start the ${def.label} connection: ${err.message}`);
    }
  }

  async function removeBooking(room) {
    if (!room) return;
    setCleanup({ state: 'working', message: null });
    try {
      const res = await fetch('/api/admin/demo/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: room }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      if (!json.found || json.removed.length === 0) {
        setCleanup({ state: 'done', message: 'Nothing to remove for that call.' });
      } else if (json.clean) {
        setCleanup({ state: 'done', message: 'Removed the calendar event and cancelled the booking.' });
      } else {
        setCleanup({
          state: 'error',
          message: 'The booking was cancelled, but the calendar event could not be deleted. Remove it by hand.',
        });
      }
      loadStatus();
    } catch (err) {
      setCleanup({ state: 'error', message: `Cleanup failed: ${err.message}` });
    }
  }

  const ended = phase === 'ended';
  const transcript = result?.transcript_structured
    ? result.transcript_structured.map((t, i) => ({
        id: `final-${i}`, who: t.role === 'user' ? 'You' : 'Agent', text: t.content, final: true,
      }))
    : segments;

  const stage = (
    <div
      className={
        presenting
          ? 'fixed inset-0 z-50 flex flex-col overflow-hidden'
          : 'rounded-xl border overflow-hidden flex flex-col min-h-[640px]'
      }
      style={{ background: PAPER, color: INK, borderColor: LINE }}
    >
      {/* Hidden container for the agent's audio element(s) */}
      <div ref={audioContainerRef} className="hidden" />

      {/* Top bar */}
      <div className="flex items-center justify-between px-6 h-14 border-b shrink-0" style={{ borderColor: LINE }}>
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[17px] font-semibold tracking-tight">Voco</span>
          <span className="h-4 w-px" style={{ background: LINE }} />
          <span className="text-sm truncate" style={{ color: 'rgba(11,15,20,0.62)' }}>
            Live call · the agent books into {getDestination(destination)?.label || 'the calendar'}
          </span>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {inCall && (
            <span className="font-mono text-xs tabular-nums" style={{ color: 'rgba(11,15,20,0.62)' }}>
              {fmtElapsed(elapsed)}
            </span>
          )}
          <button
            type="button"
            onClick={() => setPresenting((p) => !p)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-md border text-xs font-medium hover:bg-black/[0.03]"
            style={{ borderColor: LINE }}
            title={presenting ? 'Exit presentation (Esc)' : 'Hide setup and admin chrome for the recording'}
          >
            {presenting ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
            {presenting ? 'Exit' : 'Presentation'}
          </button>
        </div>
      </div>

      <div
        className={[
          'grid flex-1 min-h-0',
          presenting ? 'grid-cols-[minmax(0,1fr)_minmax(340px,420px)]' : 'grid-cols-1 lg:grid-cols-[300px_minmax(0,1fr)_360px]',
        ].join(' ')}
      >
        {/* ── Setup column ── */}
        {!presenting && (
          <aside className="border-b lg:border-b-0 lg:border-r p-5 space-y-6 overflow-y-auto" style={{ borderColor: LINE }}>
            <SetupSection label="Task">
              <div className="space-y-2">
                {(status?.scenarios || []).map((s) => {
                  const live = s.status === 'live';
                  const active = task === s.id;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      disabled={!live || inCall}
                      onClick={() => setTask(s.id)}
                      className="w-full text-left rounded-lg border px-3 py-2.5 transition-colors disabled:cursor-not-allowed"
                      style={{
                        borderColor: active ? SIGNAL : LINE,
                        background: active ? 'rgba(0,179,126,0.06)' : 'white',
                        opacity: live ? 1 : 0.55,
                      }}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{s.title}</span>
                        {!live && (
                          <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color: 'rgba(11,15,20,0.5)' }}>
                            soon
                          </span>
                        )}
                      </span>
                      {active && (
                        <span className="block text-xs mt-1 leading-snug" style={{ color: 'rgba(11,15,20,0.62)' }}>
                          {s.description}
                        </span>
                      )}
                    </button>
                  );
                })}
                {statusLoading && !status && <p className="text-xs text-black/50">Loading…</p>}
              </div>
            </SetupSection>

            <SetupSection
              label="Save to"
              action={
                <button
                  type="button"
                  onClick={loadStatus}
                  disabled={statusLoading}
                  className="inline-flex items-center gap-1 text-xs hover:underline disabled:opacity-50"
                  style={{ color: 'rgba(11,15,20,0.62)' }}
                >
                  <RefreshCw className={`h-3 w-3 ${statusLoading ? 'animate-spin' : ''}`} />
                  Re-check
                </button>
              }
            >
              <div className="space-y-2">
                {(status?.destinations || []).map((d) => {
                  const state = destinationState(d);
                  const selectable = isDestinationSelectable(d);
                  const active = destination === d.id;
                  return (
                    <div
                      key={d.id}
                      className="rounded-lg border px-3 py-2.5"
                      style={{ borderColor: active ? SIGNAL : LINE, background: active ? 'rgba(0,179,126,0.06)' : 'white' }}
                    >
                      <label className={`flex items-start gap-2.5 ${selectable ? 'cursor-pointer' : 'cursor-not-allowed'}`}>
                        <input
                          type="radio"
                          name="destination"
                          className="sr-only"
                          checked={active}
                          disabled={!selectable || inCall}
                          onChange={() => setDestination(d.id)}
                        />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <HealthDot state={state} />
                            <span className="text-sm font-medium">{d.label}</span>
                          </span>
                          <span className="block text-xs mt-0.5 truncate" style={{ color: 'rgba(11,15,20,0.62)' }}>
                            {state === 'ready' && d.kind === 'external' && (d.account || 'Connected')}
                            {state === 'ready' && d.kind === 'internal' && 'No external calendar'}
                            {state === 'not_connected' && 'Connect to enable'}
                            {state === 'needs_reconnect' && 'Connection failed its check'}
                          </span>
                        </span>
                      </label>
                      {d.kind === 'external' && state !== 'ready' && (
                        <button
                          type="button"
                          onClick={() => connect(d)}
                          className="mt-2 text-xs font-medium underline underline-offset-2"
                          style={{ color: INK }}
                        >
                          {state === 'needs_reconnect' ? 'Reconnect' : 'Connect'}
                        </button>
                      )}
                      {state === 'needs_reconnect' && d.detail && (
                        <p className="mt-1 font-mono text-[10px] leading-snug text-red-700 break-words">{d.detail}</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </SetupSection>

            <SetupSection label="Answer as">
              <input
                type="text"
                value={answerAs}
                disabled={inCall}
                maxLength={40}
                onChange={(e) => setAnswerAs(e.target.value)}
                placeholder={status?.tenant?.business_name || 'Business name'}
                className="w-full h-9 px-2.5 text-sm rounded-md border bg-white"
                style={{ borderColor: persona === null ? '#DC2626' : LINE }}
                aria-label="Business the agent answers as"
              />
              <p className="mt-1.5 text-[11px] leading-snug" style={{ color: persona === null ? '#B91C1C' : 'rgba(11,15,20,0.6)' }}>
                {persona === null
                  ? 'Use a short plain name of 2 to 40 characters: letters, numbers, spaces, and the marks & . -'
                  : 'The business named in the greeting and the captions. Leave empty to answer as the demo tenant. Hours, calendar and bookings are unchanged.'}
              </p>
            </SetupSection>

            <SetupSection label="Model">
              <div className="grid grid-cols-3 gap-1 p-1 rounded-md border bg-white" style={{ borderColor: LINE }}>
                {[{ id: '', label: 'Production' }, ...MODEL_OPTIONS].map((m) => {
                  const selected = llm === m.id;
                  return (
                    <button
                      key={m.id || 'production'}
                      type="button"
                      disabled={inCall}
                      aria-pressed={selected}
                      onClick={() => setLlm(m.id)}
                      className="h-8 px-1.5 rounded text-xs font-medium leading-tight disabled:opacity-60"
                      style={selected ? { background: INK, color: '#fff' } : { color: INK }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <p className="mt-1.5 text-[11px] leading-snug" style={{ color: 'rgba(11,15,20,0.6)' }}>
                {getModel(llm)?.hint || 'Whatever the live agent is set to, so the demo matches a real call.'}
              </p>
            </SetupSection>

            <SetupSection label="Voice">
              <select
                value={voice}
                disabled={inCall}
                onChange={(e) => setVoice(e.target.value)}
                className="w-full h-9 px-2.5 text-sm rounded-md border bg-white"
                style={{ borderColor: LINE }}
              >
                <option value="">Production voice</option>
                {[...new Set((status?.voices || []).map((v) => v.group))].map((group) => (
                  <optgroup key={group} label={group}>
                    {(status?.voices || []).filter((v) => v.group === group).map((v) => (
                      <option key={v.id} value={v.id}>{v.label}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </SetupSection>

            <SetupSection label="Microphone">
              <select
                value={deviceId}
                onChange={(e) => call.onSelectDevice(e.target.value)}
                className="w-full h-9 px-2.5 text-sm rounded-md border bg-white mb-2"
                style={{ borderColor: LINE }}
              >
                <option value="">System default</option>
                {devices.map((d) => (
                  <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-2">
                <LevelBar level={muted ? 0 : micLevel} active={micChecked || inCall} />
                {!inCall && (
                  <button
                    type="button"
                    onClick={() => call.checkMic()}
                    className="shrink-0 text-xs font-medium underline underline-offset-2"
                  >
                    {micChecked ? 'Re-check' : 'Check'}
                  </button>
                )}
              </div>
              {micSilent && (
                <p className="mt-2 text-xs text-amber-700">
                  No sound from this microphone. Pick another device or unmute it.
                </p>
              )}
            </SetupSection>

            {(status?.kept_bookings?.length || 0) > 0 && !inCall && (
              <SetupSection label="Still on the calendar">
                <div className="space-y-2">
                  {status.kept_bookings.map((b) => (
                    <div key={b.appointment_id} className="rounded-lg border bg-white px-3 py-2" style={{ borderColor: LINE }}>
                      <p className="text-xs font-medium truncate">{eventTitle(b.caller_name, b.reason)}</p>
                      <p className="font-mono text-[11px]" style={{ color: 'rgba(11,15,20,0.62)' }}>
                        {formatEventWhen(b.start_time, b.end_time, timeZone)}
                      </p>
                      <button
                        type="button"
                        disabled={!b.room_name || cleanup.state === 'working'}
                        onClick={() => removeBooking(b.room_name)}
                        className="mt-1 inline-flex items-center gap-1 text-xs font-medium underline underline-offset-2 disabled:opacity-50"
                      >
                        <Trash2 className="h-3 w-3" /> Remove
                      </button>
                    </div>
                  ))}
                </div>
              </SetupSection>
            )}
          </aside>
        )}

        {/* ── Call column ── */}
        <section className="flex flex-col min-h-0 p-6 lg:p-8">
          <div className="flex items-center gap-2 mb-6">
            <span
              className={`h-2 w-2 rounded-full ${phase === 'in-call' && agentJoined ? 'animate-pulse' : ''}`}
              style={{ background: phase === 'in-call' && agentJoined ? SIGNAL : 'rgba(11,15,20,0.25)' }}
            />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(11,15,20,0.62)' }}>
              {phase === 'idle' && 'Ready'}
              {phase === 'error' && 'Not started'}
              {phase === 'connecting' && 'Connecting'}
              {phase === 'in-call' && (agentJoined ? `On a call with ${businessName}` : 'Waiting for the agent')}
              {ended && 'Call ended'}
            </span>
          </div>

          <div className="flex justify-center mb-6">
            <VoiceOrb
              live={phase === 'in-call' && agentJoined}
              agentSpeaking={agentSpeaking}
              userSpeaking={userSpeaking && !muted}
              level={micLevel}
            />
          </div>

          <Captions segments={inCall ? segments : transcript} live={inCall} businessName={businessName} />

          {phase === 'in-call' && !agentJoined && elapsed >= 15 && (
            <p className="mt-3 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              The agent has not joined yet. If this continues, end the call and try again; if it
              keeps happening the voice worker is down or at capacity.
            </p>
          )}

          {audioBlocked && inCall && (
            <button
              type="button"
              onClick={call.enableAudio}
              className="mt-3 w-full h-10 rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-sm font-medium"
            >
              Click to enable the agent&apos;s audio
            </button>
          )}

          {(error || statusError) && !inCall && (
            <p className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {error || statusError}
            </p>
          )}

          {/* Controls */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
            {!inCall && (
              <button
                type="button"
                onClick={start}
                disabled={!canStart}
                className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-sm font-semibold text-white transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: INK }}
              >
                <Phone className="h-4 w-4" />
                {ended ? 'New take' : 'Start call'}
              </button>
            )}
            {inCall && (
              <>
                <button
                  type="button"
                  onClick={call.toggleMute}
                  className="inline-flex items-center gap-2 h-11 px-5 rounded-full border bg-white text-sm font-medium"
                  style={{ borderColor: LINE }}
                >
                  {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  {muted ? 'Unmute' : 'Mute'}
                </button>
                <button
                  type="button"
                  onClick={call.hangUp}
                  className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-red-600 text-white text-sm font-semibold hover:bg-red-700"
                >
                  <PhoneOff className="h-4 w-4" />
                  End call
                </button>
              </>
            )}
          </div>
          {!inCall && !canStart && !statusLoading && status && persona !== null && (
            <p className="mt-3 text-center text-xs" style={{ color: 'rgba(11,15,20,0.62)' }}>
              {status.tenant.can_take_calls
                ? `${getDestination(destination)?.label || 'That destination'} is not ready. Connect it or choose another under “Save to”.`
                : 'The demo tenant has no phone number, so the agent cannot answer as it.'}
            </p>
          )}

          {/* After the call */}
          {ended && (
            <div className="mt-6 pt-5 border-t space-y-3" style={{ borderColor: LINE }}>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                {recordingUrl ? (
                  <a href={recordingUrl} className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2">
                    <Download className="h-4 w-4" /> Download audio (MP4)
                  </a>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-sm" style={{ color: 'rgba(11,15,20,0.62)' }}>
                    {polling && <Loader2 className="h-4 w-4 animate-spin" />}
                    {polling ? 'Preparing the recording…' : 'No recording available'}
                  </span>
                )}
                {roomName && (
                  <button
                    type="button"
                    onClick={() => removeBooking(roomName)}
                    disabled={cleanup.state === 'working' || cleanup.state === 'done'}
                    className="inline-flex items-center gap-1.5 text-sm font-medium underline underline-offset-2 disabled:opacity-50 disabled:no-underline"
                  >
                    {cleanup.state === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                    Remove demo booking
                  </button>
                )}
              </div>
              {recordingUrl && <audio controls src={recordingUrl} className="w-full" />}
              {cleanup.message && (
                <p className={`text-sm ${cleanup.state === 'error' ? 'text-red-700' : ''}`} style={cleanup.state === 'error' ? undefined : { color: 'rgba(11,15,20,0.72)' }}>
                  {cleanup.message}
                </p>
              )}
            </div>
          )}
        </section>

        {/* ── Live actions column ── */}
        <aside className="border-t lg:border-t-0 lg:border-l flex flex-col min-h-0" style={{ borderColor: LINE, background: 'white' }}>
          <div className="px-5 h-12 flex items-center border-b shrink-0" style={{ borderColor: LINE }}>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(11,15,20,0.62)' }}>
              Live actions
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            {actions.length === 0 ? (
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(11,15,20,0.5)' }}>
                What the agent does in your systems appears here as the call happens.
              </p>
            ) : (
              <ol className="space-y-3.5">
                {actions.map((a) => (
                  <ActionRow key={a.id} action={a} />
                ))}
              </ol>
            )}
            {booking && <EventCard booking={booking} destination={destination} />}
          </div>
        </aside>
      </div>
    </div>
  );

  if (presenting) return stage;

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Demo Studio</h1>
        <p className="text-sm text-slate-500 mt-1 max-w-3xl">
          Record a call in which the agent books an appointment and it lands in the calendar. Press
          Presentation, start your screen recorder, then Start call. The booking stays on the calendar
          until you remove it; nothing is billed and no texts are sent.
        </p>
      </div>
      {stage}
    </div>
  );
}

function SetupSection({ label, action = null, children }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: 'rgba(11,15,20,0.62)' }}>
          {label}
        </h2>
        {action}
      </div>
      {children}
    </div>
  );
}

function HealthDot({ state }) {
  const color = state === 'ready' ? SIGNAL : state === 'needs_reconnect' ? '#DC2626' : 'rgba(11,15,20,0.25)';
  const label =
    state === 'ready' ? 'Ready' : state === 'needs_reconnect' ? 'Needs reconnecting' : 'Not connected';
  return <span className="h-2 w-2 rounded-full shrink-0" style={{ background: color }} role="img" aria-label={label} />;
}

function LevelBar({ level = 0, active = false }) {
  const pct = active ? Math.min(100, Math.round(level * 140)) : 0;
  return (
    <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ background: 'rgba(11,15,20,0.08)' }}>
      <div className="h-full transition-[width] duration-75" style={{ width: `${pct}%`, background: SIGNAL }} />
    </div>
  );
}

// The voice visual: a disc with two rings. The agent speaking fills it with
// the signal colour; the caller speaking moves the outer ring with the mic.
function VoiceOrb({ live, agentSpeaking, userSpeaking, level }) {
  const outer = 1 + (userSpeaking ? Math.min(0.22, level * 0.5) : 0) + (agentSpeaking ? 0.1 : 0);
  return (
    <div className="relative h-36 w-36 flex items-center justify-center" aria-hidden="true">
      <span
        className="absolute inset-0 rounded-full border transition-transform duration-150 ease-out"
        style={{ borderColor: agentSpeaking ? 'rgba(0,179,126,0.35)' : LINE, transform: `scale(${outer})` }}
      />
      <span
        className={`absolute inset-4 rounded-full border ${agentSpeaking ? 'animate-pulse' : ''}`}
        style={{ borderColor: agentSpeaking ? 'rgba(0,179,126,0.6)' : LINE }}
      />
      <span
        className="relative h-20 w-20 rounded-full transition-colors duration-200 flex items-center justify-center"
        style={{ background: agentSpeaking ? SIGNAL : live ? INK : 'rgba(11,15,20,0.12)' }}
      >
        <span className="flex items-end gap-[3px] h-6">
          {[0.5, 0.9, 0.65, 1, 0.55].map((h, i) => (
            <span
              key={i}
              className={`w-[3px] rounded-full bg-white ${agentSpeaking ? 'animate-pulse' : ''}`}
              style={{
                height: `${Math.round((agentSpeaking ? h : 0.25) * 100)}%`,
                opacity: live ? 1 : 0.6,
                animationDelay: `${i * 90}ms`,
                transition: 'height 160ms ease-out',
              }}
            />
          ))}
        </span>
      </span>
    </div>
  );
}

function Captions({ segments, live, businessName }) {
  const endRef = useRef(null);
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [segments, live]);

  return (
    <div
      className="flex-1 min-h-[180px] overflow-y-auto rounded-lg border bg-white px-5 py-4"
      style={{ borderColor: LINE }}
    >
      {segments.length === 0 ? (
        <p className="text-sm" style={{ color: 'rgba(11,15,20,0.5)' }}>
          {live ? 'Listening…' : 'The conversation appears here, word for word.'}
        </p>
      ) : (
        <div className="space-y-3.5">
          {segments.map((s) => {
            const agent = s.who !== 'You';
            return (
              <div key={s.id}>
                <p
                  className="font-mono text-[10px] uppercase tracking-[0.14em] mb-0.5"
                  style={{ color: agent ? SIGNAL : 'rgba(11,15,20,0.5)' }}
                >
                  {agent ? businessName : 'Caller'}
                </p>
                <p className="text-[17px] leading-snug" style={{ color: s.final || agent ? INK : 'rgba(11,15,20,0.5)' }}>
                  {s.text}
                </p>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}

function ActionRow({ action }) {
  const warn = action.tone === 'warn';
  const done = action.tone === 'done';
  return (
    <li className="flex gap-3">
      <span
        className="mt-0.5 h-5 w-5 rounded-full flex items-center justify-center shrink-0"
        style={{
          background: done ? 'rgba(0,179,126,0.12)' : warn ? 'rgba(217,119,6,0.12)' : 'rgba(11,15,20,0.06)',
          color: done ? '#00875F' : warn ? '#B45309' : 'rgba(11,15,20,0.6)',
        }}
      >
        {warn ? <CircleAlert className="h-3 w-3" /> : <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-medium leading-5">{action.title}</span>
        {action.detail && (
          <span className="block font-mono text-[11px] leading-4 mt-0.5" style={{ color: 'rgba(11,15,20,0.62)' }}>
            {action.detail}
          </span>
        )}
      </span>
    </li>
  );
}

function EventCard({ booking, destination }) {
  const def = getDestination(booking.provider || destination);
  const external = def?.kind === 'external';
  // status: 'booked' | 'moved' | 'cancelled' (the appointments agent can
  // change an event an earlier call created, not only create one).
  const cancelled = booking.status === 'cancelled';
  const moved = booking.status === 'moved';
  const pending = cancelled ? 'Removing from' : moved ? 'Updating' : 'Saving to';
  const done = cancelled ? 'Removed from ' : '';
  const footer = cancelled
    ? 'Cancelled by the Voco voice agent'
    : moved
      ? 'Moved by the Voco voice agent'
      : 'Booked by the Voco voice agent';
  return (
    <div className="mt-5 rounded-lg border overflow-hidden" style={{ borderColor: booking.saved ? SIGNAL : LINE }}>
      <div className="flex">
        <span className="w-1 shrink-0" style={{ background: cancelled ? LINE : SIGNAL }} />
        <div className="p-4 min-w-0 flex-1">
          <p className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em]" style={{ color: 'rgba(11,15,20,0.62)' }}>
            <CalendarCheck className="h-3.5 w-3.5" />
            {booking.saved
              ? `${done}${def?.label || 'Calendar'}`
              : external && !booking.failed
                ? `${pending} ${def.label}…`
                : 'Voco calendar'}
          </p>
          <p className={`mt-1.5 text-[15px] font-semibold leading-snug${cancelled ? ' line-through opacity-60' : ''}`}>{booking.title}</p>
          {moved && booking.previousWhen && (
            <p className="font-mono text-xs mt-1 line-through" style={{ color: 'rgba(11,15,20,0.4)' }}>{booking.previousWhen}</p>
          )}
          <p className={`font-mono text-xs mt-1${cancelled ? ' line-through' : ''}`} style={{ color: 'rgba(11,15,20,0.72)' }}>{booking.when}</p>
          <p className="text-xs mt-1" style={{ color: 'rgba(11,15,20,0.5)' }}>{footer}</p>
          {booking.link && !cancelled && (
            <a
              href={booking.link}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-flex items-center gap-1.5 h-8 px-3 rounded-md text-xs font-semibold text-white"
              style={{ background: INK }}
            >
              {def?.openLabel || 'Open event'}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
