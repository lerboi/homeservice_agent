"""Vault health check: every wikilink resolves, every note has frontmatter with type/status/description,
note names are unique. Run from the repo root:  python vault/_meta/tools/check_vault.py"""
import os, re, io, sys
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
V = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
names, files, problems, big = {}, [], [], []
for root, dirs, fs in os.walk(V):
    dirs[:] = [d for d in dirs if d != ".obsidian"]
    for f in fs:
        p = os.path.join(root, f)
        key = (f[:-3] if f.endswith(".md") else f).lower()
        if key in names and "templates" not in root:
            problems.append(f"DUPLICATE NAME: {p} and {names[key]}")
        names[key] = p
        if f.endswith(".md"):
            files.append(p)
link = re.compile(r"\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]")
nlinks = 0
for p in files:
    rel = os.path.relpath(p, V)
    text = open(p, encoding="utf-8").read()
    lines = text.split("\n")
    memory = rel.startswith("Memory")
    if lines[0].strip() != "---":
        if not rel.endswith("MEMORY.md"):
            problems.append(f"NO FRONTMATTER: {rel}")
    elif not memory and "templates" not in rel:
        head = "\n".join(lines[1:lines.index("---", 1)])
        for k in ("type", "status", "description"):
            if not re.search(rf"^{k}:\s*\S", head, re.M):
                problems.append(f"MISSING {k}: {rel}")
    if len(lines) > 320 and not rel.startswith(("Log", "Reference", "Plans", "_meta")):
        big.append((len(lines), rel))
    fence = False
    for i, l in enumerate(lines, 1):
        if l.lstrip().startswith("```"):
            fence = not fence
        if fence:
            continue
        for m in link.finditer(re.sub(r"`[^`]*`", "", l)):
            nlinks += 1
            t = m.group(1).strip().split("/")[-1].lower()
            if t not in names and "templates" not in rel:
                problems.append(f"BROKEN LINK: {rel}:{i} -> [[{m.group(1)}]]")
print(f"{len(files)} notes, {nlinks} wikilinks checked")
for n, rel in sorted(big, reverse=True):
    print(f"LONG ({n} lines): {rel}")
for x in problems:
    print(x)
print("OK" if not problems else f"{len(problems)} problem(s)")
sys.exit(1 if problems else 0)
