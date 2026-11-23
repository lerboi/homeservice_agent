---
type: system
system: Integrations Jobber Xero
status: legacy-app
description: "Phase 61 added a Voco-normalized address_components JSONB column to"
source: .claude/skills/integrations-jobber-xero/SKILL.md § Phase 61 cross-link — Voco-normalized address shape
migrated: 2026-11-23
verified:
tags: [voco/system/integrations-jobber-xero]
---

# Phase 61 cross-link - Voco-normalized address shape

Part of [[Integrations Jobber Xero]]. Migrated verbatim from the `integrations-jobber-xero` skill; check `verified` before trusting details.

Phase 61 added a Voco-normalized `address_components` JSONB column to
`appointments` and `inquiries` (D-D1 named-key shape):

```
{
  "street_number": str | null,
  "route": str | null,
  "subpremise": str | null,
  "locality": str | null,
  "admin_area_level_1": str | null,
  "admin_area_level_2": str | null,
  "postal_code": str | null,
  "country": str | null,
  "country_code": str | null   // ISO short code from Google's postalAddress.regionCode
}
```

The Voco-normalized shape is **what Phase 62 Jobber write-side will read**
when pushing a booked appointment into Jobber's `Client.properties`.
Named-key access — zero translation. Mapper in
`livekit-agent/src/integrations/google_maps.py::map_components` is the
source of truth; the mapper absorbs Google API surface changes (raw
response is NOT stored). The companion `address_validation_verdict`
column gates which Jobber-push paths are safe — only `confirmed` and
`confirmed_with_changes` rows carry a Google-validated `formatted_address`
suitable for downstream provider writes.

Tool-return shapes after Phase 61 fall into two patterns: the success path
uses a label form (`BOOKED [verdict=validated]: <directive>`,
`LEAD CAPTURED [verdict=validated_with_corrections]: <directive>`, etc.)
and the failure path uses the STATE+DIRECTIVE form
(`STATE:<reason> | DIRECTIVE:<action>`). Both carry the verdict token
verbatim; the prompt's `_build_address_validation_section` substring-matches
on `verdict=validated` / `verdict=validated_with_corrections` /
`verdict=unvalidated` and is shape-agnostic. Source of truth:
`livekit-agent/src/tools/book_appointment.py` and
`livekit-agent/src/tools/capture_lead.py`. The Phase 61
`_build_address_validation_section(locale)` block in `prompt.py` enforces
that the agent never speaks "validated"/"verified"/etc. unless the
preceding tool return contained the validating verdict — see
`voice-call-architecture` for the EN+ES CRITICAL RULE structure.

---
