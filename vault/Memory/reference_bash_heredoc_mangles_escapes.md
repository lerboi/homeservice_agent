---
name: reference-bash-heredoc-mangles-escapes
description: "In this Windows Git Bash harness, inline heredoc scripts lose backslash escapes and can fail on apostrophes; write patch scripts to a file with the Write tool instead"
metadata:
  node_type: memory
  type: reference
  originSessionId: 69987a29-03cc-4b00-8201-5c60fcbd1db8
  modified: 2026-11-23T17:51:44.627Z
---

On this machine (Windows, Git Bash tool), a Python script passed inline through a quoted heredoc (`python - <<'EOF'` or `cat > file <<'EOF'`) does not arrive intact:

- `\\n` arrives as `\n` and `\\b` as `\b`, so regex word boundaries were written into source files as backspace characters and string escapes as real newlines (seen 2026-11-24, livekit-agent `guard.py` and `prompt.py`).
- Scripts containing apostrophes inside triple-quoted strings sometimes fail outright with `unexpected EOF while looking for matching`.

**How to apply:** for any multi-line edit that contains backslashes, regexes or apostrophes, use the Edit tool, or write the script with the Write tool to the scratchpad and run that file. After a heredoc edit has run, grep the touched files for control characters (`grep -c $'\x08'`).
