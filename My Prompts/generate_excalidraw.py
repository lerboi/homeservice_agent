"""
Generate Voco network diagram as .excalidraw file.
Open at excalidraw.com > File > Open, then Export > PDF.
"""
import json, random, time

ts = int(time.time() * 1000)

def uid():
    return '%016x' % random.getrandbits(64)

def rect(x, y, w, h, bg='transparent', stroke='#1e1e1e', sw=2,
         style='solid', roughness=0, radius=True, opacity=100, group=None):
    return {
        'id': uid(), 'type': 'rectangle',
        'x': x, 'y': y, 'width': w, 'height': h, 'angle': 0,
        'strokeColor': stroke, 'backgroundColor': bg,
        'fillStyle': 'solid', 'strokeWidth': sw, 'strokeStyle': style,
        'roughness': roughness, 'opacity': opacity,
        'groupIds': [group] if group else [],
        'roundness': {'type': 3} if radius else None,
        'seed': random.randint(1,9999999), 'version': 1, 'versionNonce': random.randint(1,9999999),
        'isDeleted': False, 'boundElements': [], 'updated': ts, 'link': None, 'locked': False
    }

def text(x, y, content, size=14, color='#1e1e1e', align='left',
         bold=False, width=None, group=None):
    w = width or max(len(content) * size * 0.6, 100)
    h = size * 1.6
    display = content
    return {
        'id': uid(), 'type': 'text',
        'x': x, 'y': y, 'width': w, 'height': h, 'angle': 0,
        'strokeColor': color, 'backgroundColor': 'transparent',
        'fillStyle': 'solid', 'strokeWidth': 1, 'strokeStyle': 'solid',
        'roughness': 0, 'opacity': 100,
        'groupIds': [group] if group else [],
        'roundness': None,
        'seed': random.randint(1,9999999), 'version': 1, 'versionNonce': random.randint(1,9999999),
        'isDeleted': False, 'boundElements': None, 'updated': ts, 'link': None, 'locked': False,
        'text': display, 'fontSize': size, 'fontFamily': 2,
        'textAlign': align, 'verticalAlign': 'top',
        'baseline': int(size * 1.2), 'containerId': None, 'originalText': display
    }

def arrow(x1, y1, x2, y2, color='#64748b', sw=2, dashed=False, label=None):
    els = [{
        'id': uid(), 'type': 'arrow',
        'x': x1, 'y': y1, 'width': abs(x2-x1), 'height': abs(y2-y1), 'angle': 0,
        'strokeColor': color, 'backgroundColor': 'transparent',
        'fillStyle': 'solid', 'strokeWidth': sw, 'strokeStyle': 'dashed' if dashed else 'solid',
        'roughness': 0, 'opacity': 100,
        'groupIds': [],
        'roundness': {'type': 2},
        'seed': random.randint(1,9999999), 'version': 1, 'versionNonce': random.randint(1,9999999),
        'isDeleted': False, 'boundElements': [], 'updated': ts, 'link': None, 'locked': False,
        'points': [[0, 0], [x2-x1, y2-y1]],
        'lastCommittedPoint': None,
        'startBinding': None, 'endBinding': None,
        'startArrowhead': None, 'endArrowhead': 'arrow'
    }]
    if label:
        mx, my = (x1+x2)//2 - 40, (y1+y2)//2 - 10
        els.append(text(mx, my, label, size=11, color=color, width=90))
    return els


elements = []

# ── Title ──────────────────────────────────────────────────────────────────
elements.append(text(40, 20, 'Voco Private Limited — System / Network Configuration Diagram', 18, '#0f172a', bold=True, width=900))
elements.append(text(40, 48, 'IMDA SBO Licence Application  |  Internet-Based Voice & Data Services  |  March 2026', 12, '#64748b', width=800))

# ── SINGAPORE ZONE ─────────────────────────────────────────────────────────
# Big dashed blue container
sg = rect(20, 85, 1340, 560, bg='#f0f9ff', stroke='#0369a1', sw=2, style='dashed')
elements.append(sg)
elements.append(text(34, 92, 'SINGAPORE  —  Country Boundary', 13, '#0369a1', bold=True, width=400))

# ── VOCO PREMISES ─────────────────────────────────────────────────────────
vp = rect(36, 118, 870, 510, bg='#fff7ed', stroke='#c2410c', sw=2, style='dashed')
elements.append(vp)
elements.append(text(50, 125, 'Voco Private Limited  (Premises under Voco\'s control)', 12, '#c2410c', bold=True, width=500))

# service boxes
boxes = [
    (56,  152, 260, 455, '#eff6ff', '#2563eb', 'Web Application',
     ['Vercel (Next.js)', 'Dashboard & CRM', 'API routes', 'Onboarding wizard', 'Calendar sync']),
    (336, 152, 260, 455, '#fff7ed', '#c2410c', 'AI Voice Agent',
     ['Railway (Python)', 'LiveKit SDK', 'Call triage', 'Appointment booking', 'Urgency scoring']),
    (616, 152, 260, 455, '#f0fdf4', '#16a34a', 'Database & Auth',
     ['Supabase (PostgreSQL)', 'Tenant & lead data', 'Bookings & calls', 'Auth + sessions', 'Encrypted at rest']),
]

for bx, by, bw, bh, bg, accent, title, lines in boxes:
    elements.append(rect(bx, by, bw, bh, bg=bg, stroke=accent, sw=1.5))
    # accent top bar
    elements.append(rect(bx, by, bw, 28, bg=accent, stroke=accent, sw=0))
    elements.append(text(bx + bw//2 - len(title)*4, by + 6, title, 13, '#ffffff', bold=True, width=bw-10))
    for i, line in enumerate(lines):
        elements.append(text(bx+12, by + 40 + i*32, '• ' + line, 12, '#475569', width=bw-20))

# ── END USERS BOX ─────────────────────────────────────────────────────────
eu = rect(924, 118, 420, 510, bg='#f8fafc', stroke='#475569', sw=1.5)
elements.append(eu)
elements.append(rect(924, 118, 420, 28, bg='#0f172a', stroke='#0f172a', sw=0))
elements.append(text(960, 125, 'End Users', 13, '#ffffff', bold=True, width=200))

user_items = [
    ('Business Owners', 'Subscribers who access the'),
    ('',                'Voco dashboard at getvoco.ai'),
    ('',                ''),
    ('Callers',         'End-customers who call the'),
    ('',                'business phone number'),
    ('',                'AI receptionist answers 24/7'),
]
for i, (label, desc) in enumerate(user_items):
    y = 158 + i * 36
    if label:
        elements.append(text(940, y, label, 13, '#0f172a', bold=True, width=380))
    if desc:
        elements.append(text(940, y + (16 if label else 0), desc, 11, '#64748b', width=380))

# ── THIRD-PARTY CLOUD ZONE ────────────────────────────────────────────────
cl = rect(20, 665, 1340, 220, bg='#f8fafc', stroke='#94a3b8', sw=2, style='dashed')
elements.append(cl)
elements.append(text(34, 672, 'Third-Party Cloud Infrastructure  (Global / United States)  —  NOT Voco premises', 12, '#64748b', bold=True, width=800))

providers = [
    (36,  698, 300, 172, '#fef2f2', '#dc2626', 'Twilio Inc.',
     ['Voice carrier (FCC licensed)', 'DID phone numbers', 'SIP trunking to LiveKit']),
    (356, 698, 300, 172, '#eff6ff', '#2563eb', 'LiveKit Inc.',
     ['WebRTC / SIP media rooms', 'Routes audio streams', 'Agent ↔ caller bridge']),
    (676, 698, 300, 172, '#f0fdf4', '#16a34a', 'Google Gemini',
     ['Gemini 2.0 Flash Live API', 'Real-time speech processing', 'AI response generation']),
    (996, 698, 300, 172, '#f5f3ff', '#7c3aed', 'Stripe Inc.',
     ['Subscription billing', 'Usage-based metering', 'PCI-DSS Level 1']),
]

for bx, by, bw, bh, bg, accent, title, lines in providers:
    elements.append(rect(bx, by, bw, bh, bg=bg, stroke=accent, sw=1.5))
    elements.append(rect(bx, by, bw, 26, bg=accent, stroke=accent, sw=0))
    elements.append(text(bx + bw//2 - len(title)*4, by + 5, title, 12, '#ffffff', bold=True, width=bw-10))
    for i, line in enumerate(lines):
        elements.append(text(bx+12, by + 36 + i*28, '• ' + line, 11, '#475569', width=bw-20))

# ── ARROWS ────────────────────────────────────────────────────────────────
# 1. Caller → Twilio (inbound call)
elements += arrow(1134, 628, 186, 665, color='#dc2626', sw=2, label='① Inbound call')
# 2. Twilio → LiveKit
elements += arrow(336, 784, 356, 784, color='#2563eb', sw=2, label='② SIP trunk')
# 3. LiveKit → AI Agent (up)
elements += arrow(506, 665, 466, 607, color='#7c3aed', sw=2, label='③ Audio stream')
# 4. Gemini ↔ AI Agent (dashed)
elements += arrow(826, 698, 536, 607, color='#16a34a', sw=1.5, dashed=True, label='④ AI processing')
# 5. AI Agent → Database
elements += arrow(596, 374, 616, 374, color='#16a34a', sw=1.5, label='⑤ Store booking')
# 6. DB → Web App (dashed realtime)
elements += arrow(616, 340, 316, 340, color='#2563eb', sw=1.5, dashed=True, label='⑥ Realtime sync')
# 7. Web App → Business Owner
elements += arrow(260, 260, 924, 280, color='#0f172a', sw=1.5, dashed=True, label='⑦ Dashboard view')

# ── LEGEND ────────────────────────────────────────────────────────────────
elements.append(rect(20, 898, 1340, 44, bg='#f1f5f9', stroke='#e2e8f0', sw=1))
legend_items = [
    (36,  '- - -', '#0369a1', 'Singapore boundary'),
    (260, '- - -', '#c2410c', 'Voco premises (under Voco control)'),
    (530, '- - -', '#94a3b8', 'Third-party cloud (not Voco premises)'),
    (800, '────', '#64748b',  'Call / data flow'),
    (980, '- - -', '#64748b', 'Internal data sync'),
]
elements.append(text(36, 903, 'LEGEND:', 11, '#0f172a', bold=True, width=80))
for lx, dash, color, label in legend_items:
    elements.append(text(lx, 917, dash, 11, color, width=50))
    elements.append(text(lx + 44, 917, label, 11, '#475569', width=220))

# ── Assemble ──────────────────────────────────────────────────────────────
doc = {
    'type': 'excalidraw',
    'version': 2,
    'source': 'https://excalidraw.com',
    'elements': elements,
    'appState': {
        'gridSize': None,
        'viewBackgroundColor': '#ffffff',
    },
    'files': {}
}

import os
out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   'Voco_Network_Diagram.excalidraw')
with open(out, 'w') as f:
    json.dump(doc, f, indent=2)

print('Saved: ' + out)
print('Open at excalidraw.com > File > Open > select the file')
print('Then: Export > PDF (or SVG, then print to PDF)')
