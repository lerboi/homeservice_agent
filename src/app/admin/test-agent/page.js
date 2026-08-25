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

import { useCallback, useEffect, useRef, useState } from 'react';
import { Room, RoomEvent, Track } from 'livekit-client';
import { Search, Phone, PhoneOff, Mic, MicOff, Download, RefreshCw } from 'lucide-react';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 120_000; // egress upload can lag the call close

function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export default function TestAgentPage() {
  // Tenant picker
  const [searchInput, setSearchInput] = useState('');
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [selectedTenant, setSelectedTenant] = useState(null);
  const [simulateFrom, setSimulateFrom] = useState('');

  // Call lifecycle: idle | connecting | in-call | ended | error
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [agentJoined, setAgentJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [segments, setSegments] = useState([]); // [{id, who, text, final}]

  // Post-call result
  const [result, setResult] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [polling, setPolling] = useState(false);

  const roomRef = useRef(null);
  const roomNameRef = useRef(null);
  const audioContainerRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const phaseRef = useRef('idle');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

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

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { roomRef.current?.disconnect(); } catch { /* already gone */ }
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // ── Post-call result polling ─────────────────────────────────────────────
  const startPolling = useCallback((roomName) => {
    setPolling(true);
    const startedAt = Date.now();
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_MAX_MS) {
        clearInterval(pollRef.current);
        setPolling(false);
        return;
      }
      try {
        const res = await fetch(`/api/admin/test-agent/result?room=${encodeURIComponent(roomName)}`);
        if (!res.ok) return;
        const json = await res.json();
        if (json.call) setResult(json.call);
        if (json.recording_url) setRecordingUrl(json.recording_url);
        // Stop once we have the analyzed row AND the recording (or timed out).
        if (json.call?.status === 'analyzed' && json.recording_url) {
          clearInterval(pollRef.current);
          setPolling(false);
        }
      } catch {
        /* transient — keep polling */
      }
    }, POLL_INTERVAL_MS);
  }, []);

  const handleEnded = useCallback(() => {
    if (phaseRef.current === 'ended') return;
    setPhase('ended');
    if (timerRef.current) clearInterval(timerRef.current);
    if (roomNameRef.current) startPolling(roomNameRef.current);
  }, [startPolling]);

  // ── Start test call ──────────────────────────────────────────────────────
  async function startCall() {
    if (!selectedTenant) return;
    setError(null);
    setSegments([]);
    setResult(null);
    setRecordingUrl(null);
    setAgentJoined(false);
    setMuted(false);
    setElapsed(0);
    setPhase('connecting');

    let sessionJson;
    try {
      const res = await fetch('/api/admin/test-agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tenant_id: selectedTenant.id,
          ...(simulateFrom.trim() ? { simulate_from_number: simulateFrom.trim() } : {}),
        }),
      });
      sessionJson = await res.json();
      if (!res.ok) throw new Error(sessionJson.error || 'Failed to create session');
    } catch (err) {
      setError(err.message);
      setPhase('error');
      return;
    }

    const room = new Room();
    roomRef.current = room;
    roomNameRef.current = sessionJson.room_name;

    // Live captions: the agent publishes both its own and the caller's
    // transcription as `lk.transcription` text streams. Speaker attribution:
    // segments whose transcribed track is our local mic are "You".
    room.registerTextStreamHandler('lk.transcription', async (reader) => {
      try {
        const attrs = reader.info?.attributes || {};
        const segId = attrs['lk.segment_id'] || reader.info?.id || `${Date.now()}`;
        const trackId = attrs['lk.transcribed_track_id'];
        const localSids = new Set(room.localParticipant?.trackPublications ? [...room.localParticipant.trackPublications.keys()] : []);
        const who = trackId && localSids.has(trackId) ? 'You' : 'Agent';
        let text = '';
        for await (const chunk of reader) {
          text += chunk;
          const finalFlag = attrs['lk.transcription_final'] === 'true';
          setSegments((prev) => {
            const idx = prev.findIndex((s) => s.id === segId);
            const seg = { id: segId, who, text, final: finalFlag };
            if (idx === -1) return [...prev, seg];
            const next = [...prev];
            next[idx] = seg;
            return next;
          });
        }
      } catch {
        /* captions are best-effort — audio + post-call transcript still work */
      }
    });

    room.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        el.autoplay = true;
        audioContainerRef.current?.appendChild(el);
      }
    });
    room.on(RoomEvent.ParticipantConnected, () => setAgentJoined(true));
    room.on(RoomEvent.Disconnected, handleEnded);

    try {
      await room.connect(sessionJson.livekit_url, sessionJson.token);
      await room.localParticipant.setMicrophoneEnabled(true);
    } catch (err) {
      setError(
        /permission|denied|notallowed/i.test(String(err))
          ? 'Microphone access was denied. Allow mic access and try again.'
          : `Could not connect: ${err.message}`,
      );
      setPhase('error');
      try { room.disconnect(); } catch { /* noop */ }
      return;
    }

    // Browser is in the room — NOW dispatch the agent (no join race).
    try {
      const res = await fetch('/api/admin/test-agent/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_name: sessionJson.room_name }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Dispatch failed');
      }
    } catch (err) {
      setError(`Agent dispatch failed: ${err.message}`);
      setPhase('error');
      try { room.disconnect(); } catch { /* noop */ }
      return;
    }

    setPhase('in-call');
    const startedAt = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
  }

  function hangUp() {
    try { roomRef.current?.disconnect(); } catch { /* noop */ }
    handleEnded();
  }

  async function toggleMute() {
    const room = roomRef.current;
    if (!room) return;
    const next = !muted;
    try {
      await room.localParticipant.setMicrophoneEnabled(!next);
      setMuted(next);
    } catch {
      /* noop */
    }
  }

  const inCall = phase === 'in-call' || phase === 'connecting';

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
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-3xl">
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
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D4ED8] text-white text-sm font-medium rounded-md hover:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Phone className="h-4 w-4" />
            Start test call{selectedTenant ? ` as ${selectedTenant.business_name}` : ''}
          </button>
        </div>
      )}

      {/* ── In-call card ── */}
      {inCall && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
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
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-300 rounded-md text-sm text-slate-700 hover:bg-slate-50"
              >
                {muted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                {muted ? 'Unmute' : 'Mute'}
              </button>
              <button
                onClick={hangUp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-md text-sm font-medium hover:bg-red-700"
              >
                <PhoneOff className="h-4 w-4" />
                Hang up
              </button>
            </div>
          </div>
          <TranscriptPane segments={segments} live />
        </div>
      )}

      {/* ── Results card ── */}
      {phase === 'ended' && (
        <div className="bg-white border border-slate-200 rounded-lg p-5 mb-6 max-w-3xl">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-slate-900">Call ended — results</h2>
            <div className="flex items-center gap-2">
              {polling && (
                <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  processing…
                </span>
              )}
              <button
                onClick={() => { setPhase('idle'); setError(null); }}
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
