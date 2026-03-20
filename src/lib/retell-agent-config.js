import { buildSystemPrompt } from './agent-prompt.js';

const TONE_PRESETS = {
  professional: { voice_speed: 0.95, responsiveness: 0.75 },
  friendly:     { voice_speed: 1.05, responsiveness: 0.85 },
  local_expert: { voice_speed: 0.90, responsiveness: 0.80 },
};

/**
 * Get the Retell agent configuration for a tenant.
 * This is used when creating or updating the Retell agent via API.
 *
 * Includes the transfer_call custom function that the AI agent can invoke
 * during a live call. When invoked, the webhook handler (Plan 02) looks up
 * the tenant's owner_phone and calls retell.call.transfer() to connect the
 * caller to the business owner. Falls back gracefully if owner doesn't answer.
 *
 * @param {object} options
 * @param {string} options.locale - Tenant default locale ('en' or 'es')
 * @param {string} options.business_name - Business name
 * @param {boolean} options.onboarding_complete - Whether onboarding is done
 * @param {string} options.tone_preset - Tone preset: 'professional' | 'friendly' | 'local_expert'
 * @returns {object} Retell agent config object
 */
export function getAgentConfig({ locale = 'en', business_name = 'HomeService', onboarding_complete = false, tone_preset = 'professional' } = {}) {
  const preset = TONE_PRESETS[tone_preset] || TONE_PRESETS.professional;

  const functions = [
    {
      name: 'transfer_call',
      description: "Transfer the current call to the business owner's phone number. Use this when the caller requests to speak with a human or when you cannot handle their request. Always capture caller information (name, phone, issue) BEFORE invoking this function.",
      parameters: {
        type: 'object',
        properties: {},
        required: [],
      },
    },
  ];

  if (onboarding_complete) {
    functions.push({
      name: 'book_appointment',
      description: 'Book a confirmed appointment slot for the caller. Only invoke AFTER: (1) collecting caller name, phone, and service address, (2) reading back the address and receiving verbal confirmation ("Just to confirm, you are at [address], correct?") and the caller said yes, (3) the caller has selected a slot from the offered options. Pass the confirmed slot the caller selected.',
      parameters: {
        type: 'object',
        properties: {
          slot_start: { type: 'string', description: 'ISO 8601 datetime of the appointment start (e.g., "2026-03-21T10:00:00")' },
          slot_end: { type: 'string', description: 'ISO 8601 datetime of the appointment end' },
          service_address: { type: 'string', description: 'Service address as verbally confirmed by the caller' },
          caller_name: { type: 'string', description: 'Caller full name' },
          urgency: { type: 'string', enum: ['emergency', 'routine', 'high_ticket'], description: 'Urgency level from triage' },
        },
        required: ['slot_start', 'slot_end', 'service_address', 'caller_name', 'urgency'],
      },
    });
  }

  return {
    language: 'multilingual',
    system_prompt: buildSystemPrompt(locale, { business_name, onboarding_complete, tone_preset }),
    voice_speed: preset.voice_speed,
    responsiveness: preset.responsiveness,
    interruption_sensitivity: 0.7,
    ambient_sound: 'off',
    max_call_duration_ms: 600000, // 10 minutes
    functions,
  };
}
