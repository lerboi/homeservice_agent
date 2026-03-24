const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
        Header, Footer, AlignmentType, HeadingLevel, BorderStyle, WidthType,
        ShadingType, PageNumber, PageBreak, LevelFormat } = require('docx');
const fs = require('fs');

const border = { style: BorderStyle.SINGLE, size: 1, color: "CCCCCC" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 80, bottom: 80, left: 120, right: 120 };

function headerCell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    shading: { fill: "1B4F72", type: ShadingType.CLEAR },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, bold: true, color: "FFFFFF", font: "Arial", size: 20 })] })]
  });
}

function cell(text, width) {
  return new TableCell({
    borders,
    width: { size: width, type: WidthType.DXA },
    margins: cellMargins,
    children: [new Paragraph({ children: [new TextRun({ text, font: "Arial", size: 20 })] })]
  });
}

function heading1(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 360, after: 200 }, children: [new TextRun({ text, bold: true, font: "Arial", size: 32, color: "1B4F72" })] });
}

function heading2(text) {
  return new Paragraph({ heading: HeadingLevel.HEADING_2, spacing: { before: 280, after: 160 }, children: [new TextRun({ text, bold: true, font: "Arial", size: 26, color: "2E75B6" })] });
}

function para(text) {
  return new Paragraph({ spacing: { after: 120 }, children: [new TextRun({ text, font: "Arial", size: 22 })] });
}

function boldPara(label, text) {
  return new Paragraph({ spacing: { after: 120 }, children: [
    new TextRun({ text: label, bold: true, font: "Arial", size: 22 }),
    new TextRun({ text, font: "Arial", size: 22 })
  ]});
}

const doc = new Document({
  styles: {
    default: { document: { run: { font: "Arial", size: 22 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 32, bold: true, font: "Arial", color: "1B4F72" },
        paragraph: { spacing: { before: 360, after: 200 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 26, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 1 } },
    ]
  },
  numbering: {
    config: [
      { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
      { reference: "numbers", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 360 } } } }] },
    ]
  },
  sections: [
    {
      properties: {
        page: {
          size: { width: 12240, height: 15840 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [new TextRun({ text: "Voco AI \u2014 Voice Call System", italics: true, font: "Arial", size: 18, color: "888888" })]
          })]
        })
      },
      footers: {
        default: new Footer({
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "Page ", font: "Arial", size: 18, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "888888" })]
          })]
        })
      },
      children: [
        // ── Title Page ──
        new Paragraph({ spacing: { before: 3000 } }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Voice Call System", bold: true, font: "Arial", size: 56, color: "1B4F72" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text: "Complete Architecture Guide", font: "Arial", size: 32, color: "2E75B6" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 600 }, children: [new TextRun({ text: "How the AI receptionist answers calls, books appointments, and manages leads", font: "Arial", size: 22, color: "666666" })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Last Updated: March 2026", font: "Arial", size: 20, color: "888888" })] }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── What Is This System? ──
        heading1("What Is This System?"),
        para("This is an AI-powered phone receptionist for home service businesses (plumbers, electricians, HVAC, etc.). When a customer calls the business phone number, an AI agent answers the call, has a natural conversation, and can:"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Answer questions about the business", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Book appointments by checking real-time availability", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Transfer the call to the business owner if needed", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Detect emergencies and prioritize urgent calls", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Send the owner an SMS and email alert for every new lead", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Follow up with callers who didn\u2019t book via a recovery text", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Handle calls in English and Spanish", font: "Arial", size: 22 })] }),

        // ── How It Works (High Level) ──
        heading1("How It Works \u2014 The Big Picture"),
        para("The system has two main parts that work together:"),
        new Paragraph({ spacing: { after: 200 } }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2500, 3430, 3430],
          rows: [
            new TableRow({ children: [headerCell("Component", 2500), headerCell("What It Does", 3430), headerCell("Where It Runs", 3430)] }),
            new TableRow({ children: [cell("WebSocket Server", 2500), cell("The AI brain \u2014 listens to what callers say and generates responses using Groq AI", 3430), cell("Railway (standalone service)", 3430)] }),
            new TableRow({ children: [cell("Next.js App", 2500), cell("Handles webhooks, dashboard, notifications, booking, and all business logic", 3430), cell("Vercel", 3430)] }),
          ]
        }),

        new Paragraph({ spacing: { after: 200 } }),

        heading2("The Call Flow Step by Step"),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "A customer dials the business\u2019s Retell phone number", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Retell sends a webhook to our app asking \u201Cwho is this business?\u201D", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Our app looks up the business, calculates available appointment slots, and sends back the info", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Retell connects the call to our WebSocket server, which powers the AI conversation", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "The AI greets the caller, asks what they need, and offers to book an appointment or transfer the call", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "After the call ends, the system uploads the recording, classifies the urgency, creates a lead, and notifies the business owner via SMS and email", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "If the caller didn\u2019t book, they receive a friendly follow-up text about 60 seconds later", font: "Arial", size: 22 })] }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── The AI Agent's Personality ──
        heading1("The AI Agent\u2019s Personality & Behavior"),
        para("The AI receptionist is configured per business. Each business can choose a tone:"),
        new Paragraph({ spacing: { after: 200 } }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2340, 2340, 4680],
          rows: [
            new TableRow({ children: [headerCell("Tone", 2340), headerCell("Style", 2340), headerCell("Best For", 4680)] }),
            new TableRow({ children: [cell("Professional", 2340), cell("Measured and formal", 2340), cell("Building trust with first-time callers", 4680)] }),
            new TableRow({ children: [cell("Friendly", 2340), cell("Upbeat and warm", 2340), cell("Residential customers, approachable feel", 4680)] }),
            new TableRow({ children: [cell("Local Expert", 2340), cell("Relaxed and neighborly", 2340), cell("Established local businesses", 4680)] }),
          ]
        }),

        new Paragraph({ spacing: { after: 200 } }),
        heading2("What the Agent Says and Does"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Always discloses that the call may be recorded", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Asks for the caller\u2019s name, service address, and what issue they need help with", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Detects the caller\u2019s language and responds in English or Spanish", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "For unsupported languages: apologizes, gathers basic info, and tags the call for follow-up", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Wraps up after 9 minutes, hard limit at 10 minutes", font: "Arial", size: 22 })] }),

        new Paragraph({ spacing: { after: 200 } }),
        heading2("The Booking Conversation"),
        para("When a caller needs service and the business has completed onboarding, the AI follows this exact flow:"),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Identifies what the caller needs and how urgent it is", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Offers 2\u20133 available time slots from real calendar data", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Asks for the service address", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Reads the address back and waits for the caller to confirm (\u201CJust to confirm, you\u2019re at 123 Main St, correct?\u201D)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Only then books the appointment (slot + name + confirmed address required)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Confirms the booking to the caller", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "If the slot was just taken by another caller, offers the next available time", font: "Arial", size: 22 })] }),

        heading2("Call Transfer"),
        para("If a caller wants to speak to a person, the AI:"),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "First captures the caller\u2019s name, phone, and issue (so the lead is never lost)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Says \u201CLet me transfer you to the team now\u201D", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, children: [new TextRun({ text: "Transfers the call to the business owner\u2019s phone", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "numbers", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "If the owner doesn\u2019t answer, reassures the caller that someone will follow up", font: "Arial", size: 22 })] }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Urgency Detection ──
        heading1("How Urgency Is Detected"),
        para("Every call goes through a three-layer triage system that determines if the call is an emergency, high-value job, or routine request."),
        new Paragraph({ spacing: { after: 200 } }),

        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [1800, 3780, 3780],
          rows: [
            new TableRow({ children: [headerCell("Layer", 1800), headerCell("How It Works", 3780), headerCell("Examples", 3780)] }),
            new TableRow({ children: [cell("1. Keywords", 1800), cell("Instant regex pattern matching on the transcript", 3780), cell("\"flooding\", \"gas leak\", \"pipe burst\", \"no heat\", \"carbon monoxide\"", 3780)] }),
            new TableRow({ children: [cell("2. AI (Groq)", 1800), cell("Only runs when keywords are ambiguous. AI classifies the transcript.", 3780), cell("Ambiguous cases like \"water is coming through the ceiling\" that don\u2019t match exact patterns", 3780)] }),
            new TableRow({ children: [cell("3. Owner Rules", 1800), cell("Checks the business\u2019s service catalog. Can only ESCALATE, never downgrade.", 3780), cell("If business tags \"Water Heater Install\" as emergency, that overrides routine classification", 3780)] }),
          ]
        }),

        new Paragraph({ spacing: { after: 200 } }),
        boldPara("Key safety rule: ", "The system can only make things MORE urgent, never less. If Layer 1 says emergency, Layer 3 cannot downgrade it to routine."),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Scheduling & Booking ──
        heading1("Scheduling & Booking"),
        heading2("How Available Slots Are Calculated"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Based on the business\u2019s working hours (per day of week, including lunch breaks)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Existing appointments are excluded (no double-booking)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Google Calendar events are excluded (personal blocks, meetings, etc.)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Travel time between service zones is factored in", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Up to 6 slots are offered across today + next 2 days", font: "Arial", size: 22 })] }),

        heading2("How Double-Booking Is Prevented"),
        para("When two callers try to book the same slot at the exact same moment, the system uses a database-level lock (Postgres advisory lock) to ensure only one booking goes through. The second caller is immediately offered the next available time."),

        heading2("Google Calendar Sync"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "New bookings are automatically pushed to the owner\u2019s Google Calendar", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Emergency appointments get an [URGENT] prefix in the calendar event title", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "The owner\u2019s calendar events block those times from being offered to callers", font: "Arial", size: 22 })] }),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Notifications ──
        heading1("Notifications"),
        heading2("When a New Lead Comes In"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "SMS to the business owner via Twilio: includes caller name, job type, urgency, address, and callback link", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Email to the business owner via Resend: formatted email with full lead details and dashboard link", font: "Arial", size: 22 })] }),

        heading2("Recovery Text to Caller"),
        para("If a caller hangs up without booking an appointment, they receive a friendly text message about 60 seconds later:"),
        new Paragraph({ spacing: { after: 200 }, indent: { left: 720 }, children: [new TextRun({ text: "\u201CHi [Name], thanks for calling [Business]. We\u2019d love to help \u2014 book online at [link] or call us back anytime at [phone].\u201D", italics: true, font: "Arial", size: 22 })] }),
        para("This only sends if the call lasted more than 15 seconds (to skip misdials) and the caller didn\u2019t already book."),

        new Paragraph({ children: [new PageBreak()] }),

        // ── Lead Management ──
        heading1("Lead Management"),
        para("Every call creates a lead in the CRM dashboard. Here\u2019s how leads work:"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Calls under 15 seconds are ignored (misdials/voicemail)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "If the same phone number calls again, the new call is attached to the existing lead (not duplicated)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Lead status starts as \u201Cnew\u201D (or \u201Cbooked\u201D if an appointment was made)", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Status progression: new \u2192 booked \u2192 completed \u2192 paid (or lost)", font: "Arial", size: 22 })] }),

        // ── External Services ──
        heading1("External Services Used"),
        new Paragraph({ spacing: { after: 200 } }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2340, 7020],
          rows: [
            new TableRow({ children: [headerCell("Service", 2340), headerCell("What It Does", 7020)] }),
            new TableRow({ children: [cell("Retell", 2340), cell("Provides the phone number, handles telephony, connects calls to our AI via WebSocket", 7020)] }),
            new TableRow({ children: [cell("Groq", 2340), cell("AI inference engine \u2014 runs Llama 4 Scout model for real-time voice conversation and triage classification", 7020)] }),
            new TableRow({ children: [cell("Supabase", 2340), cell("Database (tenants, calls, leads, appointments), file storage (recordings), and real-time dashboard feed", 7020)] }),
            new TableRow({ children: [cell("Twilio", 2340), cell("Sends SMS notifications to business owners and recovery texts to callers", 7020)] }),
            new TableRow({ children: [cell("Resend", 2340), cell("Sends email notifications to business owners when new leads come in", 7020)] }),
            new TableRow({ children: [cell("Google Calendar", 2340), cell("Two-way sync \u2014 bookings go to calendar, calendar events block availability", 7020)] }),
          ]
        }),

        new Paragraph({ spacing: { after: 200 } }),

        // ── Deployment ──
        heading1("Deployment"),
        new Paragraph({ spacing: { after: 200 } }),
        new Table({
          width: { size: 9360, type: WidthType.DXA },
          columnWidths: [2800, 3280, 3280],
          rows: [
            new TableRow({ children: [headerCell("Component", 2800), headerCell("Platform", 3280), headerCell("URL Pattern", 3280)] }),
            new TableRow({ children: [cell("Next.js App", 2800), cell("Vercel", 3280), cell("your-app.vercel.app", 3280)] }),
            new TableRow({ children: [cell("WebSocket Server", 2800), cell("Railway", 3280), cell("your-service.up.railway.app", 3280)] }),
          ]
        }),

        new Paragraph({ spacing: { after: 200 } }),
        heading2("Retell Dashboard Settings"),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, children: [new TextRun({ text: "Custom LLM WebSocket URL: wss://your-railway-app.up.railway.app/llm-websocket", font: "Arial", size: 22 })] }),
        new Paragraph({ numbering: { reference: "bullets", level: 0 }, spacing: { after: 200 }, children: [new TextRun({ text: "Inbound Webhook URL: https://your-vercel-app.vercel.app/api/webhooks/retell", font: "Arial", size: 22 })] }),
      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("F:/homeservice-agent/docs/Voice-Call-System-Guide.docx", buffer);
  console.log("Created: docs/Voice-Call-System-Guide.docx");
});
