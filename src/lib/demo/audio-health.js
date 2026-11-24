/**
 * How cleanly this browser received the agent's voice on a call. Pure
 * functions, unit-tested.
 *
 * Why: a voice that turns slow, muffled or broken can come from two places.
 * Either the speech was generated that way (the agent logs `tts_metrics` for
 * every sentence), or it left the agent clean and was damaged on the way to
 * the listener: lost or late packets, which the browser patches over by
 * stretching and synthesising audio. These numbers are the browser's own
 * count of that patching, so the two cases can be told apart after a call.
 *
 * Input: livekit-client's AudioReceiverStats for the agent's audio track
 * (RemoteAudioTrack.getReceiverStats()).
 */

const SAMPLE_RATE = 48000; // WebRTC's audio clock: concealedSamples counts at this rate

/**
 * @returns {{ patchedPct: number, packetsLost: number, packetsReceived: number, lostPct: number,
 *             jitterMs: number, seconds: number, poor: boolean } | null}
 */
export function summariseAudioStats(stats) {
  if (!stats || typeof stats !== 'object') return null;
  const seconds = Number(stats.totalSamplesDuration) || 0;
  if (seconds <= 0) return null;
  // Concealment while nothing was being said (the agent sends no audio between
  // replies) is not a fault, so only the audible part is counted.
  const concealed = Math.max(0, (Number(stats.concealedSamples) || 0) - (Number(stats.silentConcealedSamples) || 0));
  const patchedPct = Math.min(100, (concealed / SAMPLE_RATE / seconds) * 100);
  const packetsLost = Math.max(0, Number(stats.packetsLost) || 0);
  const packetsReceived = Math.max(0, Number(stats.packetsReceived) || 0);
  const total = packetsLost + packetsReceived;
  const lostPct = total > 0 ? (packetsLost / total) * 100 : 0;
  const jitterMs = Math.max(0, (Number(stats.jitter) || 0) * 1000);
  return {
    patchedPct: Math.round(patchedPct * 10) / 10,
    packetsLost,
    packetsReceived,
    lostPct: Math.round(lostPct * 10) / 10,
    jitterMs: Math.round(jitterMs),
    seconds: Math.round(seconds),
    // Above these the voice is audibly affected on this device.
    poor: patchedPct >= 2 || lostPct >= 1 || jitterMs >= 60,
  };
}

/** One line for the page, or '' when there is nothing to report. */
export function describeAudioHealth(health) {
  if (!health) return '';
  const packets = health.packetsLost + health.packetsReceived;
  const parts = [
    `${health.patchedPct}% patched over`,
    // Some browsers report no packet counts; say nothing rather than "0 of 0".
    packets > 0 ? `${health.packetsLost} of ${packets} packets lost` : '',
    `${health.jitterMs} ms jitter`,
  ].filter(Boolean);
  return health.poor
    ? `The agent's voice reached this browser damaged (${parts.join(', ')}). That is this device or its connection, not the agent's speech.`
    : `The agent's voice reached this browser cleanly (${parts.join(', ')}).`;
}
