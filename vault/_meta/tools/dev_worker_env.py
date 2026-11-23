"""Prints `export K=V` lines (both repos env files merged) for `eval` in Git Bash, to run a LOCAL dev worker.
Usage:  eval "$(python vault/_meta/tools/dev_worker_env.py)"   -- never run it bare: it prints secrets."""
import shlex
env={}
def load(path):
    for line in open(path, encoding="utf-8"):
        line=line.strip()
        if line and not line.startswith("#") and "=" in line:
            k,v=line.split("=",1); env.setdefault(k.strip(), v.strip().strip('"').strip("'"))
load(r"C:\Users\leheh\.Projects\homeservice_agent\.env.local")
load(r"C:\Users\leheh\.Projects\livekit-agent\.env")
env["ELEVEN_API_KEY"]=env["ELEVENLABS_API_KEY"]; env["VOCO_AGENT_NAME"]="voco-voice-agent-dev"
for k,v in env.items():
    if k.replace("_","").isalnum(): print(f"export {k}={shlex.quote(v)}")
