import { Resend } from 'resend';

const INQUIRY_ADDRESSES = {
  sales: process.env.CONTACT_EMAIL_SALES,
  support: process.env.CONTACT_EMAIL_SUPPORT,
  partnerships: process.env.CONTACT_EMAIL_PARTNERSHIPS,
};

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, email, inquiryType, message, _honeypot } = body;

    // Honeypot spam gate -- silent success to avoid fingerprinting
    if (_honeypot) {
      return Response.json({ ok: true });
    }

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !inquiryType?.trim() || !message?.trim()) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Determine recipient address
    const to = INQUIRY_ADDRESSES[inquiryType] || process.env.CONTACT_EMAIL_FALLBACK;

    if (!to) {
      console.error('[contact] No recipient email configured for inquiry type:', inquiryType);
      return Response.json({ error: 'Configuration error' }, { status: 500 });
    }

    // Send email via Resend (instantiated per-request -- correct for serverless API routes)
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'noreply@homeserviceai.com',
      to,
      replyTo: email.trim(),
      subject: `[${inquiryType}] Contact form: ${name.trim()}`,
      text: `Name: ${name.trim()}\nEmail: ${email.trim()}\nInquiry Type: ${inquiryType}\n\n${message.trim()}`,
    });

    return Response.json({ ok: true });
  } catch (error) {
    console.error('[contact] Failed to send email:', error);
    return Response.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
