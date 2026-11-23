"""Scripted sandboxed web test call against the DEPLOYED agent. Measures voice-to-voice gap
(end of caller audio -> first agent audio) from this machine. No secrets are printed.

Env switches:
  BASELINE_AGENT_NAME=voco-voice-agent-dev   dispatch a local dev worker instead of production
  BASELINE_DEMO=google                       Demo Studio call: the booking is pushed to that
                                             calendar and kept after the call (clean it up with
                                             demo_event_check.mjs --cleanup). Prints the
                                             voco.events stream under EVENTS."""
import asyncio, json, os, sys, time, array, math, urllib.request, io

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)


def load_env(path):
    for line in open(path, encoding="utf-8"):
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_env(r"C:\Users\leheh\.Projects\livekit-agent\.env")
load_env(r"C:\Users\leheh\.Projects\homeservice_agent\.env.local")

from livekit import api, rtc  # noqa: E402

TENANT_ID = sys.argv[1]
TO_NUMBER = sys.argv[2]
SR = 24000
UTTERANCES = [
    "Hi, I'd like to book an appointment for a product demo.",
    "My name is Alex Tan.",
    "What times do you have tomorrow afternoon?",
    "The first one works for me.",
    "Yes, please book it.",
    "No, that's all. Thank you, goodbye.",
]


def tts(text):
    voice = "JBFqnCBsd6RMkjVDRZzb"
    req = urllib.request.Request(
        f"https://api.elevenlabs.io/v1/text-to-speech/{voice}?output_format=pcm_24000",
        data=json.dumps({"text": text, "model_id": "eleven_flash_v2_5"}).encode(),
        headers={"xi-api-key": os.environ["ELEVENLABS_API_KEY"], "Content-Type": "application/json"},
    )
    return urllib.request.urlopen(req, timeout=30).read()


def rms(frame):
    a = array.array("h", bytes(frame.data))
    if not a:
        return 0.0
    return math.sqrt(sum(x * x for x in a[::4]) / (len(a) / 4)) / 32768.0


async def main():
    pcm = [tts(u) for u in UTTERANCES]
    print("caller audio ready:", [round(len(p) / 2 / SR, 2) for p in pcm], "s")
    room_name = f"test-web-{TENANT_ID}-{int(time.time() * 1000)}"
    lk = api.LiveKitAPI()
    room_meta = {"test_call": True, "web_test": True, "tenant_id": TENANT_ID, "to_number": TO_NUMBER}
    demo_destination = os.environ.get("BASELINE_DEMO", "").strip().lower()
    if demo_destination:
        room_meta["demo"] = {"task": "scheduling", "destination": demo_destination, "keep_booking": True}
    await lk.room.create_room(api.CreateRoomRequest(
        name=room_name, empty_timeout=120,
        metadata=json.dumps(room_meta)))
    token = (api.AccessToken().with_identity(f"baseline-{int(time.time())}").with_name("Baseline Caller")
             .with_grants(api.VideoGrants(room_join=True, room=room_name, can_publish=True, can_subscribe=True)).to_jwt())
    room = rtc.Room()
    state = {"last_audio": 0.0, "onsets": [], "speaking": False, "t0": time.time()}
    lines = []

    def now():
        return time.time() - state["t0"]

    async def read_audio(track):
        stream = rtc.AudioStream(track)
        quiet_since = None
        async for ev in stream:
            level = rms(ev.frame)
            t = now()
            if level > 0.01:
                if not state["speaking"]:
                    state["speaking"] = True
                    state["onsets"].append(t)
                state["last_audio"] = t
                quiet_since = None
            else:
                quiet_since = quiet_since or t
                if state["speaking"] and t - quiet_since > 0.35:
                    state["speaking"] = False

    @room.on("track_subscribed")
    def _sub(track, pub, participant):
        if track.kind == rtc.TrackKind.KIND_AUDIO:
            print(f"[{now():6.2f}] subscribed to agent audio")
            asyncio.create_task(read_audio(track))

    async def on_text(reader, participant_identity):
        attrs = reader.info.attributes or {}
        who = "caller" if attrs.get("lk.transcribed_track_id") in {p.sid for p in room.local_participant.track_publications.values()} else "agent"
        text = await reader.read_all()
        if attrs.get("lk.transcription_final", "true") == "true" or who == "agent":
            lines.append((now(), who, text.strip()))

    room.register_text_stream_handler("lk.transcription", lambda r, pid: asyncio.create_task(on_text(r, pid)))

    events = []

    async def on_event(reader, participant_identity):
        try:
            events.append((now(), json.loads(await reader.read_all())))
        except Exception as err:
            events.append((now(), {"type": "unparseable", "error": str(err)}))

    room.register_text_stream_handler("voco.events", lambda r, pid: asyncio.create_task(on_event(r, pid)))

    await room.connect(os.environ["LIVEKIT_URL"], token)
    source = rtc.AudioSource(SR, 1)
    track = rtc.LocalAudioTrack.create_audio_track("microphone", source)
    await room.local_participant.publish_track(track, rtc.TrackPublishOptions(source=rtc.TrackSource.SOURCE_MICROPHONE))
    queue = {"buf": b"", "end_at": None}
    FRAME = SR // 50  # 20 ms

    async def pump():
        nxt = time.time()
        while True:
            chunk = queue["buf"][: FRAME * 2]
            queue["buf"] = queue["buf"][FRAME * 2:]
            had = bool(chunk)
            chunk = chunk.ljust(FRAME * 2, b"\x00")
            await source.capture_frame(rtc.AudioFrame(chunk, SR, 1, FRAME))
            if had and not queue["buf"]:
                queue["end_at"] = now()
            nxt += 0.02
            await asyncio.sleep(max(0, nxt - time.time()))

    pump_task = asyncio.create_task(pump())
    t_dispatch = now()
    await lk.agent_dispatch.create_dispatch(api.CreateAgentDispatchRequest(agent_name=os.environ.get("BASELINE_AGENT_NAME", "voco-voice-agent"), room=room_name))
    print(f"[{t_dispatch:6.2f}] dispatched agent into {room_name}")

    async def wait_agent_done(min_quiet, timeout, need_onset_after):
        start = now()
        while now() - start < timeout:
            got = any(o >= need_onset_after for o in state["onsets"])
            if got and not state["speaking"] and now() - state["last_audio"] > min_quiet:
                return True
            await asyncio.sleep(0.05)
        return False

    results = []
    ok = await wait_agent_done(1.5, 40, t_dispatch)
    first = next((o for o in state["onsets"] if o >= t_dispatch), None)
    print(f"[{now():6.2f}] greeting finished={ok}; dispatch -> first agent audio = {None if first is None else round(first - t_dispatch, 2)} s")
    for i, p in enumerate(pcm):
        queue["end_at"] = None
        queue["buf"] = p
        while queue["end_at"] is None:
            await asyncio.sleep(0.01)
        t_end = queue["end_at"]
        # first agent onset after caller audio ended
        t_wait = now()
        onset = None
        while now() - t_wait < 25:
            onset = next((o for o in state["onsets"] if o > t_end - 0.05), None)
            if onset:
                break
            await asyncio.sleep(0.02)
        gap = None if onset is None else round(onset - t_end, 2)
        results.append((UTTERANCES[i], gap))
        print(f"[{now():6.2f}] turn {i + 1}: caller audio ended at {t_end:.2f}; first agent audio after = {gap} s")
        if onset is None:
            break
        await wait_agent_done(1.8, 45, t_end)
        if room.connection_state != rtc.ConnectionState.CONN_CONNECTED:
            break
    pump_task.cancel()
    await asyncio.sleep(1)
    await room.disconnect()
    try:
        await lk.room.delete_room(api.DeleteRoomRequest(room=room_name))
    except Exception:
        pass
    await lk.aclose()
    print("\nROOM", room_name)
    print("TRANSCRIPT")
    for t, who, text in sorted(lines):
        print(f"  [{t:6.2f}] {who}: {text}")
    print("EVENTS")
    for t, ev in events:
        print(f"  [{t:6.2f}] {json.dumps(ev)}")
    print("RESULTS", json.dumps(results))


import threading
threading.Timer(170, lambda: (print("WATCHDOG: forced exit"), os._exit(2))).start()
try:
    asyncio.run(main())
finally:
    sys.stdout.flush()
    os._exit(0)
