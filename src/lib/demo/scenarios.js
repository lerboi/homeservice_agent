/**
 * Demo Studio task registry.
 *
 * One task is live (scheduling: the agent books an appointment). The others
 * are listed as "coming soon" so the page shows where the product goes
 * without pretending those flows exist. A task becomes selectable only when
 * its status is 'live'.
 */
export const SCENARIOS = [
  {
    id: 'scheduling',
    title: 'Book an appointment',
    description: 'The caller asks for a time. The agent checks availability, books it, and the event lands in the calendar.',
    status: 'live',
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
