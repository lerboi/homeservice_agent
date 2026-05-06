// One-shot transcript fetch for Phase 61.2 D-09 evidence.
// Reads SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY from .env.local.
// Outputs JSON to stdout; truncate transcript_text/structured if huge.

const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv(file) {
  const txt = fs.readFileSync(file, "utf8");
  const out = {};
  for (const line of txt.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[m[1]] = v;
  }
  return out;
}

const env = loadEnv(path.resolve(__dirname, "../../.env.local"));
const url = env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("Missing Supabase URL or service role key");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

const callRoom = "call-_+6587528516_H7JwdDCLMeF3";

(async () => {
  const { data, error } = await supabase
    .from("calls")
    .select(
      "id, call_id, tenant_id, booking_outcome, duration_seconds, disconnection_reason, detected_language, created_at, transcript_text, transcript_structured, recording_storage_path"
    )
    .eq("call_id", callRoom)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    console.error("Query error:", error);
    process.exit(2);
  }

  if (!data || data.length === 0) {
    console.error("No row found for call_id =", callRoom);
    process.exit(3);
  }

  const row = data[0];
  // Truncate large fields for readability; print structure summary.
  const tt = row.transcript_text || "";
  const ts = Array.isArray(row.transcript_structured) ? row.transcript_structured : [];
  const out = {
    id: row.id,
    call_id: row.call_id,
    tenant_id: row.tenant_id,
    booking_outcome: row.booking_outcome,
    duration_seconds: row.duration_seconds,
    disconnection_reason: row.disconnection_reason,
    detected_language: row.detected_language,
    urgency: row.urgency,
    created_at: row.created_at,
    recording_storage_path: row.recording_storage_path,
    transcript_text_length: tt.length,
    transcript_text_preview_4k: tt.slice(0, 4000),
    transcript_structured_count: ts.length,
    transcript_structured_first_30: ts.slice(0, 30),
    transcript_structured_last_15: ts.length > 30 ? ts.slice(-15) : [],
  };
  console.log(JSON.stringify(out, null, 2));
})();
