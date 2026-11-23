'use client';

/**
 * /admin/test-agent — browser-based test console for the AI receptionist.
 *
 * Talks to the SAME production agent (Railway) over a LiveKit WebRTC room —
 * no phone call, no Twilio. Flow:
 *   1. Pick a tenant (the agent answers as that tenant's receptionist).
 *   2. POST /api/admin/test-agent/session → room + join token (metadata marks
 *      the room as a sandboxed test call; server-set, not alterable here).
 *   3. Connect the browser mic, THEN POST /api/admin/test-agent/dispatch so the
 *      agent joins a room that already has its participant.
 *   4. Live captions via the agent's `lk.transcription` text streams.
 *   5. Hang up (or let the agent end the call) → poll
 *      /api/admin/test-agent/result for the analyzed calls row + MP4 recording.
 *
 * Sandbox guarantees (enforced agent-side): no CRM writes, no owner SMS/email,
 * no caller SMS, no calendar events, no billing. A booking made during a test
 * creates a real appointment row that is auto-cancelled when the call ends —
 * it briefly occupies the slot, which is what makes the test realistic.
 */

import { useEffect, useRef, useState } from 'react';
import { Search, Phone, PhoneOff, Mic, MicOff, Download, RefreshCw } from 'lucide-react';
import { fmtElapsed, useAgentCall } from '@/hooks/useAgentCall';

export default function TestAgentPage() {
  // Tenant picker
  const [searchInput, setSearchInput] = useState('');
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [simulateFrom, setSimulateFrom] = useState('');
  const [voices, setVoices] = useState([]);
  const [voiceOverride, setVoiceOverride] = useState(''); // '' = tenant's production voice

  // Microphone, LiveKit room, captions and post-call polling live in the hook
  // shared with the Demo Studio (/admin/demo).
  const call = useAgentCall({ tag: 'test-agent' });
  const {
    phase, inCall, error, endReason, audioBlocked, agentJoined, muted, elapsed, segments,
    devices, deviceId, micLevel, micChecked, micSilent, result, recordingUrl, polling,
    audioContainerRef, checkMic, onSelectDevice, hangUp, enableAudio, toggleMute,
  } = call;

  // ── Tenant search (debounced) ────────────────────────────────────────────
  useEffect(() => {
    const t = setTimeout(async () => {
      setTenantsLoading(true);
      try {
        const params = new URLSearchParams({ page: '0' });
        if (searchInput) params.set('search', searchInput);
        const res = await fetch(`/api/admin/tenants?${params}`);
        if (res.ok) {
          const json = await res.json();
          setTenants(json.data || []);
        }
      } catch {
        /* keep previous list */
      } finally {
        setTenantsLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ── Voice options (curated allowlist served by the session route) ────────
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/test-agent/session');
        if (res.ok) {
          const json = await res.json();
          setVoices(json.voices || []);
        }
      } catch {
        /* picker degrades to "production voice" only */
      }
    })();
  }, []);

  function startCall() {
    if (!selectedTenant) return;
    call.startCall({
      sessionUrl: '/api/admin/test-agent/session',
      body: {
        tenant_id: selectedTenant.id,
        ...(simulateFrom.trim() ? { simulate_from_number: simulateFrom.trim() } : {}),
        ...(voiceOverride ? { voice_override: voiceOverride } : {}),
      },
    });
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-semibold text-slate-900">Test Agent</h1>
        {inCall && (
          <span className="text-sm font-mono text-slate-600">{fmtElapsed(elapsed)} / 10:00 max</span>
        )}
      </div>
      <p className="text-sm text-slate-500 mb-6 max-w-3xl">
        Talk to the live AI receptionist from your browser — no phone call needed. Test calls are
        sandboxed: no CRM records, no owner or caller SMS/email, no calendar events, no billing.
        A booking made during a test briefly occupies the real slot and is auto-cancelled when the
        call ends. Asking for a transfer exercises the transfer-failure recovery path (a browser
        can&apos;t receive a SIP transfer). The conversation is recorded as an MP4 you can download below.
      </p>

      {/* Hidden container for the agent's audio element(s) */}
      <div ref={audioContainerRef} className="hidden" />

      {/* ── Setup card ── */}
      {!inCall && phase !== 'ended' && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 mb-6 max-w-3xl">
          <h2 className="text-sm font-semibold text-slate-900 mb-3">1. Choose a tenant to test as</h2>
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search by business name or owner..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full max-w-sm pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <div className="border border-slate-200 rounded-md divide-y divide-slate-100 max-h-56 overflow-y-auto mb-4">
            {tenantsLoading ? (
              <div className="p-3 text-sm text-slate-400">Loading…</div>
            ) : tenants.length === 0 ? (
              <div className="p-3 text-sm text-slate-400">No tenants found</div>
            ) : (
              tenants.map((t) => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTenant(t)}
                  className={[
                    'w-full text-left px-3 py-2 text-sm flex items-center justify-between hover:bg-slate-50',
                    selectedTenant?.id === t.id ? 'bg-blue-50' : '',
                  ].join(' ')}
                >
                  <span className="font-medium text-slate-900">{t.business_name || '—'}</span>
                  <span className="text-slate-500 text-xs">
                    {t.phone_number || 'no number'}
                    {t.onboarding_complete ? '' : ' · onboarding incomplete'}
                  </span>
                </button>
              ))
            )}
          </div>

          <h2 className="text-sm font-semibold text-slate-900 mb-2">
            2. Optional: simulate a caller number
          </h2>
          <input
            type="text"
            placeholder="+6591234567 (exercises the repeat-caller path; read-only)"
            value={simulateFrom}
            onChange={(e) => setSimulateFrom(e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-4"
          />

          <h2 className="text-sm font-semibold text-slate-900 mb-2">
            3. Optional: choose the AI voice for this test
          </h2>
          <select
            value={voiceOverride}
            onChange={(e) => setVoiceOverride(e.target.value)}
            className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-1"
          >
            <option value="">Tenant&apos;s production voice (no override)</option>
            {[...new Set(voices.map((v) => v.group))].map((group) => (
              <optgroup key={group} label={group}>
                {voices.filter((v) => v.group === group).map((v) => (
                  <option key={v.id} value={v.id}>{v.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-slate-400 mb-4">
            Test-call only — never changes what real callers hear.
          </p>

          <h2 className="text-sm font-semibold text-slate-900 mb-2">
            4. Microphone
          </h2>
          <div className="flex flex-col sm:flex-row gap-2 mb-1">
            <select
              value={deviceId}
              onChange={(e) => onSelectDevice(e.target.value)}
              className="w-full max-w-sm px-3 py-2 text-sm border border-slate-200 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">System default microphone</option>
              {devices.map((d) => (
                <option key={d.deviceId} value={d.deviceId}>{d.label}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => checkMic()}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50 shrink-0"
            >
              <Mic className="h-4 w-4" />
              {micChecked ? 'Re-check' : 'Check microphone'}
            </button>
          </div>
          <MicMeter level={micLevel} active={micChecked} className="max-w-sm mb-1" />
          {micChecked && !micSilent && (
            <p className="text-xs text-slate-400 mb-4">
              Speak — the bar should move. If it stays flat, pick a different device above. This is
              exactly what the agent hears.
            </p>
          )}
          {micSilent && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 my-2 max-w-sm">
              No sound detected from this microphone — the agent would hear silence and end the call.
              Choose a different device above, or check that the mic isn&apos;t muted, then re-check.
            </p>
          )}
          {!micChecked && (
            <p className="text-xs text-slate-400 mb-4">
              Optional: confirm the right microphone is picked before calling (this machine has
              several). The call also captures the selected device.
            </p>
          )}

          {selectedTenant && !selectedTenant.phone_number && (
            <p className="text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2 mb-4">
              This tenant has no AI phone number provisioned — the agent can&apos;t resolve it. Pick a
              tenant with a number.
            </p>
          )}
          {error && phase === 'error' && (
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
              {error}
            </p>
          )}

          <button
            onClick={startCall}
            disabled={!selectedTenant || !selectedTenant.phone_number}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1D4ED8] text-white text-sm font-medium rounded-md hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="h-4 w-4" />
            Start test call{selectedTenant ? ` as ${selectedTenant.business_name}` : ''}
          </button>
        </div>
      )}

      {/* ── In-call card ── */}
      {inCall && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 mb-6 max-w-3xl">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className={[
                'inline-block h-2.5 w-2.5 rounded-full',
                phase === 'in-call' && agentJoined ? 'bg-green-500 animate-pulse' : 'bg-amber-400',
              ].join(' ')} />
              <span className="text-sm font-medium text-slate-900">
                {phase === 'connecting'
                  ? 'Connecting…'
                  : agentJoined
                    ? `In call with ${selectedTenant?.business_name || 'agent'}`
                    : 'Waiting for the agent to join…'}
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={toggleMute}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50"
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={hangUp}
                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3 py-2 sm:py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                <PhoneOff className="h-4 w-4" />
                Hang up
              </button>
            </div>
          </div>
          {audioBlocked && (
            <button
              onClick={enableAudio}
              className="w-full mb-3 inline-flex items-center justify-center gap-2 px-3 py-2 bg-amber-100 text-amber-900 border border-amber-300 rounded-md text-sm font-medium"
            >
              Tap to enable the agent&apos;s audio (blocked by the browser&apos;s autoplay policy)
            </button>
          )}
          <div className="flex items-center gap-2 mb-3">
            {muted ? <MicOff className="h-4 w-4 text-slate-400 shrink-0" /> : <Mic className="h-4 w-4 text-slate-500 shrink-0" />}
            <MicMeter level={muted ? 0 : micLevel} active className="flex-1" />
            <span className="text-[11px] text-slate-400 shrink-0 w-24 text-right">
              {muted ? 'you are muted' : 'your mic → agent'}
            </span>
          </div>
          <TranscriptPane segments={segments} live />
        </div>
      )}

      {/* ── Results card ── */}
      {phase === 'ended' && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 mb-6 max-w-3xl">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
            <h2 className="text-sm font-semibold text-slate-900">
              Call ended — results
              {endReason && <span className="ml-2 font-normal text-slate-500">({endReason})</span>}
            </h2>
            <div className="flex items-center gap-2">
              {polling && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  processing…
                </span>
              )}
              <button
                onClick={() => call.reset()}
                className="px-3 py-1.5 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50"
              >
                New test call
              </button>
            </div>
          </div>

          {result ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
              <ResultStat label="Outcome" value={result.booking_outcome || '—'} />
              <ResultStat label="Urgency" value={result.urgency_classification || '—'} />
              <ResultStat label="Triage layer" value={result.triage_layer_used || '—'} />
              <ResultStat label="Ended by" value={result.disconnection_reason || '—'} />
            </div>
          ) : (
            <p className="text-sm text-slate-500 mb-4">Waiting for the post-call pipeline…</p>
          )}

          {recordingUrl ? (
            <div className="mb-4">
              <audio controls src={recordingUrl} className="w-full mb-2" />
              <a
                href={recordingUrl}
                className="inline-flex items-center gap-1.5 text-sm text-blue-700 hover:underline"
              >
                <Download className="h-4 w-4" />
                Download recording (MP4)
              </a>
            </div>
          ) : (
            <p className="text-sm text-slate-400 mb-4">
              Recording (MP4) will appear here once the upload finishes.
            </p>
          )}

          <TranscriptPane
            segments={
              result?.transcript_structured
                ? result.transcript_structured.map((t, i) => ({
                    id: `final-${i}`,
                    who: t.role === 'user' ? 'You' : 'Agent',
                    text: t.content,
                    final: true,
                  }))
                : segments
            }
          />
        </div>
      )}
    </div>
  );
}

// Horizontal input-level bar. `level` is a 0..1 peak; green until it gets hot.
function MicMeter({ level = 0, active = false, className = '' }) {
  const pct = Math.min(100, Math.round(level * 140)); // headroom so normal speech fills most of the bar
  const color = pct > 85 ? 'bg-red-500' : pct > 8 ? 'bg-green-500' : 'bg-slate-300';
  return (
    <div className={`h-2.5 rounded-full bg-slate-100 border border-slate-200 overflow-hidden ${className}`}>
      <div
        className={`h-full ${active ? color : 'bg-slate-200'} transition-[width] duration-75`}
        style={{ width: active ? `${pct}%` : '0%' }}
      />
    </div>
  );
}

function ResultStat({ label, value }) {
  return (
    <div className="border border-slate-200 rounded-md px-3 py-2">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="text-sm font-medium text-slate-900">{String(value).replace(/_/g, ' ')}</p>
    </div>
  );
}

function TranscriptPane({ segments, live = false }) {
  const endRef = useRef(null);
  useEffect(() => {
    if (live) endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [segments, live]);

  return (
    <div className="border border-slate-200 rounded-md bg-slate-50 p-3 max-h-72 overflow-y-auto">
      {segments.length === 0 ? (
        <p className="text-sm text-slate-400">
          {live ? 'Live transcript will appear here as you talk…' : 'No transcript available.'}
        </p>
      ) : (
        <div className="space-y-2">
          {segments.map((s) => (
            <div key={s.id} className="text-sm">
              <span className={[
                'font-semibold mr-2',
                s.who === 'You' ? 'text-blue-700' : 'text-slate-900',
              ].join(' ')}>
                {s.who}:
              </span>
              <span className={s.final ? 'text-slate-700' : 'text-slate-400 italic'}>{s.text}</span>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
}
