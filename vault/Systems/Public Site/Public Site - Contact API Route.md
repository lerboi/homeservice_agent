---
type: system
system: Public Site
status: pending-rebuild
description: "File: src/app/api/contact/route.js"
source: .claude/skills/public-site-i18n/SKILL.md § 9. Contact API Route
migrated: 2026-11-23
verified:
tags: [voco/system/public-site]
---

# Contact API Route

Part of [[Public Site]]. Migrated verbatim from the `public-site-i18n` skill; check `verified` before trusting details.

**File**: `src/app/api/contact/route.js`

```js
export async function POST(request) {
  const { name, email, inquiryType, message, _honeypot } = await request.json();

  // Honeypot gate — silent 200 to avoid bot fingerprinting
  if (_honeypot) return Response.json({ ok: true });

  // ... validation ...

  // Resend instantiated per-request — correct for serverless/stateless execution
  const resend = new Resend(process.env.RESEND_API_KEY);
  await resend.emails.send({ from, to, replyTo, subject, text });

  return Response.json({ ok: true });
}
```

**Resend per-request**: Instantiated inside the handler, not at module level. Correct pattern for serverless environments where module-level singletons may not be available across cold starts.

**Inquiry routing**: `INQUIRY_ADDRESSES` map routes to different recipients by `inquiryType` (sales/support/partnerships). Falls back to `CONTACT_EMAIL_FALLBACK`. If no recipient configured, returns 500.

**Environment variables**: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `CONTACT_EMAIL_SALES`, `CONTACT_EMAIL_SUPPORT`, `CONTACT_EMAIL_PARTNERSHIPS`, `CONTACT_EMAIL_FALLBACK`.

---
