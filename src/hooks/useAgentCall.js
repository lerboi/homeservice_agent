'use client';

/**
 * useAgentCall — the browser side of a web test call with the voice agent.
 *
 * One implementation shared by /admin/test-agent (engineering console) and
 * /admin/demo (Demo Studio). It owns:
 *   - microphone permission, device picker and live input-level meter
 *   - the LiveKit room: connect, publish the mic, dispatch the agent
 *   - live captions (`lk.transcription` text streams)
 *   - live agent actions (`voco.events` text stream: tool calls, "booked",
 *     "calendar_saved"), published by the agent for web test rooms
 *   - who is speaking (for a voice visual)
 *   - post-call polling for the analyzed calls row and the MP4 recording
 *
 * The caller supplies the session route and its body through startCall(), so
 * each page decides what kind of session is created; everything after that
 * (dispatch, result) uses the shared /api/admin/test-agent routes, which
 * accept any `test-web-` room.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { DisconnectReason, Room, RoomEvent, Track } from 'livekit-client';

const POLL_INTERVAL_MS = 2500;
const POLL_MAX_MS = 120_000; // egress upload can lag the call close
const EVENTS_TOPIC = 'voco.events';

/**
 * Parse a JSON API response, but turn a non-JSON body (Vercel's HTML error
 * pages for function crashes/timeouts, an HTML sign-in redirect, a proxy
 * challenge page) into a readable error naming the HTTP status, the Vercel
 * error code and request id — instead of "Unexpected token '<'".
 */
export async function readJsonResponse(res, tag = 'agent-call') {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    const vercelId = res.headers.get('x-vercel-id') || '';
    const vercelErr = res.headers.get('x-vercel-error') || '';
    const codeMatch = text.match(/[A-Z_]{6,}(?:_[A-Z]+)+/); // e.g. FUNCTION_INVOCATION_TIMEOUT
    const snippet = text.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
    const detail = [
      `HTTP ${res.status}`,
      vercelErr || (codeMatch ? codeMatch[0] : null),
      vercelId ? `id ${vercelId}` : null,
      snippet ? `— ${snippet}` : null,
    ].filter(Boolean).join(' ');
    console.error(`[${tag}] non-JSON response from`, res.url, detail, text.slice(0, 2000));
    throw new Error(`server returned a non-JSON page (${detail})`);
  }
}

export function fmtElapsed(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function describeMicError(err) {
  const name = err?.name || '';
  const text = name + ' ' + String(err?.message || err);
  if (/by system|system denied/i.test(text)) {
    return 'The operating system is blocking microphone access for this browser. On Windows: Settings > Privacy & security > Microphone > allow apps (and desktop apps) to access the microphone; on macOS: System Settings > Privacy & Security > Microphone. Then try again.';
  }
  if (/NotAllowed|Permission|denied|SecurityError/i.test(text)) {
    return 'Microphone access was denied. Allow the microphone for this site (browser address-bar icon, or chrome://settings/content/microphone) and try again.';
  }
  if (/NotFound|DevicesNotFound|OverconstrainedError/i.test(name)) {
    return 'No microphone was found on this device.';
  }
  if (/NotReadable|TrackStartError|AbortError/i.test(name)) {
    return 'The microphone is in use by another app or could not be started. Close other apps using it and try again.';
  }
  return `Could not access the microphone: ${err?.message || err}`;
}

// Returns a user-facing message when the site's Permissions-Policy blocks the
// microphone for this page (getUserMedia then fails like a denial with no way
// to grant), or null when the mic is allowed / the policy API is unavailable.
function micPolicyBlockedMessage() {
  try {
    const policy = document.permissionsPolicy || document.featurePolicy;
    if (policy && typeof policy.allowsFeature === 'function' && !policy.allowsFeature('microphone')) {
      return (
        "The microphone is blocked by the site's Permissions-Policy header for this page. " +
        'Hard-reload the page; if this persists, the deployment is still sending microphone=().'
      );
    }
  } catch { /* policy API unavailable — let getUserMedia decide */ }
  return null;
}

const NO_MEDIA_MESSAGE =
  'This browser cannot capture the microphone here (needs HTTPS and a modern browser).';

export function useAgentCall({ tag = 'agent-call' } = {}) {
  // Call lifecycle: idle | connecting | in-call | ended | error
  const [phase, setPhase] = useState('idle');
  const [error, setError] = useState(null);
  const [endReason, setEndReason] = useState(null); // why the room disconnected (genuine ends only)
  const [audioBlocked, setAudioBlocked] = useState(false); // browser autoplay policy blocked agent audio
  const [agentJoined, setAgentJoined] = useState(false);
  const [muted, setMuted] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [segments, setSegments] = useState([]); // [{id, who, text, final}]
  const [events, setEvents] = useState([]); // [{id, type, ts, ...payload}] from voco.events
  const [session, setSession] = useState(null); // the session route's JSON for the current call
  const [agentSpeaking, setAgentSpeaking] = useState(false);
  const [userSpeaking, setUserSpeaking] = useState(false);

  // Microphone selection + live input level. A machine can expose several audio
  // inputs (built-in, USB mic, virtual/streaming capture devices) and
  // getUserMedia({audio:true}) blindly takes the OS default — which may be a
  // silent virtual device, so the agent greets and then hears nothing. The
  // picker + level meter let the admin choose the right mic and SEE it working
  // before (and during) the call, turning "I can't talk" into a visible cause.
  const [devices, setDevices] = useState([]); // [{deviceId, label}]
  const [deviceId, setDeviceId] = useState(''); // '' = system default
  const [micLevel, setMicLevel] = useState(0); // smoothed 0..1 peak for the meter
  const [micChecked, setMicChecked] = useState(false); // preview has run at least once
  const [micSilent, setMicSilent] = useState(false); // preview heard no sound

  // Post-call result
  const [result, setResult] = useState(null);
  const [recordingUrl, setRecordingUrl] = useState(null);
  const [polling, setPolling] = useState(false);

  const roomRef = useRef(null);
  const roomNameRef = useRef(null);
  const micStreamRef = useRef(null);
  // Set while startCall is tearing the room down because a step FAILED — the
  // resulting RoomEvent.Disconnected must not be reported as a normal "ended".
  const abortingRef = useRef(false);
  const audioContainerRef = useRef(null);
  const timerRef = useRef(null);
  const pollRef = useRef(null);
  const phaseRef = useRef('idle');
  const deviceIdRef = useRef('');
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);
  useEffect(() => {
    deviceIdRef.current = deviceId;
  }, [deviceId]);

  // ── Microphone level meter (Web Audio) ────────────────────────────────────
  // A separate "preview" stream drives the meter before the call; during the
  // call the meter runs on the published mic stream so the admin can watch
  // their own voice register in real time.
  const previewStreamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const meterRafRef = useRef(null);
  const peakRef = useRef(0); // running max since the meter (re)started — silence probe

  const stopMeter = useCallback(() => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = null;
    try { analyserRef.current?.disconnect(); } catch { /* noop */ }
    analyserRef.current = null;
    try { audioCtxRef.current?.close(); } catch { /* noop */ }
    audioCtxRef.current = null;
    setMicLevel(0);
  }, []);

  const startMeter = useCallback((stream) => {
    stopMeter();
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx || !stream) return;
      const ctx = new Ctx();
      ctx.resume?.().catch(() => { /* resumes on the click that called us */ });
      audioCtxRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.fftSize);
      peakRef.current = 0;
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) {
          const v = Math.abs(data[i] - 128) / 128;
          if (v > peak) peak = v;
        }
        if (peak > peakRef.current) peakRef.current = peak;
        // Smooth for a calmer bar; snap up fast, decay slow.
        setMicLevel((prev) => (peak > prev ? peak : prev * 0.8 + peak * 0.2));
        meterRafRef.current = requestAnimationFrame(tick);
      };
      tick();
    } catch (e) {
      console.warn(`[${tag}] level meter unavailable:`, e);
    }
  }, [stopMeter, tag]);

  // ── Cleanup on unmount ───────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      try { roomRef.current?.disconnect(); } catch { /* already gone */ }
      try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      try { previewStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      stopMeter();
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [stopMeter]);

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

  // Called on RoomEvent.Disconnected (reason = livekit DisconnectReason enum) and
  // by hangUp (no reason). While an error path is tearing the room down
  // (abortingRef) the disconnect is a side effect of the failure, not an end —
  // the error must stay visible instead of the results.
  const handleEnded = useCallback((reason) => {
    if (abortingRef.current) return;
    if (phaseRef.current === 'ended') return;
    if (typeof reason === 'number') {
      const name = DisconnectReason[reason] || `code ${reason}`;
      console.warn(`[${tag}] room disconnected:`, name);
      setEndReason(name);
    }
    setPhase('ended');
    setAgentSpeaking(false);
    setUserSpeaking(false);
    if (timerRef.current) clearInterval(timerRef.current);
    stopMeter();
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    micStreamRef.current = null;
    if (roomNameRef.current) startPolling(roomNameRef.current);
  }, [startPolling, stopMeter, tag]);

  // Tear the room down after a failed step WITHOUT flipping the UI to "ended".
  function abortCall(room, message, err) {
    console.error(`[${tag}]`, message, err || '');
    abortingRef.current = true;
    setError(message);
    setPhase('error');
    try { room?.off(RoomEvent.Disconnected, handleEnded); } catch { /* noop */ }
    try { room?.disconnect(); } catch { /* noop */ }
    stopMeter();
    try { micStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    micStreamRef.current = null;
    roomRef.current = null;
    // Release the guard once the disconnect has flushed its events.
    setTimeout(() => { abortingRef.current = false; }, 1000);
  }

  // getUserMedia audio constraint for a device id ('' / undefined = default).
  // Guard the type: only a non-empty STRING is a device id — never let a stray
  // value (e.g. a click event) become an { exact } constraint (OverconstrainedError).
  function micConstraint(id = deviceIdRef.current) {
    return typeof id === 'string' && id ? { deviceId: { exact: id } } : true;
  }

  // Populate the device picker. Labels are only exposed after a mic permission
  // has been granted once, so this is called right after a successful
  // getUserMedia — before that the list has anonymous entries we skip.
  async function refreshDevices(preferredId) {
    try {
      const list = await navigator.mediaDevices.enumerateDevices();
      const inputs = list
        .filter((d) => d.kind === 'audioinput' && d.deviceId && d.deviceId !== 'default')
        .map((d) => ({ deviceId: d.deviceId, label: d.label || 'Microphone' }));
      setDevices(inputs);
      // If nothing is selected yet, adopt whichever device the granted stream
      // actually used so the picker and the live stream agree.
      if (!deviceIdRef.current && preferredId && inputs.some((d) => d.deviceId === preferredId)) {
        setDeviceId(preferredId);
      }
    } catch { /* enumeration best-effort */ }
  }

  function stopPreview() {
    try { previewStreamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
    previewStreamRef.current = null;
  }

  // Preview the selected microphone: grant permission (once), light up the
  // level meter, populate the device list, and after a short listen flag a
  // silent device. Safe to call repeatedly (e.g. after switching devices).
  // `overrideId` lets onSelectDevice preview the just-picked device without
  // waiting for the deviceId state update to flush.
  async function checkMic(overrideId) {
    const useId = typeof overrideId === 'string' ? overrideId : deviceIdRef.current;
    setError(null);
    setMicSilent(false);
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(NO_MEDIA_MESSAGE);
      return;
    }
    const policyMsg = micPolicyBlockedMessage();
    if (policyMsg) { setError(policyMsg); return; }
    stopPreview();
    stopMeter();
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: micConstraint(useId) });
    } catch (err) {
      console.error(`[${tag}] checkMic getUserMedia failed:`, err);
      setError(describeMicError(err));
      return;
    }
    previewStreamRef.current = stream;
    setMicChecked(true);
    const usedId = stream.getAudioTracks()[0]?.getSettings?.().deviceId;
    await refreshDevices(usedId);
    startMeter(stream);
    // Listen for ~1.8s; if the peak never rises above the noise floor the
    // device is producing no sound (muted hardware, wrong virtual device).
    peakRef.current = 0;
    const probed = stream;
    setTimeout(() => {
      if (previewStreamRef.current === probed) setMicSilent(peakRef.current < 0.02);
    }, 1800);
  }

  function onSelectDevice(id) {
    setDeviceId(id);
    deviceIdRef.current = id;
    setMicSilent(false);
    // Re-preview the newly chosen device so the meter reflects it immediately.
    if (micChecked) checkMic(id);
  }

  /**
   * Start a call.
   * @param {object} opts
   * @param {string} opts.sessionUrl - POST route that creates the room and
   *   returns { room_name, token, livekit_url, ... }.
   * @param {object} opts.body - JSON body for that route.
   */
  async function startCall({ sessionUrl, body }) {
    setError(null);
    setEndReason(null);
    setAudioBlocked(false);
    setSegments([]);
    setEvents([]);
    setSession(null);
    setResult(null);
    setRecordingUrl(null);
    setAgentJoined(false);
    setAgentSpeaking(false);
    setUserSpeaking(false);
    setMuted(false);
    setElapsed(0);
    setMicSilent(false);
    abortingRef.current = false;
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(false);
    setPhase('connecting');

    // Microphone FIRST, inside the click's user-gesture window and before any
    // network round-trip: a permission/device failure is then reported as
    // itself (previously it happened after the room was connected, and the
    // teardown's Disconnected event overwrote the error with "Call ended").
    // Mobile Safari also only grants getUserMedia within the gesture.
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setError(NO_MEDIA_MESSAGE);
      setPhase('error');
      return;
    }
    // A Permissions-Policy header that disables the microphone makes
    // getUserMedia fail exactly like a user denial, but the browser offers no
    // way to allow it. Chrome exposes the effective policy — name it.
    const policyMsg = micPolicyBlockedMessage();
    if (policyMsg) {
      setError(policyMsg);
      setPhase('error');
      return;
    }
    // Release any preview stream + meter so the call opens the selected device
    // cleanly (some drivers refuse a second concurrent open of the same mic).
    stopPreview();
    stopMeter();
    let micStream;
    try {
      // Honor the picked device; fall back to the system default when unset.
      micStream = await navigator.mediaDevices.getUserMedia({ audio: micConstraint() });
      micStreamRef.current = micStream;
      // Labels only become available after a grant — refresh the list now so a
      // first-time caller who skipped "Check microphone" still gets a picker.
      refreshDevices(micStream.getAudioTracks()[0]?.getSettings?.().deviceId);
    } catch (err) {
      console.error(`[${tag}] getUserMedia failed:`, err);
      setError(describeMicError(err));
      setPhase('error');
      return;
    }

    let sessionJson;
    try {
      const res = await fetch(sessionUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body || {}),
      });
      sessionJson = await readJsonResponse(res, tag);
      if (!res.ok) throw new Error(sessionJson.error || `HTTP ${res.status}`);
    } catch (err) {
      console.error(`[${tag}] session request failed:`, err);
      setError(`Could not start a session: ${err.message}`);
      setPhase('error');
      try { micStream.getTracks().forEach((t) => t.stop()); } catch { /* noop */ }
      micStreamRef.current = null;
      return;
    }
    setSession(sessionJson);

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

    // Live agent actions: one JSON object per stream (tool calls, "booked",
    // "calendar_saved"). Best-effort, like captions.
    room.registerTextStreamHandler(EVENTS_TOPIC, async (reader) => {
      try {
        const text = await reader.readAll();
        const event = JSON.parse(text);
        if (!event || typeof event.type !== 'string') return;
        const id = reader.info?.id || `${event.type}-${event.ts || Date.now()}-${Math.random()}`;
        setEvents((prev) => (prev.some((e) => e.id === id) ? prev : [...prev, { ...event, id }]));
      } catch {
        /* a malformed event is dropped */
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
    room.on(RoomEvent.ActiveSpeakersChanged, (speakers) => {
      const local = room.localParticipant?.identity;
      setUserSpeaking(speakers.some((p) => p.identity === local));
      setAgentSpeaking(speakers.some((p) => p.identity !== local));
    });
    room.on(RoomEvent.Disconnected, handleEnded);
    // Autoplay policy (notably iOS/Safari and some Chrome states): the agent's
    // audio element may be created outside a user gesture and stay silent
    // until room.startAudio() is called from a tap — surface a button.
    room.on(RoomEvent.AudioPlaybackStatusChanged, () => {
      setAudioBlocked(!room.canPlaybackAudio);
    });

    try {
      await room.connect(sessionJson.livekit_url, sessionJson.token);
    } catch (err) {
      abortCall(room, `Could not connect to the call server: ${err?.message || err}`, err);
      return;
    }

    try {
      // Publish the already-granted microphone track (no second permission
      // prompt, no gesture requirement). Source=Microphone keeps
      // setMicrophoneEnabled() bound to this publication.
      const [micTrack] = micStream.getAudioTracks();
      if (!micTrack) throw new Error('microphone stream has no audio track');
      await room.localParticipant.publishTrack(micTrack, {
        source: Track.Source.Microphone,
        name: 'microphone',
      });
    } catch (err) {
      abortCall(room, `Could not publish the microphone: ${err?.message || err}`, err);
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
        const j = await readJsonResponse(res, tag).catch((e) => ({ error: e.message }));
        throw new Error(j.error || `HTTP ${res.status}`);
      }
    } catch (err) {
      abortCall(room, `Agent dispatch failed: ${err?.message || err}`, err);
      return;
    }

    setAudioBlocked(!room.canPlaybackAudio);
    // Keep the level meter running on the published mic so the admin can watch
    // their voice register during the call — a flat bar means the agent hears
    // nothing (wrong/silent device), which was invisible before.
    startMeter(micStream);
    setPhase('in-call');
    const startedAt = Date.now();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setElapsed(Math.round((Date.now() - startedAt) / 1000));
    }, 1000);
  }

  function hangUp() {
    setEndReason('hung up');
    try { roomRef.current?.disconnect(); } catch { /* noop */ }
    handleEnded();
  }

  async function enableAudio() {
    try {
      await roomRef.current?.startAudio();
      setAudioBlocked(!roomRef.current?.canPlaybackAudio);
    } catch (err) {
      console.warn(`[${tag}] startAudio failed:`, err);
    }
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

  // Back to the setup state after a finished or failed call.
  function reset() {
    if (pollRef.current) clearInterval(pollRef.current);
    setPolling(false);
    setPhase('idle');
    setError(null);
  }

  return {
    // lifecycle
    phase,
    inCall: phase === 'in-call' || phase === 'connecting',
    error,
    setError,
    endReason,
    agentJoined,
    elapsed,
    session,
    // audio
    audioContainerRef,
    audioBlocked,
    enableAudio,
    muted,
    toggleMute,
    agentSpeaking,
    userSpeaking,
    // microphone
    devices,
    deviceId,
    onSelectDevice,
    micLevel,
    micChecked,
    micSilent,
    checkMic,
    // live data
    segments,
    events,
    // post-call
    result,
    recordingUrl,
    polling,
    // actions
    startCall,
    hangUp,
    reset,
  };
}
