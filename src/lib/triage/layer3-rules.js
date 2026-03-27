/**
 * Layer 3: Owner rules — service-tag lookup for urgency override.
 * Queries the tenant's active services and escalates urgency if owner has tagged
 * a matching service as higher severity. Never downgrades.
 *
 * Severity ranking: emergency=3, high_ticket=2, routine=1
 */

import { supabase } from '@/lib/supabase';

const SEVERITY = {
  emergency: 3,
  high_ticket: 2,
  routine: 1,
};

/**
 * Apply owner-configured service tag rules to potentially escalate urgency.
 *
 * @param {string} baseUrgency - Urgency from Layer 1 or Layer 2 ('emergency'|'routine'|'high_ticket').
 * @param {string} tenant_id - The tenant UUID to look up services for.
 * @param {string|null} detected_service - The service name extracted from the transcript (optional).
 * @returns {Promise<{ urgency: string, escalated: boolean }>}
 */
export async function applyOwnerRules(baseUrgency, tenant_id, detected_service) {
  const { data: services, error } = await supabase
    .from('services')
    .select('name, urgency_tag')
    .eq('tenant_id', tenant_id)
    .eq('is_active', true);

  if (error || !services?.length) {
    return { urgency: baseUrgency, escalated: false };
  }

  // If a specific detected_service is provided, match against owner's services
  let matchedTag = null;
  if (detected_service) {
    const normalizedDetected = detected_service.toLowerCase();
    const match = services.find((s) =>
      s.name.toLowerCase().includes(normalizedDetected) ||
      normalizedDetected.includes(s.name.toLowerCase())
    );
    if (match) {
      matchedTag = match.urgency_tag;
    }
  }

  // If no specific match and tenant has only one service, use that service's tag.
  // With multiple services and no detected_service, do NOT escalate — we can't know
  // which service the caller is asking about, so default to baseUrgency.
  if (!matchedTag) {
    if (services.length === 1) {
      matchedTag = services[0].urgency_tag;
    } else {
      matchedTag = baseUrgency;
    }
  }

  // Never downgrade — only escalate
  const baseSeverity = SEVERITY[baseUrgency] || 1;
  const tagSeverity = SEVERITY[matchedTag] || 1;

  if (tagSeverity > baseSeverity) {
    return { urgency: matchedTag, escalated: true };
  }

  return { urgency: baseUrgency, escalated: false };
}
