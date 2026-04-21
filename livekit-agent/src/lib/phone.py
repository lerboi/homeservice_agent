"""Phone normalization for the Voco LiveKit agent.

_normalize_phone handles SIP-attribute strings (the format LiveKit delivers
from inbound SIP calls) and produces E.164 output.

Production sibling: C:/Users/leheh/.Projects/livekit-agent/src/lib/phone.py
This mirror copy is used by local pytest and worktree-authoritative plans.

Per SKILL voice-call-architecture §1 Connection lifecycle step 6:
  Phone normalization strips `sip:`/`tel:` prefixes, `@domain` suffixes,
  and ensures a `+` E.164 prefix.

D-05: Output MUST be E.164 for the `UNIQUE(tenant_id, phone_e164)` dedup
      constraint on the `customers` table.
"""
from __future__ import annotations

import re
from typing import Optional

# Match sip: or tel: URI prefix
_SIP_PREFIX_RE = re.compile(r"^(?:sip:|tel:)", re.IGNORECASE)
# Strip @domain suffix
_SIP_DOMAIN_RE = re.compile(r"@.*$")
# Valid E.164: + followed by 7-15 digits
_E164_RE = re.compile(r"^\+[1-9]\d{6,14}$")


def _normalize_phone(raw: str, country_hint: Optional[str] = None) -> str:
    """Normalize a SIP-attribute phone string to E.164.

    Raises ValueError if the result is not a valid E.164 number (ensures
    callers see a clear error rather than inserting a malformed phone into
    the UNIQUE constraint).

    Args:
        raw: Raw phone string, e.g. "sip:+15551234567@pstn.twilio.com",
             "tel:+15551234567", "+15551234567", or "15551234567".
        country_hint: Unused in this SIP-focused normalizer (kept for API
                      parity with the production version which delegates to
                      phonenumbers for free-form fallback). Reserved for
                      future extension.

    Returns:
        E.164 string, e.g. "+15551234567".

    Raises:
        ValueError: If raw is empty or the normalized result is not E.164.
    """
    if not raw:
        raise ValueError("empty phone string")

    # Strip sip: / tel: prefix
    cleaned = _SIP_PREFIX_RE.sub("", raw.strip())
    # Strip @domain suffix
    cleaned = _SIP_DOMAIN_RE.sub("", cleaned)
    # Remove whitespace/dashes/parens that may appear in formatted numbers
    cleaned = re.sub(r"[\s\-().]+", "", cleaned)
    # Ensure + prefix
    if cleaned and cleaned[0] != "+":
        cleaned = "+" + cleaned

    if not _E164_RE.match(cleaned):
        raise ValueError(f"not a valid E.164 number after normalization: {cleaned!r} (raw={raw!r})")

    return cleaned
