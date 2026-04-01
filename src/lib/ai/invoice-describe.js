import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

/**
 * Fetch combined transcript text for a lead via lead_calls junction table.
 * Returns null if no transcripts found.
 */
export async function getTranscriptsForLead(supabase, leadId, tenantId) {
  const { data: leadCalls } = await supabase
    .from('lead_calls')
    .select('call_id')
    .eq('lead_id', leadId);

  if (!leadCalls || leadCalls.length === 0) return null;

  const callIds = leadCalls.map((lc) => lc.call_id);

  const { data: calls } = await supabase
    .from('calls')
    .select('transcript_text, created_at')
    .in('id', callIds)
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true });

  const combined = (calls || [])
    .filter((c) => c.transcript_text)
    .map((c) => c.transcript_text)
    .join('\n\n---\n\n');

  return combined || null;
}

/**
 * Generate professional line item descriptions from a call transcript
 * using Gemini Flash. Returns an array of description strings matching
 * the order of existingLineItems.
 */
export async function generateLineItemDescriptions(transcript, existingLineItems) {
  const prompt = `You are helping a home service contractor write professional invoice line item descriptions.

Given the call transcript below, generate a clear, professional description for each line item on this invoice.

RULES:
- Describe ONLY work explicitly discussed in the transcript
- Use professional trade terminology (plumbing, HVAC, electrical)
- Do NOT suggest pricing, labor hours, or materials quantities
- Do NOT invent brand names, model numbers, or part numbers unless the caller stated them
- Keep each description to 1-2 sentences
- If the transcript doesn't mention relevant work for a line item, return the existing description unchanged

EXISTING LINE ITEMS:
${existingLineItems.map((item, i) => `${i + 1}. [${item.item_type}] ${item.description || '(empty)'}`).join('\n')}

CALL TRANSCRIPT:
${transcript}

Return a JSON array of strings, one description per line item, in the same order. Return ONLY the JSON array, no markdown formatting.`;

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: prompt,
  });

  // Strip any markdown code fences before parsing
  let text = response.text.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
  }

  return JSON.parse(text);
}
