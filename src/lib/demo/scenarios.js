/**
 * Demo Studio task registry.
 *
 * One task is live (scheduling: the agent books, moves and cancels
 * appointments). `agent` names the voice agent that takes the call
 * (livekit-agent src/agents); it goes into the room metadata. The others
 * are listed as "coming soon" so the page shows where the product goes
 * without pretending those flows exist. A task becomes selectable only when
 * its status is 'live'.
 */
export const SCENARIOS = [
  {
    id: 'scheduling',
    title: 'Book, move or cancel an appointment',
    description: 'The caller asks for a time, or to change a booking. The agent checks availability, makes the change, and the calendar event appears, moves or disappears.',
    status: 'live',
    // The clinic front desk built for the recording (livekit-agent
    // src/agents/demo): its own prompt on the appointments agent's real tools.
    agent: 'demo',
  },
  {
    id: 'lead_crm',
    title: 'Capture a lead into a CRM',
    description: 'The agent takes the caller’s details and creates the record.',
    status: 'soon',
  },
  {
    id: 'follow_up_task',
    title: 'Create a follow-up task',
    description: 'The agent schedules a callback or task for the team.',
    status: 'soon',
  },
  {
    id: 'order_lookup',
    title: 'Look up an order',
    description: 'The agent finds the caller’s order or account and reads back its status.',
    status: 'soon',
  },
];

export const DEFAULT_SCENARIO_ID = 'scheduling';

export function getScenario(id) {
  return SCENARIOS.find((s) => s.id === id) || null;
}

export function isScenarioLive(id) {
  return getScenario(id)?.status === 'live';
}
