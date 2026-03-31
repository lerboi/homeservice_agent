"""
Voco — Network Configuration Diagram (clean minimal version)
"""
import math
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor, white, black

W, H = A4
PAD = 14 * mm

# Palette
NAVY     = HexColor('#0F172A')
ORANGE   = HexColor('#C2410C')
SLATE    = HexColor('#64748B')
MUTED    = HexColor('#94A3B8')
SG_FILL  = HexColor('#F0F9FF')
SG_LINE  = HexColor('#0369A1')
VP_FILL  = HexColor('#FFF7ED')
VP_LINE  = HexColor('#C2410C')
CL_FILL  = HexColor('#F8FAFC')
CL_LINE  = HexColor('#CBD5E1')
BOX_FILL = white
BOX_LINE = HexColor('#E2E8F0')
GREEN    = HexColor('#16A34A')
BLUE     = HexColor('#2563EB')
PURPLE   = HexColor('#7C3AED')

def rr(c, x, y, w, h, r=4, fill=white, stroke=BOX_LINE, lw=1):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(lw)
    c.setDash()
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)

def rr_dash(c, x, y, w, h, r=6, fill=SG_FILL, stroke=SG_LINE, lw=1.5, dash=(6,4)):
    c.setFillColor(fill)
    c.setStrokeColor(stroke)
    c.setLineWidth(lw)
    c.setDash(*dash)
    c.roundRect(x, y, w, h, r, fill=1, stroke=1)
    c.setDash()

def txt(c, x, y, text, size=8, color=NAVY, bold=False, align='left'):
    c.setFillColor(color)
    c.setFont("Helvetica-Bold" if bold else "Helvetica", size)
    if align == 'center':
        c.drawCentredString(x, y, text)
    elif align == 'right':
        c.drawRightString(x, y, text)
    else:
        c.drawString(x, y, text)

def arrow_line(c, x1, y1, x2, y2, color=SLATE, lw=1.2, dashed=False):
    c.setStrokeColor(color)
    c.setLineWidth(lw)
    c.setDash(5, 3) if dashed else c.setDash()
    c.line(x1, y1, x2, y2)
    c.setDash()
    # arrowhead
    dx, dy = x2-x1, y2-y1
    L = math.sqrt(dx*dx+dy*dy)
    if L < 1: return
    ux, uy = dx/L, dy/L
    s = 5
    ax1 = x2 - 9*ux + s*(-uy)
    ay1 = y2 - 9*uy + s*ux
    ax2 = x2 - 9*ux - s*(-uy)
    ay2 = y2 - 9*uy - s*ux
    p = c.beginPath()
    p.moveTo(x2, y2); p.lineTo(ax1, ay1); p.lineTo(ax2, ay2); p.close()
    c.setFillColor(color)
    c.drawPath(p, fill=1, stroke=0)

def chip(c, cx, y, label, bg, fg):
    w = len(label) * 4.5 + 10
    c.setFillColor(bg)
    c.roundRect(cx - w/2, y, w, 5.5*mm, 3, fill=1, stroke=0)
    c.setFont("Helvetica-Bold", 6.5)
    c.setFillColor(fg)
    c.drawCentredString(cx, y + 1.8*mm, label)

def service_box(c, x, y, w, h, title, lines, accent):
    rr(c, x, y, w, h, r=5, fill=BOX_FILL, stroke=BOX_LINE, lw=1)
    # left accent bar
    c.setFillColor(accent)
    c.roundRect(x, y + h - 18*mm, 3, 18*mm, 1, fill=1, stroke=0)
    txt(c, x + 6, y + h - 5.5*mm, title, size=7.5, bold=True, color=NAVY)
    c.setFillColor(HexColor('#E2E8F0'))
    c.setLineWidth(0.5)
    c.line(x+5, y + h - 7.5*mm, x+w-5, y + h - 7.5*mm)
    for i, line in enumerate(lines):
        txt(c, x + 7, y + h - 12*mm - i*5.5*mm, line, size=6.5, color=SLATE)


def build(out):
    c = canvas.Canvas(out, pagesize=A4)
    c.setTitle("Voco_Network_Configuration_Diagram")

    # White background
    c.setFillColor(white)
    c.rect(0, 0, W, H, fill=1, stroke=0)

    # ── Header ───────────────────────────────────────────────────────────────
    c.setFillColor(NAVY)
    c.rect(0, H - 28*mm, W, 28*mm, fill=1, stroke=0)
    c.setFillColor(ORANGE)
    c.rect(0, H - 29.5*mm, W, 1.5*mm, fill=1, stroke=0)

    txt(c, PAD, H - 11*mm, "Voco Private Limited", size=13, color=white, bold=True)
    txt(c, PAD, H - 18*mm, "System / Network Configuration Diagram  —  IMDA SBO Licence Application", size=8, color=HexColor('#94A3B8'))
    txt(c, PAD, H - 24*mm, "Internet-Based Voice and Data Services  |  March 2026  |  Singapore", size=7, color=HexColor('#64748B'))

    # ── Layout constants ─────────────────────────────────────────────────────
    body_top = H - 32*mm
    body_bot = 12*mm
    body_h   = body_top - body_bot

    # Split vertically: SG zone top 60%, Cloud zone bottom 37%
    sg_h  = body_h * 0.60
    gap   = 5*mm
    cl_h  = body_h - sg_h - gap

    sg_y  = body_bot + cl_h + gap
    cl_y  = body_bot

    sg_x  = PAD
    sg_w  = W - 2*PAD
    cl_x  = PAD
    cl_w  = W - 2*PAD

    # ── CLOUD ZONE (bottom) ───────────────────────────────────────────────────
    rr_dash(c, cl_x, cl_y, cl_w, cl_h, r=6, fill=CL_FILL, stroke=CL_LINE, lw=1.2, dash=(5,3))

    txt(c, cl_x + 5*mm, cl_y + cl_h - 5.5*mm,
        "THIRD-PARTY INFRASTRUCTURE  (Global Cloud — not under Voco premises)", size=7, bold=True, color=SLATE)

    # 4 provider chips in a row
    providers = [
        ("Twilio", "Voice carrier / SIP / DID numbers", HexColor('#FEF2F2'), HexColor('#DC2626')),
        ("LiveKit", "WebRTC media rooms / SIP routing",  HexColor('#EFF6FF'), HexColor('#2563EB')),
        ("Google Gemini", "AI speech processing (Live API)",    HexColor('#F0FDF4'), HexColor('#16A34A')),
        ("Stripe", "Subscription billing / payments",   HexColor('#F5F3FF'), HexColor('#7C3AED')),
    ]

    pb_count = len(providers)
    pb_w = (cl_w - 6*mm) / pb_count - 2*mm
    pb_h = cl_h - 10*mm
    pb_y = cl_y + 2*mm

    for i, (name, desc, bg, accent) in enumerate(providers):
        px = cl_x + 3*mm + i * (pb_w + 2*mm)
        rr(c, px, pb_y, pb_w, pb_h, r=4, fill=bg, stroke=HexColor('#E2E8F0'), lw=1)
        # accent top bar
        c.setFillColor(accent)
        c.roundRect(px, pb_y + pb_h - 2.5*mm, pb_w, 2.5*mm, 2, fill=1, stroke=0)
        txt(c, px + pb_w/2, pb_y + pb_h - 6.5*mm, name, size=7.5, bold=True, color=NAVY, align='center')
        # wrap description
        words = desc.split()
        line1 = ' '.join(words[:4])
        line2 = ' '.join(words[4:]) if len(words) > 4 else ''
        txt(c, px + pb_w/2, pb_y + pb_h - 11.5*mm, line1, size=6, color=SLATE, align='center')
        if line2:
            txt(c, px + pb_w/2, pb_y + pb_h - 16*mm, line2, size=6, color=SLATE, align='center')

    # ── SINGAPORE ZONE (top) ─────────────────────────────────────────────────
    rr_dash(c, sg_x, sg_y, sg_w, sg_h, r=7, fill=SG_FILL, stroke=SG_LINE, lw=2, dash=(8,5))

    txt(c, sg_x + 5*mm, sg_y + sg_h - 6*mm,
        "SINGAPORE", size=8.5, bold=True, color=SG_LINE)
    txt(c, sg_x + 5*mm + 28*mm, sg_y + sg_h - 6*mm,
        "Country Boundary", size=7, color=MUTED)

    # ── Voco Premises box (inside SG) ────────────────────────────────────────
    vp_x = sg_x + 5*mm
    vp_y = sg_y + 14*mm
    vp_w = sg_w * 0.64
    vp_h = sg_h - 22*mm

    rr_dash(c, vp_x, vp_y, vp_w, vp_h, r=5, fill=VP_FILL, stroke=VP_LINE, lw=1.5, dash=(5,3))
    txt(c, vp_x + 4*mm, vp_y + vp_h - 5.5*mm,
        "Voco Premises  (under Voco's control)", size=7.5, bold=True, color=ORANGE)

    # 3 service boxes inside Voco premises
    sb_count = 3
    sb_gap = 2.5*mm
    sb_w = (vp_w - 6*mm - sb_gap*(sb_count-1)) / sb_count
    sb_h = vp_h - 10*mm
    sb_y = vp_y + 2.5*mm

    services = [
        ("Web App", ["Vercel (Next.js)", "Dashboard & CRM", "API routes", "Calendar sync", "Onboarding"], BLUE),
        ("AI Agent", ["Railway (Python)", "LiveKit SDK", "Call triage", "Appointment booking", "Urgency scoring"], ORANGE),
        ("Database", ["Supabase (PostgreSQL)", "Tenant data", "Leads & bookings", "Auth & sessions", "Encrypted at rest"], GREEN),
    ]

    for i, (title, lines, accent) in enumerate(services):
        sx = vp_x + 3*mm + i*(sb_w + sb_gap)
        service_box(c, sx, sb_y, sb_w, sb_h, title, lines, accent)

    # ── End Users / Callers box (right side of SG) ───────────────────────────
    eu_x = sg_x + vp_w + 7*mm
    eu_y = sg_y + 14*mm
    eu_w = sg_w - vp_w - 12*mm
    eu_h = sg_h - 22*mm

    rr(c, eu_x, eu_y, eu_w, eu_h, r=5, fill=BOX_FILL, stroke=BOX_LINE, lw=1)
    c.setFillColor(HexColor('#0369A1'))
    c.roundRect(eu_x, eu_y + eu_h - 2.5*mm, eu_w, 2.5*mm, 2, fill=1, stroke=0)
    txt(c, eu_x + eu_w/2, eu_y + eu_h - 6.5*mm, "End Users", size=8, bold=True, color=NAVY, align='center')

    users = [
        ("Business Owners", "Dashboard access via browser"),
        ("", "getvoco.ai"),
        ("", ""),
        ("Callers", "Dial business phone number"),
        ("", "AI receptionist answers"),
    ]
    for i, (label, desc) in enumerate(users):
        y = eu_y + eu_h - 12*mm - i*5*mm
        if label:
            txt(c, eu_x + 5*mm, y, label, size=7, bold=True, color=NAVY)
        if desc:
            txt(c, eu_x + 5*mm, y - 4.5*mm if label else y, desc, size=6, color=SLATE)

    # ── FLOW ARROWS ──────────────────────────────────────────────────────────
    # Caller → Twilio (downward, from SG zone to cloud zone)
    caller_x = eu_x + eu_w/2
    caller_bot = sg_y
    twilio_top = cl_y + cl_h
    twilio_x = cl_x + 3*mm + pb_w/2

    arrow_line(c, caller_x, caller_bot, twilio_x, twilio_top, color=HexColor('#DC2626'), lw=1.4)
    c.setFillColor(white)
    c.setStrokeColor(HexColor('#DC2626'))
    c.setLineWidth(0.8)
    c.roundRect(twilio_x - 14*mm, (caller_bot+twilio_top)/2 - 3.5*mm, 28*mm, 7*mm, 3, fill=1, stroke=1)
    txt(c, twilio_x, (caller_bot+twilio_top)/2 - 1*mm, "Inbound call", size=6, color=HexColor('#DC2626'), align='center')

    # Twilio → LiveKit (right, within cloud zone)
    tw_mid_y = cl_y + cl_h/2
    lk_left_x = cl_x + 3*mm + pb_w + 2*mm
    tw_right_x = cl_x + 3*mm + pb_w
    arrow_line(c, tw_right_x, tw_mid_y, lk_left_x, tw_mid_y, color=HexColor('#2563EB'), lw=1.2)

    # LiveKit ↔ AI Agent (vertical connector between cloud and Voco)
    lk_x = cl_x + 3*mm + pb_w + 2*mm + pb_w/2
    lk_top_y = cl_y + cl_h
    agent_x = vp_x + 3*mm + sb_w + sb_gap + sb_w/2
    agent_bot_y = sb_y
    arrow_line(c, lk_x, lk_top_y, agent_x, agent_bot_y, color=PURPLE, lw=1.4)
    c.setFillColor(white)
    c.setStrokeColor(PURPLE)
    c.setLineWidth(0.8)
    c.roundRect(agent_x - 16*mm, (lk_top_y+agent_bot_y)/2 - 3.5*mm, 32*mm, 7*mm, 3, fill=1, stroke=1)
    txt(c, agent_x, (lk_top_y+agent_bot_y)/2 - 1*mm, "Audio stream", size=6, color=PURPLE, align='center')

    # Gemini ↔ AI Agent (dashed — AI processing)
    gem_x = cl_x + 3*mm + 2*(pb_w + 2*mm) + pb_w/2
    gem_top_y = cl_y + cl_h
    arrow_line(c, gem_x, gem_top_y, agent_x + 8, agent_bot_y, color=GREEN, lw=1.2, dashed=True)

    # AI Agent → Database (horizontal within Voco)
    agent_right = vp_x + 3*mm + sb_w + sb_gap + sb_w
    db_left = vp_x + 3*mm + 2*(sb_w + sb_gap)
    mid_sb = sb_y + sb_h/2
    arrow_line(c, agent_right, mid_sb, db_left, mid_sb, color=GREEN, lw=1.2)

    # AI Agent → Web App (back, dashed)
    web_right = vp_x + 3*mm + sb_w
    agent_left = vp_x + 3*mm + sb_w + sb_gap
    arrow_line(c, agent_left, mid_sb + 5, web_right, mid_sb + 5, color=BLUE, lw=1, dashed=True)

    # ── LEGEND ───────────────────────────────────────────────────────────────
    leg_x = sg_x
    leg_y = sg_y + 6*mm
    leg_items = [
        (SG_LINE, "Singapore country boundary", True),
        (ORANGE,  "Voco premises (under Voco control)", True),
        (CL_LINE, "Third-party cloud (not Voco premises)", True),
    ]
    for i, (col, label, is_dash) in enumerate(leg_items):
        lx = leg_x + i * (sg_w/3) + 4*mm
        c.setStrokeColor(col)
        c.setLineWidth(1.2)
        if is_dash:
            c.setDash(5, 3)
        c.line(lx, leg_y + 2.5*mm, lx + 10*mm, leg_y + 2.5*mm)
        c.setDash()
        txt(c, lx + 12*mm, leg_y + 1.5*mm, label, size=6.5, color=SLATE)

    # ── Footer ───────────────────────────────────────────────────────────────
    c.setFillColor(HexColor('#F1F5F9'))
    c.rect(0, 0, W, 10*mm, fill=1, stroke=0)
    txt(c, PAD, 3.5*mm, "Voco Private Limited  |  IMDA SBO Licence Application  |  Confidential  |  March 2026", size=6, color=SLATE)
    txt(c, W - PAD, 3.5*mm, "Page 1 of 1", size=6, color=MUTED, align='right')

    c.save()
    print("Saved to: " + out)


if __name__ == "__main__":
    import os
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                       "Voco_Private_Limited_System_Network_Configuration_Diagram.pdf")
    build(out)
