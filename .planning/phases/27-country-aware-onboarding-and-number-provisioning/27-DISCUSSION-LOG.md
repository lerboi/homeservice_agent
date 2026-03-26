# Phase 27: Country-Aware Onboarding & Number Provisioning - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-03-26
**Phase:** 27-country-aware-onboarding-and-number-provisioning
**Areas discussed:** Contact step restructure, Singapore slot handling, Number provisioning flow, Simplified plan cards

---

## Contact Step Restructure

### Step Title
| Option | Description | Selected |
|--------|-------------|----------|
| "Your Details" (Recommended) | Broader title that covers name + phone + country naturally | ✓ |
| "Personal Info" | Clear and direct | |
| Keep "Contact Details" | Familiar title, just expanded with more fields | |

**User's choice:** "Your Details"

### Field Validation
| Option | Description | Selected |
|--------|-------------|----------|
| All required (Recommended) | Name, phone, and country all mandatory | ✓ |
| Phone optional | Name and country required, phone optional | |
| Name optional | Country and phone required, name nice-to-have | |

**User's choice:** All required

### Country Selector UX
| Option | Description | Selected |
|--------|-------------|----------|
| Radio cards with flags (Recommended) | Three cards with flag emoji + country name | |
| Dropdown select | Standard dropdown — compact | ✓ |
| Button group | Inline toggle buttons (SG/US/CA) | |

**User's choice:** Dropdown select

### Phone Format
| Option | Description | Selected |
|--------|-------------|----------|
| Auto-prefix by country (Recommended) | Country selection pre-fills country code (+65, +1) | ✓ |
| Free-text with placeholder | Show placeholder based on country | |
| Separate code + number | Country code dropdown + local number input | |

**User's choice:** Auto-prefix by country

---

## Singapore Slot Handling

### Slot Count Display
| Option | Description | Selected |
|--------|-------------|----------|
| Show remaining count (Recommended) | "3 Singapore numbers available" — creates urgency | ✓ |
| No count, just availability | "Singapore numbers available" or "Slots full" | |
| Show only when low | Only display when ≤ 5 remaining | |

**User's choice:** Show remaining count

### When SG is Full
| Option | Description | Selected |
|--------|-------------|----------|
| Block onboarding + waitlist (Recommended) | Show unavailable message with waitlist option | ✓ |
| Block onboarding, no waitlist | Simply show unavailable message | |
| Let them continue anyway | Allow onboarding without a number | |

**User's choice:** Block onboarding + waitlist

### Availability Check Timing
| Option | Description | Selected |
|--------|-------------|----------|
| On country selection (Recommended) | Immediately when user picks Singapore | ✓ |
| On step submit | Check when user clicks Continue | |
| On test call step | Check later when number would be provisioned | |

**User's choice:** On country selection

---

## Number Provisioning Flow

### Provisioning Timing
| Option | Description | Selected |
|--------|-------------|----------|
| After checkout success (Recommended) | Provision only after payment confirmed | ✓ |
| During test call step | Provision when reaching test call (current behavior) | |
| On contact step submit | Provision as soon as country + phone submitted | |

**User's choice:** After checkout success

### Test Call Without Provisioned Number
| Option | Description | Selected |
|--------|-------------|----------|
| Skip test call, provision after checkout (Recommended) | Remove test call from onboarding entirely | ✓ |
| Use a shared demo number | Test call uses generic company demo number | |
| Move provisioning back to before test call | Keep current flow, accept waste risk | |

**User's choice:** Skip test call, provision after checkout
**Notes:** This removes the test call step from the wizard entirely, shortening it. Users can test from dashboard settings after onboarding.

### US/CA Provisioning Method
| Option | Description | Selected |
|--------|-------------|----------|
| Keep Retell provisioning | US/CA via retell.phoneNumber.create() | |
| Direct Twilio API | Purchase directly from Twilio API | ✓ |
| You decide | Claude's discretion | |

**User's choice:** Direct Twilio API

---

## Simplified Plan Cards

**User clarification:** Plan selection cards are NOT being modified in this phase. The user plans to completely change the flow so that onboarding starts from the pricing page after the user clicks a plan. The final onboarding step would just collect CC details for the pre-selected plan. This is a separate effort handled by another Claude/phase.

**Outcome:** Removed from Phase 27 scope, noted as deferred idea.

---

## Claude's Discretion

- Waitlist implementation details
- Twilio API configuration for US/CA
- How provisioned Twilio numbers get wired to Retell
- Error handling for provisioning failures
- SG availability count query approach (real-time vs cached)
- Phone number format validation per country

## Deferred Ideas

- Pricing page → onboarding entry point rewiring (separate effort)
- Simplified plan selection cards (part of pricing page rewiring)
