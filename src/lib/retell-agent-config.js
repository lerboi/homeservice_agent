import { buildSystemPrompt } from './agent-prompt.js';

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
 * @returns {object} Retell agent config object
 */
export function getAgentConfig({ locale = 'en', business_name = 'HomeService', onboarding_complete = false } = {}) {
  return {
    language: 'multilingual',
    system_prompt: buildSystemPrompt(locale, { business_name, onboarding_complete }),
    voice_speed: 1.0,
    responsiveness: 0.8,
    interruption_sensitivity: 0.7,
    ambient_sound: 'off',
    max_call_duration_ms: 600000, // 10 minutes
    functions: [
      {
        name: 'transfer_call',
        description: "Transfer the current call to the business owner's phone number. Use this when the caller requests to speak with a human or when you cannot handle their request. Always capture caller information (name, phone, issue) BEFORE invoking this function.",
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    ],
  };
}
