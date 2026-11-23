/**
 * Demo Studio session rules: request validation and the room metadata the
 * voice agent reads. Pure functions (no I/O) so they are unit-tested directly.
 *
 * The metadata is written to the LiveKit room by the admin-gated session
 * route. The browser's join token cannot change it, and the agent ignores the
 * `demo` block unless `test_call` is true, so a demo is always a sandboxed
 * test call: no billing, no SMS, no CRM rows, no owner notifications. The
 * `demo` block relaxes two rules only: push the booking to the chosen external
 * calendar, and keep it after the call (the Studio's cleanup removes it).
 */

import { getDestination, isDestinationSelectable } from './destinations.js';
import { isScenarioLive, getScenario } from './scenarios.js';
import { VOICE_IDS } from './voices.js';
import { MODEL_IDS } from './models.js';

export const DEMO_ROOM_PREFIX = 'test-web-';

/**
 * @returns {{ ok: true, task: string, destination: string, voiceOverride: string|null }
 *          | { ok: false, status: number, error: string }}
 */
export function validateDemoRequest(body, destinationStatuses = []) {
  const task = typeof body?.task === 'string' ? body.task : '';
  if (!getScenario(task)) {
    return { ok: false, status: 400, error: 'Unknown task' };
  }
  if (!isScenarioLive(task)) {
    return { ok: false, status: 400, error: 'That task is not available yet' };
  }

  const destinationId = typeof body?.destination === 'string' ? body.destination : '';
  const destination = getDestination(destinationId);
  if (!destination) {
    return { ok: false, status: 400, error: 'Unknown destination' };
  }
  const status = destinationStatuses.find((s) => s.id === destinationId);
  if (!isDestinationSelectable(status)) {
    const reason = status?.connected
      ? `${destination.label} needs reconnecting before a demo can be saved to it`
      : `${destination.label} is not connected`;
    return { ok: false, status: 409, error: reason };
  }

  let voiceOverride = null;
  if (body?.voice_override) {
    const candidate = String(body.voice_override).trim();
    if (!VOICE_IDS.has(candidate)) {
      return { ok: false, status: 400, error: 'voice_override must be one of the curated test voices' };
    }
    voiceOverride = candidate;
  }

  // Optional: which model the agent runs this call on. Absent = the worker's
  // own setting, i.e. what production uses.
  let llm = null;
  if (body?.llm) {
    const candidate = String(body.llm).trim().toLowerCase();
    if (!MODEL_IDS.has(candidate)) {
      return { ok: false, status: 400, error: 'llm must be one of the listed models' };
    }
    llm = candidate;
  }

  return { ok: true, task, destination: destinationId, voiceOverride, llm };
}

export function buildDemoRoomName(tenantId, now = Date.now()) {
  // Keeping the test-web- prefix lets the existing dispatch and result routes
  // serve demo calls unchanged.
  return `${DEMO_ROOM_PREFIX}${tenantId}-${now}`;
}

export function buildDemoRoomMetadata({ tenant, task, destination, voiceOverride = null, llm = null }) {
  // `agent` picks the voice agent on the worker (livekit-agent
  // src/agents/__init__.py). It is honoured on test calls only.
  const agent = getScenario(task)?.agent;
  return {
    test_call: true,
    web_test: true,
    tenant_id: tenant.id,
    to_number: tenant.phone_number,
    ...(agent ? { agent } : {}),
    ...(llm ? { llm } : {}),
    ...(voiceOverride ? { voice_override: voiceOverride } : {}),
    demo: { task, destination, keep_booking: true },
  };
}

/** A room name is cleanable only if it is a web test room of this tenant. */
export function isDemoRoomOfTenant(roomName, tenantId) {
  return (
    typeof roomName === 'string' &&
    typeof tenantId === 'string' &&
    tenantId.length > 0 &&
    roomName.startsWith(`${DEMO_ROOM_PREFIX}${tenantId}-`)
  );
}
