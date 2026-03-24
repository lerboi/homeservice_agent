/**
 * Three-layer triage classifier orchestrator.
 * Pipeline: Layer 1 (regex) → Layer 2 (LLM, if ambiguous) → Layer 3 (owner rules).
 *
 * Layer 3 always runs as a final override — it can only escalate, never downgrade.
 * Short/empty transcripts short-circuit immediately without calling LLM.
 */

import { runKeywordClassifier } from './layer1-keywords.js';
import { runLLMScorer } from './layer2-llm.js';
import { applyOwnerRules } from './layer3-rules.js';

/**
 * Classify a call transcript through all three triage layers.
 *
 * @param {{ transcript: string, tenant_id: string, detected_service?: string }} params
 * @returns {Promise<{ urgency: string, confidence: string, layer: string, reason?: string }>}
 */
export async function classifyCall({ transcript, tenant_id, detected_service = null }) {
  // Guard: empty or too-short transcript — return routine/low without calling LLM
  if (!transcript || transcript.length < 10) {
    return {
      urgency: 'routine',
      confidence: 'low',
      layer: 'layer1',
    };
  }

  // Layer 1: keyword/regex classification
  const layer1Result = runKeywordClassifier(transcript);

  if (layer1Result.confident) {
    // Layer 1 is confident — skip Layer 2 LLM, apply Layer 3 owner rules
    const layer3Result = await applyOwnerRules(layer1Result.result, tenant_id, detected_service);

    const finalLayer = layer3Result.escalated ? 'layer3' : 'layer1';
    return {
      urgency: layer3Result.urgency,
      confidence: 'high',
      layer: finalLayer,
    };
  }

  // Layer 2: LLM scoring for ambiguous transcripts
  const layer2Result = await runLLMScorer(transcript);

  // Layer 3: owner rule override
  const layer3Result = await applyOwnerRules(layer2Result.urgency, tenant_id, detected_service);

  const finalLayer = layer3Result.escalated ? 'layer3' : 'layer2';
  return {
    urgency: layer3Result.urgency,
    confidence: layer2Result.confidence ?? 'low',
    layer: finalLayer,
    reason: layer2Result.reason,
  };
}
