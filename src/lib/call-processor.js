import { supabase } from '@/lib/supabase';
import { locales } from '@/i18n/routing';
import { classifyCall } from '@/lib/triage/classifier';

/** Supported languages — calls in any other language trigger a language barrier tag. */
const SUPPORTED_LANGUAGES = new Set(locales); // ['en', 'es']

/**
 * Process call_ended event — create initial call record.
 * Lightweight: no recording yet, just basic call metadata.
 */
export async function processCallEnded(call) {
  const {
    call_id,
    from_number,
    to_number,
    direction,
    disconnection_reason,
    start_timestamp,
    end_timestamp,
    metadata,
  } = call;

  // Look up tenant by the number that was called
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('retell_phone_number', to_number)
    .single();

  const tenantId = tenant?.id || null;

  // Upsert using retell_call_id as dedupe key
  await supabase.from('calls').upsert(
    {
      retell_call_id: call_id,
      tenant_id: tenantId,
      from_number,
      to_number,
      direction: direction || 'inbound',
      status: 'ended',
      disconnection_reason,
      start_timestamp,
      end_timestamp,
      retell_metadata: metadata || null,
    },
    { onConflict: 'retell_call_id' }
  );
}

/**
 * Process call_analyzed event — store recording, transcript, and detect language barriers.
 * This is the heavy handler: fetch audio, upload to storage, write transcript,
 * and tag calls with LANGUAGE_BARRIER if detected_language is not in supported set.
 *
 * Per locked decision: unsupported languages create a lead tagged with
 * "LANGUAGE BARRIER: [Detected Language]" — implemented via language_barrier
 * and barrier_language columns on the calls table.
 */
export async function processCallAnalyzed(call) {
  const {
    call_id,
    from_number,
    to_number,
    direction,
    disconnection_reason,
    start_timestamp,
    end_timestamp,
    recording_url,
    transcript,
    transcript_object,
    call_analysis,
    metadata,
  } = call;

  // Look up tenant
  const { data: tenant } = await supabase
    .from('tenants')
    .select('id')
    .eq('retell_phone_number', to_number)
    .single();

  const tenantId = tenant?.id || null;
  let recordingStoragePath = null;

  // Upload recording to Supabase Storage if available
  if (recording_url) {
    try {
      const audioResponse = await fetch(recording_url);
      const audioBuffer = await audioResponse.arrayBuffer();

      const { data, error } = await supabase.storage
        .from('call-recordings')
        .upload(`${call_id}.wav`, audioBuffer, {
          contentType: 'audio/wav',
          upsert: true,
        });

      if (!error && data) {
        recordingStoragePath = data.path;
      } else {
        console.error('Recording upload failed:', error);
      }
    } catch (err) {
      console.error('Recording fetch/upload error:', err);
    }
  }

  // Detect language barrier: if detected_language is not in SUPPORTED_LANGUAGES, tag it
  const detectedLanguage = metadata?.detected_language || call_analysis?.detected_language || null;
  const isLanguageBarrier = detectedLanguage != null && !SUPPORTED_LANGUAGES.has(detectedLanguage);

  // Run triage classification on the transcript
  let triageResult = { urgency: 'routine', confidence: 'low', layer: 'layer1' };
  try {
    triageResult = await classifyCall({
      transcript: transcript || '',
      tenant_id: tenantId,
    });
  } catch (err) {
    console.error('Triage classification failed:', err);
  }

  // Emergency priority notification (lightweight, pre-Phase-4)
  if (triageResult.urgency === 'emergency') {
    console.warn(`EMERGENCY TRIAGE: call ${call_id} for tenant ${tenantId} — ${triageResult.reason || 'keyword match'}`);
  }

  // Upsert call record with full analyzed data
  await supabase.from('calls').upsert(
    {
      retell_call_id: call_id,
      tenant_id: tenantId,
      from_number,
      to_number,
      direction: direction || 'inbound',
      status: 'analyzed',
      disconnection_reason,
      start_timestamp,
      end_timestamp,
      recording_url,
      recording_storage_path: recordingStoragePath,
      transcript_text: transcript || null,
      transcript_structured: transcript_object || null,
      detected_language: detectedLanguage,
      language_barrier: isLanguageBarrier,
      barrier_language: isLanguageBarrier ? detectedLanguage : null,
      retell_metadata: { ...(metadata || {}), call_analysis: call_analysis || null },
      urgency_classification: triageResult.urgency,
      urgency_confidence: triageResult.confidence,
      triage_layer_used: triageResult.layer,
    },
    { onConflict: 'retell_call_id' }
  );
}
