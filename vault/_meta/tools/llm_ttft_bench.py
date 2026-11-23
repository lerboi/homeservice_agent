"""Time-to-first-token bake-off for voice-agent LLM candidates, with a tool-choice sanity check.
Run from the repo root:  python vault/_meta/tools/llm_ttft_bench.py
Reads OPENAI_API_KEY and GROQ_API_KEY from .env.local. Prints no secrets.
Measured from the machine it runs on, so use it to rank models, not as absolute production numbers."""
import io, json, os, statistics, sys, time
import httpx

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", line_buffering=True)
for line in open(".env.local", encoding="utf-8"):
    if "=" in line and not line.startswith("#"):
        k, v = line.strip().split("=", 1)
        os.environ.setdefault(k, v.strip('"'))

OPENAI = ("https://api.openai.com/v1/chat/completions", os.environ["OPENAI_API_KEY"])
GROQ = ("https://api.groq.com/openai/v1/chat/completions", os.environ["GROQ_API_KEY"])
CANDIDATES = [
    ("gpt-4.1-mini (current)", OPENAI, "gpt-4.1-mini", {}),
    ("gpt-5.4-nano", OPENAI, "gpt-5.4-nano", {"reasoning_effort": "none"}),
    ("gpt-5.4-mini", OPENAI, "gpt-5.4-mini", {"reasoning_effort": "none"}),
    ("gpt-5.6-luna", OPENAI, "gpt-5.6-luna", {"reasoning_effort": "none"}),
    ("gpt-6-luna", OPENAI, "gpt-6-luna", {"reasoning_effort": "none"}),
    ("groq gpt-oss-120b", GROQ, "openai/gpt-oss-120b", {"reasoning_effort": "low"}),
    ("groq gpt-oss-20b", GROQ, "openai/gpt-oss-20b", {"reasoning_effort": "low"}),
    ("groq qwen3.8-27b", GROQ, "qwen/qwen3.8-27b", {}),
]
SYSTEM = """You are the voice assistant for Voco. You are on a live voice call: one caller, real time, voice only.
Your job is to schedule an appointment. You need the caller's name, what the appointment is for, and a time.
Speak in short, natural sentences. One question at a time. Never read lists aloud; offer at most two times.
Never describe your tools or reasoning. Never invent availability: only offer times a tool returned.
To see what is free on a day call check_day. To confirm one exact time call check_slot. Call a tool directly, without announcing it.
Before booking, read back the name and the time once and wait for a yes. Then call book_appointment with the slot_token.
After booking, confirm the day and time in one sentence and ask if there is anything else. When the caller says goodbye, say goodbye and call end_call.
Today is Monday 23 November 2026. The business is open 9am to 6pm on weekdays. Appointments last one hour."""
PAD = "\n\nReference notes (do not read aloud):\n" + "\n".join(
    f"- Policy {i}: when the caller raises topic {i}, acknowledge briefly, stay on scheduling, and never promise anything the tools did not return."
    for i in range(170))


def tool(name, desc, props, req):
    return {"type": "function", "function": {"name": name, "description": desc,
            "parameters": {"type": "object", "properties": props, "required": req}}}


TOOLS = [
    tool("check_day", "List open appointment times on one date.", {"date": {"type": "string", "description": "YYYY-MM-DD"}, "part_of_day": {"type": "string", "enum": ["morning", "afternoon", "any"]}}, ["date"]),
    tool("check_slot", "Check whether one exact time is free.", {"date": {"type": "string"}, "time": {"type": "string", "description": "HH:MM 24h"}}, ["date", "time"]),
    tool("book_appointment", "Book the slot the caller confirmed.", {"slot_token": {"type": "string"}, "caller_name": {"type": "string"}, "reason": {"type": "string"}}, ["slot_token"]),
    tool("end_call", "End the call after saying goodbye.", {}, []),
]
TURNS = {
    "plain": ([{"role": "user", "content": "Hi, I'd like to book an appointment."}], None),
    "tool": ([{"role": "user", "content": "Hi, I'd like to book an appointment."},
              {"role": "assistant", "content": "Sure. What's your name, and what's it for?"},
              {"role": "user", "content": "It's Alex Tan, for a product demo. What do you have tomorrow afternoon?"}], "check_day"),
}


def one(client, url, key, model, extra, system, msgs):
    body = {"model": model, "stream": True, "messages": [{"role": "system", "content": system}] + msgs, "tools": TOOLS, **extra}
    t0 = time.perf_counter()
    ttft, called, text = None, None, ""
    with client.stream("POST", url, headers={"Authorization": f"Bearer {key}"}, json=body, timeout=30) as r:
        if r.status_code != 200:
            return None, f"HTTP {r.status_code}: {r.read().decode()[:160]}", ""
        for line in r.iter_lines():
            if not line.startswith("data: ") or line == "data: [DONE]":
                continue
            ch = json.loads(line[6:]).get("choices") or []
            if not ch:
                continue
            d = ch[0].get("delta") or {}
            if (d.get("content") or d.get("tool_calls")) and ttft is None:
                ttft = time.perf_counter() - t0
            if d.get("content"):
                text += d["content"]
            for tc in d.get("tool_calls") or []:
                called = called or (tc.get("function") or {}).get("name")
    return ttft, called, text


RUNS = int(sys.argv[1]) if len(sys.argv) > 1 else 6
print(f"{'model':26} {'prompt':6} {'turn':6} {'median':>7} {'min':>6} {'max':>6}  tool/ reply")
with httpx.Client(http2=False) as client:
    for label, (url, key), model, extra in CANDIDATES:
        for size, system in (("small", SYSTEM), ("large", SYSTEM + PAD)):
            for turn, (msgs, expect) in TURNS.items():
                times, note = [], ""
                for i in range(RUNS + 1):
                    try:
                        t, called, text = one(client, url, key, model, extra, system, msgs)
                    except Exception as e:  # noqa: BLE001
                        t, called, text = None, f"ERR {type(e).__name__}", ""
                    if t is None:
                        note = str(called)
                        break
                    if i:  # first call is the warm-up (connection + prompt cache)
                        times.append(t)
                    note = (("OK " if called == expect else f"WRONG({called}) ") if expect else "") + (text[:60].replace("\n", " ") if not called else called)
                if times:
                    print(f"{label:26} {size:6} {turn:6} {statistics.median(times):7.2f} {min(times):6.2f} {max(times):6.2f}  {note}")
                else:
                    print(f"{label:26} {size:6} {turn:6}   FAILED  {note[:120]}")
                    break
            else:
                continue
            break
