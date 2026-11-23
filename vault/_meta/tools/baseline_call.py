"""Scripted sandboxed web test call against the DEPLOYED agent. Measures voice-to-voice gap
(end of caller audio -> first agent audio) from this machine. No secrets are printed.

Env switches:
  BASELINE_AGENT_NAME=voco-voice-agent-dev   dispatch a local dev worker instead of production
  BASELINE_DEMO=google                       Demo Studio call: the booking is pushed to that
                                             calendar and kept after the call (clean it up with
                                             demo_event_check.mjs --cleanup). Prints the
                                             voco.events stream under EVENTS.
  BASELINE_AGENT=appointments                ask for the appointments agent (room metadata
                                             `agent`); unset = the worker's default agent.
  BASELINE_LLM=groq|openai                   the model the appointments agent runs this call on
                                             (room metadata `llm`); unset = the worker's setting.
  BASELINE_SCRIPT=book|reschedule|cancel|demo
                                             what the caller says (default book). reschedule and
                                             cancel act on a booking an earlier demo call kept.
                                             demo is the recorded product demo: one caller books a
                                             cleaning for tomorrow at two, then moves it to Friday
                                             at ten. It also checks the result (CHECKS) and exits 1
                                             if the call did not do exactly that. Run it Monday to
                                             Wednesday in the business's timezone, so "tomorrow" and
                                             "Friday" are two different working days.
  BASELINE_BUSINESS="Brightside Dental"      the business the agent answers as (demo block
                                             `business_name`); unset = the tenant's own name.
  BASELINE_QUIET=1.8                         seconds of agent silence before the caller speaks.
  BASELINE_TZ=Asia/Singapore                 the business's timezone, for the demo script's checks.

Every run prints TIMING: the call length from the start of the greeting to the agent's last
audio, as run and with the caller answering 0.5 s after the agent stops (a person's pace)."""
import asyncio, json, os, sys, time, array, math, urllib.request, io
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

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
SCRIPTS = {
    "book": [
        "Hi, I'd like to book an appointment for a product demo.",
        "My name is Alex Tan.",
        "What times do you have tomorrow afternoon?",
        "The first one works for me.",
        "Yes, please book it.",
        "No, that's all. Thank you, goodbye.",
    ],
    "reschedule": [
        "Hi, I need to move my appointment. My name is Alex Tan.",
        "Could we do the day after tomorrow at ten in the morning instead?",
        "Yes, please move it.",
        "No, that's all. Thank you, goodbye.",
    ],
    "cancel": [
        "Hi, I'd like to cancel my appointment. It's under Alex Tan.",
        "Yes, please cancel it.",
        "No thanks, that's everything. Goodbye.",
    ],
    # The recorded product demo, word for word (vault: Runbooks/Record a demo).
    "demo": [
        "Hi, it's Alex Tan. Can I book a cleaning for tomorrow at two?",
        "Yes, please.",
        "Actually, sorry, I've got a meeting then. Could you move it to Friday at ten?",
        "Yes, please.",
        "That's all, thanks. Bye.",
    ],
}
SCRIPT = os.environ.get("BASELINE_SCRIPT", "book").strip().lower() or "book"
UTTERANCES = SCRIPTS[SCRIPT]
QUIET = float(os.environ.get("BASELINE_QUIET", "1.8"))
EXIT_CODE = 0


def demo_checks(events, tz_name):
    """[(label, passed, detail)] for the demo script: did the call book Alex
    Tan's cleaning for tomorrow at two and move the same appointment to Friday
    at ten, in the calendar, and hang up."""
    tz = ZoneInfo(tz_name)
    today = datetime.now(tz).date()
    tomorrow = today + timedelta(days=1)
    friday = today + timedelta(days=(4 - today.weekday()) % 7 or 7)

    def first(kind):
        return next((e for _, e in events if e.get("type") == kind), None)

    def local(iso):
        try:
            return datetime.fromisoformat(iso.replace("Z", "+00:00")).astimezone(tz).strftime("%Y-%m-%d %H:%M")
        except Exception:
            return str(iso)

    booked, moved = first("booked"), first("rescheduled")
    saved, updated = first("calendar_saved"), first("calendar_updated")
    order = [e.get("type") for _, e in events if e.get("type") in (
        "booked", "calendar_saved", "rescheduled", "calendar_updated")]
    hung_up = any(e.get("type") == "tool" and e.get("name") == "end_call" for _, e in events)
    failed = [e.get("type") for _, e in events if e.get("type") == "calendar_failed"]
    want_booked, want_moved = f"{tomorrow} 14:00", f"{friday} 10:00"
    return [
        ("days are usable (tomorrow and Friday differ, both working days)",
         tomorrow.weekday() < 5 and friday != tomorrow, f"tomorrow={tomorrow} friday={friday}"),
        ("booked", booked is not None, ""),
        ("booked for tomorrow at two", bool(booked) and local(booked.get("start")) == want_booked,
         f"got {local(booked.get('start')) if booked else None}, want {want_booked}"),
        ("name on the booking is Alex Tan", bool(booked) and booked.get("caller_name") == "Alex Tan",
         f"got {booked.get('caller_name') if booked else None!r}"),
        ("reason on the booking is a cleaning", bool(booked) and "clean" in str(booked.get("reason") or "").lower(),
         f"got {booked.get('reason') if booked else None!r}"),
        ("event saved to the calendar", saved is not None, ""),
        ("moved", moved is not None, ""),
        ("moved to Friday at ten", bool(moved) and local(moved.get("start")) == want_moved,
         f"got {local(moved.get('start')) if moved else None}, want {want_moved}"),
        ("the move changed the same appointment",
         bool(booked and moved) and booked.get("appointment_id") == moved.get("appointment_id"), ""),
        ("calendar event updated, same event",
         bool(saved and updated) and saved.get("event_id") == updated.get("event_id"), ""),
        ("in order: booked, saved, moved, updated",
         order == ["booked", "calendar_saved", "rescheduled", "calendar_updated"], f"got {order}"),
        ("no calendar failure", not failed, f"got {failed}"),
        ("agent hung up", hung_up, ""),
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
        business = os.environ.get("BASELINE_BUSINESS", "").strip()
        if business:
            room_meta["demo"]["business_name"] = business
    agent_kind = os.environ.get("BASELINE_AGENT", "").strip().lower()
    if agent_kind:
        room_meta["agent"] = agent_kind
    llm_choice = os.environ.get("BASELINE_LLM", "").strip().lower()
    if llm_choice:
        room_meta["llm"] = llm_choice
    await lk.room.create_room(api.CreateRoomRequest(
        name=room_name, empty_timeout=120,
        metadata=json.dumps(room_meta)))
    token = (api.AccessToken().with_identity(f"baseline-{int(time.time())}").with_name("Baseline Caller")
             .with_grants(api.VideoGrants(room_join=True, room=room_name, can_publish=True, can_subscribe=True)).to_jwt())
    room = rtc.Room()
    state = {"last_audio": 0.0, "onsets": [], "offsets": [], "speaking": False, "t0": time.time()}
    caller_spans = []
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
                    state["offsets"].append(state["last_audio"])

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
        t_say = now()
        queue["buf"] = p
        while queue["end_at"] is None:
            await asyncio.sleep(0.01)
        t_end = queue["end_at"]
        caller_spans.append((t_say, t_end))
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
        await wait_agent_done(QUIET, 45, t_end)
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
    if state["onsets"] and caller_spans:
        first_audio, last_audio = state["onsets"][0], state["last_audio"]
        ends = state["offsets"] + [last_audio]
        # Dead air the script adds: from the agent going quiet to the caller starting.
        waits = [round(s - max((e for e in ends if e <= s), default=s), 2) for s, _ in caller_spans]
        human = (last_audio - first_audio) - sum(max(0.0, w - 0.5) for w in waits)
        print("TIMING", json.dumps({
            "call_length_as_run_s": round(last_audio - first_audio, 1),
            "call_length_at_human_pace_s": round(human, 1),
            "caller_wait_s": waits,
        }))
    if SCRIPT == "demo":
        global EXIT_CODE
        checks = demo_checks(events, os.environ.get("BASELINE_TZ", "Asia/Singapore"))
        print("CHECKS")
        for label, passed, detail in checks:
            print(f"  {'PASS' if passed else 'FAIL'}  {label}{'' if passed or not detail else ' (' + detail + ')'}")
        ok = all(passed for _, passed, _ in checks)
        print("VERDICT", "PASS" if ok else "FAIL")
        EXIT_CODE = 0 if ok else 1


import threading
threading.Timer(170, lambda: (print("WATCHDOG: forced exit"), os._exit(2))).start()
try:
    asyncio.run(main())
finally:
    sys.stdout.flush()
    os._exit(EXIT_CODE)
