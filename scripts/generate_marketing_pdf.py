"""
Generate Voco Marketing PDF — Sales-ready overview of features and value.
Run: python scripts/generate_marketing_pdf.py
Output: marketing/Voco_Marketing_Overview.pdf
"""

import os
from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.lib.colors import HexColor, white, black
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, KeepTogether, Image, HRFlowable,
)
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ── Colors ──────────────────────────────────────────────────────────────
NAVY     = HexColor("#0F172A")
COPPER   = HexColor("#C2410C")
SLATE    = HexColor("#475569")
LIGHT_BG = HexColor("#F8FAFC")
BORDER   = HexColor("#E2E8F0")
EMERALD  = HexColor("#059669")
WHITE    = white

# ── Paths ───────────────────────────────────────────────────────────────
BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(BASE, "marketing")
os.makedirs(OUT_DIR, exist_ok=True)
OUT_PATH = os.path.join(OUT_DIR, "Voco_Marketing_Overview.pdf")
LOGO_PATH = os.path.join(BASE, "public", "images", "logos", "VOCO Logo V1 (no bg).png")

# ── Styles ──────────────────────────────────────────────────────────────
s_hero_title = ParagraphStyle(
    "HeroTitle", fontSize=28, leading=34, textColor=NAVY,
    fontName="Helvetica-Bold", alignment=TA_LEFT, spaceAfter=8,
)
s_hero_sub = ParagraphStyle(
    "HeroSub", fontSize=13, leading=19, textColor=SLATE,
    fontName="Helvetica", alignment=TA_LEFT, spaceAfter=4,
)
s_section = ParagraphStyle(
    "Section", fontSize=18, leading=23, textColor=NAVY,
    fontName="Helvetica-Bold", spaceBefore=24, spaceAfter=10,
)
s_subsection = ParagraphStyle(
    "SubSection", fontSize=13, leading=17, textColor=COPPER,
    fontName="Helvetica-Bold", spaceBefore=14, spaceAfter=4,
)
s_body = ParagraphStyle(
    "Body", fontSize=10.5, leading=16, textColor=SLATE,
    fontName="Helvetica", spaceAfter=6,
)
s_body_bold = ParagraphStyle(
    "BodyBold", fontSize=10.5, leading=16, textColor=NAVY,
    fontName="Helvetica-Bold", spaceAfter=2,
)
s_bullet = ParagraphStyle(
    "Bullet", fontSize=10.5, leading=16, textColor=SLATE,
    fontName="Helvetica", leftIndent=18, spaceAfter=3,
    bulletIndent=6, bulletFontName="Helvetica",
)
s_quote = ParagraphStyle(
    "Quote", fontSize=11, leading=17, textColor=NAVY,
    fontName="Helvetica-Oblique", leftIndent=24, rightIndent=24,
    spaceBefore=10, spaceAfter=4, alignment=TA_LEFT,
)
s_quote_attr = ParagraphStyle(
    "QuoteAttr", fontSize=9.5, leading=14, textColor=SLATE,
    fontName="Helvetica", leftIndent=24, spaceAfter=14,
)
s_stat_num = ParagraphStyle(
    "StatNum", fontSize=22, leading=26, textColor=COPPER,
    fontName="Helvetica-Bold", alignment=TA_CENTER,
)
s_stat_label = ParagraphStyle(
    "StatLabel", fontSize=9, leading=13, textColor=SLATE,
    fontName="Helvetica", alignment=TA_CENTER,
)
s_footer = ParagraphStyle(
    "Footer", fontSize=8, leading=10, textColor=HexColor("#94A3B8"),
    fontName="Helvetica", alignment=TA_CENTER,
)
s_table_header = ParagraphStyle(
    "TableHeader", fontSize=10, leading=14, textColor=WHITE,
    fontName="Helvetica-Bold", alignment=TA_CENTER,
)
s_table_cell = ParagraphStyle(
    "TableCell", fontSize=9.5, leading=14, textColor=NAVY,
    fontName="Helvetica", alignment=TA_CENTER,
)
s_table_cell_left = ParagraphStyle(
    "TableCellLeft", fontSize=9.5, leading=14, textColor=NAVY,
    fontName="Helvetica", alignment=TA_LEFT,
)
s_table_cell_bold = ParagraphStyle(
    "TableCellBold", fontSize=9.5, leading=14, textColor=NAVY,
    fontName="Helvetica-Bold", alignment=TA_LEFT,
)


def copper_rule():
    return HRFlowable(width="100%", thickness=1.5, color=COPPER, spaceAfter=6, spaceBefore=2)

def light_rule():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=8)

def bullet(text):
    return Paragraph(f"\u2022  {text}", s_bullet)


# ── Page templates ──────────────────────────────────────────────────────
def on_page(canvas, doc):
    """Footer on every page."""
    canvas.saveState()
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(HexColor("#94A3B8"))
    canvas.drawCentredString(letter[0] / 2, 36, "Voco  |  Every call answered. Every job booked.  |  getvoco.ai")
    canvas.drawRightString(letter[0] - 54, 36, f"{doc.page}")
    canvas.restoreState()


# ── Build story ─────────────────────────────────────────────────────────
story = []

# ── PAGE 1: Hero ────────────────────────────────────────────────────────
if os.path.exists(LOGO_PATH):
    story.append(Image(LOGO_PATH, width=140, height=46))
    story.append(Spacer(1, 20))

story.append(Paragraph("Every Call You Miss Is a Job<br/>Your Competitor Just Won", s_hero_title))
story.append(Spacer(1, 6))
story.append(Paragraph(
    "Voco is an AI-powered receptionist built for home service businesses. "
    "It answers every call 24/7, triages urgency, books appointments on the spot, "
    "and sends you instant alerts for emergencies \u2014 so you never lose a lead to voicemail again.",
    s_hero_sub,
))

story.append(Spacer(1, 24))

# Stats bar
stats = [
    ["24/7", "100%", "< 1 sec", "4 min"],
    ["Call coverage", "Emergency answer rate", "Average response time", "Setup time"],
]
stat_data = [
    [Paragraph(v, s_stat_num) for v in stats[0]],
    [Paragraph(v, s_stat_label) for v in stats[1]],
]
stat_table = Table(stat_data, colWidths=[1.2 * inch] * 4)
stat_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), LIGHT_BG),
    ("ROUNDEDCORNERS", [8, 8, 8, 8]),
    ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
    ("TOPPADDING", (0, 0), (-1, 0), 14),
    ("BOTTOMPADDING", (0, -1), (-1, -1), 14),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))
story.append(stat_table)

story.append(Spacer(1, 28))
story.append(copper_rule())

# ── The Problem ─────────────────────────────────────────────────────────
story.append(Paragraph("The Problem", s_section))
story.append(Paragraph(
    "Home service contractors lose thousands of dollars each month to missed calls. "
    "When you're on a job site, driving between appointments, or off the clock, every unanswered call "
    "is a potential customer who calls your competitor instead. Voicemail doesn't cut it \u2014 "
    "67% of callers hang up without leaving a message.",
    s_body,
))
story.append(Spacer(1, 4))
story.append(Paragraph(
    "Hiring a full-time receptionist costs $35,000\u2013$50,000/year and still doesn't cover nights or weekends. "
    "Generic answering services take messages but can't book jobs or assess urgency. "
    "You need someone who understands your trade, speaks your customer's language, and closes appointments \u2014 not just takes notes.",
    s_body,
))

story.append(Spacer(1, 6))
story.append(copper_rule())

# ── The Solution ────────────────────────────────────────────────────────
story.append(Paragraph("The Voco Solution", s_section))
story.append(Paragraph(
    "Voco is your AI receptionist that answers, qualifies, and books \u2014 all in one phone call. "
    "It's not a chatbot, not a message-taker. It's a booking machine that works 24/7.",
    s_body,
))

story.append(Spacer(1, 6))

# Feature cards
features = [
    ("AI Call Answering, 24/7",
     "Every call is answered instantly \u2014 nights, weekends, holidays. "
     "Your AI receptionist greets callers with your business name, answers questions about your services, "
     "and keeps the conversation natural and professional."),

    ("Smart Urgency Triage",
     "Voco instantly classifies every call: Emergency (gas leaks, floods, no heat), "
     "High-Value (water heater installs, full rewires), or Routine (quotes, maintenance). "
     "Emergencies trigger instant SMS alerts to your phone."),

    ("Books Appointments on the Spot",
     "The AI checks your real-time calendar availability and offers callers 2\u20133 open time slots. "
     "When they pick one, it's locked into your Google or Outlook calendar immediately. "
     "No phone tag. No callbacks. The job is booked before you even know about the call."),

    ("Instant Emergency Alerts",
     "For urgent calls, you receive an SMS within seconds with the caller's name, number, job type, "
     "and urgency level. Be the first contractor on site, not the fastest to call back."),

    ("Multi-Language Support",
     "Voco auto-detects whether your caller speaks English or Spanish and responds in their language. "
     "No frustrated hang-ups. No lost jobs from language barriers."),

    ("Recovery SMS",
     "If a time slot fills while the AI is on a call, the caller automatically receives a text message "
     "with alternative available times and a booking link. No lead left behind."),
]

for title, desc in features:
    story.append(Paragraph(title, s_subsection))
    story.append(Paragraph(desc, s_body))

story.append(PageBreak())

# ── PAGE 2: Dashboard & CRM ────────────────────────────────────────────
story.append(Paragraph("Your Command Center", s_section))
story.append(Paragraph(
    "Every call, lead, and appointment flows into a single dashboard purpose-built for tradespeople. "
    "No training required \u2014 if you can use a phone, you can use Voco.",
    s_body,
))
story.append(Spacer(1, 6))

dashboard_features = [
    ("Live Dashboard",
     "See today's calls answered, pending leads, upcoming appointments, weekly stats, "
     "and a live activity feed \u2014 all at a glance."),

    ("Lead Management (CRM)",
     "Every caller becomes a lead automatically. Track them through your pipeline: "
     "New \u2192 Booked \u2192 Completed \u2192 Paid. View call recordings, transcripts, "
     "and urgency classification. Switch between list and Kanban board views. "
     "Filter by status, urgency, date, or search by phone number."),

    ("Calendar & Scheduling",
     "A visual weekly calendar showing all booked appointments color-coded by urgency. "
     "Syncs in real time with Google Calendar and Outlook. Travel time between service zones "
     "is automatically accounted for \u2014 no double-booking, no scheduling conflicts."),

    ("Call Logs & Recordings",
     "Complete history of every call: duration, booking outcome, urgency, language detected, "
     "and whether a recovery SMS was sent. Listen back to any call recording. "
     "Filter by urgency, outcome, date, or phone number."),

    ("Analytics & Reporting",
     "Track call volume trends, booking conversion rates, urgency breakdown, "
     "and lead pipeline status over time. Know exactly how your AI receptionist is performing "
     "and how much revenue it's driving."),
]

for title, desc in dashboard_features:
    story.append(Paragraph(title, s_subsection))
    story.append(Paragraph(desc, s_body))

story.append(Spacer(1, 8))
story.append(copper_rule())

# ── Customisation ───────────────────────────────────────────────────────
story.append(Paragraph("Fully Customizable to Your Business", s_section))
story.append(Paragraph(
    "Voco molds to the way you work, not the other way around.",
    s_body,
))
story.append(Spacer(1, 4))

config_items = [
    "Define your own service list with urgency tags (Emergency, High-Value, Routine)",
    "Set working hours, lunch breaks, and appointment slot duration",
    "Connect Google Calendar, Outlook Calendar, or both",
    "Create service zones with travel buffers between areas",
    "Configure escalation contacts for emergency call transfers",
    "Choose your AI's tone: Professional, Friendly, or Local Expert",
    "Make a test call to hear your AI before going live",
]
for item in config_items:
    story.append(bullet(item))

story.append(Spacer(1, 8))
story.append(copper_rule())

# ── Testimonials ────────────────────────────────────────────────────────
story.append(Paragraph("What Contractors Are Saying", s_section))

story.append(Paragraph(
    "\u201cBefore Voco, I was losing 3\u20134 calls every weekend. "
    "Now my phone's booked Monday before I've had coffee.\u201d",
    s_quote,
))
story.append(Paragraph("\u2014 Mike R., HVAC Contractor, Phoenix AZ", s_quote_attr))

story.append(Paragraph(
    "\u201cSetup took 4 minutes. I heard my AI answer a call with my business name "
    "before I even finished my first cup.\u201d",
    s_quote,
))
story.append(Paragraph("\u2014 Sandra T., Plumbing Company Owner, Austin TX", s_quote_attr))

story.append(Paragraph(
    "\u201cOne emergency booking at 2 AM paid for three months of Voco. "
    "I don't know why I waited so long.\u201d",
    s_quote,
))
story.append(Paragraph("\u2014 Carlos M., Electrician, Miami FL", s_quote_attr))

story.append(PageBreak())

# ── PAGE 3: Pricing ────────────────────────────────────────────────────
story.append(Paragraph("Simple, Transparent Pricing", s_section))
story.append(Paragraph(
    "No per-call charges. No hidden fees. Every plan includes the full AI receptionist, "
    "CRM, calendar sync, triage, notifications, and multi-language support.",
    s_body,
))
story.append(Spacer(1, 10))

# Pricing table
p_hdr = s_table_header
p_cell = s_table_cell
p_left = s_table_cell_left
p_bold = s_table_cell_bold

pricing_data = [
    [Paragraph("", p_hdr), Paragraph("Starter", p_hdr), Paragraph("Growth", p_hdr), Paragraph("Scale", p_hdr)],
    [Paragraph("Monthly price", p_bold), Paragraph("$99/mo", p_cell), Paragraph("$249/mo", p_cell), Paragraph("$599/mo", p_cell)],
    [Paragraph("Included calls", p_bold), Paragraph("40", p_cell), Paragraph("120", p_cell), Paragraph("400", p_cell)],
    [Paragraph("Ideal for", p_bold),
     Paragraph("Solo operators, side hustles", p_cell),
     Paragraph("Growing crews, 3\u20135 jobs/day", p_cell),
     Paragraph("Multi-crew teams at capacity", p_cell)],
    [Paragraph("AI receptionist 24/7", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("Lead capture & CRM", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("Priority triage engine", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("Google + Outlook sync", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("SMS + email alerts", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("Multi-language (EN/ES)", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("Recovery SMS fallback", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("Support", p_bold), Paragraph("Email", p_cell), Paragraph("Priority email", p_cell), Paragraph("Priority + onboarding call", p_cell)],
]

col_w = [1.7 * inch, 1.15 * inch, 1.15 * inch, 1.15 * inch]
pricing_table = Table(pricing_data, colWidths=col_w, repeatRows=1)
pricing_table.setStyle(TableStyle([
    # Header row
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    # Alternating rows
    ("BACKGROUND", (0, 1), (-1, 1), LIGHT_BG),
    ("BACKGROUND", (0, 3), (-1, 3), LIGHT_BG),
    ("BACKGROUND", (0, 5), (-1, 5), LIGHT_BG),
    ("BACKGROUND", (0, 7), (-1, 7), LIGHT_BG),
    ("BACKGROUND", (0, 9), (-1, 9), LIGHT_BG),
    ("BACKGROUND", (0, 11), (-1, 11), LIGHT_BG),
    # Grid
    ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
    ("BOX", (0, 0), (-1, -1), 1, NAVY),
    # Padding
    ("TOPPADDING", (0, 0), (-1, -1), 8),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 8),
    ("LEFTPADDING", (0, 0), (-1, -1), 8),
    ("RIGHTPADDING", (0, 0), (-1, -1), 8),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    # Round top corners
    ("ROUNDEDCORNERS", [6, 6, 6, 6]),
]))
story.append(pricing_table)

story.append(Spacer(1, 14))
story.append(Paragraph(
    "<b>14-day free trial on all plans.</b> No credit card required to start. "
    "Cancel anytime.",
    s_body,
))
story.append(Paragraph(
    "<b>Enterprise pricing</b> available for franchises and multi-location businesses. "
    "Includes unlimited calls, dedicated account manager, and custom integrations.",
    s_body,
))

story.append(Spacer(1, 16))
story.append(copper_rule())

# ── How It Works ────────────────────────────────────────────────────────
story.append(Paragraph("Get Started in 4 Minutes", s_section))

steps = [
    ("1.  Choose your trade", "Select HVAC, Plumbing, Electrical, or General Contracting. Your service list auto-populates."),
    ("2.  Set up your profile", "Enter your business name, customize services, and set your working hours."),
    ("3.  Connect your calendar", "Link Google Calendar, Outlook, or both. Your AI will only book open slots."),
    ("4.  Make a test call", "Call your new AI number and hear it answer with your business name. You're live."),
]
for title, desc in steps:
    story.append(Paragraph(title, s_body_bold))
    story.append(Paragraph(desc, s_body))
    story.append(Spacer(1, 2))

story.append(Spacer(1, 16))
story.append(copper_rule())

# ── Why Voco ────────────────────────────────────────────────────────────
story.append(Paragraph("Why Voco vs. The Alternatives", s_section))

compare_data = [
    [Paragraph("", p_hdr), Paragraph("Voco", p_hdr), Paragraph("Voicemail", p_hdr), Paragraph("Answering<br/>Service", p_hdr), Paragraph("Full-Time<br/>Receptionist", p_hdr)],
    [Paragraph("Answers 24/7", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2713", p_cell), Paragraph("\u2717", p_cell)],
    [Paragraph("Books appointments", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2717", p_cell), Paragraph("\u2717", p_cell), Paragraph("\u2713", p_cell)],
    [Paragraph("Triages urgency", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2717", p_cell), Paragraph("\u2717", p_cell), Paragraph("Varies", p_cell)],
    [Paragraph("Calendar sync", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2717", p_cell), Paragraph("\u2717", p_cell), Paragraph("Manual", p_cell)],
    [Paragraph("Multi-language", p_bold), Paragraph("\u2713", p_cell), Paragraph("\u2717", p_cell), Paragraph("Extra cost", p_cell), Paragraph("If bilingual", p_cell)],
    [Paragraph("Cost/month", p_bold), Paragraph("From $99", p_cell), Paragraph("Free", p_cell), Paragraph("$300\u2013800", p_cell), Paragraph("$3,000+", p_cell)],
]
compare_w = [1.2 * inch, 0.9 * inch, 0.9 * inch, 1.0 * inch, 1.0 * inch]
compare_table = Table(compare_data, colWidths=compare_w, repeatRows=1)
compare_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, 0), NAVY),
    ("TEXTCOLOR", (0, 0), (-1, 0), WHITE),
    ("BACKGROUND", (1, 1), (1, -1), HexColor("#F0FDF4")),  # green tint on Voco column
    ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
    ("BOX", (0, 0), (-1, -1), 1, NAVY),
    ("TOPPADDING", (0, 0), (-1, -1), 7),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ("LEFTPADDING", (0, 0), (-1, -1), 6),
    ("RIGHTPADDING", (0, 0), (-1, -1), 6),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
    ("ROUNDEDCORNERS", [6, 6, 6, 6]),
]))
story.append(compare_table)

story.append(Spacer(1, 24))

# ── CTA ─────────────────────────────────────────────────────────────────
cta_data = [[
    Paragraph(
        "<b>Ready to stop losing calls?</b><br/><br/>"
        "Start your 14-day free trial at <b>getvoco.ai</b><br/>"
        "Questions? Email us at <b>hello@getvoco.ai</b>",
        ParagraphStyle("CTA", fontSize=13, leading=20, textColor=WHITE,
                        fontName="Helvetica", alignment=TA_CENTER),
    )
]]
cta_table = Table(cta_data, colWidths=[5.2 * inch])
cta_table.setStyle(TableStyle([
    ("BACKGROUND", (0, 0), (-1, -1), NAVY),
    ("ROUNDEDCORNERS", [12, 12, 12, 12]),
    ("TOPPADDING", (0, 0), (-1, -1), 24),
    ("BOTTOMPADDING", (0, 0), (-1, -1), 24),
    ("LEFTPADDING", (0, 0), (-1, -1), 20),
    ("RIGHTPADDING", (0, 0), (-1, -1), 20),
    ("ALIGN", (0, 0), (-1, -1), "CENTER"),
    ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
]))
story.append(cta_table)


# ── Build ───────────────────────────────────────────────────────────────
doc = SimpleDocTemplate(
    OUT_PATH,
    pagesize=letter,
    topMargin=0.65 * inch,
    bottomMargin=0.65 * inch,
    leftMargin=0.75 * inch,
    rightMargin=0.75 * inch,
    title="Voco - AI Receptionist for Home Service Businesses",
    author="Voco",
    subject="Marketing Overview",
)
doc.build(story, onFirstPage=on_page, onLaterPages=on_page)
print(f"PDF generated: {OUT_PATH}")
