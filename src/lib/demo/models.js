/**
 * Demo Studio "Model" registry: which language model the appointments agent
 * runs a demo call on.
 *
 * The id goes into the room metadata as `llm` and is read by the agent
 * (livekit-agent src/agents/appointments/pipeline.py::resolve_provider). It
 * is honoured on test calls only. Without it the call uses whatever the
 * worker is set to (VOCO_APPT_LLM_PROVIDER, else VOCO_LLM_PROVIDER), which
 * is what a production call gets.
 *
 * Numbers are from scripted calls on 2026-11-24 (vault Log, "Appointments
 * agent build"): mean time to the model's first token.
 */
export const MODEL_OPTIONS = [
  {
    id: 'groq',
    label: 'Qwen on Groq',
    hint: 'Fastest: about 0.4 s to first word. Falls back to GPT-4.1 mini if Groq fails.',
  },
  {
    id: 'openai',
    label: 'GPT-4.1 mini',
    hint: 'Steadier with tools: about 1.0 s to first word.',
  },
];

export const MODEL_IDS = new Set(MODEL_OPTIONS.map((m) => m.id));

export function getModel(id) {
  return MODEL_OPTIONS.find((m) => m.id === id) || null;
}
