/**
 * Build a structured whisper message for warm transfer.
 * Per D-08: "[Name] calling about [job type]. [Emergency/Routine]. [1-line summary]."
 *
 * @param {object} params
 * @param {string} [params.callerName]
 * @param {string} [params.jobType]
 * @param {string} [params.urgency] - 'emergency' | 'routine' | 'high_ticket'
 * @param {string} [params.summary]
 * @returns {string}
 */
export function buildWhisperMessage({ callerName, jobType, urgency, summary } = {}) {
  const name = callerName || 'Unknown caller';
  const job = jobType || 'unspecified job';
  const tier = urgency === 'emergency' ? 'Emergency' : 'Routine';
  return `${name} calling about ${job}. ${tier}. ${summary || ''}`.trim();
}
